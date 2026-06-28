import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { YAML } from "bun";

// ── Types ──────────────────────────────────────────────────────────

export interface ProjectMapping {
  remote_path: string;
  local_path: string;
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
  judge?: 'auto' | 'api' | 'cli';
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

export function resolveProjectName(config: JournalConfig | null): string | null {
  if (!config) return null;
  const cwd = process.cwd();
  const base = cwd.split("/").pop() ?? "";
  if (config.journal.projects[base]) {
    // Return sanitized version from config for safety
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