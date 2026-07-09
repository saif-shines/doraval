/**
 * B13a step 7 — promote high-weight memory principles into AGENTS.md.
 * Reuses free reflection checks; section is managed so re-promote is idempotent.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { loadPrinciples, type Principle } from "./memory-rubric.js";
import { extractConventions } from "./cross-agent.js";

export const PROMOTE_START = "<!-- dora-memory-principles:start -->";
export const PROMOTE_END = "<!-- dora-memory-principles:end -->";
export const DEFAULT_MIN_WEIGHT = 7;

export interface PromoteCandidate {
  principle: Principle;
  reason: string;
}

export interface PromotePlan {
  cwd: string;
  file: string;
  absPath: string;
  minWeight: number;
  candidates: PromoteCandidate[];
  alreadyPresent: Principle[];
  before: string;
  after: string;
  diff: string;
  isNewFile: boolean;
  noop: boolean;
}

function generateDiff(before: string, after: string, file: string): string {
  const bLines = before.split("\n");
  const aLines = after.split("\n");
  const lines: string[] = [`--- a/${file}`, `+++ b/${file}`];
  // Prefer a compact unified-ish view: only show changed region when short
  if (before === after) {
    lines.push("@@ no changes @@");
    return lines.join("\n");
  }
  for (const l of bLines) lines.push(`-${l}`);
  for (const l of aLines) lines.push(`+${l}`);
  return lines.join("\n");
}

/** Significant tokens from a principle title for reflection checks. */
export function principleKeywords(title: string): string[] {
  return title
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter(
      (w) =>
        w.length > 3 &&
        !["must", "should", "always", "never", "when", "with", "from", "that", "this", "then", "than", "prefer", "using", "into"].includes(
          w,
        ),
    );
}

/**
 * True if AGENTS.md already reflects this principle:
 * - title keywords mostly present, OR
 * - extractConventions from principle body/title overlap AGENTS.md conventions
 */
export function isPrincipleReflected(principle: Principle, agentsMd: string): boolean {
  if (!agentsMd.trim()) return false;
  const lower = agentsMd.toLowerCase();

  // Exact title substring (strong signal)
  if (lower.includes(principle.title.toLowerCase())) return true;

  const keywords = principleKeywords(principle.title);
  if (keywords.length > 0) {
    const hits = keywords.filter((k) => lower.includes(k)).length;
    if (hits >= Math.ceil(keywords.length * 0.7)) return true;
  }

  // Convention overlap (title + body as pseudo-content)
  const principleText = `${principle.title}\n${principle.body}`;
  const want = extractConventions(principleText, "principle", "shared");
  if (want.length === 0) return false;
  const have = extractConventions(agentsMd, "AGENTS.md", "shared");
  const haveKeys = new Set(have.map((c) => `${c.topic}:${c.value}`));
  return want.every((c) => haveKeys.has(`${c.topic}:${c.value}`));
}

export function buildPrinciplesSection(principles: Principle[]): string {
  const lines = [
    PROMOTE_START,
    "## Project principles (from dora memory)",
    "",
    "Durable rules recorded via `dora memory`. Agents should treat weight ≥ 7 as hard constraints.",
    "",
  ];
  // Stable order: weight desc, then title
  const sorted = [...principles].sort((a, b) => b.weight - a.weight || a.title.localeCompare(b.title));
  for (const p of sorted) {
    lines.push(`- **${p.title}** (w${p.weight})`);
    if (p.body?.trim()) {
      for (const bl of p.body.trim().split("\n")) {
        lines.push(`  ${bl}`);
      }
    }
    lines.push("");
  }
  lines.push(PROMOTE_END);
  return lines.join("\n");
}

/** Replace managed section or append; creates file if missing. */
export function mergeAgentsMd(existing: string, section: string): string {
  if (!existing.trim()) {
    return `# Agent instructions\n\n${section}\n`;
  }
  const start = existing.indexOf(PROMOTE_START);
  const end = existing.indexOf(PROMOTE_END);
  if (start !== -1 && end !== -1 && end > start) {
    const before = existing.slice(0, start);
    const after = existing.slice(end + PROMOTE_END.length);
    // trim trailing whitespace on before, single blank line before section
    return `${before.replace(/\s*$/, "\n\n")}${section}${after.replace(/^\s*/, "\n")}`;
  }
  // Append with blank line separation
  return `${existing.replace(/\s*$/, "")}\n\n${section}\n`;
}

export function planPromote(
  cwd: string,
  opts: { minWeight?: number; principles?: Principle[] } = {},
): PromotePlan {
  const minWeight = opts.minWeight ?? DEFAULT_MIN_WEIGHT;
  const principles = opts.principles ?? loadPrinciples(cwd);
  const eligible = principles.filter((p) => p.status === "active" && p.weight >= minWeight);

  const absPath = join(cwd, "AGENTS.md");
  const isNewFile = !existsSync(absPath);
  const before = isNewFile ? "" : readFileSync(absPath, "utf-8");

  const candidates: PromoteCandidate[] = [];
  const alreadyPresent: Principle[] = [];
  for (const p of eligible) {
    if (isPrincipleReflected(p, before)) {
      alreadyPresent.push(p);
    } else {
      candidates.push({
        principle: p,
        reason: `weight ${p.weight} ≥ ${minWeight}, not reflected in AGENTS.md`,
      });
    }
  }

  // Section content = candidates + already present high-weight (keep section complete)
  // Only rewrite when there is something new to add; include already-present so section stays full.
  const toWrite = [...candidates.map((c) => c.principle), ...alreadyPresent];
  const noop = candidates.length === 0;

  let after = before;
  if (!noop) {
    // When promoting, write full high-weight set into managed section
    const section = buildPrinciplesSection(toWrite);
    after = mergeAgentsMd(before, section);
  }

  return {
    cwd,
    file: "AGENTS.md",
    absPath,
    minWeight,
    candidates,
    alreadyPresent,
    before,
    after,
    diff: generateDiff(before, after, "AGENTS.md"),
    isNewFile,
    noop,
  };
}

export function applyPromote(plan: PromotePlan): void {
  if (plan.noop) return;
  mkdirSync(dirname(plan.absPath), { recursive: true });
  writeFileSync(plan.absPath, plan.after, "utf-8");
}
