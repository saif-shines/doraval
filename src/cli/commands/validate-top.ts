import { defineCommand } from "citty";
import { existsSync } from "fs";
import { resolve } from "path";
import pc from "picocolors";
import { ui } from "../out.js";
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
    const remote = parseRemoteUrl(args.path);
    let fullPath: string;
    let cleanup: (() => void) | undefined;

    if (remote) {
      if (!hasGitCli()) {
        ui.fail("git is not installed. Remote validation requires git to clone the repository.");
        ui.info("  Install git and try again.");
        process.exit(1);
      }
      ui.info(`\n  Cloning ${pc.dim(args.path)}...`);
      try {
        const result = await cloneToTemp(remote);
        cleanup = result.cleanup;
        if (remote.subpath) {
          const safe = sanitizeSubpath(remote.subpath);
          if (!safe) {
            if (cleanup) cleanup();
            ui.fail(`Invalid subdirectory in remote URL: ${remote.subpath}`);
            process.exit(1);
          }
          fullPath = resolve(result.dir, safe);
        } else {
          fullPath = result.dir;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        ui.fail(msg);
        process.exit(1);
      }

      if (!existsSync(fullPath)) {
        cleanup!();
        ui.fail(`Subdirectory not found in repo: ${remote.subpath}`);
        process.exit(1);
      }
    } else {
      fullPath = resolve(args.path);
      if (!existsSync(fullPath)) {
        ui.fail(
          `Path not found: ${args.path}\n\nCheck that the path is correct and the directory exists.`
        );
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
        ui.fail(
          `No validator matched this directory: ${args.path}\n\n` +
            `Available providers:\n` +
            providers.map((p) => {
              const pvs = validators.filter((v) => v.provider === p);
              return `  ${pc.bold(p)}\n` + pvs.map((v) => `    • ${pc.dim(v.id)} — ${v.description}`).join("\n");
            }).join("\n") +
            `\n\nUse ${pc.dim("--for <provider>")} or ${pc.dim("--for <provider:type>")} to target explicitly.`
        );
        process.exit(1);
      }

      const allResults: { id: string; name: string; result: ValidateResult }[] = [];
      let totalErrors = 0;

      for (const v of matched) {
        const result = await v.validate(fullPath, opts);
        allResults.push({ id: v.id, name: v.name, result });
        totalErrors += result.errors.length;
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
        for (const { id, name, result } of allResults) {
          ui.write(
            `\n  ${pc.bold("dora validate")} — ${pc.white(name)} ${pc.dim(`(${id})`)}\n`
          );
          ui.info(`  Path:  ${args.path}\n`);

          for (const p of result.passes) {
            ui.pass(p);
          }
          for (const w of result.warnings) {
            ui.warnItem(w);
          }
          for (const e of result.errors) {
            ui.failItem(e);
          }

          if (result.errors.length === 0 && result.warnings.length === 0) {
            ui.write(`\n  ${pc.green("✓")} ${pc.white("All checks passed.")}\n`);
          } else {
            ui.info(
              `\n  Result: ${result.errors.length} error(s), ${result.warnings.length} warning(s)\n`
            );
          }
        }
      }

      process.exit(totalErrors > 0 ? 1 : 0);
    } finally {
      cleanup?.();
    }
  },
});
