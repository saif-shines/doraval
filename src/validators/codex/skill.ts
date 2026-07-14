import { createSkillValidator } from "../shared/skill-validator.js";

export const codexSkillValidator = createSkillValidator({
  id: "codex:skill",
  provider: "codex",
  name: "Codex Skill",
  description:
    "Validates SKILL.md (shared format): frontmatter (name/description), body, supporting files, substitutions. Codex uses the same SKILL.md spec as other providers.",
});
