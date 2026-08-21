import { defineCommand } from "citty";
import { confirm, isCancel, select } from "@clack/prompts";
import { applyRestore, listQuarantine, planRestore } from "../../../core/skill-remove.js";
import { canPromptInteractively } from "../fix.js";
import { isAgentCaller, refuseAgentWrite, shouldBlockAgentWrite } from "../../agent-detect.js";
import { ui, resolveOutputMode, outJson, emitError, summaryLine, nextAction } from "../../out.js";
import { exit } from "../../render/exit.js";

export default defineCommand({
  meta: {
    name: "restore",
    description: [
      "Restore a Quarantined Global Skill",
      "",
      "Examples:",
      "  dora skill restore ghost --dry-run",
      "  dora skill restore ghost --yes",
      "Exit: 0 clean · 1 issues · 2 could not run",
    ].join("\n"),
  },
  args: {
    name: { type: "positional", description: "Quarantined Skill name", required: false },
    for: { type: "string", description: "Target agent when the name matches more than one record", alias: "f" },
    yes: { type: "boolean", description: "Restore without prompting", default: false, alias: "y" },
    "dry-run": { type: "boolean", description: "Show the plan, write nothing", default: false },
    format: { type: "string", description: "Output format: table | json", default: "table" },
    json: { type: "boolean", description: "Alias for --format json", default: false },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: args.ci as boolean, json: args.json as boolean });
    const dryRun = Boolean(args["dry-run"]);
    const yes = Boolean(args.yes);
    let name = ((args.name as string) || "").trim();

    if (shouldBlockAgentWrite({ agent: isAgentCaller(), yes, dryRun })) {
      refuseAgentWrite("dora skill restore --dry-run");
      await exit(2);
      return;
    }

    try {
      let pickedPlan: ReturnType<typeof planRestore> | undefined;
      if (!name) {
        const known = listQuarantine();
        const canPick = canPromptInteractively(false, false, mode.format) && !isAgentCaller();
        if (!canPick) {
          ui.fail("Pass a Quarantined Skill name.");
          nextAction("dora skill restore <name>");
          await exit(2);
          return;
        }
        if (known.length === 0) {
          summaryLine("Nothing in Quarantine.");
          await exit(0);
          return;
        }
        const picked = await select({
          message: "Restore which Quarantined Skill?",
          options: known.map((r) => ({
            value: r.storedAt,
            label: `${r.name}${r.agent ? ` · ${r.agent}` : ""}  ${r.originalPath}`,
          })),
          output: process.stderr,
        });
        if (isCancel(picked) || !picked) {
          summaryLine("Nothing restored.");
          await exit(0);
          return;
        }
        const byStore = planRestore({ storedAt: String(picked) });
        if (!byStore.ok) {
          ui.fail(`Cannot restore that record (${byStore.reason}).`);
          nextAction("dora skill restore");
          await exit(1);
          return;
        }
        name = byStore.record.name;
        pickedPlan = byStore;
      }

      const plan = pickedPlan ?? planRestore({ name, forAgent: args.for as string | undefined });
      if (!plan.ok) {
        if (plan.reason === "occupied") {
          ui.fail(`Original path is occupied. Not restoring "${name}".`);
          nextAction("Free the original path, then retry dora skill restore");
          await exit(1);
          return;
        }
        if (plan.reason === "ambiguous") {
          ui.fail(`More than one Quarantined Skill named "${name}".`);
          nextAction(`dora skill restore ${name} --for <agent>`);
          await exit(2);
          return;
        }
        ui.fail(`No Quarantined Skill named "${name}".`);
        nextAction("dora skill restore");
        await exit(1);
        return;
      }

      if (mode.format === "json") {
        const applied = !dryRun && yes;
        if (applied) applyRestore(plan);
        outJson({ plan, applied });
        await exit(0);
        return;
      }

      ui.blank();
      summaryLine(`${dryRun ? "Would restore" : "Restore"} ${name} → ${plan.record.originalPath}`);
      if (dryRun) {
        nextAction(`dora skill restore ${name} --yes`);
        await exit(0);
        return;
      }

      const interactive = canPromptInteractively(yes, dryRun, mode.format);
      if (interactive) {
        const ok = await confirm({
          message: `Restore ${name} to ${plan.record.originalPath}?`,
          initialValue: false,
          output: process.stderr,
        });
        if (isCancel(ok) || !ok) {
          summaryLine("Nothing restored.");
          await exit(0);
          return;
        }
      } else if (!yes) {
        ui.fail("Pass --yes to restore, or --dry-run to preview.");
        nextAction(`dora skill restore ${name} --dry-run`);
        await exit(2);
        return;
      }

      applyRestore(plan);
      summaryLine(`Restored ${plan.record.originalPath}`);
      await exit(0);
    } catch (e) {
      emitError(e, mode);
      await exit(2);
    }
  },
});
