import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "fs";
import { basename, isAbsolute, join, relative, resolve } from "path";
import { classifySkillDir, isPluginOwned, pluginRoot, type SkillOrigin } from "./skill-classify.js";
import { findSkillDirs, isSkillDir, normalizeSkillPath } from "./skill-discovery.js";
import { withinWindow } from "./session-adapters/types.js";
import { getDoravalDir, readConfigSync } from "./journal-config.js";
import { positiveInt } from "./review-window.js";
import { skillWasInvoked, type LoadResult } from "./session-evidence.js";

export interface SkillMatch {
  name: string;
  dir: string;
  origin: SkillOrigin;
  agent?: string;
}

export type ResolveSkillResult =
  | { status: "unique"; match: SkillMatch }
  | { status: "none" }
  | { status: "ambiguous"; matches: SkillMatch[] }
  | { status: "imported"; match: SkillMatch };

const AGENT_ROOTS: [string, string][] = [
  ["claude", ".claude/skills"],
  ["codex", "skills"],
  ["grok", ".grok/skills"],
  ["grok", ".grok/commands"],
  ["grok", ".agents/skills"],
  ["grok", ".agents/commands"],
  ["cursor", ".cursor/rules"],
];

function agentForDir(skillDir: string, roots: string[]): string | undefined {
  const abs = resolve(skillDir);
  for (const base of roots) {
    const rel = relative(resolve(base), abs).replace(/\\/g, "/");
    if (rel.startsWith("..")) continue;
    for (const [agent, root] of AGENT_ROOTS) {
      if (rel === root || rel.startsWith(`${root}/`)) return agent;
    }
  }
  return undefined;
}

function toMatch(dir: string, cwd: string, home?: string): SkillMatch {
  const bases = home ? [cwd, home] : [cwd];
  return {
    name: basename(dir),
    dir,
    origin: classifySkillDir(dir, { cwd, home }),
    agent: agentForDir(dir, bases),
  };
}

export function listProjectSkills(cwd: string, home?: string): SkillMatch[] {
  const seen = new Set<string>();
  const out: SkillMatch[] = [];
  const search = [cwd, ...(home ? AGENT_ROOTS.map(([, r]) => resolve(home, r)) : [])];
  for (const root of search) {
    for (const dir of findSkillDirs(root)) {
      if (seen.has(dir)) continue;
      seen.add(dir);
      out.push(toMatch(dir, cwd, home));
    }
  }
  return out;
}

export function resolveSkillName(opts: {
  name: string;
  cwd: string;
  home?: string;
  forAgent?: string;
  globalOnly?: boolean;
}): ResolveSkillResult {
  const cwd = resolve(opts.cwd);
  const raw = opts.name.trim();
  const asPath = normalizeSkillPath(isAbsolute(raw) ? raw : resolve(cwd, raw));
  if (isSkillDir(asPath) && (raw.includes("/") || isAbsolute(raw) || raw.endsWith("SKILL.md"))) {
    const match = toMatch(asPath, cwd, opts.home);
    if (match.origin === "imported") return { status: "imported", match };
    return { status: "unique", match };
  }

  let hits = listProjectSkills(cwd, opts.home).filter((s) => s.name === raw);
  if (opts.forAgent) hits = hits.filter((s) => s.agent === opts.forAgent);
  if (opts.globalOnly) hits = hits.filter((s) => s.origin === "global");
  if (hits.length === 0) return { status: "none" };
  if (hits.length > 1) return { status: "ambiguous", matches: hits };
  const match = hits[0]!;
  if (match.origin === "imported") return { status: "imported", match };
  return { status: "unique", match };
}

export type RemovePlan =
  | { ok: true; action: "delete"; dir: string; origin: "authored"; name: string }
  | { ok: true; action: "quarantine"; dir: string; origin: "global"; name: string; agent?: string }
  | { ok: false; reason: "none" | "ambiguous" | "imported" }
  | { ok: false; reason: "plugin-owned"; pluginRoot: string };

export function planRemove(resolved: ResolveSkillResult, cwd?: string): RemovePlan {
  if (resolved.status === "none") return { ok: false, reason: "none" };
  if (resolved.status === "ambiguous") return { ok: false, reason: "ambiguous" };
  if (resolved.status === "imported") return { ok: false, reason: "imported" };
  const { match } = resolved;
  const root = pluginRoot(match.dir, cwd);
  if (root) return { ok: false, reason: "plugin-owned", pluginRoot: root };
  if (match.origin === "authored") {
    return { ok: true, action: "delete", dir: match.dir, origin: "authored", name: match.name };
  }
  return { ok: true, action: "quarantine", dir: match.dir, origin: "global", name: match.name, agent: match.agent };
}

export interface QuarantineRecord {
  name: string;
  originalPath: string;
  storedAt: string;
  agent?: string;
  quarantinedAt: string;
}

function quarantineRoot(): string {
  return join(getDoravalDir(), "quarantine");
}

function recordsPath(): string {
  return join(quarantineRoot(), "records.json");
}

export function listQuarantine(): QuarantineRecord[] {
  if (!existsSync(recordsPath())) return [];
  const data = JSON.parse(readFileSync(recordsPath(), "utf8"));
  if (!Array.isArray(data)) throw new Error("Quarantine records.json is not an array");
  return data as QuarantineRecord[];
}

function writeRecords(records: QuarantineRecord[]): void {
  mkdirSync(quarantineRoot(), { recursive: true });
  const tmp = `${recordsPath()}.tmp`;
  writeFileSync(tmp, JSON.stringify(records, null, 2));
  renameSync(tmp, recordsPath());
}

function moveDir(from: string, to: string): void {
  try {
    renameSync(from, to);
  } catch {
    cpSync(from, to, { recursive: true });
    rmSync(from, { recursive: true, force: true });
  }
}

export function applyRemove(plan: Extract<RemovePlan, { ok: true }>): void {
  if (plan.action === "delete") {
    rmSync(plan.dir, { recursive: true, force: true });
    return;
  }
  const previous = listQuarantine();
  mkdirSync(join(quarantineRoot(), "store"), { recursive: true });
  let storedAt = join(quarantineRoot(), "store", `${plan.agent ?? "global"}--${plan.name}`);
  if (existsSync(storedAt)) storedAt = `${storedAt}-${Date.now()}`;
  moveDir(plan.dir, storedAt);
  try {
    writeRecords([
      ...previous,
      {
        name: plan.name,
        originalPath: plan.dir,
        storedAt,
        agent: plan.agent,
        quarantinedAt: new Date().toISOString(),
      },
    ]);
  } catch (err) {
    if (existsSync(storedAt) && !existsSync(plan.dir)) moveDir(storedAt, plan.dir);
    throw err;
  }
}

export type RestorePlan =
  | { ok: true; record: QuarantineRecord }
  | { ok: false; reason: "missing" | "occupied" | "ambiguous" }
  | { ok: false; reason: "plugin-owned"; pluginRoot: string };

export function planRestore(
  query: string | { name?: string; storedAt?: string; forAgent?: string; cwd?: string },
): RestorePlan {
  const q = typeof query === "string" ? { name: query } : query;
  let hits = listQuarantine();
  if (q.storedAt) hits = hits.filter((r) => r.storedAt === q.storedAt);
  else if (q.name) hits = hits.filter((r) => r.name === q.name);
  else return { ok: false, reason: "missing" };
  if (q.forAgent) hits = hits.filter((r) => r.agent === q.forAgent);
  if (hits.length === 0) return { ok: false, reason: "missing" };
  if (hits.length > 1) return { ok: false, reason: "ambiguous" };
  const record = hits[0]!;
  const root = pluginRoot(record.originalPath, q.cwd);
  if (root) return { ok: false, reason: "plugin-owned", pluginRoot: root };
  if (existsSync(record.originalPath)) return { ok: false, reason: "occupied" };
  return { ok: true, record };
}

export function applyRestore(plan: Extract<RestorePlan, { ok: true }>): void {
  const { record } = plan;
  mkdirSync(resolve(record.originalPath, ".."), { recursive: true });
  try {
    renameSync(record.storedAt, record.originalPath);
  } catch {
    cpSync(record.storedAt, record.originalPath, { recursive: true });
    rmSync(record.storedAt, { recursive: true, force: true });
  }
  writeRecords(listQuarantine().filter((r) => r.storedAt !== record.storedAt));
}

export const INSTALL_AGE_DAYS = 90;

/** Flag > config > default. Invalid values fall back. Independent of the Review window. */
export function resolveInstallAgeDays(opts?: {
  days?: number;
  config?: { install_age_days?: number } | null;
}): number {
  return positiveInt(opts?.days, positiveInt(opts?.config?.install_age_days, INSTALL_AGE_DAYS));
}

export function isRecentInstall(
  mtimeMs: number,
  nowMs: number = Date.now(),
  maxAgeDays: number = resolveInstallAgeDays({ config: readConfigSync() }),
): boolean {
  return withinWindow(mtimeMs, nowMs, maxAgeDays);
}

export function isRemoveCandidate(input: {
  origin: SkillOrigin;
  invoked: boolean;
  recentInstall: boolean;
}): boolean {
  return input.origin === "authored" && !input.invoked && !input.recentInstall;
}

export function listRemoveCandidates(opts: {
  cwd: string;
  home?: string;
  loaded: LoadResult;
  nowMs?: number;
  installAgeDays?: number;
}): SkillMatch[] {
  return listUnusedReport(opts).candidates;
}

export function listUnusedReport(opts: {
  cwd: string;
  home?: string;
  loaded: LoadResult;
  nowMs?: number;
  installAgeDays?: number;
}): { candidates: SkillMatch[]; recent: SkillMatch[]; installAgeDays: number } {
  const installAgeDays = resolveInstallAgeDays({
    days: opts.installAgeDays,
    config: readConfigSync(),
  });
  if (opts.loaded.sessions.length === 0) {
    return { candidates: [], recent: [], installAgeDays };
  }
  const nowMs = opts.nowMs ?? Date.now();
  const candidates: SkillMatch[] = [];
  const recent: SkillMatch[] = [];
  for (const s of listProjectSkills(opts.cwd, opts.home)) {
    if (s.origin !== "authored") continue;
    if (isPluginOwned(s.dir, opts.cwd)) continue;
    let mtimeMs: number;
    try { mtimeMs = statSync(join(s.dir, "SKILL.md")).mtimeMs; } catch { continue; }
    const invoked = skillWasInvoked(s.name, s.dir, opts.loaded);
    if (invoked) continue;
    const recentInstall = isRecentInstall(mtimeMs, nowMs, installAgeDays);
    if (isRemoveCandidate({ origin: s.origin, invoked: false, recentInstall })) {
      candidates.push(s);
    } else if (recentInstall) {
      recent.push(s);
    }
  }
  return { candidates, recent, installAgeDays };
}
