import { existsSync, readdirSync } from "fs";
import { join } from "path";

export interface Context {
  cwd: string;
  hasClaudeDir: boolean;
  hasPluginManifest: boolean;
  looseSkillFiles: string[];
  isEmpty: boolean;
  // Add more fields as needed (e.g. hasGit)
}

export function detectContext(cwd: string = process.cwd()): Context {
  const hasClaudeDir = existsSync(join(cwd, ".claude"));
  const hasPluginManifest = existsSync(join(cwd, ".claude-plugin", "plugin.json"));

  let looseSkillFiles: string[] = [];
  try {
    const files = readdirSync(cwd);
    looseSkillFiles = files.filter((f) => f.endsWith(".md") && !f.startsWith("."));
    // More precise: read and check for frontmatter "name" or just treat .md as potential in this scope
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
