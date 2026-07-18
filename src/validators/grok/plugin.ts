import { existsSync } from "fs";
import { resolve } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

/**
 * Grok plugin packaging (Appendix H §H4):
 * 1. plugin.json at plugin root (canonical)
 * 2. .grok-plugin/plugin.json
 * 3. .claude-plugin/plugin.json (compat)
 * Convention dirs alone are only treated as a Grok plugin when under a .grok tree
 * or when a Grok-specific manifest is present (avoid claiming every skills/ dir).
 */
const MANIFEST_CANDIDATES = [
  "plugin.json",
  ".grok-plugin/plugin.json",
  ".claude-plugin/plugin.json",
] as const;

function resolveManifest(dir: string): { abs: string; rel: string } | null {
  for (const rel of MANIFEST_CANDIDATES) {
    const abs = resolve(dir, rel);
    if (existsSync(abs)) return { abs, rel };
  }
  return null;
}

function isGrokPluginContext(dir: string): boolean {
  // Explicit Grok packaging markers
  if (existsSync(resolve(dir, ".grok-plugin", "plugin.json"))) return true;
  if (existsSync(resolve(dir, ".grok"))) return true;
  // Plugin packages often live under .grok/plugins/<name>
  const norm = dir.replace(/\\/g, "/");
  if (norm.includes("/.grok/plugins/") || norm.endsWith("/.grok/plugins")) return true;
  return false;
}

export const grokPluginValidator: Validator = {
  id: "grok:plugin",
  provider: "grok",
  name: "Grok Plugin",
  description:
    "Validates Grok plugin packaging: plugin.json (root canonical), .grok-plugin/plugin.json, or .claude-plugin/plugin.json under a Grok context",

  detect(dir: string): boolean {
    if (!isGrokPluginContext(dir) && !existsSync(resolve(dir, ".grok-plugin", "plugin.json"))) {
      // Root plugin.json alone is only "Grok" when Grok markers exist
      return false;
    }
    return resolveManifest(dir) !== null;
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    const found = resolveManifest(dir);
    if (!found) {
      errors.push(
        "No plugin.json found (looked for plugin.json, .grok-plugin/plugin.json, .claude-plugin/plugin.json)",
      );
      return { errors, warnings, passes };
    }

    passes.push(`manifest: ${found.rel}`);

    try {
      const raw = await Bun.file(found.abs).text();
      const manifest = JSON.parse(raw) as Record<string, unknown>;
      passes.push(`${found.rel} is valid JSON`);
      if (manifest.name !== undefined) {
        passes.push(`name: "${String(manifest.name)}"`);
      } else {
        warnings.push('manifest has no "name" — Grok falls back to directory name');
      }
    } catch {
      errors.push(`${found.rel} is missing or invalid JSON`);
    }

    return { errors, warnings, passes };
  },
};
