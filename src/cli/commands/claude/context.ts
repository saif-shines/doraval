import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { getProviderSpec } from "../../../providers/spec.js";

export interface Context {
  cwd: string;
  hasClaudeDir: boolean;
  hasPluginManifest: boolean;
  looseSkillFiles: string[];
  isEmpty: boolean;
  // Add more fields as needed (e.g. hasGit)
}

export function detectContext(cwd: string = process.cwd()): Context {
  const claudeSpec = getProviderSpec("claude");
  const hasClaudeDir = existsSync(join(cwd, ".claude"));
  const hasPluginManifest = existsSync(join(cwd, claudeSpec.manifestPath));

  let looseSkillFiles: string[] = [];
  try {
    const files = readdirSync(cwd);
    looseSkillFiles = files.filter((f) => {
      if (!f.endsWith(".md") || f.startsWith(".")) return false;
      const lower = f.toLowerCase();
      // Only treat as loose skill file if it looks like a skill (not README, changelog, etc.)
      if (lower === "readme.md" || lower === "changelog.md" || lower === "license.md" || lower.includes("contributing")) return false;
      return lower.includes("skill") || lower === "skill.md";
    });
  } catch {}

  const isEmpty = !hasClaudeDir && !hasPluginManifest && looseSkillFiles.length === 0;

  return {
    cwd,
    hasClaudeDir,
    hasPluginManifest,
    looseSkillFiles,
    isEmpty,
  };
}
