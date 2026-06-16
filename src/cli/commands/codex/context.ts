import { existsSync, readdirSync } from "fs";
import { join } from "path";

export interface Context {
  cwd: string;
  hasCodexDir: boolean;
  hasPluginManifest: boolean;
  hasMarketplace: boolean;
  looseSkillFiles: string[];
  isEmpty: boolean;
}

export function detectContext(cwd: string = process.cwd()): Context {
  const hasCodexDir = existsSync(join(cwd, ".codex"));
  const hasPluginManifest = existsSync(join(cwd, ".codex-plugin", "plugin.json"));
  const hasMarketplace =
    existsSync(join(cwd, ".agents", "plugins", "marketplace.json")) ||
    existsSync(join(cwd, ".codex-plugin", "marketplace.json")); // legacy compat

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

  const isEmpty = !hasPluginManifest && looseSkillFiles.length === 0;

  return {
    cwd,
    hasCodexDir,
    hasPluginManifest,
    hasMarketplace,
    looseSkillFiles,
    isEmpty,
  };
}
