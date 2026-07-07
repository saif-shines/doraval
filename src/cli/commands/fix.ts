import { defineCommand } from "citty";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import pc from "picocolors";
import { reviewSkill, reviewAll } from "../../core/review.js";
import { collectFixes, type FixEdit, type FixResult } from "../../core/fix-engine.js";
import { isDoravalError } from "../../core/errors.js";
import { ui, resolveOutputMode, outJson, emitError, summaryLine, nextAction } from "../out.js";
import { exit } from "../render/exit.js";

function renderDiff(diff: string): void {
  for (const line of diff.split("\n")) {
    if (line.startsWith("+")) ui.write(`  ${pc.green(line)}`);
    else if (line.startsWith("-")) ui.write(`  ${pc.red(line)}`);
    else ui.write(`  ${pc.dim(line)}`);
  }
}

function renderMechanical(edits: FixEdit[], dryRun: boolean, yes: boolean): number {
  let applied = 0;
  for (const edit of edits) {
    ui.blank();
    ui.write(`  ${pc.dim(edit.file)}`);
    ui.write(`  ${"─".repeat(Math.min(edit.file.length, 40))}`);
    renderDiff(edit.diff);
    ui.blank();

    if (dryRun) continue;
    if (yes) {
      edit.apply();
      applied++;
      ui.write(`  ${pc.green("✓")} Applied: ${edit.description}`);
    } else {
      ui.write(`  Apply? [Y/n] → use ${pc.bold("--yes")} to auto-approve`);
    }
  }
  return applied;
}

function buildBriefPrompt(judgments: string[], skillDir: string): string {
  const skillMd = resolve(skillDir, "SKILL.md");
  const content = existsSync(skillMd) ? readFileSync(skillMd, "utf-8") : "";
  const issues = judgments.map((j) => `- ${j}`).join("\n");
  return [
    "# Fix these skill issues (judgment required)",
    "",
    "## Issues",
    issues,
    "",
    "## Current SKILL.md",
    "```markdown",
    content,
    "```",
  ].join("\n");
}

export default defineCommand({
  meta: { name: "fix", description: "Auto-fix review findings: apply mechanical fixes, surface judgment items" },
  args: {
    path: { type: "positional", description: "Skill dir or project root", required: false, default: "." },
    yes: { type: "boolean", description: "Pre-approve all fixes (for agents/CI)", default: false },
    "dry-run": { type: "boolean", description: "Show diffs but write nothing", default: false },
    brief: { type: "boolean", description: "Emit an agent-ready prompt for judgment fixes", default: false },
    format: { type: "string", description: "Output format: table | json", default: "table" },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: args.ci as boolean });
    const root = (args.cwd as string) || process.cwd();
    const target = resolve(root, (args.path as string) || ".");
    const dryRun = (args["dry-run"] as boolean) || false;
    const yes = (args.yes as boolean) || false;
    const brief = (args.brief as boolean) || false;

    try {
      const isSkillDir = existsSync(resolve(target, "SKILL.md"));
      const results = isSkillDir
        ? [await reviewSkill(target, { quick: true })]
        : await reviewAll(target, { quick: true });

      let totalMech = 0;
      let totalApplied = 0;
      const allJudgments: string[] = [];

      for (const r of results) {
        const allFindings = [
          ...r.tiers.structure.findings,
          ...r.tiers.heuristics.findings,
          ...(r.tiers.llm?.findings ?? []),
          ...(r.tiers.sessions?.findings ?? []),
        ];
        const fix: FixResult = collectFixes(allFindings, r.path);
        totalMech += fix.mechanical.length;
        allJudgments.push(...fix.judgment);

        if (mode.format === "table" && fix.mechanical.length > 0) {
          ui.blank();
          ui.heading(`dora fix ${r.path}`);
          summaryLine(`${fix.mechanical.length} fixable issue${fix.mechanical.length === 1 ? "" : "s"} found.`);
          totalApplied += renderMechanical(fix.mechanical, dryRun, yes);
        }
      }

      if (mode.format === "json") {
        outJson({ mechanical: totalMech, judgment: allJudgments, applied: !dryRun && yes });
        await exit(allJudgments.length > 0 ? 1 : 0);
        return;
      }

      ui.blank();
      if (dryRun) {
        summaryLine(`${totalMech} fix${totalMech === 1 ? "" : "es"} would be applied (--dry-run)`);
      } else {
        summaryLine(`${totalApplied} fix${totalApplied === 1 ? "" : "es"} applied`);
      }

      if (allJudgments.length > 0) {
        ui.blank();
        ui.write(`  ${allJudgments.length} issue${allJudgments.length === 1 ? "" : "s"} need${allJudgments.length === 1 ? "s" : ""} judgment (not auto-fixable):`);
        if (brief) {
          const prompt = buildBriefPrompt(allJudgments, target);
          ui.blank();
          ui.write(prompt);
        } else {
          for (const j of allJudgments) ui.write(`    ${pc.yellow("⚠")} ${j}`);
          nextAction("dora fix --brief       copy an agent-ready prompt");
        }
      }

      ui.blank();
      await exit(allJudgments.length > 0 ? 1 : 0);
    } catch (e) {
      emitError(e, mode);
      await exit(isDoravalError(e) ? 2 : 1);
    }
  },
});