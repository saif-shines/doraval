import {
  resolveProjectName,
  type JournalConfig,
  type RuleOverride,
  type RulesConfig,
} from "../../core/journal-config.js";
import { getPackage } from "../../core/rules/packages.js";
import { resolveRuleId } from "../../core/rules/registry.js";

export type Scope = { kind: "global" } | { kind: "project"; name: string };
export type ScopeResult = { ok: true; scope: Scope } | { ok: false; error: string };

const UNREGISTERED_PROJECT =
  "Not a registered project. Register it first (dora memory setup) or use --global.";

export function resolveScope(
  config: JournalConfig | null,
  opts: { global?: boolean; project?: boolean; cwd: string },
): ScopeResult {
  if (opts.global) return { ok: true, scope: { kind: "global" } };

  const name = resolveProjectName(config, opts.cwd);
  if (opts.project) {
    return name
      ? { ok: true, scope: { kind: "project", name } }
      : { ok: false, error: UNREGISTERED_PROJECT };
  }

  return name
    ? { ok: true, scope: { kind: "project", name } }
    : { ok: true, scope: { kind: "global" } };
}

export function readScopeRules(config: JournalConfig | null, scope: Scope): RulesConfig {
  if (!config) return {};
  return scope.kind === "global"
    ? config.rules ?? {}
    : config.journal.projects[scope.name]?.rules ?? {};
}

export type MutationResult =
  | { ok: true; config: JournalConfig; message: string }
  | { ok: false; error: string };

function emptyConfig(): JournalConfig {
  return { journal: { repo: "", projects: {} } };
}

function ensureScopeRules(config: JournalConfig, scope: Scope): RulesConfig | { error: string } {
  if (scope.kind === "global") return (config.rules ??= {});

  const project = config.journal.projects[scope.name];
  if (!project) return { error: UNREGISTERED_PROJECT };
  return (project.rules ??= {});
}

export function applyOverride(
  config: JournalConfig | null,
  scope: Scope,
  idOrSlug: string,
  value: RuleOverride,
): MutationResult {
  const rule = resolveRuleId(idOrSlug);
  if (!rule) return { ok: false, error: `Unknown rule "${idOrSlug}". Try "dora rules list".` };
  if (rule.locked && (value === "off" || value === "fyi")) {
    return {
      ok: false,
      error: `${rule.code} ${rule.slug} is locked (safety). Cannot ${value === "off" ? "disable" : "demote"}.`,
    };
  }

  const next = structuredClone(config ?? emptyConfig());
  const rules = ensureScopeRules(next, scope);
  if ("error" in rules) return { ok: false, error: rules.error };
  (rules.overrides ??= {})[rule.slug] = value;
  return { ok: true, config: next, message: `${rule.code} ${rule.slug} → ${value}` };
}

export function applyPackage(
  config: JournalConfig | null,
  scope: Scope,
  packageName: string,
): MutationResult {
  if (!getPackage(packageName)) {
    return {
      ok: false,
      error: `Unknown package "${packageName}". Built-in: recommended, strict, minimal.`,
    };
  }

  const next = structuredClone(config ?? emptyConfig());
  const rules = ensureScopeRules(next, scope);
  if ("error" in rules) return { ok: false, error: rules.error };
  rules.package = packageName;
  return { ok: true, config: next, message: `package → ${packageName}` };
}
