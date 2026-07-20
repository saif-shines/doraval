import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { YAML } from "bun";

// ── Types ──────────────────────────────────────────────────────────

export type RuleOverride = "on" | "off" | "error" | "warning" | "fyi";

export interface RulesConfig {
  package?: string;
  overrides?: Record<string, RuleOverride>;
}

export interface ProjectMapping {
  remote_path: string;
  local_path: string;
  /**
   * Absolute path of the project directory this mapping was registered
   * from (added after the original release — may be absent on entries
   * written by older versions). Lets resolveProjectName match on the
   * actual directory instead of guessing that the registration key
   * equals the current directory's basename, which silently collides
   * when two different projects share a basename (e.g. two "api" repos).
   */
  source_dir?: string;
  rules?: RulesConfig;
}

export interface EvalConfig {
  model: string;
  /** Provider name from the PROVIDERS registry (e.g. "openai", "zai", "groq"). */
  provider?: string;
  api_key?: string;
  base_url?: string;
  max_tool_calls: number;
  save_history: boolean;
  /** Explicit judge backend preference. "auto" (default) prefers direct API when credentials available. */
  judge?: 'auto' | 'api' | 'delegate';
  /** Per-call timeout for direct API judge (ms). Default 180s for reasoning models. */
  timeout_ms?: number;
}

export interface JournalConfig {
  journal: {
    repo: string;
    projects: Record<string, ProjectMapping>;
  };
  agent?: {
    command: string;
    prompt_template?: string;
    /** Optional flag name the agent uses to set its working directory/repo (e.g. "--cwd", "-C"). If set, doraval will pass it when driving full sessions for --runs / eval. */
    cwd_flag?: string;
  };
  eval?: Partial<EvalConfig>;
  rules?: RulesConfig;
}

// ── Paths ──────────────────────────────────────────────────────────

export function getDoravalDir(): string {
  return process.env.DORAVAL_HOME ?? join(homedir(), ".doraval");
}

export function getConfigPath(): string {
  return join(getDoravalDir(), "config.yml");
}

export function getJournalsDir(): string {
  return join(getDoravalDir(), "journals");
}

export function getPendingDir(): string {
  return join(getDoravalDir(), "pending");
}

export function getPendingProjectDir(project: string): string {
  return join(getPendingDir(), project);
}

export function getEvalsDir(): string {
  return join(getDoravalDir(), "evals");
}

export function getEvalConfig(config: JournalConfig | null): EvalConfig {
  const defaults: EvalConfig = {
    model: "",
    api_key: undefined,
    base_url: undefined,
    max_tool_calls: 200,
    save_history: true,
    judge: 'auto',
    timeout_ms: 180_000,
  };
  return { ...defaults, ...(config?.eval ?? {}) };
}

// ── Ensure dirs ────────────────────────────────────────────────────

export function ensureDoravalDirs(): void {
  const base = getDoravalDir();
  for (const dir of [base, getJournalsDir(), getPendingDir(), getEvalsDir()]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

// ── Read / Write ───────────────────────────────────────────────────

export async function readConfig(): Promise<JournalConfig | null> {
  const path = getConfigPath();
  if (!existsSync(path)) return null;
  const raw = await Bun.file(path).text();
  return YAML.parse(raw) as JournalConfig;
}

export async function writeConfig(config: JournalConfig): Promise<void> {
  ensureDoravalDirs();
  const raw = serializeConfig(config);
  await Bun.write(getConfigPath(), raw);
}

function serializeConfig(config: JournalConfig): string {
  // Use proper YAML roundtrip so extra top-level keys (agent, future extensions) are preserved losslessly.
  return YAML.stringify(config);
}

// ── Helpers ────────────────────────────────────────────────────────

export function resolveProjectName(config: JournalConfig | null, cwd: string = process.cwd()): string | null {
  if (!config) return null;

  // Prefer an exact match on the recorded source directory — precise,
  // and doesn't collide when two different projects share a basename.
  for (const [name, mapping] of Object.entries(config.journal.projects)) {
    if (mapping.source_dir && mapping.source_dir === cwd) {
      try {
        return sanitizeProjectName(name);
      } catch {
        return null;
      }
    }
  }

  // Legacy fallback for entries registered before source_dir existed:
  // guess that the registration key equals the current basename.
  const base = cwd.split("/").pop() ?? "";
  const legacy = config.journal.projects[base];
  if (legacy && !legacy.source_dir) {
    try {
      return sanitizeProjectName(base);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Sanitizes a project name for safe use in filesystem paths and GitHub repo paths.
 * Allows only safe characters. Throws on invalid input.
 */
export function sanitizeProjectName(name: string): string {
  if (!name || typeof name !== "string") {
    throw new Error("Project name must be a non-empty string");
  }

  // Strict allowlist for safety in paths and GitHub
  let sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 64);

  if (!sanitized || sanitized.includes("..")) {
    throw new Error(`Invalid or unsafe project name: "${name}"`);
  }

  return sanitized;
}