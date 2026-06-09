import { defineCommand } from "citty";
import { existsSync } from "fs";
import { resolve } from "path";
import pc from "picocolors";
import { ui } from "../out.js";
import { parseFrontmatter } from "../../core/frontmatter.js";
import { validateSkillModel } from "../../core/skill-validate.js";

const OPTIONAL_DIRS = ["references", "scripts", "assets"] as const;

export default defineCommand({
  meta: {
    name: "validate",
    description: "Validate structure and schema of a skill or plugin",
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

    if (!existsSync(fullPath)) {
      ui.fail(
        `Path not found: ${targetPath}\n\nCheck that the path is correct and the directory exists.`
      );
      process.exit(1);
    }

    const skillMd = resolve(fullPath, "SKILL.md");
    if (!existsSync(skillMd)) {
      ui.fail(
        `No skill or plugin found at ${targetPath}\n\nSearched for:\n  • SKILL.md (Agent Skills spec)\n  • .claude-plugin/plugin.json (Claude Code plugin)\n\nTry:\n  • Check the path points to a skill or plugin directory\n  • Use --for to target a specific validator`
      );
      process.exit(1);
    }

    const raw = await Bun.file(skillMd).text();
    let parsed;
    try {
      parsed = parseFrontmatter(raw);
    } catch {
      ui.fail(
        `Failed to parse YAML frontmatter in SKILL.md\n\nFix the YAML syntax and retry.`
      );
      process.exit(1);
    }

    const existingDirs = OPTIONAL_DIRS.filter((dir) =>
      existsSync(resolve(fullPath, dir))
    );
    const { errors, warnings, passes } = validateSkillModel(parsed, {
      existingDirs: [...existingDirs],
    });

    if (args.format === "json") {
      const result = { path: targetPath, errors, warnings, passes };
      console.log(JSON.stringify(result, null, 2));
    } else {
      ui.heading("dora skill validate — Structural validation");
      ui.info(`  Path:  ${targetPath}\n`);

      for (const p of passes) {
        ui.pass(p);
      }
      for (const w of warnings) {
        ui.warnItem(w);
      }
      for (const e of errors) {
        ui.failItem(e);
      }

      if (errors.length === 0 && warnings.length === 0) {
        ui.write(`\n  ${pc.green("✓")} ${pc.white("All checks passed.")}\n`);
      } else {
        ui.info(
          `\n  Result: ${errors.length} error(s), ${warnings.length} warning(s)\n`
        );
      }
    }

    if (errors.length > 0) {
      process.exit(1);
    }

    process.exit(0);
  },
});
