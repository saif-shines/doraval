import { defineCommand } from "citty";
import { existsSync } from "fs";
import { resolve } from "path";
import pc from "picocolors";
import { ui, renderValidationReport, guidedError, nextAction } from "../out.js";
import { validators, resolveFor } from "../../validators/index.js";
import type { ValidateOptions, ValidateResult } from "../../validators/types.js";
import { parseRemoteUrl, cloneToTemp, hasGitCli, sanitizeSubpath } from "../../core/remote.js";

export default defineCommand({
  meta: {
    name: "validate",
    description:
      "Auto-detect project type and run matching validators. Accepts a local path or a Git URL (e.g. https://github.com/owner/repo). Use --for <provider>:plugin to see keyword trigger messages.",
  },
  args: {
    path: {
      type: "positional",
      description: "Path or Git URL to validate",
      required: true,
    },
    for: {
      type: "string",
      description: 'Target a provider ("claude") or specific validator ("claude:plugin")',
    },
    format: {
      type: "string",
      alias: "f",
      description: "Output format (json or table)",
      default: "table",
    },
    verbose: {
      type: "boolean",
      alias: "v",
      description: "Show detailed diagnostics",
      default: false,
    },
    ci: {
      type: "boolean",
      description: "Machine-friendly output, non-zero exit on issues",
      default: false,
    },
  },

  async run({ args }) {
    let cleanup: (() => void) | undefined;

    const remote = parseRemoteUrl(args.path);
    let fullPath: string;

    if (remote) {
      if (!hasGitCli()) {
        guidedError({
          context: "Remote validate clones a git repo (or uses gh) so it can inspect its skills, plugins, etc. without you checking it out.",
          problem: "git is not installed",
          solutions: [
            "Install git (macOS: brew install git)",
            "Validate a local checkout instead: dora validate .",
          ],
          next: "dora validate .",
        });
        process.exit(1);
      }
      ui.info(`\n  Cloning ${pc.dim(args.path)}...`);
      try {
        const result = await cloneToTemp(remote);
        cleanup = result.cleanup;
        if (remote.subpath) {
          const safe = sanitizeSubpath(remote.subpath);
          if (!safe) {
            cleanup?.();
            ui.fail(`Invalid subdirectory in remote URL: ${remote.subpath}`);
            process.exit(1);
          }
          fullPath = resolve(result.dir, safe as string);
        } else {
          fullPath = result.dir;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        ui.fail(msg);
        process.exit(1);
      }

      if (!existsSync(fullPath)) {
        cleanup?.();
        ui.fail(`Error (E-VAL-001): Subdirectory not found in repo: ${remote.subpath}`);
        nextAction("dora validate <valid-path-or-url>");
        process.exit(1);
      }
    } else {
      fullPath = resolve(args.path);
      if (!existsSync(fullPath)) {
        ui.fail(`Error (E-VAL-001): Path not found: ${args.path}`);
        ui.info("  Check that the path is correct and the directory exists.");
        nextAction("dora validate .");
        process.exit(1);
      }
    }

    try {
      const opts: ValidateOptions = {
        format: (args.format as "json" | "table") ?? "table",
        verbose: !!args.verbose,
        ci: !!args.ci,
      };

      const { matched: candidates, error } = resolveFor(args.for as string | undefined);
      if (error) {
        ui.fail(error);
        nextAction("dora validate . --for claude   (or another provider)");
        process.exit(1);
      }

      let matched;
      if (args.for && (args.for as string).includes(":")) {
        matched = candidates;
      } else {
        matched = candidates.filter((v) => v.detect(fullPath));
      }

      if (matched.length === 0) {
        const providers = [...new Set(validators.map((v) => v.provider))];
        guidedError({
          context: `dora validate auto-detects skills, plugins, hooks, etc. based on files present. Nothing matched ${args.path}.`,
          problem: "No validator matched this directory",
          solutions: [
            `dora validate . --for <provider>   (e.g. claude, cursor)`,
            "dora providers   (see all supported + keywords)",
          ],
          next: "dora validate . --for claude",
        });
        // still show the list for discoverability
        ui.info(
          `  Available providers:\n` +
            providers.map((p) => {
              const pvs = validators.filter((v) => v.provider === p);
              return `    ${pc.bold(p)}\n` + pvs.map((v) => `      • ${pc.dim(v.id)} — ${v.description}`).join("\n");
            }).join("\n")
        );
        process.exit(1);
      }

      const allResults: { id: string; name: string; result: ValidateResult }[] = [];
      let totalErrors = 0;
      let totalWarnings = 0;

      for (const v of matched) {
        const result = await v.validate(fullPath, opts);
        allResults.push({ id: v.id, name: v.name, result });
        totalErrors += result.errors.length;
        totalWarnings += result.warnings.length;
      }

      if (opts.format === "json") {
        const output = allResults.map((r) => ({
          validator: r.id,
          name: r.name,
          path: args.path,
          ...r.result,
        }));
        console.log(JSON.stringify(output, null, 2));
      } else {
        renderValidationReport(allResults, { path: args.path, verbose: !!args.verbose });
      }

      process.exit(totalErrors > 0 ? 1 : 0);
    } finally {
      cleanup?.();
    }
  },
});
