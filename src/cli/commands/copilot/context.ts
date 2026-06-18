import { existsSync, readdirSync } from "fs";
import { join } from "path";

export interface Context {
  cwd: string;
  hasGithubDir: boolean;
  hasPluginManifest: boolean;
  looseSkillFiles: string[];
  isEmpty: boolean;
}

export function detectContext(cwd: string = process.cwd()): Context {
  const hasGithubDir = existsSync(join(cwd, ".github"));
  const hasPluginManifest = existsSync(join(cwd, ".github", "plugin", "plugin.json"));

  let looseSkillFiles: string[] = [];
  try {
    const files = readdirSync(cwd);
    looseSkillFiles = files.filter((f) => {
      if (!f.endsWith(".md") || f.startsWith(".")) return false;
      const lower = f.toLowerCase();
      if (lower === "readme.md" || lower === "changelog.md" || lower === "license.md" || lower.includes("contributing")) return false;
      return lower.includes("skill") || lower === "skill.md";
    });
  } catch {}

  const isEmpty = !hasGithubDir && !hasPluginManifest && looseSkillFiles.length === 0;

  return {
    cwd,
    hasGithubDir,
    hasPluginManifest,
    looseSkillFiles,
    isEmpty,
  };
}
