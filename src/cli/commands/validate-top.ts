import { defineCommand } from "citty";
import { existsSync } from "fs";
import { resolve } from "path";
import pc from "picocolors";
import { validators, resolveFor } from "../../validators/index.js";
import type { ValidateOptions, ValidateResult } from "../../validators/types.js";
import { parseRemoteUrl, cloneToTemp } from "../../core/remote.js";

export default defineCommand({
  meta: {
    name: "validate",
    description:
      "Auto-detect project type and run matching validators. Accepts a local path or a Git URL (e.g. https://github.com/owner/repo)",
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
    // Resolve path: remote URL or local directory
    const remote = parseRemoteUrl(args.path);
    let fullPath: string;
    let cleanup: (() => void) | undefined;

    if (remote) {
      console.error(`\n  Cloning ${pc.dim(args.path)}...`);
      try {
        const result = await cloneToTemp(remote);
        fullPath = remote.subpath ? resolve(result.dir, remote.subpath) : result.dir;
        cleanup = result.cleanup;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${pc.red("✗")} ${msg}`);
        process.exit(1);
      }

      if (!existsSync(fullPath)) {
        cleanup!();
        console.error(
          `${pc.red("✗")} Subdirectory not found in repo: ${remote.subpath}`
        );
        process.exit(1);
      }
    } else {
      fullPath = resolve(args.path);
      if (!existsSync(fullPath)) {
        console.error(
          `${pc.red("✗")} Path not found: ${args.path}\n\nCheck that the path is correct and the directory exists.`
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

      // Resolve which validators to run
      const { matched: candidates, error } = resolveFor(args.for as string | undefined);
      if (error) {
        console.error(`${pc.red("✗")} ${error}`);
        process.exit(1);
      }

      // If --for targets a specific id, skip detection — run it directly.
      // If --for targets a provider (or omitted), run detection on candidates.
      let matched;
      if (args.for && (args.for as string).includes(":")) {
        matched = candidates; // exact match, no detection needed
      } else {
        matched = candidates.filter((v) => v.detect(fullPath));
      }

      if (matched.length === 0) {
        const providers = [...new Set(validators.map((v) => v.provider))];
        console.error(
          `${pc.red("✗")} No validator matched this directory: ${args.path}\n\n` +
            `Available providers:\n` +
            providers.map((p) => {
              const pvs = validators.filter((v) => v.provider === p);
              return `  ${pc.bold(p)}\n` + pvs.map((v) => `    • ${pc.dim(v.id)} — ${v.description}`).join("\n");
            }).join("\n") +
            `\n\nUse ${pc.dim("--for <provider>")} or ${pc.dim("--for <provider:type>")} to target explicitly.`
        );
        process.exit(1);
      }

      // Run matched validators and collect results
      const allResults: { id: string; name: string; result: ValidateResult }[] = [];
      let totalErrors = 0;

      for (const v of matched) {
        const result = await v.validate(fullPath, opts);
        allResults.push({ id: v.id, name: v.name, result });
        totalErrors += result.errors.length;
      }

      // Output
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
          console.error(
            `\n  ${pc.bold("dora validate")} — ${name} ${pc.dim(`(${id})`)}\n`
          );
          console.error(`  Path:  ${args.path}\n`);

          for (const p of result.passes) {
            console.error(`  ${pc.green("✓")} ${p}`);
          }
          for (const w of result.warnings) {
            console.error(`  ${pc.yellow("⚠")} ${w}`);
          }
          for (const e of result.errors) {
            console.error(`  ${pc.red("✗")} ${e}`);
          }

          console.error(
            `\n  Result: ${result.errors.length} error(s), ${result.warnings.length} warning(s)\n`
          );
        }
      }

      process.exit(totalErrors > 0 ? 1 : 0);
    } finally {
      cleanup?.();
    }
  },
});