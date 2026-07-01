/**
 * Workspace skill discovery.
 * Consumed by: TUI Skills pane, validate/lint commands.
 */
import { existsSync, readdirSync } from "fs";
import { join } from "path";

export interface SkillEntry {
  name: string;
  dir: string;
  source: "cwd" | ".claude/skills" | "skills";
}

export function discoverSkills(cwd: string = process.cwd()): SkillEntry[] {
  const results: SkillEntry[] = [];
  const seen = new Set<string>();

  function push(entry: SkillEntry) {
    if (!seen.has(entry.dir)) {
      seen.add(entry.dir);
      results.push(entry);
    }
  }

  // Current directory itself
  if (existsSync(join(cwd, "SKILL.md"))) {
    push({ name: cwd.split("/").pop() ?? ".", dir: cwd, source: "cwd" });
  }

  // .claude/skills/<name>/SKILL.md
  const claudeSkillsDir = join(cwd, ".claude", "skills");
  if (existsSync(claudeSkillsDir)) {
    for (const entry of readdirSync(claudeSkillsDir, { withFileTypes: true })) {
      if (
        entry.isDirectory() &&
        existsSync(join(claudeSkillsDir, entry.name, "SKILL.md"))
      ) {
        push({
          name: entry.name,
          dir: join(claudeSkillsDir, entry.name),
          source: ".claude/skills",
        });
      }
    }
  }

  // skills/<name>/SKILL.md
  const skillsDir = join(cwd, "skills");
  if (existsSync(skillsDir)) {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (
        entry.isDirectory() &&
        existsSync(join(skillsDir, entry.name, "SKILL.md"))
      ) {
        push({
          name: entry.name,
          dir: join(skillsDir, entry.name),
          source: "skills",
        });
      }
    }
  }

  return results;
}
