import { defineCommand } from "citty";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import pc from "picocolors";
import { confirm, isCancel } from "@clack/prompts";
import { reviewSkill, reviewAll } from "../../core/review.js";
import { collectFixes, type FixEdit, type FixResult } from "../../core/fix-engine.js";

import { ui, resolveOutputMode, outJson, emitError, summaryLine, nextAction } from "../out.js";
import { exit } from "../render/exit.js";
import { posthog, anonymousId } from "../../analytics.js";

function renderDiff(diff: string): void {
  for (const line of diff.split("\n")) {
    if (line.startsWith("+")) ui.write(`  ${pc.green(line)}`);
    else if (line.startsWith("-")) ui.write(`  ${pc.red(line)}`);
    else ui.write(`  ${pc.dim(line)}`);
  }
}

/** Interactive confirm is only offered to a human at a real terminal. */
export function canPromptInteractively(
  yes: boolean,
  dryRun: boolean,
  format: string,
  tty: boolean = process.stdin.isTTY === true && process.stderr.isTTY === true
): boolean {
  return !yes && !dryRun && format !== "json" && tty;
}

async function renderMechanical(
  edits: FixEdit[],
  dryRun: boolean,
  yes: boolean,
  interactive: boolean
): Promise<number> {
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
    } else if (interactive) {
      const ok = await confirm({
        message: `Apply: ${edit.description}?`,
        output: process.stderr,
      });
      if (isCancel(ok)) {
        ui.write(`  ${pc.dim("cancelled")}`);
        break;
      }
      if (ok) {
        edit.apply();
        applied++;
        ui.write(`  ${pc.green("✓")} Applied: ${edit.description}`);
      } else {
        ui.write(`  ${pc.dim("skipped")}`);
      }
    } else {
      ui.write(`  ${pc.dim("skipped")} — re-run with ${pc.bold("--yes")} to apply`);
    }
  }
  return applied;
}

interface SkillJudgments {
  path: string;
  judgments: string[];
}

function buildBriefPrompt(perSkill: SkillJudgments[]): string {
  const sections: string[] = ["# Fix these skill issues (judgment required)"];
  for (const s of perSkill) {
    if (s.judgments.length === 0) continue;
    const skillMd = resolve(s.path, "SKILL.md");
    const content = existsSync(skillMd) ? readFileSync(skillMd, "utf-8") : "";
    sections.push(
      "",
      `## Skill: ${s.path}`,
      "",
      "### Issues",
      s.judgments.map((j) => `- ${j}`).join("\n"),
      "",
      "### Current SKILL.md",
      "```markdown",
      content,
      "```"
    );
  }
  sections.push(
    "",
    "When done, verify with: dora review <skill-path> (zero errors expected)."
  );
  return sections.join("\n");
}

export default defineCommand({
  meta: { name: "fix", description: "Apply mechanical review fixes; surface judgment items" },
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
    // Resolve --cwd to an absolute path: it's hashed into the memory
    // project slug (getProjectSlug), so a relative string here would give
    // the same physical project two different slugs depending on how the
    // caller happened to spell --cwd.
    const root = args.cwd ? resolve(args.cwd as string) : process.cwd();
    const target = resolve(root, (args.path as string) || ".");
    const dryRun = (args["dry-run"] as boolean) || false;
    const yes = (args.yes as boolean) || false;
    const brief = (args.brief as boolean) || false;
    const interactive = canPromptInteractively(yes, dryRun, mode.format);

    try {
      const isSkillDir = existsSync(resolve(target, "SKILL.md"));
      const results = isSkillDir
        ? [await reviewSkill(target, { quick: true })]
        : await reviewAll(target, { quick: true });

      let totalMech = 0;
      let totalApplied = 0;
      const allJudgments: string[] = [];
      const perSkill: SkillJudgments[] = [];

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
        perSkill.push({ path: r.path, judgments: fix.judgment });

        if (fix.mechanical.length > 0) {
          if (mode.format === "table") {
            ui.blank();
            ui.heading(`dora fix ${r.path}`);
            summaryLine(`${fix.mechanical.length} fixable issue${fix.mechanical.length === 1 ? "" : "s"} found.`);
            totalApplied += await renderMechanical(fix.mechanical, dryRun, yes, interactive);
          } else if (!dryRun && yes) {
            // JSON mode: apply silently, count
            for (const edit of fix.mechanical) { edit.apply(); totalApplied++; }
          }
        }
      }

      // Exit contract: 1 = issues remain (judgment items OR mechanical fixes
      // found but not applied, e.g. --dry-run or interactive decline). 0 = clean.
      const unapplied = dryRun ? totalMech : totalMech - totalApplied;
      const exitCode = allJudgments.length > 0 || unapplied > 0 ? 1 : 0;
      posthog.capture({
        distinctId: anonymousId,
        event: "fix_applied",
        properties: {
          mechanical_fixes_found: totalMech,
          fixes_applied: totalApplied,
          judgment_items: allJudgments.length,
          dry_run: dryRun,
          format: mode.format,
        },
      });

      if (mode.format === "json") {
        outJson({ mechanical: totalMech, judgment: allJudgments, applied: dryRun ? 0 : totalApplied });
        await exit(exitCode);
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
          const prompt = buildBriefPrompt(perSkill);
          ui.blank();
          ui.write(prompt);
        } else {
          for (const j of allJudgments) ui.write(`    ${pc.yellow("⚠")} ${j}`);
          nextAction("dora fix --brief       copy an agent-ready prompt");
        }
      }

      ui.blank();
      await exit(exitCode);
    } catch (e) {
      emitError(e, mode);
      await exit(2); // could-not-run (internal error or unmet prerequisite)
    }
  },
});