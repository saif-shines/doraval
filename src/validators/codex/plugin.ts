import { existsSync, readdirSync } from "fs";
import { resolve, join, dirname } from "path";
import type { Validator, ValidateResult, ValidateOptions, CheckItem } from "../types.js";

const NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

interface CodexPluginManifest {
  name?: unknown;
  version?: unknown;
  description?: unknown;
  skills?: unknown;
  interface?: unknown;
  [key: string]: unknown;
}

export const codexPluginValidator: Validator = {
  id: "codex:plugin",
  provider: "codex",
  name: "Codex Plugin",
  description: "Validates .codex-plugin/plugin.json manifest (requires interface block and skills as directory string per Codex packaging)",

  detect(dir: string): boolean {
    return existsSync(resolve(dir, ".codex-plugin", "plugin.json"));
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: CheckItem[] = [];
    const warnings: CheckItem[] = [];
    const passes: CheckItem[] = [];

    const manifestPath = resolve(dir, ".codex-plugin", "plugin.json");

    let manifest: CodexPluginManifest;
    try {
      const raw = await Bun.file(manifestPath).text();
      manifest = JSON.parse(raw) as CodexPluginManifest;
      passes.push(".codex-plugin/plugin.json is valid JSON");
    } catch {
      errors.push(".codex-plugin/plugin.json is missing or invalid JSON");
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

    // skills — required as directory string (e.g. "./skills/")
    if (manifest.skills === undefined) {
      errors.push('Missing required field: "skills" (must be a directory string like "./skills/")');
    } else if (typeof manifest.skills !== "string") {
      errors.push('"skills" must be a string directory path');
    } else {
      const s = manifest.skills;
      if (!s.startsWith("./")) {
        warnings.push('"skills" should start with "./"');
      }
      passes.push(`skills: "${s}" (directory string)`);
    }

    // interface — required block for Codex (displayName, category, etc.)
    if (!manifest.interface || typeof manifest.interface !== "object") {
      errors.push('Missing required "interface" object (Codex uses it for displayName, shortDescription, category, etc.)');
    } else {
      const iface = manifest.interface as Record<string, unknown>;
      if (iface.displayName) {
        passes.push(`interface.displayName: "${iface.displayName}"`);
      } else {
        warnings.push('interface.displayName recommended');
      }
      if (iface.category) {
        passes.push(`interface.category: "${iface.category}"`);
      }
      passes.push("interface block present");
    }

    // version — optional, recommend semver
    if (manifest.version !== undefined) {
      const v = String(manifest.version);
      if (!/^\d+\.\d+\.\d+/.test(v)) {
        warnings.push(`version "${v}" should look like semver for explicit versioning`);
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

    if (manifest.keywords !== undefined) {
      if (Array.isArray(manifest.keywords)) {
        passes.push(`keywords: [${manifest.keywords.join(", ")}] — If users mention any of these keywords, your plugin will get triggered in Codex`);
      } else {
        errors.push("keywords must be an array of strings");
      }
    } else {
      warnings.push('Missing "keywords" (recommended — if users mention any of these, your plugin will get triggered in Codex)');
    }

    // Check on-disk skills/ if present
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

    // Unrecognized fields — warn (Codex is more lenient than Claude)
    const known = new Set(["name", "version", "description", "skills", "interface", "author", "homepage", "repository", "license", "keywords"]);
    const unknown = Object.keys(manifest).filter((k) => !known.has(k));
    for (const k of unknown) {
      warnings.push(`Unrecognized field "${k}" — will be ignored (for compatibility)`);
    }

    return { errors, warnings, passes };
  },
};
