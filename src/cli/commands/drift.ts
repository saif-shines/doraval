import { defineCommand } from "citty";
import { existsSync } from "fs";
import { resolve } from "path";
import pc from "picocolors";
import { parseFrontmatter } from "../../core/frontmatter.js";
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
    const skillMd = resolve(fullPath, "SKILL.md");

    if (!existsSync(skillMd)) {
      console.error(
        `${pc.red("✗")} No SKILL.md found at ${targetPath}`
      );
      process.exit(1);
    }

    const raw = await Bun.file(skillMd).text();
    let parsed;
    try {
      parsed = parseFrontmatter(raw);
    } catch {
      console.error(
        `${pc.red("✗")} Failed to parse YAML frontmatter in SKILL.md`
      );
      process.exit(1);
    }

    const desc = String(parsed.data.description || "");
    const when = String(parsed.data.when_to_use || "");
    // Concatenate so the Trigger check in analyzeDrift sees activation phrases from either field (current spec).
    const { drifts, driftCount, total } = analyzeDrift({
      description: (desc + " " + when).trim(),
      content: parsed.content,
    });

    if (args.format === "json") {
      console.log(
        JSON.stringify({ path: targetPath, driftCount, total, drifts }, null, 2)
      );
    } else {
      console.error(
        `\n  ${pc.bold("doraval skill drift")} — Measuring rubric drift\n`
      );
      console.error(`  Path:  ${targetPath}\n`);

      for (const d of drifts) {
        const icon = d.drifted ? pc.yellow("↗") : pc.green("·");
        const cat = d.drifted
          ? pc.yellow(d.category.padEnd(10))
          : pc.dim(d.category.padEnd(10));
        console.error(`  ${icon} ${cat} ${d.detail}`);
      }

      if (driftCount === 0) {
        console.error(
          `\n  ${pc.green("No drift detected.")} Skill aligns with rubric standards.\n`
        );
      } else {
        console.error(
          `\n  ${pc.yellow(`${driftCount}/${total}`)} rubric areas have drifted.\n`
        );
      }
    }

    if (args.ci && driftCount > 0) {
      process.exit(1);
    }

    process.exit(0);
  },
});
