import { existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

const NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const RELATIVE_PATH_REGEX = /^\.\//;

// All known top-level fields from the official Plugins reference manifest schema (Plugins reference).
// Unknown fields produce warnings (Claude Code ignores them; official `claude plugin validate` surfaces as warnings, suggests close matches).
const KNOWN_FIELDS = new Set([
  "$schema",
  "name",
  "displayName",
  "version",
  "description",
  "author",
  "homepage",
  "repository",
  "license",
  "keywords",
  "defaultEnabled",
  "skills",
  "commands",
  "agents",
  "hooks",
  "mcpServers",
  "outputStyles",
  "lspServers",
  "experimental",
  "userConfig",
  "channels",
  "dependencies",
]);

// Fields whose declared custom path(s) REPLACE default dir scanning (per "Path behavior rules").
// skills augments; hooks/mcp/lsp have merge rules.
const REPLACES_DEFAULT = new Set(["commands", "agents", "outputStyles", "lspServers"]);

interface PluginManifest {
  name?: unknown;
  version?: unknown;
  description?: unknown;
  displayName?: unknown;
  author?: unknown;
  license?: unknown;
  keywords?: unknown;
  defaultEnabled?: unknown;
  homepage?: unknown;
  repository?: unknown;
  skills?: unknown;
  commands?: unknown;
  agents?: unknown;
  hooks?: unknown;
  mcpServers?: unknown;
  outputStyles?: unknown;
  lspServers?: unknown;
  experimental?: unknown;
  userConfig?: unknown;
  channels?: unknown;
  dependencies?: unknown;
  [key: string]: unknown;
}

// Levenshtein for close-match suggestions on unrecognized fields (supports the "1 or 2 characters off" behavior described).
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0)) as number[][];
  for (let i = 0; i <= m; i++) {
    const row = dp[i]!;
    row[0] = i;
  }
  for (let j = 0; j <= n; j++) {
    const row = dp[0]!;
    row[j] = j;
  }
  for (let i = 1; i <= m; i++) {
    const row = dp[i]!;
    const prev = dp[i - 1]!;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
  }
  return dp[m]![n] as number;
}

function suggestField(unknown: string): string | null {
  const lower = unknown.toLowerCase();
  for (const k of KNOWN_FIELDS) {
    if (k.toLowerCase() === lower) return k;
    if (levenshtein(k.toLowerCase(), lower) <= 1) return k;
    if (k.toLowerCase().startsWith(lower.slice(0, 3)) && lower.length > 3) return k;
  }
  if (lower === "licence") return "license";
  if (lower === "dependancies" || lower === "deps") return "dependencies";
  if (lower === "mcp" || lower === "mcpservers") return "mcpServers";
  if (lower === "lsp") return "lspServers";
  if (lower === "outputstyles" || lower === "styles") return "outputStyles";
  if (lower === "userconfig") return "userConfig";
  return null;
}

function isRelativePathLike(v: unknown): boolean {
  if (typeof v !== "string") return false;
  return RELATIVE_PATH_REGEX.test(v) && !v.includes("..");
}

export const claudePluginValidator: Validator = {
  id: "claude:plugin",
  provider: "claude",
  name: "Claude Plugin",
  description: "Validates .claude-plugin/plugin.json manifest (complete schema per Plugins reference), component path rules (replace vs augment), .claude-plugin/ purity, default dirs, single-root-skill layout, unrecognized fields + suggestions, and structure",

  detect(dir: string): boolean {
    return existsSync(resolve(dir, ".claude-plugin", "plugin.json"));
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    const manifestPath = resolve(dir, ".claude-plugin", "plugin.json");
    const dotClaudePluginDir = resolve(dir, ".claude-plugin");

    // Parse manifest
    let manifest: PluginManifest;
    try {
      const raw = await Bun.file(manifestPath).text();
      manifest = JSON.parse(raw) as PluginManifest;
      passes.push(".claude-plugin/plugin.json is valid JSON");
    } catch (err: any) {
      if (!existsSync(manifestPath)) {
        errors.push(`.claude-plugin/plugin.json is missing (looked for ${manifestPath})`);
        warnings.push('Hint: Run `doraval claude new` (or `dora claude new`) to scaffold a new Claude plugin in this directory.');
      } else {
        errors.push(`.claude-plugin/plugin.json is invalid JSON (${err.message})`);
      }
      return { errors, warnings, passes };
    }

    // .claude-plugin/ directory purity (critical rule from spec):
    // Only plugin.json may live here. Everything else (skills/, commands/, agents/, hooks/, .mcp.json, .lsp.json, monitors/, themes/ etc.) must be at plugin root.
    try {
      const entries = readdirSync(dotClaudePluginDir);
      const unexpected = entries.filter((e) => e !== "plugin.json");
      if (unexpected.length > 0) {
        for (const e of unexpected) {
          warnings.push(`Unexpected item "${e}" inside .claude-plugin/ — only plugin.json belongs here. Move component directories and files (skills/, commands/, agents/, hooks/, .mcp.json etc.) to the plugin root.`);
        }
      } else if (entries.length === 1) {
        passes.push(".claude-plugin/ contains only plugin.json (correct layout)");
      }
    } catch {}

    // name — required, kebab-case (used for namespacing e.g. plugin-name:skill-name)
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

    // version — optional.
    // If present: explicit semver pins the cache key; users only see updates when you bump it (follow semver).
    // If omitted: falls back to git commit SHA (every push is a new "version" for update detection).
    if (manifest.version !== undefined) {
      const v = String(manifest.version);
      if (!/^\d+\.\d+\.\d+/.test(v)) {
        errors.push(`Invalid version format: "${v}" — must look like semver (MAJOR.MINOR.PATCH) when using explicit versioning`);
      } else {
        passes.push(`version: "${v}" (explicit — bump on every release to publish updates)`);
      }
    } else {
      passes.push("version omitted (git commit SHA used as version key — every commit becomes an available update)");
    }

    // description
    if (manifest.description !== undefined) {
      const desc = String(manifest.description);
      if (desc.length < 10) {
        warnings.push(`Description is very short (${desc.length} chars) — 50-200 chars recommended`);
      } else {
        passes.push("description field present");
      }
    } else {
      warnings.push('Missing "description" (recommended for UI, marketplace listings, and auto-discovery)');
    }

    // Other metadata (lightweight)
    if (manifest.displayName !== undefined) {
      passes.push(`displayName: "${manifest.displayName}" (human UI label; falls back to name)`);
    }
    if (manifest.author !== undefined) {
      const a = manifest.author as { name?: string } | undefined;
      if (a && typeof a === "object" && a.name) {
        passes.push("author present");
      } else {
        warnings.push('author should be an object like {"name": "...", "email?": "..."}');
      }
    }
    if (manifest.license !== undefined) {
      passes.push(`license: "${manifest.license}"`);
    }
    if (manifest.keywords !== undefined) {
      if (Array.isArray(manifest.keywords)) {
        passes.push(`keywords: [${manifest.keywords.join(", ")}] — If users mention any of these keywords, your plugin will get triggered in Claude Code`);
      } else {
        errors.push("keywords must be an array of strings");
      }
    } else {
      warnings.push('Missing "keywords" (recommended — if users mention any of these, your plugin will get triggered in Claude Code)');
    }
    if (manifest.defaultEnabled !== undefined) {
      passes.push(`defaultEnabled: ${manifest.defaultEnabled}`);
    }
    if (manifest.homepage) passes.push("homepage present");
    if (manifest.repository) passes.push("repository present");

    // Unrecognized fields (official: warnings not errors. Suggests likely intended name on small typos.)
    const unknown = Object.keys(manifest).filter((k) => !KNOWN_FIELDS.has(k));
    for (const k of unknown) {
      const sug = suggestField(k);
      const hint = sug ? ` (did you mean "${sug}"?)` : "";
      warnings.push(`Unrecognized top-level field "${k}"${hint} — will be ignored at runtime (allowed for cross-tool manifest compatibility).`);
    }

    // Handle component path fields and inline configs (full set from schema + path behavior rules)
    const handleField = (field: string, val: unknown) => {
      if (val === undefined || val === null) return;

      if (isRelativePathLike(val) || (Array.isArray(val) && val.every(isRelativePathLike))) {
        const arr = Array.isArray(val) ? val : [val];
        for (const p of arr) {
          const s = String(p);
          if (!RELATIVE_PATH_REGEX.test(s)) {
            errors.push(`${field}: path "${s}" must start with "./"`);
          } else if (s.includes("..")) {
            errors.push(`${field}: path "${s}" must not use ".." (paths are confined to the plugin tree after cache copy)`);
          } else if (existsSync(resolve(dir, s))) {
            passes.push(`${field}: path "${s}" exists`);
          } else {
            warnings.push(`${field}: path "${s}" does not exist on disk`);
          }
        }
        if (field === "skills") {
          passes.push(`${field}: augments the default skills/ (both are scanned)`);
        } else if (REPLACES_DEFAULT.has(field)) {
          passes.push(`${field}: custom path replaces default ${field}/ scan`);
        } else {
          passes.push(`${field}: custom path or config (merge rules apply)`);
        }
      } else if (typeof val === "object") {
        passes.push(`${field}: inline ${field} config present`);
      }
    };

    ["skills", "commands", "agents", "hooks", "mcpServers", "outputStyles", "lspServers"].forEach((f) => {
      if (manifest[f] !== undefined) handleField(f, manifest[f]);
    });

    // experimental.*
    if (manifest.experimental && typeof manifest.experimental === "object") {
      const exp = manifest.experimental as Record<string, unknown>;
      if (exp.themes !== undefined) handleField("experimental.themes", exp.themes);
      if (exp.monitors !== undefined) handleField("experimental.monitors", exp.monitors);
      passes.push("experimental section present (themes and monitors are experimental components)");
    }

    // userConfig (values prompted on enable; support ${user_config.KEY} and CLAUDE_PLUGIN_OPTION_*)
    if (manifest.userConfig && typeof manifest.userConfig === "object") {
      const keys = Object.keys(manifest.userConfig as object);
      passes.push(`userConfig: ${keys.length} user-configurable value(s) declared`);
      for (const k of keys) {
        const opt: any = (manifest.userConfig as any)[k];
        if (!opt || !opt.type || !opt.title) {
          warnings.push(`userConfig.${k} is missing required "type" and/or "title"`);
        }
      }
    }

    // channels (for MCP-backed injection like telegram/slack)
    if (Array.isArray(manifest.channels)) {
      passes.push(`channels: ${manifest.channels.length} channel(s) (each binds to an mcpServer)`);
      (manifest.channels as any[]).forEach((ch, i) => {
        if (!ch?.server) warnings.push(`channels[${i}]: "server" is required and must match an mcpServers key`);
      });
    }

    // dependencies (other plugins required)
    if (Array.isArray(manifest.dependencies)) {
      passes.push(`dependencies: declares ${manifest.dependencies.length} plugin dependency/ies`);
    }

    // Default on-disk component discovery (always reported; warnings when both manifest key + default dir exist for replace fields)
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
      if (manifest.skills !== undefined) {
        warnings.push("Default skills/ dir co-exists with manifest \"skills\" — manifest path is authoritative; default folder ignored for loading");
      }
    }

    const commandsDir = resolve(dir, "commands");
    if (existsSync(commandsDir)) {
      const mds = readdirSync(commandsDir).filter((f) => f.endsWith(".md"));
      if (mds.length) {
        passes.push(`commands/ has ${mds.length} .md file(s)`);
      }
      if (manifest.commands !== undefined) {
        warnings.push("commands/ co-exists with manifest \"commands\" — manifest replaces default (dir ignored)");
      }
    }

    const agentsDir = resolve(dir, "agents");
    if (existsSync(agentsDir)) {
      const mds = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
      if (mds.length) {
        passes.push(`agents/ has ${mds.length} .md file(s)`);
      }
      if (manifest.agents !== undefined) {
        warnings.push("agents/ co-exists with manifest \"agents\" — manifest replaces default (dir ignored)");
      }
    }

    // output-styles, themes, monitors, bin, etc. (presence reporting)
    if (existsSync(resolve(dir, "output-styles"))) {
      passes.push("output-styles/ directory present");
      if (manifest.outputStyles) warnings.push("output-styles/ co-exists with manifest outputStyles — manifest wins");
    }
    if (existsSync(resolve(dir, "themes"))) passes.push("themes/ present (experimental)");
    if (existsSync(resolve(dir, "monitors")) || (manifest.experimental as any)?.monitors) {
      passes.push("monitors config present (experimental)");
    }
    if (existsSync(resolve(dir, "bin"))) passes.push("bin/ present (adds executables to Bash tool $PATH)");
    if (existsSync(resolve(dir, "settings.json"))) passes.push("settings.json present (plugin defaults for agent/statusline)");
    if (existsSync(resolve(dir, "README.md"))) passes.push("README.md present");
    if (existsSync(resolve(dir, ".mcp.json"))) passes.push(".mcp.json present (validated by claude:mcp)");
    if (existsSync(resolve(dir, ".lsp.json"))) passes.push(".lsp.json present (validated by claude:lsp when registered)");
    if (existsSync(resolve(dir, "hooks/hooks.json")) || existsSync(resolve(dir, "hooks.json"))) {
      passes.push("hooks config present (validated by claude:hooks)");
    }

    // Single-skill plugin via root SKILL.md (no skills/ subdir + no "skills" manifest key)
    if (existsSync(resolve(dir, "SKILL.md")) && !existsSync(skillsDir) && manifest.skills === undefined) {
      passes.push("Root SKILL.md detected — plugin will be treated as a single-skill plugin (prefer frontmatter \"name\" for stable /command)");
    }

    return { errors, warnings, passes };
  },
};