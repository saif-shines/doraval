import { defineCommand } from "citty";
import { ui } from "../out.js";
import pc from "picocolors";
import { resolve, join, dirname, relative } from "path";
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "fs";

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
        if (parentName === ".claude-plugin" || parentName === ".codex-plugin" || parentName === ".cursor-plugin") {
          results.push({
            file: full,
            kind: "plugin",
            label: `plugin manifest (${parentName.replace(".", "")})`,
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
    description: "Bump semver versions in plugin.json (manifests) and marketplace.json files (supports Claude, Codex, Cursor)",
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
  run({ args }) {
    let rawType = (args.type as string) || "patch";
    let targetPath = (args.path as string) || ".";
    const scopeInput = ((args.only as string) || "all").toLowerCase();
    const scope: Scope = scopeInput === "plugin" || scopeInput === "marketplace" ? scopeInput : "all";

    if (!["all", "plugin", "marketplace"].includes(scopeInput)) {
      ui.fail(`Invalid --only "${args.only}". Allowed: all, plugin, marketplace.`);
      process.exit(1);
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
      process.exit(1);
    }

    const root = resolve(targetPath);
    if (!existsSync(root)) {
      ui.fail(`Path does not exist: ${root}`);
      process.exit(1);
    }

    ui.heading("doraval bump");
    ui.info(`  scanning: ${root}`);
    ui.info(`  scope: ${scope}   (use --only plugin or --only marketplace to narrow; Cursor metadata.version supported)`);

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
      ui.info("    • **/marketplace.json (top-level version or metadata.version for Cursor)");
      ui.info("");
      ui.info("  Tip: run from inside a plugin directory, or pass a path that contains plugins/.");
      ui.info("  Examples:");
      ui.info("    dora bump minor");
      ui.info("    dora bump minor ./my-claude-plugin");
      ui.info("    dora bump --only plugin .          # only the manifests");
      ui.info("    dora bump --only marketplace ./marketplaces-root   # includes Cursor metadata.version");
      process.exit(1);
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
        process.exit(1);
      }

      const relPath = relative(root, t.file);

      if (current === next) {
        ui.dim(`  • ${t.label}  ${current || "(no version)"}  (no change)  [${relPath}]`);
        continue;
      }

      const didUpdate = setVersion(json, next);
      if (!didUpdate) {
        ui.warnItem(`skipped (could not locate version field to update): ${relPath}`);
        continue;
      }

      writeJson(t.file, json);

      ui.success(`${t.label}: ${pc.dim(current || "(none)")} → ${pc.green(next)}`);
      ui.info(`    ${relPath}`);
      bumpedCount++;
    }

    ui.blank();

    if (bumpedCount === 0) {
      ui.info("All matched files were already at the target version.");
    } else {
      ui.info(`Done. Bumped ${bumpedCount} file(s).`);
      ui.dim("  Next: doraval validate " + (targetPath === "." ? "." : targetPath));
    }
    process.exit(0);
  },
});
