import { defineCommand } from "citty";
import { existsSync } from "fs";
import { resolve } from "path";
import pc from "picocolors";
import { ui } from "../out.js";
import { loadSkill } from "../../core/skill-validate.js";
import { analyzeDrift } from "../../core/skill-drift.js";

export default defineCommand({
  meta: {
    name: "drift",
    description: "Measure how far a skill has drifted from rubric standards",
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
  },

  async run({ args }) {
    const targetPath = args.path;
    const fullPath = resolve(targetPath);
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
