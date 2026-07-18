import { createSkillValidator } from "../shared/skill-validator.js";

export const grokSkillValidator = createSkillValidator({
  id: "grok:skill",
  provider: "grok",
  name: "Grok Skill",
  description:
    "Validates SKILL.md (shared format with Claude/Cursor): name/description, body, supporting files. Grok optional frontmatter (when-to-use, disable-model-invocation, user-invocable, allowed-tools) is accepted by the shared parser — discovery paths are the Grok-specific surface.",
  includeDrift: true,
});
