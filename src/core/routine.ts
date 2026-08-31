import { spawnSync } from "bun";
import { YAML } from "bun";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { basename, isAbsolute, join, resolve } from "path";
import { parseRemoteUrl } from "./remote.js";
import { isSkillDir, normalizeSkillPath } from "./skill-discovery.js";

const DEFAULT_INTERVAL = "1h";
const DEFAULT_MAX_TICK = "10m";
const HOME_SKILL_ROOTS = [".claude/skills", ".grok/skills", ".agents/skills"] as const;

export type RoutineInput = {
  slug: string;
  prompt: string;
  skillsRun: string[];
  skillsRefer: string[];
  mcpUrl: string;
  interval?: string;
  maxTick?: string;
};

function harnessRoot(home: string): string {
  return join(home, ".dora", "harness");
}

function routineDir(home: string, slug: string): string {
  return join(harnessRoot(home), slug);
}

function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

function yamlList(key: string, items: string[]): string {
  if (items.length === 0) return `${key}: []`;
  return `${key}:\n${items.map((s) => `  - ${yamlScalar(s)}`).join("\n")}`;
}

function assertSlug(slug: string): void {
  if (!slug || slug === "." || slug === ".." || /[\\/]/.test(slug)) {
    throw new Error(`Invalid routine slug: ${slug}`);
  }
}

export type SkillRefHit = { kind: "found"; dir: string; name: string };
export type SkillRefAsk = { kind: "ask"; ref: string };
export type SkillRefRemote = { kind: "remote"; url: string };
export type SkillRefResolved = SkillRefHit | SkillRefAsk | SkillRefRemote;

export type WriteRoutineOpts = {
  cwd?: string;
  fetchRemote?: (url: string) => string;
};

/** Project `skills/`, then home skills, then ask. A GitHub URL is remote. No registry. */
export function resolveSkillRef(ref: string, opts: { cwd: string; home: string }): SkillRefResolved {
  const trimmed = ref.trim();
  if (!trimmed) return { kind: "ask", ref: trimmed };
  const remote = parseRemoteUrl(trimmed);
  if (remote?.ghRepo) return { kind: "remote", url: trimmed };

  if (isAbsolute(trimmed) || /[\\/]/.test(trimmed)) {
    const asPath = isAbsolute(trimmed) ? trimmed : resolve(opts.cwd, trimmed);
    if (existsSync(asPath)) {
      const dir = normalizeSkillPath(asPath);
      if (isSkillDir(dir)) return { kind: "found", dir, name: basename(dir) };
    }
    return { kind: "ask", ref: trimmed };
  }

  const project = join(opts.cwd, "skills", trimmed);
  if (isSkillDir(project)) return { kind: "found", dir: project, name: trimmed };
  for (const root of HOME_SKILL_ROOTS) {
    const homeDir = join(opts.home, root, trimmed);
    if (isSkillDir(homeDir)) return { kind: "found", dir: homeDir, name: trimmed };
  }
  return { kind: "ask", ref: trimmed };
}

function skipCopyName(name: string): boolean {
  if (name === ".git" || name === ".env" || name.startsWith(".env.")) return true;
  return /secret|credential|password/i.test(name);
}

function copySkillDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || skipCopyName(entry.name)) continue;
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) copySkillDir(from, to);
    else if (entry.isFile()) copyFileSync(from, to);
  }
}

function askError(ref: string): Error {
  return new Error(`Skill "${ref}" not found. Give a local path or a GitHub URL.`);
}

/** Clone a GitHub URL to a temp skill dir. Tests inject `fetchRemote` so CI stays offline. */
function fetchSkillRemote(url: string): { dir: string; cleanup: () => void } {
  const parsed = parseRemoteUrl(url);
  if (!parsed?.ghRepo) throw askError(url);
  const tmp = mkdtempSync(join(tmpdir(), "dora-skill-"));
  const cleanup = () => rmSync(tmp, { recursive: true, force: true });
  const args = ["clone", "--depth", "1"];
  if (parsed.ref) args.push("--branch", parsed.ref);
  args.push(parsed.gitUrl, tmp);
  const r = spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe", timeout: 60_000 });
  if ((r.exitCode ?? 1) !== 0) {
    cleanup();
    throw new Error(`Could not fetch ${url}`);
  }
  const root = parsed.subpath ? join(tmp, parsed.subpath) : tmp;
  const dir = normalizeSkillPath(root);
  if (!isSkillDir(dir)) {
    cleanup();
    throw askError(url);
  }
  return { dir, cleanup };
}

function materializeSkill(
  ref: string,
  home: string,
  opts: WriteRoutineOpts,
): { dir: string; name: string; cleanup?: () => void } {
  const cwd = opts.cwd ?? process.cwd();
  const resolved = resolveSkillRef(ref, { cwd, home });
  if (resolved.kind === "ask") throw askError(resolved.ref);
  if (resolved.kind === "found") return { dir: resolved.dir, name: resolved.name };
  if (opts.fetchRemote) {
    const dir = normalizeSkillPath(opts.fetchRemote(resolved.url));
    if (!isSkillDir(dir)) throw askError(ref);
    return { dir, name: basename(dir) };
  }
  const fetched = fetchSkillRemote(resolved.url);
  return { dir: fetched.dir, name: basename(fetched.dir), cleanup: fetched.cleanup };
}

export function writeRoutine(home: string, input: RoutineInput, opts: WriteRoutineOpts = {}): string {
  assertSlug(input.slug);
  const dir = routineDir(home, input.slug);
  if (existsSync(join(dir, "prompt.md")) || existsSync(join(dir, "routine.yml"))) {
    throw new Error(`Routine already exists: ${input.slug}`);
  }
  const existed = existsSync(dir);
  mkdirSync(dir, { recursive: true });
  try {
    const copies = new Map<string, string>();
    const destOf = (ref: string): string => {
      const hit = materializeSkill(ref, home, opts);
      try {
        const prev = copies.get(hit.name);
        if (prev && prev !== hit.dir) {
          throw new Error(`Two skills named "${hit.name}". Give one path or rename one.`);
        }
        const dest = join(dir, "skills", hit.name);
        if (!prev) {
          copySkillDir(hit.dir, dest);
          copies.set(hit.name, hit.dir);
        }
        return dest;
      } finally {
        hit.cleanup?.();
      }
    };
    const skillsRun = input.skillsRun.map(destOf);
    const skillsRefer = input.skillsRefer.map(destOf);
    const prompt = input.prompt.endsWith("\n") ? input.prompt : input.prompt + "\n";
    writeFileSync(join(dir, "prompt.md"), prompt);
    writeFileSync(
      join(dir, "routine.yml"),
      [
        yamlList("skills_run", skillsRun),
        yamlList("skills_refer", skillsRefer),
        `mcp_url: ${yamlScalar(input.mcpUrl)}`,
        `interval: ${yamlScalar(input.interval ?? DEFAULT_INTERVAL)}`,
        `max_tick: ${yamlScalar(input.maxTick ?? DEFAULT_MAX_TICK)}`,
        "",
      ].join("\n"),
    );
    return dir;
  } catch (e) {
    if (!existed) rmSync(dir, { recursive: true, force: true });
    throw e;
  }
}

export function listRoutineSlugs(home: string): string[] {
  const root = harnessRoot(home);
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => {
      const dir = join(root, name);
      try {
        return (
          statSync(dir).isDirectory() &&
          existsSync(join(dir, "prompt.md")) &&
          existsSync(join(dir, "routine.yml"))
        );
      } catch {
        return false;
      }
    })
    .sort();
}

function defaultOpenDir(dir: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  const r = spawnSync([cmd, dir], { stdout: "ignore", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`Could not open ${dir}`);
}

export function openRoutine(home: string, slug: string, openDir: (dir: string) => void = defaultOpenDir): string {
  assertSlug(slug);
  const dir = routineDir(home, slug);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`No routine named "${slug}".`);
  }
  openDir(dir);
  return dir;
}

export type Routine = RoutineInput & { dir: string };

function defaultMcpUrlPath(home: string): string {
  return join(home, ".dora", "default-mcp-url");
}

export function readDefaultMcpUrl(home: string): string | undefined {
  const p = defaultMcpUrlPath(home);
  if (!existsSync(p)) return undefined;
  const url = readFileSync(p, "utf8").trim();
  return url || undefined;
}

export function writeDefaultMcpUrl(home: string, url: string): void {
  mkdirSync(join(home, ".dora"), { recursive: true });
  writeFileSync(defaultMcpUrlPath(home), url.trim() + "\n");
}

export function readRoutine(home: string, slug: string): Routine {
  assertSlug(slug);
  const dir = routineDir(home, slug);
  const yml = join(dir, "routine.yml");
  const promptPath = join(dir, "prompt.md");
  if (!existsSync(yml) || !existsSync(promptPath)) {
    throw new Error(`No routine named "${slug}".`);
  }
  const data = YAML.parse(readFileSync(yml, "utf8")) as Record<string, unknown>;
  const skillsRun = Array.isArray(data.skills_run) ? data.skills_run.map(String) : [];
  const skillsRefer = Array.isArray(data.skills_refer) ? data.skills_refer.map(String) : [];
  return {
    slug,
    dir,
    prompt: readFileSync(promptPath, "utf8"),
    skillsRun,
    skillsRefer,
    mcpUrl: String(data.mcp_url ?? ""),
    interval: String(data.interval ?? DEFAULT_INTERVAL),
    maxTick: String(data.max_tick ?? DEFAULT_MAX_TICK),
  };
}
