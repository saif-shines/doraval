import { createSkillValidator } from "../shared/skill-validator.js";

export const copilotSkillValidator = createSkillValidator({
  id: "copilot:skill",
  provider: "copilot",
  name: "Copilot Skill",
  description:
    "Validates SKILL.md (shared format). Copilot supports skills referenced via array paths in the manifest.",
});
