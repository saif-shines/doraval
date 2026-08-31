import { spawnSync } from "bun";
import { YAML } from "bun";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { join } from "path";

const DEFAULT_INTERVAL = "1h";
const DEFAULT_MAX_TICK = "10m";

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

export function writeRoutine(home: string, input: RoutineInput): string {
  assertSlug(input.slug);
  const dir = routineDir(home, input.slug);
  mkdirSync(dir, { recursive: true });
  const prompt = input.prompt.endsWith("\n") ? input.prompt : input.prompt + "\n";
  writeFileSync(join(dir, "prompt.md"), prompt);
  writeFileSync(
    join(dir, "routine.yml"),
    [
      yamlList("skills_run", input.skillsRun),
      yamlList("skills_refer", input.skillsRefer),
      `mcp_url: ${yamlScalar(input.mcpUrl)}`,
      `interval: ${yamlScalar(input.interval ?? DEFAULT_INTERVAL)}`,
      `max_tick: ${yamlScalar(input.maxTick ?? DEFAULT_MAX_TICK)}`,
      "",
    ].join("\n"),
  );
  return dir;
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
