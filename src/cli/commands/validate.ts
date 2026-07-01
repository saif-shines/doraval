import { defineCommand } from "citty";
import { existsSync } from "fs";
import { resolve } from "path";
import { ui, renderValidationReport, guidedError, nextAction } from "../out.js";
import { loadSkillFromDir, validateSkillModel } from "../../core/skill-validate.js";

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
      ui.fail(`Error (E-VAL-001): Path not found: ${targetPath}`);
      ui.info("  Check that the path is correct and the directory exists.");
      nextAction("dora skill validate .");
      process.exit(1);
    }

    const loaded = await loadSkillFromDir(fullPath);
    if (!loaded.ok) {
      if (loaded.error === "No SKILL.md found") {
        ui.fail(`Error (E-VAL-002): No skill or plugin found at ${targetPath}`);
        ui.info(
          "  Searched for:\n" +
          "    • SKILL.md (Agent Skills spec)\n" +
          "    • .claude-plugin/plugin.json (Claude Code plugin)"
        );
        ui.info(
          "  Solutions:\n" +
          "    • dora skill validate <correct-path>\n" +
          "    • Use --for to target a specific validator"
        );
      } else {
        guidedError({
          context: "SKILL.md must start with valid YAML frontmatter (--- ... ---).",
          problem: "Failed to parse YAML frontmatter in SKILL.md",
          solutions: [
            "Fix the YAML syntax at the top of SKILL.md",
            "dora skill validate <path> --verbose for details",
          ],
        });
      }
      process.exit(1);
    }

    const { model: parsed, existingDirs } = loaded;
    const { errors, warnings, passes } = validateSkillModel(parsed, {
      existingDirs: [...existingDirs],
    });

    if (args.format === "json") {
      const result = { path: targetPath, errors, warnings, passes };
      console.log(JSON.stringify(result, null, 2));
    } else {
      const wrappedResult = {
        id: "skill",
        name: "Structural validation",
        result: { errors, warnings, passes }
      };
      renderValidationReport([wrappedResult], { path: targetPath, verbose: !!args.verbose });
    }

    if (errors.length > 0) {
      process.exit(1);
    }

    process.exit(0);
  },
});
