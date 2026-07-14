import { existsSync } from "fs";
import { basename, resolve } from "path";
import type { CheckItem } from "../validators/types.js";
import type { SkillModel } from "./skill-validate.js";
import {
  DESCRIPTION_MAX_LENGTH,
  estimateTokens,
  merge,
} from "./skill-validate.js";

/**
 * Validation against the open agentskills.io specification
 * (https://agentskills.io/specification, reference impl: github.com/agentskills/agentskills).
 *
 * This is a distinct, stricter profile from Claude Code's own SKILL.md conventions
 * (see skill-validate.ts): name + description are REQUIRED here, fields have hard length
 * caps, `name` must match the parent directory, and progressive-disclosure budgets
 * (the three "levels") are enforced. Fields specific to Claude Code (when_to_use, model,
 * hooks, ...) are correctly flagged as unknown under this profile.
 */

export interface AgentSkillValidateContext {
  /** Absolute path to the skill directory (the one containing SKILL.md). */
  skillDir: string;
  existingDirs: string[];
}

export interface AgentSkillValidateResult {
  errors: CheckItem[];
  warnings: CheckItem[];
  passes: CheckItem[];
}

export type AgentSkillCheckResult = {
  errors?: CheckItem[];
  warnings?: CheckItem[];
  passes?: CheckItem[];
};
export type AgentSkillCheck = (model: SkillModel, ctx: AgentSkillValidateContext) => AgentSkillCheckResult;

// Unicode-lowercase alphanumeric + hyphens; no leading/trailing/consecutive hyphen (spec allows digit-start).
const NAME_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NAME_MAX_LEN = 64;
const COMPATIBILITY_MAX_LEN = 500;

// Level 2 progressive-disclosure budget (agentskills.io/specification#progressive-disclosure).
const BODY_TOKEN_BUDGET = 5000;
const BODY_LINE_BUDGET = 500;

export const AGENTSKILLS_FIELDS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
]);

// Re-export for tests that import estimateTokens from this module.
export { estimateTokens };

export function checkName(model: SkillModel, ctx: AgentSkillValidateContext): AgentSkillCheckResult {
  const raw = model.data.name;
  if (!raw) {
    return { errors: [{ text: 'Missing required "name" field (agentskills.io spec requires name)' }] };
  }
  const name = String(raw);
  const errors: CheckItem[] = [];
  if (!NAME_REGEX.test(name)) {
    errors.push({
      text: `Invalid name format: "${name}" — must be lowercase unicode alphanumeric + hyphens, no leading/trailing/consecutive hyphen`,
    });
  }
  if (name.length < 1 || name.length > NAME_MAX_LEN) {
    errors.push({ text: `Name length out of range: ${name.length} chars (must be 1-${NAME_MAX_LEN})` });
  }
  const dirName = basename(ctx.skillDir);
  if (name !== dirName) {
    errors.push({ text: `name "${name}" does not match parent directory name "${dirName}" (spec requires an exact match)` });
  }
  if (errors.length > 0) return { errors };
  return { passes: [{ text: `name: "${name}" (matches directory)` }] };
}

export function checkDescription(model: SkillModel, _ctx: AgentSkillValidateContext): AgentSkillCheckResult {
  const raw = model.data.description;
  if (!raw || !String(raw).trim()) {
    return { errors: [{ text: 'Missing required "description" field (agentskills.io spec requires description)' }] };
  }
  const description = String(raw);
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    return { errors: [{ text: `Description length out of range: ${description.length} chars (must be 1-${DESCRIPTION_MAX_LENGTH})` }] };
  }
  return { passes: [{ text: "description field present and within length limit" }] };
}

export function checkCompatibility(model: SkillModel, _ctx: AgentSkillValidateContext): AgentSkillCheckResult {
  const raw = model.data.compatibility;
  if (raw === undefined) return {};
  const compatibility = String(raw);
  if (compatibility.length === 0 || compatibility.length > COMPATIBILITY_MAX_LEN) {
    return { warnings: [{ text: `compatibility length out of range: ${compatibility.length} chars (should be 1-${COMPATIBILITY_MAX_LEN})` }] };
  }
  return { passes: [{ text: "compatibility field within length limit" }] };
}

export function checkMetadata(model: SkillModel, _ctx: AgentSkillValidateContext): AgentSkillCheckResult {
  const raw = model.data.metadata;
  if (raw === undefined) return {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { warnings: [{ text: "metadata should be a map of string keys to string values" }] };
  }
  const nonString = Object.entries(raw as Record<string, unknown>).filter(([, v]) => typeof v !== "string");
  if (nonString.length > 0) {
    return { warnings: [{ text: `metadata values should be strings; non-string keys: ${nonString.map(([k]) => k).join(", ")}` }] };
  }
  return { passes: [{ text: "metadata is a valid string map" }] };
}

export function checkUnknownFields(model: SkillModel, _ctx: AgentSkillValidateContext): AgentSkillCheckResult {
  const warnings = Object.keys(model.data)
    .filter((k) => !AGENTSKILLS_FIELDS.has(k))
    .map((k) => ({ text: `"${k}" is not part of the agentskills.io spec (may be a Claude Code / provider-specific extension)` }));
  return { warnings };
}

export function checkBody(model: SkillModel, _ctx: AgentSkillValidateContext): AgentSkillCheckResult {
  if (!model.content.trim()) {
    return { errors: [{ text: "Markdown body is empty" }] };
  }
  return { passes: [{ text: "Markdown body is non-empty" }] };
}

/** Level 1: metadata (name + description) is always loaded — flagged here mainly as a summary line. */
export function checkLevel1Metadata(model: SkillModel, _ctx: AgentSkillValidateContext): AgentSkillCheckResult {
  const tokens = estimateTokens(String(model.data.name ?? "")) + estimateTokens(String(model.data.description ?? ""));
  return { passes: [{ text: `Level 1 (metadata): ~${tokens} tokens` }] };
}

/** Level 2: SKILL.md body should stay under ~5000 tokens / 500 lines so it's cheap to activate. */
export function checkLevel2Budget(model: SkillModel, _ctx: AgentSkillValidateContext): AgentSkillCheckResult {
  const lines = model.content.split("\n").length;
  const tokens = estimateTokens(model.content);
  const warnings: CheckItem[] = [];
  if (tokens > BODY_TOKEN_BUDGET) {
    warnings.push({ text: `Level 2 (instructions) body is ~${tokens} tokens, over the ${BODY_TOKEN_BUDGET}-token recommendation — move detail into references/` });
  }
  if (lines > BODY_LINE_BUDGET) {
    warnings.push({ text: `Level 2 (instructions) body is ${lines} lines, over the ${BODY_LINE_BUDGET}-line recommendation — move detail into references/` });
  }
  if (warnings.length > 0) return { warnings };
  return { passes: [{ text: `Level 2 (instructions): ~${tokens} tokens, ${lines} lines — within budget` }] };
}

// Matches markdown links [text](target) and bare relative paths into supporting dirs
// (e.g. "scripts/extract.py" mentioned as a runnable command, per the spec's file-references example).
const MD_LINK_RE = /\[[^\]]*\]\(([^)\s]+)\)/g;
const BARE_REF_RE = /\b((?:references|scripts|assets)\/[\w.\-/]+)/g;

function isExternal(target: string): boolean {
  return /^([a-z][a-z0-9+.-]*:)?\/\//i.test(target) || target.startsWith("mailto:") || target.startsWith("#");
}

function extractReferences(content: string): string[] {
  const refs = new Set<string>();
  for (const m of content.matchAll(MD_LINK_RE)) {
    const target = m[1]!;
    if (!isExternal(target)) refs.add(target);
  }
  for (const m of content.matchAll(BARE_REF_RE)) {
    refs.add(m[1]!);
  }
  return [...refs];
}

function pathDepth(target: string): number {
  const clean = target.replace(/^\.\//, "").split("#")[0]!;
  return clean.split("/").filter(Boolean).length - 1; // "references/REFERENCE.md" -> depth 1 (0-indexed: file itself doesn't count)
}

/** Level 3: resources are loaded on demand; keep references one level deep from SKILL.md and pointing at real files. */
export function checkLevel3References(model: SkillModel, ctx: AgentSkillValidateContext): AgentSkillCheckResult {
  const refs = extractReferences(model.content);
  if (refs.length === 0) {
    return { passes: [{ text: "Level 3 (resources): no file references in body" }] };
  }
  const warnings: CheckItem[] = [];
  for (const ref of refs) {
    if (pathDepth(ref) > 1) {
      warnings.push({ text: `Reference "${ref}" is nested more than one level deep — keep file references one level deep from SKILL.md` });
      continue;
    }
    const target = resolve(ctx.skillDir, ref.split("#")[0]!);
    if (!existsSync(target)) {
      warnings.push({ text: `Reference "${ref}" points to a file that does not exist` });
    }
  }
  if (warnings.length > 0) return { warnings };
  return { passes: [{ text: `Level 3 (resources): ${refs.length} reference(s), all one level deep and resolvable` }] };
}

const EMPTY: AgentSkillValidateResult = { errors: [], warnings: [], passes: [] };

const checks: AgentSkillCheck[] = [
  checkName,
  checkDescription,
  checkCompatibility,
  checkMetadata,
  checkUnknownFields,
  checkBody,
  checkLevel1Metadata,
  checkLevel2Budget,
  checkLevel3References,
];

export function validateAgentSkill(
  model: SkillModel,
  ctx: AgentSkillValidateContext
): AgentSkillValidateResult {
  return checks.reduce<AgentSkillValidateResult>((acc, check) => merge(acc, check(model, ctx)), EMPTY);
}
