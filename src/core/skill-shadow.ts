/**
 * Skill name shadowing across multi-agent roots (B-viii / Appendix H §H3).
 * Higher-priority path wins for hosts that dedupe by name (Grok: .grok before .claude).
 * Paths are repo-relative with `/` separators.
 */

/** Lower rank = higher priority (Grok-style name dedup). Unknown roots rank last. */
const ROOT_RANK: { prefix: string; rank: number }[] = [
  { prefix: ".grok/skills/", rank: 0 },
  { prefix: ".grok/commands/", rank: 1 },
  { prefix: ".agents/skills/", rank: 2 },
  { prefix: ".agents/commands/", rank: 3 },
  { prefix: ".claude/skills/", rank: 4 },
  { prefix: ".claude/commands/", rank: 5 },
  { prefix: ".cursor/skills/", rank: 6 },
  { prefix: "skills/", rank: 7 },
];

export interface SkillShadow {
  /** Directory basename / skill name used for collision. */
  name: string;
  /** All paths sharing the name, winner first. */
  paths: string[];
}

function posixRel(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function rankOf(rel: string): number {
  const p = posixRel(rel);
  for (const { prefix, rank } of ROOT_RANK) {
    if (p.startsWith(prefix)) return rank;
  }
  return 100;
}

/** Skill identity for shadowing = leaf directory name (SKILL.md's folder). */
export function skillLeafName(relPath: string): string {
  const parts = posixRel(relPath).split("/").filter(Boolean);
  return parts[parts.length - 1] ?? relPath;
}

/**
 * Group skill dirs by leaf name; return groups with 2+ paths, ordered winner-first.
 */
export function detectSkillShadows(relPaths: string[]): SkillShadow[] {
  const byName = new Map<string, string[]>();
  for (const raw of relPaths) {
    const rel = posixRel(raw);
    const name = skillLeafName(rel);
    if (!name || name === ".") continue;
    const list = byName.get(name) ?? [];
    list.push(rel);
    byName.set(name, list);
  }

  const out: SkillShadow[] = [];
  for (const [name, paths] of byName) {
    const uniq = [...new Set(paths)];
    if (uniq.length < 2) continue;
    uniq.sort((a, b) => rankOf(a) - rankOf(b) || a.localeCompare(b));
    out.push({ name, paths: uniq });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export function shadowWarningText(shadow: SkillShadow, thisPath: string): string {
  const winner = shadow.paths[0]!;
  const others = shadow.paths.filter((p) => p !== posixRel(thisPath));
  const also = others.join(", ");
  if (posixRel(thisPath) === winner) {
    return `name "${shadow.name}" also at ${also} — Grok prefers this path`;
  }
  return `name "${shadow.name}" also at ${also} — Grok prefers ${winner}`;
}
