import { createSkillValidator } from "../shared/skill-validator.js";

export const cursorSkillValidator = createSkillValidator({
  id: "cursor:skill",
  provider: "cursor",
  name: "Cursor Skill",
  description:
    "Validates SKILL.md (shared format): frontmatter (name/description), body, supporting files, substitutions. Cursor uses the same SKILL.md spec as other providers.",
});
