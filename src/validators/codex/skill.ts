import { existsSync } from "fs";
import { resolve } from "path";
import { loadSkill, validateSkillModel } from "../../core/skill-validate.js";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

export const codexSkillValidator: Validator = {
  id: "codex:skill",
  provider: "codex",
  name: "Codex Skill",
  description: "Validates SKILL.md (shared format): frontmatter (name/description), body, supporting files, substitutions. Codex uses the same SKILL.md spec as other providers.",

  detect(dir: string): boolean {
    return existsSync(resolve(dir, "SKILL.md"));
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const loaded = await loadSkill(dir);
    if (!loaded.ok) {
      return {
        errors: [loaded.error],
        warnings: [],
        passes: [],
      };
    }

    const { model, existingDirs } = loaded;

    // Reuse the core validation (provider-agnostic)
    return validateSkillModel(model, { existingDirs: [...existingDirs] });
  },
};
