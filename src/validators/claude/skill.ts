import { existsSync } from "fs";
import { resolve } from "path";
import { loadSkillFromDir, validateSkillModel } from "../../core/skill-validate.js";
import { analyzeDrift } from "../../core/static-skill-checks.js";
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
        errors: [{ text: "Failed to parse YAML frontmatter in SKILL.md" }],
        warnings: [],
        passes: [],
      };
    }

    const base = validateSkillModel(loaded.model, { existingDirs: [...loaded.existingDirs] });

    // Run static heuristic checks (no LLM required).
    // Concatenate description + when_to_use as the trigger-detection input per spec.
    const description = [
      loaded.model.data.description,
      loaded.model.data.when_to_use,
    ]
      .filter(Boolean)
      .join(" ");

    const driftResult = analyzeDrift({ description: String(description), content: loaded.model.content });
    const driftErrors = driftResult.drifts
      .filter(d => d.drifted)
      .map(d => ({ text: `[static] ${d.category}: ${d.detail}` }));

    return {
      errors: [...base.errors, ...driftErrors],
      warnings: base.warnings,
      passes: base.passes,
    };
  },
};
