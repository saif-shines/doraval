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
export type ConfigResult =
  | { ok: true; config: JournalConfig | null }
  | { ok: false; error: string };

const UNREGISTERED_PROJECT =
  "Not a registered project. Register it first (dora memory setup) or use --global.";

export function resolveScope(
  config: JournalConfig | null,
  opts: { global?: boolean; project?: boolean; cwd: string },
): ScopeResult {
  if (opts.global && opts.project) {
    return { ok: false, error: "Choose either --global or --project, not both." };
  }
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

export function validatePackagePreview(packageName: string | undefined): string | null {
  return packageName && !getPackage(packageName)
    ? `Unknown package "${packageName}". Built-in: recommended, strict, minimal.`
    : null;
}

export function applyPackage(
  config: JournalConfig | null,
  scope: Scope,
  packageName: string,
): MutationResult {
  const packageError = validatePackagePreview(packageName);
  if (packageError) return { ok: false, error: packageError };

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

const RULE_OVERRIDE_VALUES = new Set<unknown>(["off", "on", "fyi", "error", "warning"]);

function validateRulesConfig(value: unknown, path: string): string | null {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return `Invalid doraval config: ${path} must be an object.`;
  }

  const rules = value as Record<string, unknown>;
  for (const key of Object.keys(rules)) {
    if (key !== "package" && key !== "overrides") {
      return `Invalid doraval config: unknown field "${path}.${key}".`;
    }
  }

  if (rules.package !== undefined) {
    if (typeof rules.package !== "string" || !getPackage(rules.package)) {
      return `Invalid doraval config: ${path}.package must be one of recommended, strict, minimal.`;
    }
  }

  if (rules.overrides === undefined) return null;
  if (!rules.overrides || typeof rules.overrides !== "object" || Array.isArray(rules.overrides)) {
    return `Invalid doraval config: ${path}.overrides must be an object.`;
  }
  for (const [key, override] of Object.entries(rules.overrides)) {
    if (!resolveRuleId(key)) {
      return `Invalid doraval config: ${path}.overrides contains unknown rule "${key}".`;
    }
    if (!RULE_OVERRIDE_VALUES.has(override)) {
      return `Invalid doraval config: ${path}.overrides.${key} must be one of off, on, fyi, error, warning.`;
    }
  }
  return null;
}

export async function readRulesConfig(): Promise<ConfigResult> {
  let config: unknown;
  try {
    config = await readConfig();
  } catch (error) {
    return {
      ok: false,
      error: `Invalid doraval config: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (config === null) return { ok: true, config: null };
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { ok: false, error: "Invalid doraval config: expected a YAML object." };
  }

  const journal = (config as Record<string, unknown>).journal;
  if (!journal || typeof journal !== "object" || Array.isArray(journal)) {
    return { ok: false, error: "Invalid doraval config: journal must be an object." };
  }
  const root = config as Record<string, unknown>;
  const globalRulesError = validateRulesConfig(root.rules, "rules");
  if (globalRulesError) return { ok: false, error: globalRulesError };

  const projects = (journal as Record<string, unknown>).projects;
  if (!projects || typeof projects !== "object" || Array.isArray(projects)) {
    return { ok: false, error: "Invalid doraval config: journal.projects must be an object." };
  }
  for (const [name, project] of Object.entries(projects)) {
    if (!project || typeof project !== "object" || Array.isArray(project)) {
      return { ok: false, error: `Invalid doraval config: project "${name}" must be an object.` };
    }
    const projectRulesError = validateRulesConfig(
      (project as Record<string, unknown>).rules,
      `journal.projects.${name}.rules`,
    );
    if (projectRulesError) return { ok: false, error: projectRulesError };
  }

  return { ok: true, config: config as JournalConfig };
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
