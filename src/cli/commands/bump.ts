import { defineCommand } from "citty";
import { ui } from "../out.js";
import pc from "picocolors";
import { resolve, join, dirname, relative } from "path";
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { exit } from "../render/exit.js";

type Scope = "all" | "plugin" | "marketplace";

function bumpVersion(current: string | undefined, type: string): string {
  if (/^\d+\.\d+\.\d+$/.test(type)) return type;

  const curr = current || "0.0.0";
  const parts = curr.split(".").map((n) => parseInt(n, 10) || 0);
  const [major = 0, minor = 0, patch = 0] = parts;

  switch (type) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "major":
      return `${major + 1}.0.0`;
    default:
      throw new Error(`Invalid bump type "${type}". Use patch, minor, major, or an exact version like 1.2.3`);
  }
}

function readJson(p: string): any | null {
  try {
    const content = readFileSync(p, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function writeJson(p: string, data: any): void {
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function getVersion(obj: any): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  if (typeof obj.version === "string") return obj.version;
  if (obj.metadata && typeof obj.metadata.version === "string") return obj.metadata.version;
  return undefined;
}

function setVersion(obj: any, newVersion: string): boolean {
  if (!obj || typeof obj !== "object") return false;
  if (typeof obj.version === "string") {
    obj.version = newVersion;
    return true;
  }
  if (obj.metadata && typeof obj.metadata.version === "string") {
    obj.metadata.version = newVersion;
    return true;
  }
  return false;
}

/**
 * Bumps version fields inside a marketplace's plugins[] array (used by Copilot, and sometimes Cursor/other).
 * Returns number of plugin entries whose version was actually changed.
 */
function bumpPluginEntriesVersions(plugins: any[], bumpType: string): number {
  if (!Array.isArray(plugins)) return 0;
  let changed = 0;
  for (const p of plugins) {
    if (p && typeof p === "object") {
      const currentVer = typeof p.version === "string" ? p.version : undefined;
      if (currentVer) {
        try {
          const nextVer = bumpVersion(currentVer, bumpType);
          if (currentVer !== nextVer) {
            p.version = nextVer;
            changed++;
          }
        } catch {
          // ignore non-semver or bad current versions
        }
      }
    }
  }
  return changed;
}

interface Target {
  file: string;
  kind: "plugin" | "marketplace";
  label: string;
}

function walkForTargets(dir: string, maxDepth = 6, currentDepth = 0): Target[] {
  const results: Target[] = [];
  if (currentDepth > maxDepth) return results;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }

    if (st.isDirectory()) {
      const sub = walkForTargets(full, maxDepth, currentDepth + 1);
      results.push(...sub);
    } else if (st.isFile()) {
      if (entry === "plugin.json") {
        const parentDir = dirname(full);
        const parentName = parentDir.split(/[/\\]/).pop();
        const grandParentName = dirname(parentDir).split(/[/\\]/).pop();
        const isCopilotPlugin = parentName === "plugin" && grandParentName === ".github";
        if (parentName === ".claude-plugin" || parentName === ".codex-plugin" || parentName === ".cursor-plugin" || isCopilotPlugin) {
          results.push({
            file: full,
            kind: "plugin",
            label: isCopilotPlugin ? "plugin manifest (copilot)" : `plugin manifest (${parentName!.replace(".", "")})`,
          });
        }
      } else if (entry === "marketplace.json") {
        const json = readJson(full);
        if (json && getVersion(json)) {
          results.push({
            file: full,
            kind: "marketplace",
            label: "marketplace.json",
          });
        }
      }
    }
  }

  return results;
}

export default defineCommand({
  meta: {
    name: "bump",
    description: "Bump semver versions in plugin.json (manifests) and marketplace.json files (supports Claude, Codex, Cursor, Copilot)",
  },
  args: {
    type: {
      type: "positional",
      description: "patch | minor | major | x.y.z (exact version)",
      required: false,
    },
    path: {
      type: "positional",
      description: "Directory to scan from (defaults to current dir). Supports single plugin or marketplace root with many plugins/",
      required: false,
    },
    only: {
      type: "string",
      description: 'Scope to "all" (default), "plugin" (only plugin.json manifests), or "marketplace" (only marketplace.json files that carry a top-level version)',
      default: "all",
    },
  },
  async run({ args }) {
    let rawType = (args.type as string) || "patch";
    let targetPath = (args.path as string) || ".";
    const scopeInput = ((args.only as string) || "all").toLowerCase();
    const scope: Scope = scopeInput === "plugin" || scopeInput === "marketplace" ? scopeInput : "all";

    if (!["all", "plugin", "marketplace"].includes(scopeInput)) {
      ui.fail(`Invalid --only "${args.only}". Allowed: all, plugin, marketplace.`);
      return await exit(1);
    }

    // Forgiving UX: `dora bump ./my-plugin-dir` should mean "patch on that dir"
    const isKnownType = ["patch", "minor", "major"].includes(rawType) || /^\d+\.\d+\.\d+$/.test(rawType);
    const maybePath = resolve(rawType);
    const looksLikeDir = existsSync(maybePath) || rawType === "." || rawType.startsWith("./") || rawType.startsWith("../");

    if (!isKnownType && looksLikeDir) {
      targetPath = rawType;
      rawType = "patch";
    } else if (!isKnownType) {
      ui.fail(`Unknown bump type "${rawType}". Use patch | minor | major | 1.2.3`);
      return await exit(1);
    }

    const root = resolve(targetPath);
    if (!existsSync(root)) {
      ui.fail(`Path does not exist: ${root}`);
      return await exit(1);
    }

    ui.heading("doraval bump");
    ui.info(`  scanning: ${root}`);
    ui.info(`  scope: ${scope}   (use --only plugin or --only marketplace to narrow; Cursor/Copilot metadata.version supported)`);

    const discovered = walkForTargets(root);
    let targets = discovered;

    if (scope === "plugin") {
      targets = discovered.filter((t) => t.kind === "plugin");
    } else if (scope === "marketplace") {
      targets = discovered.filter((t) => t.kind === "marketplace");
    }

    if (targets.length === 0) {
      ui.fail("No matching files found under the scope.");
      ui.info("");
      ui.info("  Looked for (recursively):");
      ui.info("    • **/.claude-plugin/plugin.json");
      ui.info("    • **/.codex-plugin/plugin.json");
      ui.info("    • **/.cursor-plugin/plugin.json (or marketplace.json)");
      ui.info("    • **/.github/plugin/plugin.json (or marketplace.json)");
      ui.info("    • **/marketplace.json (top-level/metadata.version + versions inside plugins[] for Cursor/Copilot)");
      ui.info("");
      ui.info("  Tip: run from inside a plugin directory, or pass a path that contains plugins/.");
      ui.info("  Examples:");
      ui.info("    dora bump minor");
      ui.info("    dora bump minor ./my-claude-plugin");
      ui.info("    dora bump --only plugin .          # only the manifests");
      ui.info("    dora bump --only marketplace ./marketplaces-root   # bumps metadata.version + plugins[].version (Copilot/Cursor)");
      return await exit(1);
    }

    ui.info(`  matched ${targets.length} file(s)`);

    let bumpedCount = 0;

    for (const t of targets) {
      const json = readJson(t.file);
      if (!json || typeof json !== "object") {
        ui.warnItem(`skipped (invalid JSON): ${relative(root, t.file)}`);
        continue;
      }

      const current = getVersion(json);
      let next: string;
      try {
        next = bumpVersion(current, rawType);
      } catch (err: any) {
        ui.fail(err.message || String(err));
        return await exit(1);
      }

      const relPath = relative(root, t.file);

      // For marketplaces we also consider inner plugin[] versions
      const rootUnchanged = current === next;
      let innerChanged = 0;

      if (t.kind === "marketplace" && Array.isArray(json.plugins)) {
        innerChanged = bumpPluginEntriesVersions(json.plugins, rawType);
      }

      if (rootUnchanged && innerChanged === 0) {
        ui.dim(`  • ${t.label}  ${current || "(no version)"}  (no change)  [${relPath}]`);
        continue;
      }

      const didRootUpdate = setVersion(json, next);
      const didAnyUpdate = didRootUpdate || innerChanged > 0;

      if (!didAnyUpdate) {
        ui.warnItem(`skipped (could not locate version field to update): ${relPath}`);
        continue;
      }

      writeJson(t.file, json);

      if (didRootUpdate && current) {
        ui.success(`${t.label}: ${pc.dim(current)} → ${pc.green(next)}`);
      } else if (didRootUpdate) {
        ui.success(`${t.label}: ${pc.green(next)}`);
      } else {
        ui.success(`${t.label} (no root version)`);
      }
      ui.info(`    ${relPath}`);

      if (innerChanged > 0) {
        ui.info(`    + bumped ${innerChanged} entry version(s) inside plugins[]`);
      }

      bumpedCount++;
    }

    ui.blank();

    if (bumpedCount === 0) {
      ui.info("All matched files were already at the target version.");
    } else {
      ui.info(`Done. Bumped ${bumpedCount} file(s).`);
      ui.dim("  Next: doraval validate " + (targetPath === "." ? "." : targetPath));
    }
    await exit(0);
  },
});
