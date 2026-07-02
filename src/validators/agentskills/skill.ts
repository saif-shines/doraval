import { relative, sep } from "path";
import { loadSkillFromDir } from "../../core/skill-validate.js";
import { validateAgentSkill } from "../../core/agentskills-validate.js";
import { normalizeSkillPath, isSkillDir, findSkillDirs } from "../../core/skill-discovery.js";
import type { CheckItem, Validator, ValidateResult, ValidateOptions } from "../types.js";

function prefix(items: CheckItem[], label: string): CheckItem[] {
  return items.map((item) => ({ ...item, text: `[${label}] ${item.text}` }));
}

async function validateOne(skillDir: string, label: string): Promise<ValidateResult> {
  const loaded = await loadSkillFromDir(skillDir);
  if (!loaded.ok) {
    return { errors: [{ text: `[${label}] Failed to parse YAML frontmatter in SKILL.md` }], warnings: [], passes: [] };
  }
  const result = validateAgentSkill(loaded.model, { skillDir, existingDirs: [...loaded.existingDirs] });
  return {
    errors: prefix(result.errors, label),
    warnings: prefix(result.warnings, label),
    passes: prefix(result.passes, label),
  };
}

export const agentskillsSkillValidator: Validator = {
  id: "agentskills:skill",
  provider: "agentskills",
  name: "Agent Skills (open spec)",
  description:
    "Validates SKILL.md against the open agentskills.io specification: required name/description with hard length caps, name-matches-directory, license/compatibility/metadata fields, and progressive-disclosure level budgets. Fans out over every skill found under the path (a single skill, or a repo containing many, including nested ones).",

  detect(dir: string): boolean {
    const root = normalizeSkillPath(dir);
    return isSkillDir(root) || findSkillDirs(root).length > 0;
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const root = normalizeSkillPath(dir);

    if (isSkillDir(root)) {
      return validateOne(root, ".");
    }

    const skillDirs = findSkillDirs(root);
    if (skillDirs.length === 0) {
      return {
        errors: [],
        warnings: [{ text: `No skills found under ${dir} (looked for SKILL.md up to 5 directories deep)` }],
        passes: [],
      };
    }

    const results = await Promise.all(
      skillDirs.map((skillDir) => validateOne(skillDir, relative(root, skillDir).split(sep).join("/") || "."))
    );

    return results.reduce<ValidateResult>(
      (acc, r) => ({
        errors: [...acc.errors, ...r.errors],
        warnings: [...acc.warnings, ...r.warnings],
        passes: [...acc.passes, ...r.passes],
      }),
      { errors: [], warnings: [], passes: [] }
    );
  },
};
