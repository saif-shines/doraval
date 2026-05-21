import { defineCommand } from "citty";
import { existsSync } from "fs";
import { resolve } from "path";
import pc from "picocolors";
import { parseFrontmatter } from "../../core/frontmatter.js";

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
    agent: {
      type: "string",
      alias: "a",
      description: "Force a specific agent adapter",
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
      console.error(
        `${pc.red("✗")} Path not found: ${targetPath}\n\nCheck that the path is correct and the directory exists.`
      );
      process.exit(1);
    }

    const skillMd = resolve(fullPath, "SKILL.md");
    if (!existsSync(skillMd)) {
      console.error(
        `${pc.red("✗")} No skill or plugin found at ${targetPath}\n\nSearched for:\n  • SKILL.md (Agent Skills spec)\n  • .claude-plugin/plugin.json (Claude Code plugin)\n\nTry:\n  • Check the path points to a skill or plugin directory\n  • Use --agent to force a specific adapter`
      );
      process.exit(1);
    }

    const raw = await Bun.file(skillMd).text();
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    // Parse frontmatter
    let parsed;
    try {
      parsed = parseFrontmatter(raw);
    } catch {
      console.error(
        `${pc.red("✗")} Failed to parse YAML frontmatter in SKILL.md\n\nFix the YAML syntax and retry.`
      );
      process.exit(1);
    }

    // Check: frontmatter exists
    if (Object.keys(parsed.data).length === 0) {
      errors.push("YAML frontmatter is empty or missing");
    } else {
      passes.push("YAML frontmatter present and parseable");
    }

    // Check: name field
    if (!parsed.data.name) {
      errors.push('Missing required field: "name"');
    } else {
      const name = String(parsed.data.name);
      const nameRegex = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
      if (!nameRegex.test(name)) {
        errors.push(
          `Invalid name format: "${name}" — must be kebab-case (a-z, 0-9, hyphens)`
        );
      } else if (name.length < 2 || name.length > 64) {
        errors.push(
          `Name length out of range: ${name.length} chars (must be 2-64)`
        );
      } else {
        passes.push(`name: "${name}"`);
      }
    }

    // Check: description field
    if (!parsed.data.description) {
      errors.push('Missing required field: "description"');
    } else {
      passes.push("description field present");
    }

    // Check: body non-empty
    if (!parsed.content.trim()) {
      errors.push("Markdown body is empty");
    } else {
      passes.push("Markdown body is non-empty");
    }

    // Check: referenced directories exist
    for (const dir of ["references", "scripts", "assets"]) {
      const dirPath = resolve(fullPath, dir);
      if (existsSync(dirPath)) {
        passes.push(`${dir}/ directory exists`);
      }
    }

    // Output
    if (args.format === "json") {
      const result = { path: targetPath, errors, warnings, passes };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(
        `\n  ${pc.bold("doraval skill validate")} — Structural validation\n`
      );
      console.error(`  Path:  ${targetPath}\n`);

      for (const p of passes) {
        console.log(`  ${pc.green("✓")} ${p}`);
      }
      for (const w of warnings) {
        console.log(`  ${pc.yellow("⚠")} ${w}`);
      }
      for (const e of errors) {
        console.log(`  ${pc.red("✗")} ${e}`);
      }

      console.log(
        `\n  Result: ${errors.length} error(s), ${warnings.length} warning(s)\n`
      );
    }

    if (errors.length > 0) {
      process.exit(1);
    }
  },
});
