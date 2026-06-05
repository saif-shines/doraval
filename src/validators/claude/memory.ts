import { existsSync } from "fs";
import { resolve } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

export const claudeMemoryValidator: Validator = {
  id: "claude:memory",
  provider: "claude",
  name: "Claude CLAUDE.md",
  description: "Validates CLAUDE.md: non-empty, length recommendations, @path imports",

  detect(dir: string): boolean {
    return existsSync(resolve(dir, "CLAUDE.md"));
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    const filePath = resolve(dir, "CLAUDE.md");
    const raw = await Bun.file(filePath).text();

    if (!raw.trim()) {
      errors.push("CLAUDE.md is empty");
      return { errors, warnings, passes };
    }
    passes.push("CLAUDE.md is non-empty");

    const lines = raw.split("\n");
    if (lines.length > 200) {
      warnings.push(
        `CLAUDE.md is ${lines.length} lines — official recommendation is under 200. Move reference content to skills.`
      );
    } else {
      passes.push(`CLAUDE.md is ${lines.length} lines (under 200 recommended limit)`);
    }

    // Check @path imports (line-level directives: lines where @path is the entire content)
    const importRegex = /^@([^\s]+)\s*$/gm;
    let match;
    while ((match = importRegex.exec(raw)) !== null) {
      const importPath = match[1];
      const resolvedImport = resolve(dir, importPath);
      if (existsSync(resolvedImport)) {
        passes.push(`@import "${importPath}" exists`);
      } else {
        warnings.push(`@import "${importPath}" — file not found at ${resolvedImport}`);
      }
    }

    // TODO: More rules added incrementally

    return { errors, warnings, passes };
  },
};