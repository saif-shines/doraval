import { existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

export const codexMarketplaceValidator: Validator = {
  id: "codex:marketplace",
  provider: "codex",
  name: "Codex Plugin Marketplace",
  description: "Validates .agents/plugins/marketplace.json (Codex convention: object source + policy blocks)",

  detect(dir: string): boolean {
    // Codex marketplace file location
    if (existsSync(resolve(dir, ".agents", "plugins", "marketplace.json"))) return true;

    // Also support if this dir itself is a plugin with local marketplace (for per-plugin local testing)
    if (existsSync(resolve(dir, ".agents", "plugins", "marketplace.json"))) return true;

    return false;
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    const marketplacePath = resolve(dir, ".agents", "plugins", "marketplace.json");

    if (!existsSync(marketplacePath)) {
      errors.push("Missing .agents/plugins/marketplace.json");
      return { errors, warnings, passes };
    }

    let marketplace: any;
    try {
      const raw = await Bun.file(marketplacePath).text();
      marketplace = JSON.parse(raw);
      passes.push(".agents/plugins/marketplace.json is valid JSON");
    } catch {
      errors.push(".agents/plugins/marketplace.json is missing or invalid JSON");
      return { errors, warnings, passes };
    }

    // name + interface (Codex convention)
    if (marketplace.name) {
      passes.push(`name: "${marketplace.name}"`);
    } else {
      warnings.push('Missing "name" at marketplace root');
    }

    if (marketplace.interface && typeof marketplace.interface === "object") {
      const iface = marketplace.interface;
      if (iface.displayName) {
        passes.push(`interface.displayName: "${iface.displayName}"`);
      }
      passes.push("interface block present");
    } else {
      warnings.push('Recommended: "interface" with displayName at marketplace root');
    }

    // plugins array
    if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
      errors.push('"plugins" must be a non-empty array');
      return { errors, warnings, passes };
    }
    passes.push(`${marketplace.plugins.length} plugin(s) declared`);

    // Validate each plugin entry
    for (const [i, p] of marketplace.plugins.entries()) {
      if (!p || typeof p !== "object") {
        errors.push(`plugins[${i}]: must be an object`);
        continue;
      }

      if (!p.name) {
        errors.push(`plugins[${i}]: missing "name"`);
      } else {
        passes.push(`plugins[${i}].name: "${p.name}"`);
      }

      // source must be object for Codex { source: "local", path: "..." }
      if (!p.source || typeof p.source !== "object") {
        errors.push(`plugins[${i}].source: must be an object like { "source": "local", "path": "..." }`);
      } else {
        if (p.source.source) {
          passes.push(`plugins[${i}].source.source: "${p.source.source}"`);
        } else {
          warnings.push(`plugins[${i}].source: missing "source"`);
        }
        if (p.source.path) {
          const pathStr = String(p.source.path);
          if (!pathStr.startsWith("./") && !pathStr.startsWith("../")) {
            warnings.push(`plugins[${i}].source.path: "${pathStr}" should be relative (./ or ../)`);
          }
          passes.push(`plugins[${i}].source.path: "${pathStr}"`);
        } else {
          errors.push(`plugins[${i}].source: missing "path"`);
        }
      }

      // policy (common in Codex)
      if (p.policy && typeof p.policy === "object") {
        passes.push(`plugins[${i}].policy present`);
        if (p.policy.installation) {
          passes.push(`plugins[${i}].policy.installation: "${p.policy.installation}"`);
        }
        if (p.policy.authentication) {
          passes.push(`plugins[${i}].policy.authentication: "${p.policy.authentication}"`);
        }
      } else {
        warnings.push(`plugins[${i}]: "policy" recommended (installation/authentication)`);
      }

      if (p.category) {
        passes.push(`plugins[${i}].category: "${p.category}"`);
      }
    }

    // Root README / LICENSE (recommended, same as claude)
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
