import { existsSync } from "fs";
import { resolve } from "path";
import { loadSkillFromDir, validateSkillModel } from "../../core/skill-validate.js";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

export const claudeSkillValidator: Validator = {
  id: "claude:skill",
  provider: "claude",
  name: "Claude Skill",
  description: "Validates SKILL.md per current Claude Code spec: frontmatter (name/description relaxed to recommended; directory name usually provides the /command), body, supporting files, dynamic injection (!`cmd`), substitutions ($ARGUMENTS, ${CLAUDE_*}), and advanced fields (allowed-tools, context, disable-model-invocation, when_to_use, etc.)",

  detect(dir: string): boolean {
    return existsSync(resolve(dir, "SKILL.md"));
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const loaded = await loadSkillFromDir(dir);
    if (!loaded.ok) {
      return {
        errors: ["Failed to parse YAML frontmatter in SKILL.md"],
        warnings: [],
        passes: [],
      };
    }
    return validateSkillModel(loaded.model, { existingDirs: [...loaded.existingDirs] });
  },
};