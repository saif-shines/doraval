import { existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

export const cursorMarketplaceValidator: Validator = {
  id: "cursor:marketplace",
  provider: "cursor",
  name: "Cursor Plugin Marketplace",
  description: "Validates .cursor-plugin/marketplace.json (string sources + metadata.pluginRoot)",

  detect(dir: string): boolean {
    if (existsSync(resolve(dir, ".cursor-plugin", "marketplace.json"))) return true;

    // Legacy? support a plugins/ style if someone uses it for cursor (rare)
    const pluginsDir = resolve(dir, "plugins");
    if (!existsSync(pluginsDir)) return false;

    try {
      const entries = readdirSync(pluginsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const hasSkills = existsSync(join(pluginsDir, entry.name, "skills"));
        const hasManifest = existsSync(join(pluginsDir, entry.name, ".cursor-plugin", "plugin.json"));
        if (hasSkills || hasManifest) return true;
      }
    } catch {}

    return false;
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    const cursorMktPath = resolve(dir, ".cursor-plugin", "marketplace.json");
    const hasCursorMkt = existsSync(cursorMktPath);
    const pluginsDir = resolve(dir, "plugins");
    const hasPluginsDirLayout = existsSync(pluginsDir);

    if (!hasCursorMkt && !hasPluginsDirLayout) {
      errors.push("Missing .cursor-plugin/marketplace.json or plugins/ directory");
      return { errors, warnings, passes };
    }

    if (hasCursorMkt) {
      let mkt: any;
      try {
        const raw = await Bun.file(cursorMktPath).text();
        mkt = JSON.parse(raw);
        passes.push(".cursor-plugin/marketplace.json is valid JSON");
      } catch {
        errors.push(".cursor-plugin/marketplace.json is missing or invalid JSON");
        return { errors, warnings, passes };
      }

      if (mkt.name) {
        passes.push(`name: "${mkt.name}"`);
      } else {
        warnings.push('Missing "name" at marketplace root');
      }

      if (mkt.metadata && typeof mkt.metadata === "object") {
        passes.push("metadata present");
        if (mkt.metadata.pluginRoot) {
          passes.push(`metadata.pluginRoot: "${mkt.metadata.pluginRoot}"`);
        }
        if (mkt.metadata.description) {
          passes.push("metadata.description present");
        }
      } else {
        warnings.push('Recommended: "metadata" with pluginRoot and description');
      }

      if (mkt.owner) {
        passes.push("owner present");
      }

      if (!Array.isArray(mkt.plugins) || mkt.plugins.length === 0) {
        errors.push('"plugins" must be a non-empty array');
        return { errors, warnings, passes };
      }
      passes.push(`${mkt.plugins.length} plugin(s) declared`);

      const pluginRoot = (mkt.metadata && mkt.metadata.pluginRoot) ? String(mkt.metadata.pluginRoot) : ".";

      for (const [i, p] of mkt.plugins.entries()) {
        if (!p || typeof p !== "object") {
          errors.push(`plugins[${i}]: must be an object`);
          continue;
        }

        if (p.name) {
          passes.push(`plugins[${i}].name: "${p.name}"`);
        } else {
          errors.push(`plugins[${i}]: missing "name"`);
        }

        if (p.source !== undefined) {
          const src = String(p.source);
          passes.push(`plugins[${i}].source: "${src}"`);
          const srcDir = resolve(dir, pluginRoot, src);
          if (existsSync(srcDir)) {
            const hasManifest = existsSync(resolve(srcDir, ".cursor-plugin", "plugin.json"));
            const hasSkills = existsSync(resolve(srcDir, "skills"));
            if (hasManifest || hasSkills) {
              passes.push(`plugins[${i}]: source exists (${hasManifest ? "manifest" : "skills/"})`);
            } else {
              warnings.push(`plugins[${i}].source "${src}" exists but lacks plugin markers`);
            }
          } else {
            warnings.push(`plugins[${i}].source path "${src}" (under ${pluginRoot}) does not exist`);
          }
        } else {
          // Some Cursor marketplaces may use name as implicit source
          const implicitSrc = resolve(dir, pluginRoot, p.name || "");
          if (p.name && existsSync(implicitSrc)) {
            passes.push(`plugins[${i}]: implicit source via name under ${pluginRoot}`);
          } else {
            warnings.push(`plugins[${i}]: missing "source" (and no implicit dir)`);
          }
        }

        if (p.description) passes.push(`plugins[${i}].description present`);
        if (p.category) {
          passes.push(`plugins[${i}].category: "${p.category}"`);
        }
        if (p.homepage) {
          passes.push(`plugins[${i}].homepage present`);
        }
      }

      // root files
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

      return { errors, warnings, passes };
    }

    // Fallback legacy plugins/ layout (rare for cursor)
    if (hasPluginsDirLayout) {
      passes.push("plugins/ directory exists");

      const pluginEntries = readdirSync(pluginsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory());

      if (pluginEntries.length === 0) {
        errors.push("plugins/ directory is empty — expected at least one plugin");
        return { errors, warnings, passes };
      }
      passes.push(`${pluginEntries.length} plugin(s) found`);

      if (existsSync(resolve(dir, "README.md"))) {
        passes.push("README.md exists at marketplace root");
      } else {
        warnings.push("No README.md at marketplace root — recommended");
      }

      for (const plugin of pluginEntries) {
        const pluginPath = join(pluginsDir, plugin.name);
        const hasSkills = existsSync(join(pluginPath, "skills"));
        const hasManifest = existsSync(join(pluginPath, ".cursor-plugin", "plugin.json"));
        if (hasManifest || hasSkills) {
          passes.push(`Plugin "${plugin.name}" has ${hasManifest ? "manifest" : "skills/"}`);
        }
      }

      return { errors, warnings, passes };
    }

    return { errors, warnings, passes };
  },
};
