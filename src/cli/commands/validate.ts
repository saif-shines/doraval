import { existsSync } from "fs";
import { resolve } from "path";
import chalk from "chalk";
import matter from "gray-matter";

interface ValidateOptions {
  agent?: string;
  format: string;
  verbose?: boolean;
  ci?: boolean;
}

export async function validate(
  targetPath: string,
  options: ValidateOptions
): Promise<void> {
  const fullPath = resolve(targetPath);

  if (!existsSync(fullPath)) {
    console.error(
      `${chalk.red("✗")} Path not found: ${targetPath}\n\nCheck that the path is correct and the directory exists.`
    );
    process.exit(1);
  }

  const skillMd = resolve(fullPath, "SKILL.md");
  if (!existsSync(skillMd)) {
    console.error(
      `${chalk.red("✗")} No skill or plugin found at ${targetPath}\n\nSearched for:\n  • SKILL.md (Agent Skills spec)\n  • .claude-plugin/plugin.json (Claude Code plugin)\n\nTry:\n  • Check the path points to a skill or plugin directory\n  • Use --agent to force a specific adapter`
    );
    process.exit(1);
  }

  const raw = await Bun.file(skillMd).text();
  const errors: string[] = [];
  const warnings: string[] = [];
  const passes: string[] = [];

  // Parse frontmatter
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch {
    console.error(
      `${chalk.red("✗")} Failed to parse YAML frontmatter in SKILL.md\n\nFix the YAML syntax and retry.`
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
    const nameRegex = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    if (
      typeof parsed.data.name !== "string" ||
      !nameRegex.test(parsed.data.name)
    ) {
      errors.push(
        `Invalid name format: "${parsed.data.name}" — must be kebab-case (a-z, 0-9, hyphens)`
      );
    } else if (
      parsed.data.name.length < 2 ||
      parsed.data.name.length > 64
    ) {
      errors.push(
        `Name length out of range: ${parsed.data.name.length} chars (must be 2-64)`
      );
    } else {
      passes.push(`name: "${parsed.data.name}"`);
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
  if (options.format === "json") {
    const result = { path: targetPath, errors, warnings, passes };
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.error(
      `\n  ${chalk.bold("doraval")} v0.0.1 — Validating skill\n`
    );
    console.error(`  Path:  ${targetPath}`);
    console.error("");

    for (const p of passes) {
      console.log(`  ${chalk.green("✓")} ${p}`);
    }
    for (const w of warnings) {
      console.log(`  ${chalk.yellow("⚠")} ${w}`);
    }
    for (const e of errors) {
      console.log(`  ${chalk.red("✗")} ${e}`);
    }

    console.log(
      `\n  Result: ${errors.length} error(s), ${warnings.length} warning(s)\n`
    );
  }

  if (errors.length > 0) {
    process.exit(1);
  }
}
