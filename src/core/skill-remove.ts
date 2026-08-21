import { rmSync } from "fs";
import { basename, isAbsolute, relative, resolve } from "path";
import { classifySkillDir, type SkillOrigin } from "./skill-classify.js";
import { findSkillDirs, isSkillDir, normalizeSkillPath } from "./skill-discovery.js";
import { withinWindow } from "./session-adapters/types.js";

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

function agentForDir(skillDir: string, cwd: string): string | undefined {
  const rel = relative(resolve(cwd), resolve(skillDir)).replace(/\\/g, "/");
  for (const [agent, root] of AGENT_ROOTS) {
    if (rel === root || rel.startsWith(`${root}/`)) return agent;
  }
  return undefined;
}

export function listProjectSkills(cwd: string, home?: string): SkillMatch[] {
  return findSkillDirs(cwd).map((dir) => ({
    name: basename(dir),
    dir,
    origin: classifySkillDir(dir, { cwd, home }),
    agent: agentForDir(dir, cwd),
  }));
}

export function resolveSkillName(opts: {
  name: string;
  cwd: string;
  home?: string;
  forAgent?: string;
}): ResolveSkillResult {
  const cwd = resolve(opts.cwd);
  const raw = opts.name.trim();
  const asPath = normalizeSkillPath(isAbsolute(raw) ? raw : resolve(cwd, raw));
  if (isSkillDir(asPath) && (raw.includes("/") || isAbsolute(raw) || raw.endsWith("SKILL.md"))) {
    const match: SkillMatch = {
      name: basename(asPath),
      dir: asPath,
      origin: classifySkillDir(asPath, { cwd, home: opts.home }),
      agent: agentForDir(asPath, cwd),
    };
    if (match.origin === "imported") return { status: "imported", match };
    return { status: "unique", match };
  }

  let hits = listProjectSkills(cwd, opts.home).filter((s) => s.name === raw);
  if (opts.forAgent) hits = hits.filter((s) => s.agent === opts.forAgent);
  if (hits.length === 0) return { status: "none" };
  if (hits.length > 1) return { status: "ambiguous", matches: hits };
  const match = hits[0]!;
  if (match.origin === "imported") return { status: "imported", match };
  return { status: "unique", match };
}

export type RemovePlan =
  | { ok: true; action: "delete"; dir: string; origin: "authored" }
  | { ok: false; reason: "none" | "ambiguous" | "imported" | "not-authored" };

export function planRemove(resolved: ResolveSkillResult): RemovePlan {
  if (resolved.status === "none") return { ok: false, reason: "none" };
  if (resolved.status === "ambiguous") return { ok: false, reason: "ambiguous" };
  if (resolved.status === "imported") return { ok: false, reason: "imported" };
  if (resolved.match.origin !== "authored") return { ok: false, reason: "not-authored" };
  return { ok: true, action: "delete", dir: resolved.match.dir, origin: "authored" };
}

export function applyRemove(plan: Extract<RemovePlan, { ok: true }>): void {
  rmSync(plan.dir, { recursive: true, force: true });
}

export function isRecentInstall(mtimeMs: number, nowMs: number = Date.now()): boolean {
  return withinWindow(mtimeMs, nowMs);
}

export function isRemoveCandidate(input: {
  origin: SkillOrigin;
  invoked: boolean;
  recentInstall: boolean;
}): boolean {
  return input.origin === "authored" && !input.invoked && !input.recentInstall;
}
