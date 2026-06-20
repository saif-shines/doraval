import { existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

const NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

interface CursorPluginManifest {
  name?: unknown;
  displayName?: unknown;
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

export const cursorPluginValidator: Validator = {
  id: "cursor:plugin",
  provider: "cursor",
  name: "Cursor Plugin",
  description: "Validates .cursor-plugin/plugin.json manifest (skills as directory string; mcpServers support)",

  detect(dir: string): boolean {
    return existsSync(resolve(dir, ".cursor-plugin", "plugin.json"));
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    const manifestPath = resolve(dir, ".cursor-plugin", "plugin.json");

    let manifest: CursorPluginManifest;
    try {
      const raw = await Bun.file(manifestPath).text();
      manifest = JSON.parse(raw) as CursorPluginManifest;
      passes.push(".cursor-plugin/plugin.json is valid JSON");
    } catch {
      errors.push(".cursor-plugin/plugin.json is missing or invalid JSON");
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

    // skills — required as directory string for Cursor (e.g. "./skills")
    if (manifest.skills === undefined) {
      errors.push('Missing required field: "skills" (must be a directory string like "./skills")');
    } else if (typeof manifest.skills !== "string") {
      errors.push('"skills" must be a string directory path');
    } else {
      const s = manifest.skills;
      if (!s.startsWith("./")) {
        warnings.push('"skills" should start with "./"');
      }
      passes.push(`skills: "${s}" (directory string)`);
    }

    // mcpServers (optional path to mcp.json for Cursor)
    if (manifest.mcpServers !== undefined) {
      if (typeof manifest.mcpServers === "string") {
        passes.push(`mcpServers: "${manifest.mcpServers}"`);
      } else {
        warnings.push('"mcpServers" should be a string path when present');
      }
    }

    // displayName recommended for Cursor
    if (manifest.displayName) {
      passes.push(`displayName: "${manifest.displayName}"`);
    } else {
      warnings.push("displayName recommended for Cursor UI");
    }

    // version optional
    if (manifest.version !== undefined) {
      const v = String(manifest.version);
      if (!/^\d+\.\d+\.\d+/.test(v)) {
        warnings.push(`version "${v}" should look like semver`);
      } else {
        passes.push(`version: "${v}"`);
      }
    } else {
      passes.push("version omitted (git commit SHA used as version key)");
    }

    // description recommended
    if (manifest.description !== undefined) {
      const desc = String(manifest.description);
      if (desc.length < 10) {
        warnings.push(`Description is very short (${desc.length} chars) — 50-200 chars recommended`);
      } else {
        passes.push("description field present");
      }
    } else {
      warnings.push('Missing "description" (recommended)');
    }

    // author, license, etc.
    if (manifest.author) passes.push("author present");
    if (manifest.license) passes.push(`license: "${manifest.license}"`);
    if (manifest.homepage) passes.push("homepage present");
    if (manifest.repository) passes.push("repository present");
    if (manifest.keywords !== undefined) {
      if (Array.isArray(manifest.keywords)) {
        passes.push(`keywords: [${manifest.keywords.join(", ")}] — If users mention any of these keywords, your plugin will get triggered in Cursor`);
      } else {
        errors.push("keywords must be an array of strings");
      }
    } else {
      warnings.push('Missing "keywords" (recommended — if users mention any of these, your plugin will get triggered in Cursor)');
    }

    // Check on-disk skills/
    const skillsDir = resolve(dir, "skills");
    if (existsSync(skillsDir)) {
      const entries = readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
      for (const e of entries) {
        const md = join(skillsDir, e.name, "SKILL.md");
        if (existsSync(md)) {
          passes.push(`skills/${e.name}/SKILL.md exists`);
        } else {
          errors.push(`skills/${e.name}/ is missing SKILL.md`);
        }
      }
    }

    // Check referenced mcp file if declared
    if (typeof manifest.mcpServers === "string") {
      const mcpRef = manifest.mcpServers;
      if (mcpRef.startsWith("./") || mcpRef.startsWith("../")) {
        const mcpPath = resolve(dir, mcpRef);
        if (existsSync(mcpPath)) {
          passes.push(`mcpServers file exists at ${mcpRef}`);
        } else {
          warnings.push(`mcpServers path "${mcpRef}" does not exist on disk`);
        }
      }
    }

    // Unrecognized fields — warn
    const known = new Set([
      "name", "displayName", "version", "description", "author", "homepage",
      "repository", "license", "keywords", "skills", "mcpServers"
    ]);
    const unknown = Object.keys(manifest).filter((k) => !known.has(k));
    for (const k of unknown) {
      warnings.push(`Unrecognized field "${k}" — will be ignored (for compatibility)`);
    }

    return { errors, warnings, passes };
  },
};
