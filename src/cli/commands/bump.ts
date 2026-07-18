import { defineCommand } from "citty";
import { confirm, isCancel, multiselect, select } from "@clack/prompts";
import { ui } from "../out.js";
import pc from "picocolors";
import { posthog, anonymousId } from "../../analytics.js";
import { resolve, join, dirname, relative } from "path";
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { exit } from "../render/exit.js";

type Scope = "all" | "plugin" | "marketplace";
type BumpType = string; // patch | minor | major | x.y.z

export function bumpVersion(current: string | undefined, type: string): string {
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
export function bumpPluginEntriesVersions(plugins: any[], bumpType: string): number {
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

export interface Target {
  file: string;
  kind: "plugin" | "marketplace";
  label: string;
}

export function walkForTargets(dir: string, maxDepth = 6, currentDepth = 0): Target[] {
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

export interface BumpPlan {
  target: Target;
  relPath: string;
  current: string | undefined;
  next: string;
  rootUnchanged: boolean;
  /** plugin[] entries that would change (marketplace only; computed without mutating) */
  innerWouldChange: number;
}

/** Preview planned bumps without writing. */
export function planBumps(targets: Target[], root: string, bumpType: BumpType): BumpPlan[] {
  const plans: BumpPlan[] = [];
  for (const t of targets) {
    const json = readJson(t.file);
    if (!json || typeof json !== "object") continue;
    const current = getVersion(json);
    let next: string;
    try {
      next = bumpVersion(current, bumpType);
    } catch {
      continue;
    }
    let innerWouldChange = 0;
    if (t.kind === "marketplace" && Array.isArray(json.plugins)) {
      for (const p of json.plugins) {
        if (p && typeof p === "object" && typeof p.version === "string") {
          try {
            if (bumpVersion(p.version, bumpType) !== p.version) innerWouldChange++;
          } catch {
            /* skip */
          }
        }
      }
    }
    plans.push({
      target: t,
      relPath: relative(root, t.file),
      current,
      next,
      rootUnchanged: current === next,
      innerWouldChange,
    });
  }
  return plans;
}

function applyBump(plan: BumpPlan, bumpType: BumpType): boolean {
  const json = readJson(plan.target.file);
  if (!json || typeof json !== "object") return false;

  let innerChanged = 0;
  if (plan.target.kind === "marketplace" && Array.isArray(json.plugins)) {
    innerChanged = bumpPluginEntriesVersions(json.plugins, bumpType);
  }

  const rootUnchanged = plan.current === plan.next;
  if (rootUnchanged && innerChanged === 0) return false;

  const didRootUpdate = setVersion(json, plan.next);
  if (!didRootUpdate && innerChanged === 0) return false;

  writeJson(plan.target.file, json);
  return true;
}

function printLookedFor(): void {
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
  ui.info("    dora bump --only marketplace ./marketplaces-root");
}

function filterByScope(discovered: Target[], scope: Scope): Target[] {
  if (scope === "plugin") return discovered.filter((t) => t.kind === "plugin");
  if (scope === "marketplace") return discovered.filter((t) => t.kind === "marketplace");
  return discovered;
}

function isInteractiveBare(typeArg: string | undefined, pathArg: string | undefined): boolean {
  return (
    typeArg === undefined &&
    pathArg === undefined &&
    process.stdin.isTTY === true &&
    process.stderr.isTTY === true
  );
}

export default defineCommand({
  meta: {
    name: "bump",
    description: "Bump plugin/marketplace semver (Claude, Codex, Cursor, Copilot)",
  },
  args: {
    type: {
      type: "positional",
      description: "patch | minor | major | x.y.z (exact version). Omit on a TTY for interactive pick.",
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
    yes: {
      type: "boolean",
      description: "Skip confirmation in interactive mode",
      default: false,
    },
  },
  async run({ args }) {
    const typeArg = args.type as string | undefined;
    const pathArg = args.path as string | undefined;
    const scopeInput = ((args.only as string) || "all").toLowerCase();
    const scope: Scope = scopeInput === "plugin" || scopeInput === "marketplace" ? scopeInput : "all";
    const yes = Boolean(args.yes);

    if (!["all", "plugin", "marketplace"].includes(scopeInput)) {
      ui.fail(`Invalid --only "${args.only}". Allowed: all, plugin, marketplace.`);
      return await exit(1);
    }

    // B40: bare `dora bump` on TTY → discover → multiselect → type → confirm
    if (isInteractiveBare(typeArg, pathArg)) {
      return await runInteractive(scope, yes);
    }

    let rawType = typeArg || "patch";
    let targetPath = pathArg || ".";

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

    return await runNonInteractive(rawType, targetPath, scope);
  },
});

async function runInteractive(scope: Scope, yes: boolean): Promise<void> {
  const root = resolve(".");
  ui.heading("doraval bump");
  ui.info(`  scanning: ${root}`);
  ui.info(`  scope: ${scope}`);

  const targets = filterByScope(walkForTargets(root), scope);
  if (targets.length === 0) {
    ui.fail("No matching files found under the scope.");
    printLookedFor();
    return await exit(1);
  }

  const selected = await multiselect({
    message: "Which manifests to bump?",
    options: targets.map((t) => {
      const json = readJson(t.file);
      const ver = json ? getVersion(json) : undefined;
      return {
        value: t.file,
        label: `${t.label}  ${pc.dim(ver ?? "(no version)")}`,
        hint: relative(root, t.file),
      };
    }),
    required: true,
    output: process.stderr,
  });
  if (isCancel(selected)) {
    ui.dim("  cancelled");
    return await exit(0);
  }

  const picked = targets.filter((t) => (selected as string[]).includes(t.file));
  if (picked.length === 0) {
    ui.dim("  nothing selected");
    return await exit(0);
  }

  const bumpType = (await select({
    message: "Bump type",
    options: [
      { value: "patch", label: "patch", hint: "0.1.0 → 0.1.1" },
      { value: "minor", label: "minor", hint: "0.1.0 → 0.2.0" },
      { value: "major", label: "major", hint: "0.1.0 → 1.0.0" },
    ],
    initialValue: "patch",
    output: process.stderr,
  })) as string | symbol;
  if (isCancel(bumpType)) {
    ui.dim("  cancelled");
    return await exit(0);
  }

  const plans = planBumps(picked, root, bumpType as string);
  const changing = plans.filter((p) => !p.rootUnchanged || p.innerWouldChange > 0);

  ui.blank();
  ui.write("  Will change:");
  if (changing.length === 0) {
    ui.dim("    (nothing — already at target version)");
    return await exit(0);
  }
  for (const p of changing) {
    const verLine =
      p.current && !p.rootUnchanged
        ? `${pc.dim(p.current)} → ${pc.green(p.next)}`
        : p.rootUnchanged
          ? pc.dim("(root unchanged)")
          : pc.green(p.next);
    ui.write(`    ${p.target.label}: ${verLine}  ${pc.dim(p.relPath)}`);
    if (p.innerWouldChange > 0) {
      ui.write(`      ${pc.dim(`+ ${p.innerWouldChange} plugins[] entry version(s)`)}`);
    }
  }
  ui.blank();

  if (!yes) {
    const ok = await confirm({
      message: `Apply ${changing.length} bump(s)?`,
      initialValue: true,
      output: process.stderr,
    });
    if (isCancel(ok) || !ok) {
      ui.dim("  cancelled — no files written");
      return await exit(0);
    }
  }

  let bumpedCount = 0;
  for (const p of changing) {
    if (applyBump(p, bumpType as string)) {
      if (p.current && !p.rootUnchanged) {
        ui.success(`${p.target.label}: ${pc.dim(p.current)} → ${pc.green(p.next)}`);
      } else {
        ui.success(`${p.target.label}: ${pc.green(p.next)}`);
      }
      ui.info(`    ${p.relPath}`);
      if (p.innerWouldChange > 0) {
        ui.info(`    + bumped ${p.innerWouldChange} entry version(s) inside plugins[]`);
      }
      bumpedCount++;
    }
  }

  posthog.capture({
    distinctId: anonymousId,
    event: "version_bumped",
    properties: {
      bump_type: bumpType as string,
      files_bumped: bumpedCount,
      scope,
      mode: "interactive",
    },
  });
  ui.blank();
  ui.info(`Done. Bumped ${bumpedCount} file(s).`);
  ui.dim("  Next: doraval validate .");
  await exit(0);
}

async function runNonInteractive(rawType: string, targetPath: string, scope: Scope): Promise<void> {
  const root = resolve(targetPath);
  if (!existsSync(root)) {
    ui.fail(`Path does not exist: ${root}`);
    return await exit(1);
  }

  ui.heading("doraval bump");
  ui.info(`  scanning: ${root}`);
  ui.info(`  scope: ${scope}   (use --only plugin or --only marketplace to narrow; Cursor/Copilot metadata.version supported)`);

  const targets = filterByScope(walkForTargets(root), scope);

  if (targets.length === 0) {
    ui.fail("No matching files found under the scope.");
    printLookedFor();
    return await exit(1);
  }

  ui.info(`  matched ${targets.length} file(s)`);

  let bumpedCount = 0;
  for (const t of targets) {
    const plans = planBumps([t], root, rawType);
    const plan = plans[0];
    if (!plan) {
      ui.warnItem(`skipped (invalid JSON): ${relative(root, t.file)}`);
      continue;
    }
    if (plan.rootUnchanged && plan.innerWouldChange === 0) {
      ui.dim(`  • ${t.label}  ${plan.current || "(no version)"}  (no change)  [${plan.relPath}]`);
      continue;
    }

    // Re-validate bump type once so bad types fail early with a clear message
    try {
      bumpVersion(plan.current, rawType);
    } catch (err: any) {
      ui.fail(err.message || String(err));
      return await exit(1);
    }

    if (!applyBump(plan, rawType)) {
      ui.warnItem(`skipped (could not locate version field to update): ${plan.relPath}`);
      continue;
    }

    if (plan.current && !plan.rootUnchanged) {
      ui.success(`${t.label}: ${pc.dim(plan.current)} → ${pc.green(plan.next)}`);
    } else if (!plan.rootUnchanged) {
      ui.success(`${t.label}: ${pc.green(plan.next)}`);
    } else {
      ui.success(`${t.label} (no root version)`);
    }
    ui.info(`    ${plan.relPath}`);
    if (plan.innerWouldChange > 0) {
      ui.info(`    + bumped ${plan.innerWouldChange} entry version(s) inside plugins[]`);
    }
    bumpedCount++;
  }

  ui.blank();

  if (bumpedCount === 0) {
    ui.info("All matched files were already at the target version.");
  } else {
    posthog.capture({
      distinctId: anonymousId,
      event: "version_bumped",
      properties: {
        bump_type: rawType,
        files_bumped: bumpedCount,
        scope,
        mode: "non_interactive",
      },
    });
    ui.info(`Done. Bumped ${bumpedCount} file(s).`);
    ui.dim("  Next: doraval validate " + (targetPath === "." ? "." : targetPath));
  }
  await exit(0);
}
