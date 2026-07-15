import { existsSync } from "fs";
import { resolve } from "path";
import { parseFrontmatter } from "./frontmatter.js";
import type { CheckItem } from "../validators/types.js";

export interface SkillModel {
  data: Record<string, unknown>;
  content: string;
}

export interface SkillValidateContext {
  existingDirs: string[];
}

export interface SkillValidateResult {
  errors: CheckItem[];
  warnings: CheckItem[];
  passes: CheckItem[];
}

export type CheckResult = {
  errors?: CheckItem[];
  warnings?: CheckItem[];
  passes?: CheckItem[];
};
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

/** agentskills.io description max (also used as Claude-path soft ceiling). */
export const DESCRIPTION_MAX_LENGTH = 1024;

/** Rough token estimate without a tokenizer: ~4 chars/token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export type LoadSkillResult =
  | { ok: true; model: SkillModel; existingDirs: string[] }
  | { ok: false; error: string };

/**
 * Load SKILL.md from a skill directory.
 * @param dirOptions.dirs — which supporting dirs to report as present (default OPTIONAL_DIRS).
 */
export async function loadSkill(
  dir: string,
  dirOptions: { dirs?: readonly string[] } = {},
): Promise<LoadSkillResult> {
  const skillMd = resolve(dir, "SKILL.md");
  if (!existsSync(skillMd)) {
    return { ok: false, error: "No SKILL.md found" };
  }
  const raw = await Bun.file(skillMd).text();
  let parsed: SkillModel;
  try {
    parsed = parseFrontmatter(raw);
  } catch {
    return { ok: false, error: "frontmatter-parse-error" };
  }
  const dirs = dirOptions.dirs ?? OPTIONAL_DIRS;
  const existingDirs = dirs.filter((d) => existsSync(resolve(dir, d)));
  return {
    ok: true,
    model: { data: parsed.data, content: parsed.content },
    existingDirs: [...existingDirs],
  };
}

/** Same as loadSkill, scanning SUPPORTING_DIRS (includes examples/). */
export async function loadSkillFromDir(dir: string): Promise<LoadSkillResult> {
  return loadSkill(dir, { dirs: SUPPORTING_DIRS });
}

export function checkFrontmatterPresence(model: SkillModel, _ctx: SkillValidateContext): CheckResult {
  const keys = Object.keys(model.data);
  if (keys.length === 0) {
    return { warnings: [{ text: "YAML frontmatter is empty (description recommended for discoverability)" }] };
  }
  return { passes: [{ text: "YAML frontmatter present and parseable" }] };
}

export function checkName(model: SkillModel, _ctx: SkillValidateContext): CheckResult {
  if (!model.data.name) {
    return { warnings: [{ text: 'Missing "name" in frontmatter — directory name provides the /command (name is optional except for plugin-root skills)' }] };
  }
  const name = String(model.data.name);
  if (!NAME_REGEX.test(name)) {
    return { errors: [{ text: `Invalid name format: "${name}" — should be kebab-case (a-z, 0-9, hyphens) for best compatibility` }] };
  }
  if (name.length < 2 || name.length > 64) {
    return { errors: [{ text: `Name length out of range: ${name.length} chars (recommended 2-64)` }] };
  }
  return { passes: [{ text: `name: "${name}"` }] };
}

export function checkDescription(model: SkillModel, _ctx: SkillValidateContext): CheckResult {
  if (!model.data.description) {
    return { warnings: [{ text: 'Missing "description" (recommended) — helps Claude decide when to load the skill automatically' }] };
  }
  const desc = String(model.data.description);
  if (desc.length > DESCRIPTION_MAX_LENGTH) {
    return {
      warnings: [{
        text: `description is ${desc.length} chars — exceeds the agentskills.io spec max of ${DESCRIPTION_MAX_LENGTH}`,
      }],
    };
  }
  return { passes: [{ text: "description field present" }] };
}

export function checkBody(model: SkillModel, _ctx: SkillValidateContext): CheckResult {
  if (!model.content.trim()) {
    return { errors: [{ text: "Markdown body is empty" }] };
  }
  return { passes: [{ text: "Markdown body is non-empty" }] };
}

// Progressive disclosure: Level 2 (the SKILL.md body) should stay lean since it's
// loaded in full whenever the skill triggers. ~5k tokens (~20k chars) is the rule
// of thumb before detail belongs in references/ instead (loaded only on demand).
const BODY_SIZE_WARN_CHARS = 20_000;

export function checkBodySize(model: SkillModel, _ctx: SkillValidateContext): CheckResult {
  const len = model.content.length;
  if (len > BODY_SIZE_WARN_CHARS) {
    return {
      warnings: [{
        text: `SKILL.md body is ${len.toLocaleString()} chars (~${estimateTokens(model.content).toLocaleString()} tokens) — consider moving detail into references/ so it loads only on demand`,
      }],
    };
  }
  return { passes: [{ text: "SKILL.md body size is within the progressive-disclosure budget" }] };
}

// The agentskills.io spec warns against `<`/`>` in frontmatter values: they can be
// interpreted as tags and inject unintended instructions into the system prompt
// when Level 1 metadata is loaded. Treated as an error, not style, since it's a
// prompt-injection vector.
function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
}

export function checkFrontmatterInjection(model: SkillModel, _ctx: SkillValidateContext): CheckResult {
  const strings: string[] = [];
  collectStrings(model.data, strings);
  const offenders = strings.filter((s) => /[<>]/.test(s));
  if (offenders.length > 0) {
    return {
      errors: [{
        text: `Frontmatter contains "<" or ">" — possible prompt-injection vector; the spec requires plain text in frontmatter values`,
      }],
    };
  }
  return { passes: [{ text: "frontmatter free of angle brackets" }] };
}

export function checkAllowedToolsPortability(model: SkillModel, _ctx: SkillValidateContext): CheckResult {
  if (!("allowed-tools" in model.data)) return {};
  return {
    passes: [{
      text: '"allowed-tools" is experimental per the agentskills.io spec — well-supported in Claude Code, support varies on other platforms (Codex, OpenClaw)',
    }],
  };
}

export function checkAdvancedFields(model: SkillModel, _ctx: SkillValidateContext): CheckResult {
  const advanced = Object.keys(model.data).filter(
    k => KNOWN_FIELDS.has(k) && k !== "name" && k !== "description"
  );
  if (advanced.length > 0) {
    return { passes: [{ text: `advanced frontmatter: ${advanced.join(", ")}` }] };
  }
  return {};
}

export function checkUnknownFields(model: SkillModel, _ctx: SkillValidateContext): CheckResult {
  const warnings = Object.keys(model.data)
    .filter(k => !KNOWN_FIELDS.has(k))
    .map(k => ({ text: `Unknown frontmatter field: "${k}" (may be a typo or newer spec addition)` }));
  return { warnings };
}

export function checkSupportingDirs(_model: SkillModel, ctx: SkillValidateContext): CheckResult {
  const passes = SUPPORTING_DIRS
    .filter(dir => ctx.existingDirs.includes(dir))
    .map(dir => ({ text: `${dir}/ directory exists` }));
  return { passes };
}

export function checkDynamicInjection(model: SkillModel, _ctx: SkillValidateContext): CheckResult {
  const passes: CheckItem[] = [];
  if (/!\s*`[^`]+`/.test(model.content) || /```\s*!/.test(model.content)) {
    passes.push({ text: "uses dynamic context injection (!`...` or ```! blocks)" });
  }
  if (/\$ARGUMENTS|\$[0-9]|\$\{CLAUDE_/.test(model.content)) {
    passes.push({ text: "uses argument / session substitutions ($ARGUMENTS, $0, ${CLAUDE_*})" });
  }
  return { passes };
}

const EMPTY: SkillValidateResult = { errors: [], warnings: [], passes: [] };

const checks: Check[] = [
  checkFrontmatterPresence,
  checkName,
  checkDescription,
  checkBody,
  checkBodySize,
  checkFrontmatterInjection,
  checkAllowedToolsPortability,
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
