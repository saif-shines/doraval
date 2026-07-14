import { existsSync } from "fs";
import { resolve } from "path";
import { loadSkillFromDir, validateSkillModel } from "../../core/skill-validate.js";
import { analyzeDrift } from "../../core/static-skill-checks.js";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

export interface SkillValidatorOptions {
  id: string;
  provider: string;
  name: string;
  description: string;
  /** Run static drift heuristics (trigger/structure/voice…) into errors. */
  includeDrift?: boolean;
}

export function createSkillValidator(opts: SkillValidatorOptions): Validator {
  const { id, provider, name, description, includeDrift = false } = opts;
  return {
    id,
    provider,
    name,
    description,
    detect(dir: string): boolean {
      return existsSync(resolve(dir, "SKILL.md"));
    },
    async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
      const loaded = await loadSkillFromDir(dir);
      if (!loaded.ok) {
        return {
          errors: [{ text: "Failed to parse YAML frontmatter in SKILL.md" }],
          warnings: [],
          passes: [],
        };
      }

      const base = validateSkillModel(loaded.model, {
        existingDirs: [...loaded.existingDirs],
      });

      if (!includeDrift) {
        return base;
      }

      const desc = [loaded.model.data.description, loaded.model.data.when_to_use]
        .filter(Boolean)
        .join(" ");
      const driftResult = analyzeDrift({
        description: String(desc),
        content: loaded.model.content,
      });
      const driftErrors = driftResult.drifts
        .filter((d) => d.drifted)
        .map((d) => ({ text: `[static] ${d.category}: ${d.detail}` }));

      return {
        errors: [...base.errors, ...driftErrors],
        warnings: base.warnings,
        passes: base.passes,
      };
    },
  };
}
