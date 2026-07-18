/**
 * Static skill / MCP selection ambiguity (Anthropic context-engineering notes).
 * If a human can't pick which skill or server to use, neither can the agent.
 * Deterministic — no LLM.
 */

const STOP = new Set(
  `a an the and or but if in on at to for of with by from as is are was were be been being
   this that these those it its when use using help helps helper for your you we our
   do does did doing make makes made making run runs running code codes coding agent agents
   skill skills file files project projects please please just also more most some any all
   not no yes can could should would will may might about into out up down over under`
    .split(/\s+/)
    .filter(Boolean),
);

/** Min Jaccard on significant tokens to flag description competition. */
export const DESC_JACCARD_WARN = 0.45;
/** Shared significant tokens required (avoids short-desc false positives). */
export const DESC_SHARED_MIN = 3;

export interface SkillOverlapInput {
  path: string;
  name: string;
  description: string;
}

export interface SkillOverlap {
  a: string;
  b: string;
  score: number;
  shared: string[];
  reason: string;
}

export interface McpNameCollision {
  a: string;
  b: string;
  reason: string;
}

function posix(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Significant tokens from a skill description / when_to_use blob. */
export function significantTokens(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s/-]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
  return [...new Set(raw)];
}

function jaccard(a: string[], b: string[]): { score: number; shared: string[] } {
  if (a.length === 0 || b.length === 0) return { score: 0, shared: [] };
  const setA = new Set(a);
  const setB = new Set(b);
  const shared: string[] = [];
  for (const t of setA) if (setB.has(t)) shared.push(t);
  const union = setA.size + setB.size - shared.length;
  return { score: union === 0 ? 0 : shared.length / union, shared: shared.sort() };
}

/**
 * Pairwise description overlap among skills with different leaf names.
 * O(n²) on skill count — fine for typical repos (&lt; ~100 skills).
 */
export function detectSkillOverlaps(skills: SkillOverlapInput[]): SkillOverlap[] {
  const items = skills
    .map((s) => ({
      path: posix(s.path),
      name: (s.name || s.path.split("/").pop() || "").toLowerCase(),
      tokens: significantTokens(s.description),
    }))
    .filter((s) => s.tokens.length >= DESC_SHARED_MIN);

  const out: SkillOverlap[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const A = items[i]!;
      const B = items[j]!;
      // Same leaf name = shadowing (other check); skip
      if (A.name === B.name) continue;
      const { score, shared } = jaccard(A.tokens, B.tokens);
      if (shared.length < DESC_SHARED_MIN || score < DESC_JACCARD_WARN) continue;
      const [a, b] = A.path < B.path ? [A.path, B.path] : [B.path, A.path];
      out.push({
        a,
        b,
        score: Math.round(score * 100) / 100,
        shared,
        reason: `descriptions compete (~${Math.round(score * 100)}% token overlap: ${shared.slice(0, 6).join(", ")}${shared.length > 6 ? "…" : ""})`,
      });
    }
  }
  out.sort((x, y) => y.score - x.score || x.a.localeCompare(y.a));
  return out;
}

export function overlapWarningText(o: SkillOverlap, thisPath: string): string {
  const other = posix(thisPath) === o.a ? o.b : o.a;
  return `may compete with ${other} — ${o.reason}`;
}

/** Collapse MCP server names for near-duplicate detection. */
export function mcpNameStem(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_]?(mcp|server|svc|service|api|tools?)$/g, "")
    .replace(/[-_]/g, "");
}

/**
 * Flag MCP servers that look like the same product under different names
 * (e.g. github vs github-api, linear-mcp vs linear).
 */
export function detectMcpNameCollisions(serverNames: string[]): McpNameCollision[] {
  const named = serverNames
    .map((n) => ({ raw: n, stem: mcpNameStem(n) }))
    .filter((n) => n.stem.length >= 3);

  const out: McpNameCollision[] = [];
  for (let i = 0; i < named.length; i++) {
    for (let j = i + 1; j < named.length; j++) {
      const A = named[i]!;
      const B = named[j]!;
      if (A.stem === B.stem) {
        const [a, b] = A.raw < B.raw ? [A.raw, B.raw] : [B.raw, A.raw];
        out.push({
          a,
          b,
          reason: `MCP servers "${a}" and "${b}" look like the same tool — pick one or rename for distinct jobs`,
        });
        continue;
      }
      // One stem contains the other (min length 4 to avoid "git"/"github" noise… still allow github/githubapi)
      const longer = A.stem.length >= B.stem.length ? A : B;
      const shorter = A.stem.length < B.stem.length ? A : B;
      if (shorter.stem.length >= 4 && longer.stem.startsWith(shorter.stem)) {
        const [a, b] = A.raw < B.raw ? [A.raw, B.raw] : [B.raw, A.raw];
        out.push({
          a,
          b,
          reason: `MCP servers "${a}" and "${b}" may overlap in purpose — confirm distinct scopes`,
        });
      }
    }
  }
  out.sort((x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
  return out;
}
