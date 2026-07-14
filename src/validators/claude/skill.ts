import { createSkillValidator } from "../shared/skill-validator.js";

export const claudeSkillValidator = createSkillValidator({
  id: "claude:skill",
  provider: "claude",
  name: "Claude Skill",
  description:
    "Validates SKILL.md per current Claude Code spec: frontmatter (name/description relaxed to recommended; directory name usually provides the /command), body, supporting files, dynamic injection (!`cmd`), substitutions ($ARGUMENTS, ${CLAUDE_*}), and advanced fields (allowed-tools, context, disable-model-invocation, when_to_use, etc.)",
  includeDrift: true,
});
