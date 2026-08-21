import { defineCommand } from "citty";
import { homedir } from "os";
import { resolve } from "path";
import { confirm, isCancel, select } from "@clack/prompts";
import { applyRemove, planRemove, resolveSkillName, type SkillMatch } from "../../../core/skill-remove.js";
import { canPromptInteractively } from "../fix.js";
import { isAgentCaller, refuseAgentWrite, shouldBlockAgentWrite } from "../../agent-detect.js";
import { ui, resolveOutputMode, outJson, emitError, summaryLine, nextAction } from "../../out.js";
import { exit } from "../../render/exit.js";

const AGENTS = new Set(["claude", "cursor", "copilot", "codex", "grok"]);

export default defineCommand({
  meta: {
    name: "remove",
    description: [
      "Delete an Authored Skill by name",
      "",
      "Examples:",
      "  dora skill remove ghost --dry-run",
      "  dora skill remove ghost --yes",
      "  dora skill remove ghost --for claude --yes",
      "Exit: 0 clean · 1 issues · 2 could not run",
    ].join("\n"),
  },
  args: {
    name: { type: "positional", description: "Skill name or path", required: false },
    for: { type: "string", description: "Target agent: claude | cursor | codex | copilot | grok", alias: "f" },
    global: { type: "boolean", description: "Select a Global Skill when the name clashes", default: false },
    yes: { type: "boolean", description: "Delete without prompting", default: false, alias: "y" },
    "dry-run": { type: "boolean", description: "Show the plan, write nothing", default: false },
    format: { type: "string", description: "Output format: table | json", default: "table" },
    json: { type: "boolean", description: "Alias for --format json", default: false },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: args.ci as boolean, json: args.json as boolean });
    const cwd = args.cwd ? resolve(args.cwd as string) : process.cwd();
    const dryRun = Boolean(args["dry-run"]);
    const yes = Boolean(args.yes);
    const name = ((args.name as string) || "").trim();

    if (shouldBlockAgentWrite({ agent: isAgentCaller(), yes, dryRun })) {
      refuseAgentWrite("dora skill remove --dry-run");
      await exit(2);
      return;
    }

    if (!name) {
      ui.fail("Pass a Skill name.");
      nextAction("dora skill remove <name>");
      await exit(2);
      return;
    }

    const forRaw = args.for as string | undefined;
    if (forRaw && !AGENTS.has(forRaw)) {
      ui.fail(`Unknown agent: ${forRaw}`);
      nextAction("dora skill remove --for claude");
      await exit(1);
      return;
    }

    try {
      let resolved = resolveSkillName({
        name, cwd, home: homedir(), forAgent: forRaw, globalOnly: Boolean(args.global),
      });
      if (resolved.status === "ambiguous") {
        const hits = resolved.matches;
        const canPick = canPromptInteractively(false, false, mode.format) && !isAgentCaller();
        if (canPick) {
          const picked = await select({
            message: `Name "${name}" matches more than one Skill`,
            options: hits.map((m: SkillMatch) => ({
              value: m.dir,
              label: `${m.origin}${m.agent ? ` · ${m.agent}` : ""}  ${m.dir}`,
            })),
            output: process.stderr,
          });
          if (isCancel(picked) || !picked) {
            summaryLine("Nothing deleted.");
            await exit(0);
            return;
          }
          resolved = resolveSkillName({ name: String(picked), cwd, home: homedir() });
        } else {
          const list = hits.map((m) => `${m.origin}${m.agent ? `/${m.agent}` : ""} ${m.dir}`).join("; ");
          ui.fail(`Name "${name}" matches more than one Skill (${list}).`);
          nextAction(`dora skill remove ${name} --for <agent>`);
          await exit(2);
          return;
        }
      }
      const plan = planRemove(resolved);

      if (!plan.ok) {
        if (plan.reason === "none") {
          ui.fail(`No Skill named "${name}".`);
          nextAction("dora skill remove");
          await exit(1);
          return;
        }
        if (plan.reason === "ambiguous") {
          const hits = resolved.status === "ambiguous" ? resolved.matches : [];
          const list = hits.map((m) => `${m.agent ?? m.origin} ${m.dir}`).join(", ");
          ui.fail(`Name "${name}" matches more than one Skill (${list}).`);
          nextAction(`dora skill remove ${name} --for <agent>`);
          await exit(2);
          return;
        }
        if (plan.reason === "imported") {
          ui.fail(`Refusing to remove an Imported Skill (${resolved.status === "imported" ? resolved.match.dir : name}).`);
          nextAction("dora skill remove");
          await exit(1);
          return;
        }
        ui.fail("Only Authored Skills can be deleted. Global Quarantine is a later command.");
        nextAction("dora skill remove");
        await exit(1);
        return;
      }

      if (mode.format === "json") {
        const applied = !dryRun && yes;
        if (applied) applyRemove(plan);
        outJson({ plan, applied });
        await exit(0);
        return;
      }

      ui.blank();
      summaryLine(`${dryRun ? "Would delete" : "Delete"} Authored Skill ${name} (${plan.dir})`);
      if (dryRun) {
        nextAction(`dora skill remove ${name} --yes`);
        await exit(0);
        return;
      }

      const interactive = canPromptInteractively(yes, dryRun, mode.format);
      if (interactive) {
        const ok = await confirm({
          message: `Delete Authored Skill ${name}?`,
          initialValue: false,
          output: process.stderr,
        });
        if (isCancel(ok) || !ok) {
          summaryLine("Nothing deleted.");
          await exit(0);
          return;
        }
      } else if (!yes) {
        ui.fail("Pass --yes to delete, or --dry-run to preview.");
        nextAction(`dora skill remove ${name} --dry-run`);
        await exit(2);
        return;
      }

      applyRemove(plan);
      summaryLine(`Deleted ${plan.dir}`);
      await exit(0);
    } catch (e) {
      emitError(e, mode);
      await exit(2);
    }
  },
});
