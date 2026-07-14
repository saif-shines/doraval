import { defineCommand } from "citty";
import { resolve } from "path";
import pc from "picocolors";
import { confirm, select, isCancel } from "@clack/prompts";
import {
  applyReconcile,
  diffEdit,
  planReconcile,
  type ReconcilePlan,
} from "../../core/reconcile.js";
import type { Contradiction, ResolutionOption } from "../../core/cross-agent.js";
import { canPromptInteractively } from "./fix.js";
import { ui, resolveOutputMode, outJson, emitError, summaryLine, nextAction, renderCheck } from "../out.js";
import { preflight, reconcilePreflightMessage } from "../preflight.js";
import { exit } from "../render/exit.js";

function renderDiff(diff: string): void {
  for (const line of diff.split("\n")) {
    if (line.startsWith("+")) ui.write(`  ${pc.green(line)}`);
    else if (line.startsWith("-")) ui.write(`  ${pc.red(line)}`);
    else ui.write(`  ${pc.dim(line)}`);
  }
}

function recommended(cx: Contradiction): ResolutionOption {
  return (
    cx.resolution.find((r) => r.recommended) ??
    cx.resolution[0] ?? { action: "skip", label: "skip" }
  );
}

export default defineCommand({
  meta: {
    name: "reconcile",
    description: "Settle cross-agent contradictions (shared AGENTS.md, strip conflicts)",
  },
  args: {
    apply: {
      type: "boolean",
      description: "Non-interactive: take each recommended resolution",
      default: false,
    },
    "dry-run": {
      type: "boolean",
      description: "List contradictions and planned edits, write nothing",
      default: false,
    },
    yes: {
      type: "boolean",
      description: "Skip final confirmation when applying",
      default: false,
    },
    format: { type: "string", description: "Output format: table | json", default: "table" },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: false });
    const cwd = args.cwd ? resolve(args.cwd as string) : process.cwd();
    const dryRun = Boolean(args["dry-run"]);
    const applyFlag = Boolean(args.apply);
    const yes = Boolean(args.yes) || applyFlag;
    preflight(mode, reconcilePreflightMessage({ dryRun, apply: applyFlag }));
    const interactive = canPromptInteractively(yes, dryRun, mode.format);

    try {
      let plan: ReconcilePlan;

      if (interactive && !applyFlag && !dryRun) {
        // First pass: list with recommended, let user pick per item
        const preview = planReconcile(cwd);
        if (preview.nothingToDo) {
          if (mode.format === "json") {
            outJson({ nothingToDo: true, contradictions: [], applied: false });
          } else {
            ui.blank();
            ui.success("Nothing to reconcile — no cross-agent contradictions found.");
            summaryLine("clean");
          }
          await exit(0);
          return;
        }

        const picks = new Map<string, ResolutionOption>();
        ui.blank();
        ui.heading("dora reconcile");
        ui.blank();
        ui.dim(`  ${preview.contradictions.length} contradiction(s)`);
        ui.blank();

        for (const cx of preview.contradictions) {
          ui.write(`  ${pc.bold(cx.id)}  ${cx.severity === "conflict" ? pc.red(cx.severity) : pc.yellow(cx.severity)}`);
          ui.write(`    ${cx.message}`);
          ui.write(`    ${pc.dim(cx.sources.map((s) => s.file).join(", "))}`);

          // clack select needs string values — use index
          const labels = cx.resolution.map((r, i) => ({
            value: String(i),
            label: r.recommended ? `${r.label} (recommended)` : r.label,
          }));
          const choice = await select({
            message: `Resolve ${cx.id}`,
            options: labels,
            initialValue: String(Math.max(0, cx.resolution.findIndex((r) => r.recommended))),
            output: process.stderr,
          });
          if (isCancel(choice)) {
            ui.write(`  ${pc.dim("cancelled")}`);
            summaryLine("nothing written");
            await exit(0);
            return;
          }
          picks.set(cx.id, cx.resolution[Number(choice)] ?? recommended(cx));
          ui.blank();
        }

        plan = planReconcile(cwd, (cx) => picks.get(cx.id) ?? recommended(cx));
      } else {
        plan = planReconcile(cwd);
      }

      if (mode.format === "json") {
        let written: string[] = [];
        if (!plan.nothingToDo && !dryRun && (applyFlag || yes)) {
          written = applyReconcile(plan);
        }
        outJson({
          nothingToDo: plan.nothingToDo,
          contradictions: plan.contradictions,
          items: plan.items.map((i) => ({
            id: i.contradiction.id,
            kind: i.contradiction.kind,
            chosen: i.chosen,
            skipReason: i.skipReason,
            editFiles: i.edits.map((e) => e.file),
          })),
          fileEdits: plan.fileEdits.map((e) => ({
            file: e.file,
            description: e.description,
            diff: diffEdit(e),
          })),
          dryRun,
          applied: written.length > 0,
          written,
        });
        await exit(0);
        return;
      }

      // human table
      ui.blank();
      ui.heading("dora reconcile");
      ui.blank();

      if (plan.nothingToDo) {
        ui.success("Nothing to reconcile — no cross-agent contradictions found.");
        summaryLine("clean");
        await exit(0);
        return;
      }

      for (const item of plan.items) {
        const cx = item.contradiction;
        const mark = item.skipReason ? "warn" : "ok";
        renderCheck(mark, `${cx.id}  ${cx.message}`);
        ui.write(`    → ${item.skipReason ? pc.dim(item.skipReason) : item.chosen.label}`);
      }

      if (plan.fileEdits.length > 0) {
        ui.blank();
        ui.heading("Planned edits");
        for (const edit of plan.fileEdits) {
          ui.blank();
          ui.write(`  ${pc.dim(edit.file)}  ${pc.dim(edit.description)}`);
          ui.write(`  ${"─".repeat(40)}`);
          renderDiff(diffEdit(edit));
        }
      }

      ui.blank();

      if (dryRun) {
        summaryLine(
          `${plan.contradictions.length} contradiction(s), ${plan.fileEdits.length} file(s) would change (--dry-run)`,
        );
        await exit(0);
        return;
      }

      if (plan.fileEdits.length === 0) {
        summaryLine("nothing to write (all skipped or judgment-only)");
        await exit(0);
        return;
      }

      let doApply = applyFlag || yes;
      if (!doApply && interactive) {
        // already chose per-item above — still confirm write
        const ok = await confirm({
          message: `Apply ${plan.fileEdits.length} file edit(s)?`,
          output: process.stderr,
        });
        if (isCancel(ok) || !ok) {
          ui.write(`  ${pc.dim("cancelled")}`);
          summaryLine("nothing written");
          await exit(0);
          return;
        }
        doApply = true;
      }

      if (!doApply) {
        ui.write(`  ${pc.dim("skipped")} — re-run with ${pc.bold("--apply")} or ${pc.bold("--yes")} to write`);
        summaryLine("nothing written");
        await exit(0);
        return;
      }

      const written = applyReconcile(plan);
      for (const f of written) {
        ui.write(`  ${pc.green("✓")} wrote ${f}`);
      }
      nextAction("dora    # rescan — contradictions should be gone or reduced");
      summaryLine(`${written.length} file(s) updated`);
      await exit(0);
    } catch (e) {
      emitError(e, mode);
      await exit(2);
    }
  },
});
