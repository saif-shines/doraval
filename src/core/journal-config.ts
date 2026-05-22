import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { YAML } from "bun";

// ── Types ──────────────────────────────────────────────────────────

export interface ProjectMapping {
  remote_path: string;
  local_path: string;
}

export interface JournalConfig {
  journal: {
    repo: string;
    projects: Record<string, ProjectMapping>;
  };
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

// ── Ensure dirs ────────────────────────────────────────────────────

export function ensureDoravalDirs(): void {
  const base = getDoravalDir();
  for (const dir of [base, getJournalsDir(), getPendingDir()]) {
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
  let out = `journal:\n  repo: ${config.journal.repo}\n  projects:\n`;
  for (const [name, mapping] of Object.entries(config.journal.projects)) {
    out += `    ${name}:\n`;
    out += `      remote_path: ${mapping.remote_path}\n`;
    out += `      local_path: ${mapping.local_path}\n`;
  }
  return out;
}

// ── Helpers ────────────────────────────────────────────────────────

export function resolveProjectName(config: JournalConfig | null): string | null {
  if (!config) return null;
  const cwd = process.cwd();
  const base = cwd.split("/").pop() ?? "";
  if (config.journal.projects[base]) return base;
  return null;
}