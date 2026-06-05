import { existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { parseFrontmatter } from "../../core/frontmatter.js";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

export const claudeCommandValidator: Validator = {
  id: "claude:command",
  provider: "claude",
  name: "Claude Commands",
  description: "Validates commands/ directory: .md files with frontmatter and description",

  detect(dir: string): boolean {
    const commandsDir = resolve(dir, "commands");
    if (!existsSync(commandsDir)) return false;
    try {
      return readdirSync(commandsDir).some((f) => f.endsWith(".md"));
    } catch {
      return false;
    }
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    const commandsDir = resolve(dir, "commands");
    const mdFiles = readdirSync(commandsDir).filter((f) => f.endsWith(".md"));

    if (mdFiles.length === 0) {
      errors.push("commands/ directory has no .md files");
      return { errors, warnings, passes };
    }
    passes.push(`${mdFiles.length} command definition(s) found`);

    for (const file of mdFiles) {
      const filePath = join(commandsDir, file);
      const raw = await Bun.file(filePath).text();

      try {
        const parsed = parseFrontmatter(raw);

        if (Object.keys(parsed.data).length === 0) {
          warnings.push(`${file}: no YAML frontmatter`);
        } else if (!parsed.data.description) {
          warnings.push(`${file}: missing "description" in frontmatter`);
        } else {
          passes.push(`${file}: has frontmatter with description`);
        }

        if (!parsed.content.trim()) {
          errors.push(`${file}: body is empty`);
        }
      } catch {
        errors.push(`${file}: failed to parse`);
      }
    }

    // TODO: Validate allowed-tools, argument-hint, etc.

    return { errors, warnings, passes };
  },
};