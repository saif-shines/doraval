import { defineCommand } from "citty";
import { resolve } from "path";
import pc from "picocolors";
import { confirm, multiselect, isCancel } from "@clack/prompts";
import { loadManifest, planRestore, applyRestore } from "../../../core/memory-artifacts.js";
import { getProjectSlug } from "../../../core/memory-config.js";
import { runJournalMigrationIfNeeded } from "../../../core/memory-migrate.js";
import { reportMigration } from "./migration-report.js";
import { canPromptInteractively } from "../fix.js";
import { ui, resolveOutputMode, outJson, emitError, summaryLine } from "../../out.js";
import { exit } from "../../render/exit.js";

function renderDiff(diff: string): void {
  for (const line of diff.split("\n")) {
    if (line.startsWith("+")) ui.write(`  ${pc.green(line)}`);
    else if (line.startsWith("-")) ui.write(`  ${pc.red(line)}`);
    else ui.write(`  ${pc.dim(line)}`);
  }
}

export default defineCommand({
  meta: { name: "restore", description: "Restore a stashed file from project memory" },
  args: {
    file: { type: "positional", description: "File to restore (relative to cwd)", required: false },
    yes: { type: "boolean", description: "Skip per-file confirmation", default: false },
    "dry-run": { type: "boolean", description: "Show diffs but write nothing", default: false },
    format: { type: "string", description: "Output format: table | json", default: "table" },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: false });
    const migration = runJournalMigrationIfNeeded();
    if (mode.format !== "json") reportMigration(migration);
    const cwd = args.cwd ? resolve(args.cwd as string) : process.cwd();
    const slug = getProjectSlug(cwd);
    const dryRun = (args["dry-run"] as boolean) || false;
    const yes = (args.yes as boolean) || false;
    const interactive = canPromptInteractively(yes, dryRun, mode.format);

    try {
      let targets: string[];

      if (args.file) {
        targets = [String(args.file)];
      } else {
        const manifest = loadManifest(slug);
        const known = Object.keys(manifest);
        if (known.length === 0) {
          ui.blank();
          summaryLine("Nothing stashed for this project — nothing to restore.");
          await exit(0);
          return;
        }
        if (!interactive) {
          emitError(new Error("Bare `memory restore` requires an interactive terminal — pass a file explicitly (e.g. `dora memory restore notes.md`) in CI."), mode);
          await exit(2);
          return;
        }
        const selected = await multiselect({
          message: "Select files to restore from project memory",
          options: known.map((k) => ({ value: k, label: k })),
          required: false,
          output: process.stderr,
        });
        if (isCancel(selected) || (selected as string[]).length === 0) {
          ui.blank();
          summaryLine("No files selected — nothing restored.");
          await exit(0);
          return;
        }
        targets = selected as string[];
      }

      let restored = 0;
      const notFound: string[] = [];

      for (const rel of targets) {
        const plan = planRestore(cwd, slug, rel);
        if (!plan.ok) {
          notFound.push(plan.error);
          continue;
        }

        if (mode.format === "table") {
          ui.blank();
          ui.write(`  ${pc.dim(plan.relativePath)}${plan.isNew ? pc.dim(" (new file)") : ""}`);
          ui.write(`  ${"─".repeat(Math.min(plan.relativePath.length, 40))}`);
          renderDiff(plan.diff);
          ui.blank();
        }

        if (dryRun) continue;

        if (yes) {
          applyRestore(cwd, slug, plan.relativePath);
          restored++;
          if (mode.format === "table") ui.write(`  ${pc.green("✓")} Restored: ${plan.relativePath}`);
        } else if (interactive) {
          const ok = await confirm({ message: `Restore: ${plan.relativePath}?`, output: process.stderr });
          if (isCancel(ok)) {
            ui.write(`  ${pc.dim("cancelled")}`);
            break;
          }
          if (ok) {
            applyRestore(cwd, slug, plan.relativePath);
            restored++;
            ui.write(`  ${pc.green("✓")} Restored: ${plan.relativePath}`);
          } else {
            ui.write(`  ${pc.dim("skipped")}`);
          }
        } else {
          // non-interactive, no --yes: explicit --file path in CI without --yes
          ui.write(`  ${pc.dim("skipped")} — re-run with ${pc.bold("--yes")} to apply`);
        }
      }

      if (mode.format === "json") {
        outJson({ restored, notFound, dryRun });
        await exit(notFound.length > 0 ? 1 : 0);
        return;
      }

      ui.blank();
      summaryLine(dryRun ? `${targets.length - notFound.length} file(s) would be restored (--dry-run)` : `${restored} file(s) restored`);
      for (const err of notFound) ui.fail(err);
      ui.blank();

      await exit(notFound.length > 0 ? 1 : 0);
    } catch (e) {
      emitError(e, mode);
      await exit(2);
    }
  },
});
