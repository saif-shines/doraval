import { defineCommand } from "citty";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import pc from "picocolors";
import { ui } from "../out.js";
import { loadSkill } from "../../core/skill-validate.js";
import { analyzeDrift } from "../../core/skill-drift.js";
import { runSkillSessions, renderBatchResults } from "../../core/skill-runner.js";

export default defineCommand({
  meta: {
    name: "drift",
    description: "Measure how far a skill has drifted (rubric analysis or by running sessions + evals)",
  },
  args: {
    path: {
      type: "positional",
      description: "Path to skill directory or plugin root",
      required: true,
    },
    for: {
      type: "string",
      description: 'Target a provider ("claude") or specific validator ("claude:skill")',
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
    runs: {
      type: "string",
      description: "Run N sessions with the skill using prompts and show comparative eval results (enables dynamic mode)",
      default: "0",
    },
    prompt: {
      type: "string",
      description: "Prompt to use when running sessions (comma-separated for multiple)",
    },
    "prompts-file": {
      type: "string",
      description: "File with one prompt per line for session runs",
    },
    generate: {
      type: "boolean",
      description: "Auto-generate prompts from the skill when using --runs",
      default: false,
    },
    real: {
      type: "boolean",
      description: "Use real agent CLI (vs internal) for session runs",
      default: false,
    },
  },

  async run({ args }) {
    const targetPath = args.path;
    let skillInput = String(targetPath);
    if (skillInput.endsWith("SKILL.md") || skillInput.endsWith("/SKILL.md")) {
      skillInput = dirname(skillInput);
    }
    const fullPath = resolve(skillInput);
    const loaded = await loadSkill(fullPath);

    if (!loaded.ok) {
      if (loaded.error === "No SKILL.md found") {
        ui.fail(
          `No SKILL.md found at ${targetPath}\n\nCheck that the path points to a skill directory containing SKILL.md.`
        );
      } else {
        ui.fail(loaded.error);
      }
      process.exit(1);
    }

    const numRuns = parseInt(String(args.runs || "0"), 10) || 0;

    if (numRuns > 0) {
      // Dynamic session-based mode: run sessions with the skill + prompts, then eval comparatively
      let prompts: string[] | undefined;
      if (args.prompt) {
        prompts = String(args.prompt).split(",").map((p) => p.trim()).filter(Boolean);
      } else if (args["prompts-file"]) {
        try {
          const content = await Bun.file(String(args["prompts-file"])).text();
          prompts = content.split("\n").map((l) => l.trim()).filter(Boolean);
        } catch (e: any) {
          ui.fail(`Failed to read prompts file: ${e.message}`);
          process.exit(1);
        }
      }

      const result = await runSkillSessions(fullPath, {
        runs: numRuns,
        prompts,
        generate: Boolean(args.generate),
        real: Boolean(args.real),
        verbose: Boolean(args.verbose),
      });

      if (args.format === "json") {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      } else {
        ui.heading("dora skill drift — Session runs + comparative eval");
        ui.info(`  Path: ${targetPath}\n`);
        const table = renderBatchResults(result, Boolean(args.verbose));
        ui.write(table);
        ui.blank();
      }

      if (args.ci && result.summary.drifts > 0) {
        process.exit(1);
      }
      process.exit(0);
    }

    // Original static rubric drift mode
    const { model: parsed } = loaded;

    const desc = String(parsed.data.description || "");
    const when = String(parsed.data.when_to_use || "");
    const { drifts, driftCount, total } = analyzeDrift({
      description: (desc + " " + when).trim(),
      content: parsed.content,
    });

    if (args.format === "json") {
      console.log(
        JSON.stringify({ path: targetPath, driftCount, total, drifts }, null, 2)
      );
    } else {
      ui.heading("dora skill drift — Measuring rubric drift");
      ui.info(`  Path:  ${targetPath}\n`);

      for (const d of drifts) {
        const icon = d.drifted ? pc.yellow("↗") : pc.green("·");
        const cat = d.drifted
          ? pc.yellow(d.category.padEnd(10))
          : pc.dim(d.category.padEnd(10));
        ui.write(`  ${icon} ${cat} ${pc.white(d.detail)}`);
      }

      if (driftCount === 0) {
        ui.write(
          `\n  ${pc.green("No drift detected.")} ${pc.white("Skill aligns with rubric standards.")}\n`
        );
      } else {
        ui.write(
          `\n  ${pc.yellow(`${driftCount}/${total}`)} ${pc.white("rubric areas have drifted.")}\n`
        );
      }
    }

    if (args.ci && driftCount > 0) {
      process.exit(1);
    }

    process.exit(0);
  },
});
