import { existsSync } from "fs";
import { resolve } from "path";
import { parseFrontmatter } from "../../core/frontmatter.js";
import { validateSkillModel } from "../../core/skill-validate.js";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

const OPTIONAL_DIRS = ["references", "scripts", "assets"] as const;

export const claudeSkillValidator: Validator = {
  id: "claude:skill",
  provider: "claude",
  name: "Claude Skill",
  description: "Validates SKILL.md per current Claude Code spec: frontmatter (name/description relaxed to recommended; directory name usually provides the /command), body, supporting files, dynamic injection (!`cmd`), substitutions ($ARGUMENTS, ${CLAUDE_*}), and advanced fields (allowed-tools, context, disable-model-invocation, when_to_use, etc.)",

  detect(dir: string): boolean {
    return existsSync(resolve(dir, "SKILL.md"));
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const skillMd = resolve(dir, "SKILL.md");
    const raw = await Bun.file(skillMd).text();

    let parsed;
    try {
      parsed = parseFrontmatter(raw);
    } catch {
      return {
        errors: ["Failed to parse YAML frontmatter in SKILL.md"],
        warnings: [],
        passes: [],
      };
    }

    const existingDirs = OPTIONAL_DIRS.filter((d) =>
      existsSync(resolve(dir, d))
    );

    return validateSkillModel(parsed, { existingDirs: [...existingDirs] });
  },
};