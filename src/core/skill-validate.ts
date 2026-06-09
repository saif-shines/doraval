export interface SkillModel {
  data: Record<string, unknown>;
  content: string;
}

export interface SkillValidateContext {
  existingDirs: string[];
}

export interface SkillValidateResult {
  errors: string[];
  warnings: string[];
  passes: string[];
}

export type CheckResult = Partial<SkillValidateResult>;
export type Check = (model: SkillModel, ctx: SkillValidateContext) => CheckResult;

export const merge = (a: SkillValidateResult, b: CheckResult): SkillValidateResult => ({
  errors: [...a.errors, ...(b.errors ?? [])],
  warnings: [...a.warnings, ...(b.warnings ?? [])],
  passes: [...a.passes, ...(b.passes ?? [])],
});

const NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// Known frontmatter fields from the current Claude Code skills spec (pasted official docs).
// We note recognized ones and warn on unknown keys (helps catch typos or future additions).
const KNOWN_FIELDS = new Set([
  "name",
  "description",
  "when_to_use",
  "argument-hint",
  "arguments",
  "disable-model-invocation",
  "user-invocable",
  "allowed-tools",
  "disallowed-tools",
  "model",
  "effort",
  "context",
  "agent",
  "hooks",
  "paths",
  "shell",
]);

// Directories commonly bundled with skills (supporting files, scripts, examples, etc.)
const SUPPORTING_DIRS = ["references", "scripts", "assets", "examples"] as const;

export function checkFrontmatterPresence(model: SkillModel, _ctx: SkillValidateContext): CheckResult {
  const keys = Object.keys(model.data);
  if (keys.length === 0) {
    return { warnings: ["YAML frontmatter is empty (description recommended for discoverability)"] };
  }
  return { passes: ["YAML frontmatter present and parseable"] };
}

export function checkName(model: SkillModel, _ctx: SkillValidateContext): CheckResult {
  if (!model.data.name) {
    return { warnings: ['No "name" in frontmatter — directory name provides the /command (name is optional except for plugin-root skills)'] };
  }
  const name = String(model.data.name);
  if (!NAME_REGEX.test(name)) {
    return { errors: [`Invalid name format: "${name}" — should be kebab-case (a-z, 0-9, hyphens) for best compatibility`] };
  }
  if (name.length < 2 || name.length > 64) {
    return { errors: [`Name length out of range: ${name.length} chars (recommended 2-64)`] };
  }
  return { passes: [`name: "${name}"`] };
}

export function checkDescription(model: SkillModel, _ctx: SkillValidateContext): CheckResult {
  if (!model.data.description) {
    return { warnings: ['Missing "description" (recommended) — helps Claude decide when to load the skill automatically'] };
  }
  return { passes: ["description field present"] };
}

export function checkBody(model: SkillModel, _ctx: SkillValidateContext): CheckResult {
  if (!model.content.trim()) {
    return { errors: ["Markdown body is empty"] };
  }
  return { passes: ["Markdown body is non-empty"] };
}

export function checkAdvancedFields(model: SkillModel, _ctx: SkillValidateContext): CheckResult {
  const advanced = Object.keys(model.data).filter(
    k => KNOWN_FIELDS.has(k) && k !== "name" && k !== "description"
  );
  if (advanced.length > 0) {
    return { passes: [`advanced frontmatter: ${advanced.join(", ")}`] };
  }
  return {};
}

export function checkUnknownFields(model: SkillModel, _ctx: SkillValidateContext): CheckResult {
  const warnings = Object.keys(model.data)
    .filter(k => !KNOWN_FIELDS.has(k))
    .map(k => `Unknown frontmatter field: "${k}" (may be a typo or newer spec addition)`);
  return { warnings };
}

export function validateSkillModel(
  model: SkillModel,
  context: SkillValidateContext = { existingDirs: [] }
): SkillValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const passes: string[] = [];

  const frontmatterKeys = Object.keys(model.data);

  if (frontmatterKeys.length === 0) {
    warnings.push("YAML frontmatter is empty (description recommended for discoverability)");
  } else {
    passes.push("YAML frontmatter present and parseable");
  }

  // name is optional (directory name provides the invocable command in most cases).
  // If present we still validate the format because it is used as a display label
  // and for plugin-root SKILL.md it *does* determine the command name.
  if (!model.data.name) {
    warnings.push('No "name" in frontmatter — directory name provides the /command (name is optional except for plugin-root skills)');
  } else {
    const name = String(model.data.name);
    if (!NAME_REGEX.test(name)) {
      errors.push(
        `Invalid name format: "${name}" — should be kebab-case (a-z, 0-9, hyphens) for best compatibility`
      );
    } else if (name.length < 2 || name.length > 64) {
      errors.push(
        `Name length out of range: ${name.length} chars (recommended 2-64)`
      );
    } else {
      passes.push(`name: "${name}"`);
    }
  }

  // description is recommended (not strictly required — falls back to first paragraph)
  if (!model.data.description) {
    warnings.push('Missing "description" (recommended) — helps Claude decide when to load the skill automatically');
  } else {
    passes.push("description field present");
  }

  if (!model.content.trim()) {
    errors.push("Markdown body is empty");
  } else {
    passes.push("Markdown body is non-empty");
  }

  // Report recognized advanced frontmatter fields (new in current Claude Code spec)
  const advanced: string[] = [];
  for (const key of frontmatterKeys) {
    if (KNOWN_FIELDS.has(key) && key !== "name" && key !== "description") {
      advanced.push(key);
    }
  }
  if (advanced.length > 0) {
    passes.push(`advanced frontmatter: ${advanced.join(", ")}`);
  }

  // Warn on unknown top-level frontmatter keys (helps catch typos)
  for (const key of frontmatterKeys) {
    if (!KNOWN_FIELDS.has(key)) {
      warnings.push(`Unknown frontmatter field: "${key}" (may be a typo or newer spec addition)`);
    }
  }

  // Supporting files / directories (expanded list)
  for (const dir of SUPPORTING_DIRS) {
    if (context.existingDirs.includes(dir)) {
      passes.push(`${dir}/ directory exists`);
    }
  }

  // Detect dynamic context injection (!`command` or ```! fenced blocks)
  const hasInlineInjection = /!\s*`[^`]+`/.test(model.content);
  const hasFencedInjection = /```\s*!/.test(model.content);
  if (hasInlineInjection || hasFencedInjection) {
    passes.push("uses dynamic context injection (!`...` or ```! blocks)");
  }

  // Detect common substitution patterns (helps confirm the skill is using the argument / env system)
  const hasArgSubst = /\$ARGUMENTS|\$[0-9]|\$\{CLAUDE_/.test(model.content);
  if (hasArgSubst) {
    passes.push("uses argument / session substitutions ($ARGUMENTS, $0, ${CLAUDE_*})");
  }

  return { errors, warnings, passes };
}
