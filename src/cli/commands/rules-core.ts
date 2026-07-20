import {
  ensureDoravalDirs,
  readConfig,
  resolveProjectName,
  writeConfig,
  type JournalConfig,
  type RuleOverride,
  type RulesConfig,
} from "../../core/journal-config.js";
import { BUILTIN_PACKAGES, getPackage } from "../../core/rules/packages.js";
import { resolveEffectiveRules } from "../../core/rules/resolve.js";
import { RULES, resolveRuleId, type RuleSeverity } from "../../core/rules/registry.js";

export { readConfig };

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
  const severityRank: Record<"fyi" | RuleSeverity, number> = {
    fyi: 0,
    info: 0,
    warning: 1,
    error: 2,
  };
  const demotesLockedRule =
    value in severityRank && severityRank[value as "fyi" | RuleSeverity] < severityRank[rule.defaultSeverity];
  if (rule.locked && (value === "off" || demotesLockedRule)) {
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

export function displaySeverity(severity: RuleSeverity): string {
  return severity === "info" ? "FYI" : severity;
}

export interface RuleRow {
  code: string;
  slug: string;
  tier: string;
  severity: string;
  enabled: boolean;
  locked: boolean;
  source: string;
  docUrl: string;
}

export function buildListRows(
  config: JournalConfig | null,
  cwd: string,
  packageFilter?: string,
): RuleRow[] {
  const preview = packageFilter ? cfgForPackage(packageFilter) : config;
  const { map } = resolveEffectiveRules(preview, cwd);
  return RULES.map((rule) => {
    const effective = map.get(rule.code)!;
    return {
      code: rule.code,
      slug: rule.slug,
      tier: rule.tier,
      severity: displaySeverity(effective.severity),
      enabled: effective.enabled,
      locked: rule.locked === true,
      source: rule.source,
      docUrl: rule.docUrl,
    };
  });
}

function cfgForPackage(packageName: string): JournalConfig {
  return { journal: { repo: "", projects: {} }, rules: { package: packageName } };
}

export async function persist(config: JournalConfig): Promise<void> {
  ensureDoravalDirs();
  await writeConfig(config);
}

export function explainRule(
  config: JournalConfig | null,
  cwd: string,
  idOrSlug: string,
): { ok: true; lines: string[] } | { ok: false; error: string } {
  const rule = resolveRuleId(idOrSlug);
  if (!rule) return { ok: false, error: `Unknown rule "${idOrSlug}". Try "dora rules list".` };

  const effective = resolveEffectiveRules(config, cwd).map.get(rule.code)!;
  const packages = Object.values(BUILTIN_PACKAGES)
    .filter((pkg) => pkg.rules.includes(rule.code))
    .map((pkg) => pkg.name);
  return {
    ok: true,
    lines: [
      `${rule.code} · ${rule.slug}`,
      rule.title,
      `Tier:            ${rule.tier}`,
      `Default:         ${displaySeverity(rule.defaultSeverity)}`,
      `Effective:       ${effective.enabled ? displaySeverity(effective.severity) : "disabled"}`,
      `Locked:          ${rule.locked ? "yes (safety — cannot be disabled or demoted)" : "no"}`,
      `Packages:        ${packages.join(", ") || "—"}`,
      `Docs:            ${rule.docUrl}`,
    ],
  };
}
