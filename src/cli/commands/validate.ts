import { defineCommand } from "citty";
import { existsSync } from "fs";
import { resolve } from "path";
import pc from "picocolors";
import { ui, renderChecksTable, nextAction, type CheckStatus } from "../out.js";
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
        ui.fail("Error (E-VAL-003): Failed to parse YAML frontmatter in SKILL.md");
        ui.info("  Fix the YAML syntax and retry.");
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
      ui.heading("dora skill validate — Structural validation");
      ui.info(`  Path:  ${targetPath}\n`);

      // Build in priority order (errors high first) for table output
      const checks: Array<{ status: CheckStatus; text: string }> = [];
      for (const e of errors) checks.push({ status: "fail", text: e });
      for (const w of warnings) checks.push({ status: "warn", text: w });
      for (const p of passes) checks.push({ status: "pass", text: p });

      const useHeader = checks.length > 2 || !!args.verbose;
      renderChecksTable(checks, { header: useHeader });

      if (errors.length === 0 && warnings.length === 0) {
        ui.write(`\n  ${pc.green("✓")} ${pc.white("All checks passed.")}\n`);
        nextAction(
          `dora skill drift ${targetPath === "." ? "." : targetPath}   or   dora validate ${targetPath} --for claude`
        );
      } else {
        ui.info(
          `\n  Result: ${errors.length} error(s), ${warnings.length} warning(s)\n`
        );
        if (errors.length > 0) {
          nextAction(`dora skill validate ${targetPath} --verbose`);
        } else {
          nextAction(`dora skill drift ${targetPath}`);
        }
      }
    }

    if (errors.length > 0) {
      process.exit(1);
    }

    process.exit(0);
  },
});
