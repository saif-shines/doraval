import { existsSync, readdirSync } from "fs";
import { dirname, resolve } from "path";

/**
 * General-purpose SKILL.md / skill-directory discovery.
 *
 * Distinct from `discoverSkills` in `views/skills-view.ts`, which is depth-1 and scoped
 * to known Claude Code locations (cwd, .claude/skills/*, skills/*). This module walks an
 * arbitrary root to arbitrary depth, treating any directory containing SKILL.md as a leaf
 * (skills are not nested inside other skills per the agentskills.io spec).
 */

const DEFAULT_IGNORE = ["node_modules", ".git", "dist", "build"] as const;
const DEFAULT_MAX_DEPTH = 5;

/** If `p` points at a SKILL.md file, return its containing directory; otherwise return `p` unchanged. */
export function normalizeSkillPath(p: string): string {
  return p.endsWith("SKILL.md") ? dirname(p) : p;
}

/** True if `dir` is itself a skill (has a SKILL.md at its root). */
export function isSkillDir(dir: string): boolean {
  return existsSync(resolve(dir, "SKILL.md"));
}

export interface FindSkillDirsOptions {
  maxDepth?: number;
  ignore?: readonly string[];
}

/**
 * Recursively find every skill directory under `root`.
 *
 * A directory is a skill if it contains SKILL.md; once found, we do not recurse into it
 * (a skill's references/scripts/assets are not sub-skills). Returns absolute, deduped,
 * stably sorted paths.
 */
export function findSkillDirs(root: string, opts: FindSkillDirsOptions = {}): string[] {
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
  const ignore = new Set(opts.ignore ?? DEFAULT_IGNORE);
  const found = new Set<string>();

  function walk(dir: string, depth: number): void {
    if (!existsSync(dir)) return;
    if (isSkillDir(dir)) {
      found.add(resolve(dir));
      return; // leaf: don't descend into a skill's own supporting files
    }
    if (depth >= maxDepth) return;

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (ignore.has(entry.name)) continue;
      walk(resolve(dir, entry.name), depth + 1);
    }
  }

  walk(resolve(root), 0);
  return [...found].sort();
}
