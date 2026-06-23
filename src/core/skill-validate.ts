import { existsSync } from "fs";
import { resolve } from "path";
import { parseFrontmatter } from "./frontmatter.js";

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
  "expected-eval", // doraval eval: author-declared expected tool calls
]);

// Directories commonly bundled with skills (supporting files, scripts, examples, etc.)
export const SUPPORTING_DIRS = ["references", "scripts", "assets", "examples"] as const;

export const OPTIONAL_DIRS = ["references", "scripts", "assets"] as const;

export async function loadSkill(dir: string): Promise<
  | { ok: true; model: SkillModel; existingDirs: string[] }
  | { ok: false; error: string }
> {
  const skillMd = resolve(dir, "SKILL.md");
  if (!existsSync(skillMd)) {
    return { ok: false, error: "No SKILL.md found" };
  }
  const raw = await Bun.file(skillMd).text();
  let parsed;
  try {
    parsed = parseFrontmatter(raw);
  } catch {
    return { ok: false, error: "Failed to parse YAML frontmatter in SKILL.md" };
  }
  const existingDirs = OPTIONAL_DIRS.filter((d) =>
    existsSync(resolve(dir, d))
  );
  return { ok: true, model: parsed, existingDirs };
}

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

export function checkSupportingDirs(_model: SkillModel, ctx: SkillValidateContext): CheckResult {
  const passes = SUPPORTING_DIRS
    .filter(dir => ctx.existingDirs.includes(dir))
    .map(dir => `${dir}/ directory exists`);
  return { passes };
}

export function checkDynamicInjection(model: SkillModel, _ctx: SkillValidateContext): CheckResult {
  const passes: string[] = [];
  if (/!\s*`[^`]+`/.test(model.content) || /```\s*!/.test(model.content)) {
    passes.push("uses dynamic context injection (!`...` or ```! blocks)");
  }
  if (/\$ARGUMENTS|\$[0-9]|\$\{CLAUDE_/.test(model.content)) {
    passes.push("uses argument / session substitutions ($ARGUMENTS, $0, ${CLAUDE_*})");
  }
  return { passes };
}

const EMPTY: SkillValidateResult = { errors: [], warnings: [], passes: [] };

const checks: Check[] = [
  checkFrontmatterPresence,
  checkName,
  checkDescription,
  checkBody,
  checkAdvancedFields,
  checkUnknownFields,
  checkSupportingDirs,
  checkDynamicInjection,
];

export function validateSkillModel(
  model: SkillModel,
  context: SkillValidateContext = { existingDirs: [] }
): SkillValidateResult {
  return checks.reduce<SkillValidateResult>(
    (acc, check) => merge(acc, check(model, context)),
    EMPTY
  );
}

export async function loadSkillFromDir(dir: string): Promise<
  | { ok: true; model: SkillModel; existingDirs: string[] }
  | { ok: false; error: string }
> {
  const skillMd = resolve(dir, "SKILL.md");
  if (!existsSync(skillMd)) {
    return { ok: false, error: "No SKILL.md found" };
  }
  const raw = await Bun.file(skillMd).text();
  let parsed;
  try {
    parsed = parseFrontmatter(raw);
  } catch {
    return { ok: false, error: "frontmatter-parse-error" };
  }
  const existingDirs = SUPPORTING_DIRS.filter((d) =>
    existsSync(resolve(dir, d))
  );
  return { ok: true, model: { data: parsed.data, content: parsed.content }, existingDirs };
}
