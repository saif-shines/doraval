import { existsSync } from "fs";
import { resolve } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

export const copilotMarketplaceValidator: Validator = {
  id: "copilot:marketplace",
  provider: "copilot",
  name: "Copilot Plugin Marketplace",
  description: "Validates .github/plugin/marketplace.json (string sources)",

  detect(dir: string): boolean {
    return existsSync(resolve(dir, ".github", "plugin", "marketplace.json"));
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    const mktPath = resolve(dir, ".github", "plugin", "marketplace.json");

    let mkt: any;
    try {
      const raw = await Bun.file(mktPath).text();
      mkt = JSON.parse(raw);
      passes.push(".github/plugin/marketplace.json is valid JSON");
    } catch {
      errors.push(".github/plugin/marketplace.json is missing or invalid JSON");
      return { errors, warnings, passes };
    }

    if (mkt.name) {
      passes.push(`name: "${mkt.name}"`);
    } else {
      warnings.push('Missing "name" at marketplace root');
    }

    if (mkt.metadata && typeof mkt.metadata === "object") {
      passes.push("metadata present");
      if (mkt.metadata.description) passes.push("metadata.description present");
      if (mkt.metadata.version) passes.push(`metadata.version: "${mkt.metadata.version}"`);
    }

    if (mkt.owner) {
      passes.push("owner present");
    }

    if (!Array.isArray(mkt.plugins) || mkt.plugins.length === 0) {
      errors.push('"plugins" must be a non-empty array');
      return { errors, warnings, passes };
    }
    passes.push(`${mkt.plugins.length} plugin(s) declared`);

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

      if (p.source) {
        const src = String(p.source);
        passes.push(`plugins[${i}].source: "${src}"`);

        const srcDir = resolve(dir, src);
        if (existsSync(srcDir)) {
          const hasManifest = existsSync(resolve(srcDir, ".github", "plugin", "plugin.json"));
          const hasSkills = existsSync(resolve(srcDir, "skills"));

          if (hasManifest || hasSkills) {
            passes.push(`plugins[${i}]: source exists (${hasManifest ? "manifest" : "skills/"})`);
          } else {
            warnings.push(`plugins[${i}].source "${src}" exists but lacks plugin markers`);
          }
        } else {
          warnings.push(`plugins[${i}].source path "${src}" does not exist`);
        }
      } else {
        warnings.push(`plugins[${i}]: missing "source"`);
      }

      if (p.description) passes.push(`plugins[${i}].description present`);
      if (p.version) passes.push(`plugins[${i}].version: "${p.version}"`);
    }

    // root files
    if (existsSync(resolve(dir, "README.md"))) {
      passes.push("README.md exists at marketplace root");
    } else {
      warnings.push("No README.md at marketplace root — recommended");
    }
    if (existsSync(resolve(dir, "LICENSE"))) {
      passes.push("LICENSE exists at marketplace root");
    } else {
      warnings.push("No LICENSE at marketplace root — recommended");
    }

    return { errors, warnings, passes };
  },
};
