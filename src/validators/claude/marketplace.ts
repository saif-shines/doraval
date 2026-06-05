import { existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

export const claudeMarketplaceValidator: Validator = {
  id: "claude:marketplace",
  provider: "claude",
  name: "Claude Plugin Marketplace",
  description: "Validates marketplace structure: plugins/ directory with valid plugin subdirectories",

  detect(dir: string): boolean {
    const pluginsDir = resolve(dir, "plugins");
    if (!existsSync(pluginsDir)) return false;

    try {
      const entries = readdirSync(pluginsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const hasSkills = existsSync(join(pluginsDir, entry.name, "skills"));
        const hasManifest = existsSync(join(pluginsDir, entry.name, ".claude-plugin", "plugin.json"));
        if (hasSkills || hasManifest) return true;
      }
    } catch {
      // Permission error — not a match
    }

    return false;
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    const pluginsDir = resolve(dir, "plugins");
    if (!existsSync(pluginsDir)) {
      errors.push("Missing plugins/ directory");
      return { errors, warnings, passes };
    }
    passes.push("plugins/ directory exists");

    const pluginEntries = readdirSync(pluginsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory());

    if (pluginEntries.length === 0) {
      errors.push("plugins/ directory is empty — expected at least one plugin");
      return { errors, warnings, passes };
    }
    passes.push(`${pluginEntries.length} plugin(s) found`);

    // Check root-level files
    if (existsSync(resolve(dir, "README.md"))) {
      passes.push("README.md exists at marketplace root");
    } else {
      warnings.push("No README.md at marketplace root — recommended for discoverability");
    }

    if (existsSync(resolve(dir, "LICENSE"))) {
      passes.push("LICENSE exists at marketplace root");
    } else {
      warnings.push("No LICENSE at marketplace root — recommended");
    }

    // Check each plugin directory
    for (const plugin of pluginEntries) {
      const pluginPath = join(pluginsDir, plugin.name);
      const hasSkills = existsSync(join(pluginPath, "skills"));
      const hasManifest = existsSync(join(pluginPath, ".claude-plugin", "plugin.json"));
      const hasReadme = existsSync(join(pluginPath, "README.md"));

      if (hasManifest || hasSkills) {
        passes.push(`Plugin "${plugin.name}" has ${hasManifest ? "manifest" : "skills/"}`);
      } else {
        warnings.push(`Plugin "${plugin.name}" has neither .claude-plugin/plugin.json nor skills/`);
      }

      if (!hasReadme) {
        warnings.push(`Plugin "${plugin.name}" has no README.md`);
      }
    }

    // TODO: More marketplace-specific rules added incrementally

    return { errors, warnings, passes };
  },
};