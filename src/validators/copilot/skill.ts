import { existsSync } from "fs";
import { resolve } from "path";
import { loadSkill, validateSkillModel } from "../../core/skill-validate.js";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

export const copilotSkillValidator: Validator = {
  id: "copilot:skill",
  provider: "copilot",
  name: "Copilot Skill",
  description: "Validates SKILL.md (shared format). Copilot supports skills referenced via array paths in the manifest.",

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
