import { existsSync } from "fs";
import { resolve, join } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

const NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

interface CopilotPluginManifest {
  name?: unknown;
  version?: unknown;
  description?: unknown;
  author?: unknown;
  homepage?: unknown;
  repository?: unknown;
  license?: unknown;
  keywords?: unknown;
  skills?: unknown;
  mcpServers?: unknown;
  [key: string]: unknown;
}

export const copilotPluginValidator: Validator = {
  id: "copilot:plugin",
  provider: "copilot",
  name: "Copilot Plugin",
  description: "Validates .github/plugin/plugin.json (skills as array of paths, mcpServers support)",

  detect(dir: string): boolean {
    return existsSync(resolve(dir, ".github", "plugin", "plugin.json"));
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    const manifestPath = resolve(dir, ".github", "plugin", "plugin.json");

    let manifest: CopilotPluginManifest;
    try {
      const raw = await Bun.file(manifestPath).text();
      manifest = JSON.parse(raw) as CopilotPluginManifest;
      passes.push(".github/plugin/plugin.json is valid JSON");
    } catch {
      errors.push(".github/plugin/plugin.json is missing or invalid JSON");
      return { errors, warnings, passes };
    }

    // name — required, kebab-case
    if (!manifest.name) {
      errors.push('Missing required field: "name"');
    } else {
      const name = String(manifest.name);
      if (!NAME_REGEX.test(name)) {
        errors.push(`Invalid name format: "${name}" — must be kebab-case (a-z, 0-9, hyphens)`);
      } else {
        passes.push(`name: "${name}"`);
      }
    }

    // skills — array of paths for Copilot
    if (manifest.skills === undefined) {
      errors.push('Missing required field: "skills" (must be an array of paths like ["./skills/foo"])');
    } else if (!Array.isArray(manifest.skills)) {
      errors.push('"skills" must be an array of relative paths');
    } else {
      const skillsArr = manifest.skills as unknown[];
      passes.push(`skills: array with ${skillsArr.length} path(s)`);

      for (const [i, p] of skillsArr.entries()) {
        if (typeof p !== "string") {
          errors.push(`skills[${i}]: must be a string path`);
          continue;
        }
        if (!p.startsWith("./") && !p.startsWith("../")) {
          warnings.push(`skills[${i}]: "${p}" should be relative (./ or ../)`);
        }

        const skillDir = resolve(dir, p);
        const skillMd = resolve(skillDir, "SKILL.md");
        if (existsSync(skillMd)) {
          passes.push(`skills[${i}]: ${p}/SKILL.md exists`);
        } else if (existsSync(skillDir)) {
          warnings.push(`skills[${i}]: directory exists but no SKILL.md inside`);
        } else {
          warnings.push(`skills[${i}]: path "${p}" does not exist`);
        }
      }
    }

    // mcpServers (optional string path)
    if (manifest.mcpServers !== undefined) {
      if (typeof manifest.mcpServers === "string") {
        passes.push(`mcpServers: "${manifest.mcpServers}"`);
        const mcpRef = String(manifest.mcpServers);
        const mcpPath = resolve(dir, mcpRef);
        if (existsSync(mcpPath)) {
          passes.push(`mcpServers file exists at ${mcpRef}`);
        } else {
          warnings.push(`mcpServers path "${mcpRef}" does not exist on disk`);
        }
      } else {
        warnings.push('"mcpServers" should be a string path when present');
      }
    }

    // Basic metadata
    if (manifest.description) {
      const desc = String(manifest.description);
      if (desc.length < 10) {
        warnings.push(`Description is very short (${desc.length} chars)`);
      } else {
        passes.push("description field present");
      }
    } else {
      warnings.push('Missing "description" (recommended)');
    }

    if (manifest.version) passes.push(`version: "${manifest.version}"`);
    if (manifest.author) passes.push("author present");
    if (manifest.license) passes.push(`license: "${manifest.license}"`);
    if (manifest.homepage) passes.push("homepage present");
    if (manifest.repository) passes.push("repository present");
    if (Array.isArray(manifest.keywords)) {
      passes.push(`keywords: [${manifest.keywords.join(", ")}]`);
    }

    // Unrecognized fields
    const known = new Set([
      "name", "version", "description", "author", "homepage",
      "repository", "license", "keywords", "skills", "mcpServers"
    ]);
    const unknown = Object.keys(manifest).filter((k) => !known.has(k));
    for (const k of unknown) {
      warnings.push(`Unrecognized field "${k}" — will be ignored (for compatibility)`);
    }

    return { errors, warnings, passes };
  },
};
