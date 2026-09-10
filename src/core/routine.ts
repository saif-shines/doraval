import { spawnSync } from "bun";
import { YAML } from "bun";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "path";
import { parseRemoteUrl } from "./remote.js";
import { findSkillDirs, isSkillDir, normalizeSkillPath } from "./skill-discovery.js";

const DEFAULT_INTERVAL = "1h";
const DEFAULT_MAX_TICK = "10m";
const DEFAULT_REASONING_EFFORT = "xhigh";
const HOME_SKILL_ROOTS = [".claude/skills", ".grok/skills", ".agents/skills"] as const;

export type RoutineInput = {
  slug: string;
  prompt: string;
  skillsRun: string[];
  skillsRefer: string[];
  mcpUrl: string;
  interval?: string;
  maxTick?: string;
  reasoningEffort?: string;
  model?: string;
  provider?: string;
};

const KIT_REPOS: Record<string, string> = {
  skillkit: "scalekit-inc/skillkit",
  authstack: "scalekit-inc/authstack",
};

/** GitHub URL, or a local path that names skillkit / authstack. */
export function isUpstreamOrigin(origin: string): boolean {
  const t = origin.trim();
  if (!t) return false;
  if (parseRemoteUrl(t)) return true;
  return /skillkit|authstack/i.test(t.replace(/\\/g, "/"));
}

function kitNameFromRemote(remote: string): string | undefined {
  const m = remote
    .trim()
    .replace(/\.git$/, "")
    .match(/github\.com[:/][^/]+\/(skillkit|authstack)$/i);
  return m?.[1]?.toLowerCase();
}

function gitRootAndRemote(dir: string): { root: string; remote: string } | undefined {
  let cur = resolve(dir);
  for (let i = 0; i < 16; i++) {
    if (existsSync(join(cur, ".git"))) {
      const r = spawnSync(["git", "-C", cur, "remote", "get-url", "origin"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      if ((r.exitCode ?? 1) !== 0) return undefined;
      const remote = String(r.stdout ?? "").trim();
      if (!remote) return undefined;
      return { root: cur, remote };
    }
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
}

/** Map a skillkit / authstack folder to github.com/scalekit-inc/…/tree/main/…. */
export function kitOriginUrl(dir: string): string | undefined {
  const git = gitRootAndRemote(dir);
  if (git) {
    const kit = kitNameFromRemote(git.remote);
    if (kit) {
      const rel = relative(git.root, dir).replace(/\\/g, "/");
      if (!rel || rel.startsWith("..")) return undefined;
      return `https://github.com/${KIT_REPOS[kit]}/tree/main/${rel}`;
    }
  }
  const parts = resolve(dir).replace(/\\/g, "/").split("/");
  const i = parts.findIndex((p) => p === "skillkit" || p === "authstack");
  if (i < 0) return undefined;
  const rel = parts.slice(i + 1).join("/");
  if (!rel || (!rel.startsWith("plugins/") && !rel.startsWith("skills/"))) return undefined;
  return `https://github.com/${KIT_REPOS[parts[i]!]}/tree/main/${rel}`;
}

function recordOrigin(ref: string, dir: string): string {
  if (parseRemoteUrl(ref.trim())) return ref.trim();
  return kitOriginUrl(dir) ?? dir;
}

/** Empty or `none` means no Agent Gateway. Most jobs still use MCP. */
export function normalizeMcpUrl(url: string): string {
  const t = url.trim();
  if (!t || t.toLowerCase() === "none") return "";
  return t;
}

export function usesMcp(url: string): boolean {
  return normalizeMcpUrl(url) !== "";
}

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

function yamlMap(key: string, rec: Record<string, string>): string {
  const keys = Object.keys(rec).sort();
  if (keys.length === 0) return `${key}: {}`;
  return `${key}:\n${keys.map((k) => `  ${k}: ${yamlScalar(rec[k]!)}`).join("\n")}`;
}

function parseOrigins(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

function writeRoutineYml(
  dir: string,
  r: {
    skillsRun: string[];
    skillsRefer: string[];
    skillOrigins: Record<string, string>;
    mcpUrl: string;
    interval?: string;
    maxTick?: string;
    reasoningEffort?: string;
    model?: string;
    provider?: string;
    jobId?: string;
  },
): void {
  const lines = [yamlList("skills_run", r.skillsRun), yamlList("skills_refer", r.skillsRefer)];
  if (Object.keys(r.skillOrigins).length) lines.push(yamlMap("skill_origins", r.skillOrigins));
  lines.push(
    `mcp_url: ${yamlScalar(normalizeMcpUrl(r.mcpUrl))}`,
    `interval: ${yamlScalar(r.interval ?? DEFAULT_INTERVAL)}`,
    `max_tick: ${yamlScalar(r.maxTick ?? DEFAULT_MAX_TICK)}`,
    `reasoning_effort: ${yamlScalar(r.reasoningEffort ?? DEFAULT_REASONING_EFFORT)}`,
  );
  if (r.model !== undefined) lines.push(`model: ${yamlScalar(r.model)}`);
  if (r.provider !== undefined) lines.push(`provider: ${yamlScalar(r.provider)}`);
  if (r.jobId) lines.push(`job_id: ${yamlScalar(r.jobId)}`);
  lines.push("");
  writeFileSync(join(dir, "routine.yml"), lines.join("\n"));
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

/** Clone a GitHub URL. `--from` may point at a kit root, not a skill. */
function fetchRemoteDir(url: string): { dir: string; cleanup: () => void } {
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
  return { dir: root, cleanup };
}

/** Clone a GitHub URL to a temp skill dir. Tests inject `fetchRemote` so CI stays offline. */
function fetchSkillRemote(url: string): { dir: string; cleanup: () => void } {
  const fetched = fetchRemoteDir(url);
  const dir = normalizeSkillPath(fetched.dir);
  if (!isSkillDir(dir)) {
    fetched.cleanup();
    throw askError(url);
  }
  return { dir, cleanup: fetched.cleanup };
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
    const origins: Record<string, string> = {};
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
          origins[hit.name] = recordOrigin(ref, hit.dir);
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
    writeRoutineYml(dir, {
      skillsRun,
      skillsRefer,
      skillOrigins: origins,
      mcpUrl: input.mcpUrl,
      interval: input.interval,
      maxTick: input.maxTick,
      reasoningEffort: input.reasoningEffort,
      model: input.model,
      provider: input.provider,
    });
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

export function deleteRoutine(home: string, slug: string): string {
  assertSlug(slug);
  const dir = routineDir(home, slug);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`No routine named "${slug}".`);
  }
  rmSync(dir, { recursive: true, force: true });
  return dir;
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

export type Routine = RoutineInput & { dir: string; jobId?: string; skillOrigins: Record<string, string> };

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
    skillOrigins: parseOrigins(data.skill_origins),
    mcpUrl: String(data.mcp_url ?? ""),
    interval: String(data.interval ?? DEFAULT_INTERVAL),
    maxTick: String(data.max_tick ?? DEFAULT_MAX_TICK),
    reasoningEffort: String(data.reasoning_effort ?? DEFAULT_REASONING_EFFORT),
    model: typeof data.model === "string" ? data.model.trim() : undefined,
    provider: typeof data.provider === "string" ? data.provider.trim() : undefined,
    jobId: typeof data.job_id === "string" && data.job_id ? data.job_id : undefined,
  };
}

export function writeRoutineJobId(home: string, slug: string, jobId: string): void {
  const routine = readRoutine(home, slug);
  writeRoutineYml(routine.dir, { ...routine, jobId });
}

export type RefreshRoutineOpts = WriteRoutineOpts & {
  keepCopies?: boolean;
  from?: string;
};

export type RefreshResult = { refreshed: string[]; skipped: string[]; localOnly: string[] };

function githubSkillUrl(fromRef: string, found: string, root: string): string {
  const remote = parseRemoteUrl(fromRef);
  if (!remote?.ghRepo) return fromRef;
  const rel = relative(root, found).replace(/\\/g, "/");
  if (!rel || rel === "." || rel.startsWith("..")) return fromRef;
  const sub = remote.subpath ? `${remote.subpath}/${rel}` : rel;
  return `https://github.com/${remote.ghRepo}/tree/${remote.ref ?? "main"}/${sub}`;
}

function destSkillNames(routine: Routine): { name: string; dest: string }[] {
  const seen = new Set<string>();
  const out: { name: string; dest: string }[] = [];
  for (const dest of [...routine.skillsRun, ...routine.skillsRefer]) {
    const name = basename(dest);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, dest });
  }
  return out;
}

function findNamedSkill(root: string, name: string): string | undefined {
  const direct = normalizeSkillPath(root);
  if (isSkillDir(direct) && basename(direct) === name) return direct;
  return findSkillDirs(root).find((d) => basename(d) === name);
}

function materializeFromRoot(
  ref: string,
  opts: WriteRoutineOpts,
): { dir: string; cleanup?: () => void } {
  const trimmed = ref.trim();
  const remote = parseRemoteUrl(trimmed);
  if (remote) {
    if (opts.fetchRemote) return { dir: opts.fetchRemote(trimmed) };
    return fetchRemoteDir(trimmed);
  }
  const asPath = isAbsolute(trimmed) ? trimmed : resolve(opts.cwd ?? process.cwd(), trimmed);
  if (!existsSync(asPath)) throw new Error(`--from not found: ${trimmed}`);
  return { dir: asPath };
}

function replaceSkillDir(src: string, dest: string): void {
  const tmp = `${dest}.refresh`;
  rmSync(tmp, { recursive: true, force: true });
  copySkillDir(src, tmp);
  rmSync(dest, { recursive: true, force: true });
  renameSync(tmp, dest);
}

function tryMaterialize(
  origin: string,
  home: string,
  opts: WriteRoutineOpts,
): { dir: string; name: string; cleanup?: () => void } | undefined {
  try {
    return materializeSkill(origin, home, opts);
  } catch (e) {
    if (!parseRemoteUrl(origin) && !existsSync(origin)) return undefined;
    throw e;
  }
}

/** Re-copy upstream skills from recorded origin. Missing origin is left alone unless `--from`. */
export function refreshRoutineSkills(home: string, slug: string, opts: RefreshRoutineOpts = {}): RefreshResult {
  const routine = readRoutine(home, slug);
  const skills = destSkillNames(routine);
  const refreshed: string[] = [];
  const skipped: string[] = [];
  const localOnly: string[] = [];
  const origins = { ...routine.skillOrigins };
  if (opts.keepCopies) {
    return {
      refreshed,
      skipped: skills.map((s) => s.name),
      localOnly: skills.filter((s) => origins[s.name] && !parseRemoteUrl(origins[s.name]!)).map((s) => s.name),
    };
  }

  let dirty = false;
  const fromRef = opts.from?.trim() || "";
  const needsFrom = Boolean(fromRef) && skills.some((s) => !origins[s.name]);
  const fromRoot = needsFrom ? materializeFromRoot(fromRef, opts) : undefined;
  try {
    for (const { name, dest } of skills) {
      let origin = origins[name];
      if (!origin && fromRoot) {
        const found = findNamedSkill(fromRoot.dir, name);
        if (found) {
          origin = parseRemoteUrl(fromRef) ? githubSkillUrl(fromRef, found, fromRoot.dir) : recordOrigin(found, found);
          origins[name] = origin;
          dirty = true;
          replaceSkillDir(found, dest);
          refreshed.push(name);
          if (!parseRemoteUrl(origin)) localOnly.push(name);
          continue;
        }
      }
      if (!origin) {
        skipped.push(name);
        continue;
      }
      if (!parseRemoteUrl(origin)) {
        const url = kitOriginUrl(origin);
        if (url) {
          origin = url;
          origins[name] = url;
          dirty = true;
        }
      }
      const fromBackfill = Boolean(fromRef) && !routine.skillOrigins[name];
      if (!isUpstreamOrigin(origin) && !fromBackfill) {
        skipped.push(name);
        if (!parseRemoteUrl(origin)) localOnly.push(name);
        continue;
      }
      if (!parseRemoteUrl(origin) && resolve(origin) === resolve(dest)) {
        skipped.push(name);
        localOnly.push(name);
        continue;
      }
      const hit = tryMaterialize(origin, home, opts);
      if (!hit) {
        skipped.push(name);
        if (!parseRemoteUrl(origin)) localOnly.push(name);
        continue;
      }
      try {
        if (resolve(hit.dir) === resolve(dest)) {
          skipped.push(name);
          if (!parseRemoteUrl(origin)) localOnly.push(name);
          continue;
        }
        replaceSkillDir(hit.dir, dest);
        refreshed.push(name);
        if (!parseRemoteUrl(origin)) localOnly.push(name);
      } finally {
        hit.cleanup?.();
      }
    }
  } finally {
    fromRoot?.cleanup?.();
  }
  if (dirty) writeRoutineYml(routine.dir, { ...routine, skillOrigins: origins });
  return { refreshed, skipped, localOnly };
}
