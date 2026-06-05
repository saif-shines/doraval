import { existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

const NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const RELATIVE_PATH_REGEX = /^\.\//;

export const claudePluginValidator: Validator = {
  id: "claude:plugin",
  provider: "claude",
  name: "Claude Plugin",
  description: "Validates .claude-plugin/plugin.json manifest, component directories, and structure",

  detect(dir: string): boolean {
    return existsSync(resolve(dir, ".claude-plugin", "plugin.json"));
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    const manifestPath = resolve(dir, ".claude-plugin", "plugin.json");

    // Parse manifest
    let manifest: Record<string, unknown>;
    try {
      const raw = await Bun.file(manifestPath).text();
      manifest = JSON.parse(raw);
      passes.push(".claude-plugin/plugin.json is valid JSON");
    } catch {
      errors.push(".claude-plugin/plugin.json is missing or invalid JSON");
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

    // version — optional, semver if present
    if (manifest.version !== undefined) {
      const v = String(manifest.version);
      if (!/^\d+\.\d+\.\d+/.test(v)) {
        errors.push(`Invalid version format: "${v}" — must be semver (MAJOR.MINOR.PATCH)`);
      } else {
        passes.push(`version: "${v}"`);
      }
    }

    // description — optional, length recommendation
    if (manifest.description !== undefined) {
      const desc = String(manifest.description);
      if (desc.length < 10) {
        warnings.push(`Description is very short (${desc.length} chars) — 50-200 chars recommended`);
      } else {
        passes.push("description field present");
      }
    }

    // Component path validation helper
    const checkPaths = (field: string, value: unknown) => {
      const paths = Array.isArray(value) ? value : [value];
      for (const p of paths) {
        const s = String(p);
        if (!RELATIVE_PATH_REGEX.test(s)) {
          errors.push(`${field}: path "${s}" must start with "./" (relative)`);
        } else if (s.includes("..")) {
          errors.push(`${field}: path "${s}" must not use ".." (no parent traversal)`);
        } else if (existsSync(resolve(dir, s))) {
          passes.push(`${field}: path "${s}" exists`);
        } else {
          warnings.push(`${field}: path "${s}" does not exist on disk`);
        }
      }
    };

    for (const field of ["commands", "agents", "hooks", "mcpServers"]) {
      if (manifest[field] !== undefined) {
        checkPaths(field, manifest[field]);
      }
    }

    // Check default component directories
    const skillsDir = resolve(dir, "skills");
    if (existsSync(skillsDir)) {
      const skillEntries = readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
      for (const skill of skillEntries) {
        const skillMd = join(skillsDir, skill.name, "SKILL.md");
        if (existsSync(skillMd)) {
          passes.push(`skills/${skill.name}/SKILL.md exists`);
        } else {
          errors.push(`skills/${skill.name}/ missing SKILL.md`);
        }
      }
    }

    const commandsDir = resolve(dir, "commands");
    if (existsSync(commandsDir)) {
      const mdFiles = readdirSync(commandsDir).filter((f) => f.endsWith(".md"));
      if (mdFiles.length > 0) {
        passes.push(`commands/ has ${mdFiles.length} .md file(s)`);
      } else {
        warnings.push("commands/ directory exists but has no .md files");
      }
    }

    const agentsDir = resolve(dir, "agents");
    if (existsSync(agentsDir)) {
      const mdFiles = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
      if (mdFiles.length > 0) {
        passes.push(`agents/ has ${mdFiles.length} .md file(s)`);
      } else {
        warnings.push("agents/ directory exists but has no .md files");
      }
    }

    // TODO: More rules will be added incrementally from official docs

    return { errors, warnings, passes };
  },
};