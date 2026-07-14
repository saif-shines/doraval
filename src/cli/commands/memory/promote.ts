import { defineCommand } from "citty";
import { resolve } from "path";
import pc from "picocolors";
import { confirm, isCancel } from "@clack/prompts";
import { applyPromote, planPromote, DEFAULT_MIN_WEIGHT } from "../../../core/memory-promote.js";
import { runJournalMigrationIfNeeded } from "../../../core/memory-migrate.js";
import { reportMigration } from "./migration-report.js";
import { canPromptInteractively } from "../fix.js";
import { ui, resolveOutputMode, outJson, emitError, summaryLine, nextAction } from "../../out.js";
import { exit } from "../../render/exit.js";

function renderDiff(diff: string): void {
  for (const line of diff.split("\n")) {
    if (line.startsWith("+")) ui.write(`  ${pc.green(line)}`);
    else if (line.startsWith("-")) ui.write(`  ${pc.red(line)}`);
    else ui.write(`  ${pc.dim(line)}`);
  }
}

export default defineCommand({
  meta: {
    name: "promote",
    description: "Promote high-weight principles into AGENTS.md",
  },
  args: {
    weight: {
      type: "string",
      description: `Minimum weight to promote (default ${DEFAULT_MIN_WEIGHT})`,
      default: String(DEFAULT_MIN_WEIGHT),
    },
    yes: { type: "boolean", description: "Apply without confirmation", default: false },
    "dry-run": { type: "boolean", description: "Show the planned AGENTS.md diff, write nothing", default: false },
    format: { type: "string", description: "Output format: table | json", default: "table" },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: false });
    const migration = runJournalMigrationIfNeeded();
    if (mode.format !== "json") reportMigration(migration);
    const cwd = args.cwd ? resolve(args.cwd as string) : process.cwd();
    const dryRun = Boolean(args["dry-run"]);
    const yes = Boolean(args.yes);
    const interactive = canPromptInteractively(yes, dryRun, mode.format);
    const minWeight = Math.max(1, Math.min(10, Number(args.weight) || DEFAULT_MIN_WEIGHT));

    try {
      const plan = planPromote(cwd, { minWeight });

      if (mode.format === "json") {
        let applied = false;
        if (!plan.noop && !dryRun && yes) {
          applyPromote(plan);
          applied = true;
        }
        outJson({
          noop: plan.noop,
          minWeight: plan.minWeight,
          candidates: plan.candidates.map((c) => ({
            id: c.principle.id,
            title: c.principle.title,
            weight: c.principle.weight,
            reason: c.reason,
          })),
          alreadyPresent: plan.alreadyPresent.map((p) => ({ id: p.id, title: p.title, weight: p.weight })),
          file: plan.file,
          isNewFile: plan.isNewFile,
          diff: plan.diff,
          dryRun,
          applied,
          promoted: applied ? plan.candidates.map((c) => c.principle.title) : [],
        });
        await exit(0);
        return;
      }

      ui.blank();
      ui.heading("dora memory promote");
      ui.blank();

      if (plan.noop) {
        if (plan.alreadyPresent.length > 0) {
          ui.success(`All weight ≥ ${minWeight} principles already reflected in AGENTS.md`);
          for (const p of plan.alreadyPresent) {
            ui.write(`  ${pc.dim(`w${p.weight}`)}  ${p.title}`);
          }
        } else {
          ui.dim(`  No active principles with weight ≥ ${minWeight}.`);
          nextAction(`dora memory add "Your hard rule" --weight 8`);
        }
        ui.blank();
        summaryLine("nothing to promote");
        await exit(0);
        return;
      }

      ui.write(`  ${pc.dim(plan.file)}${plan.isNewFile ? pc.dim(" (new file)") : ""}`);
      ui.write(`  Promoting ${plan.candidates.length} principle(s) (weight ≥ ${minWeight}):`);
      for (const c of plan.candidates) {
        ui.write(`    ${pc.red(`w${c.principle.weight}`)}  ${c.principle.title}`);
      }
      ui.blank();
      ui.write(`  ${"─".repeat(40)}`);
      renderDiff(plan.diff);
      ui.blank();

      if (dryRun) {
        summaryLine(`${plan.candidates.length} principle(s) would be promoted (--dry-run)`);
        await exit(0);
        return;
      }

      let applied = false;
      if (yes) {
        applyPromote(plan);
        applied = true;
      } else if (interactive) {
        const ok = await confirm({
          message: `Write ${plan.candidates.length} principle(s) into AGENTS.md?`,
          output: process.stderr,
        });
        if (isCancel(ok) || !ok) {
          ui.write(`  ${pc.dim("cancelled")}`);
          summaryLine("nothing written");
          await exit(0);
          return;
        }
        applyPromote(plan);
        applied = true;
      } else {
        ui.write(`  ${pc.dim("skipped")} — re-run with ${pc.bold("--yes")} to apply`);
        summaryLine("nothing written (pass --yes)");
        await exit(0);
        return;
      }

      if (applied) {
        ui.write(`  ${pc.green("✓")} Updated ${plan.file}`);
        nextAction("dora review AGENTS.md");
        summaryLine(`${plan.candidates.length} principle(s) promoted → AGENTS.md`);
      }
      await exit(0);
    } catch (e) {
      emitError(e, mode);
      await exit(2);
    }
  },
});
