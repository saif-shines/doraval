import { RULES, resolveRuleId, type RuleSeverity } from "./registry.js";
import { getPackage, DEFAULT_PACKAGE } from "./packages.js";
import { resolveProjectName, type JournalConfig, type RulesConfig, type RuleOverride } from "../journal-config.js";

export interface EffectiveRule {
  enabled: boolean;
  severity: RuleSeverity;
  overridden: boolean;
}

export interface EffectiveRules {
  map: Map<string, EffectiveRule>;
  warnings: string[];
}

export function overrideToState(
  override: RuleOverride,
  defaultSeverity: RuleSeverity,
): { enabled: boolean; severity: RuleSeverity } {
  switch (override) {
    case "off":
      return { enabled: false, severity: defaultSeverity };
    case "on":
      return { enabled: true, severity: defaultSeverity };
    case "fyi":
      return { enabled: true, severity: "info" };
    case "error":
      return { enabled: true, severity: "error" };
    case "warning":
      return { enabled: true, severity: "warning" };
  }
}

function applyPackage(map: Map<string, EffectiveRule>, packageName: string | undefined): void {
  const pkg = packageName ? getPackage(packageName) : undefined;
  const codes = new Set(pkg ? pkg.rules : getPackage(DEFAULT_PACKAGE)!.rules);
  for (const rule of RULES) map.get(rule.code)!.enabled = codes.has(rule.code);
}

function applyOverrides(
  map: Map<string, EffectiveRule>,
  overrides: Record<string, RuleOverride> | undefined,
  warnings: string[],
): void {
  if (!overrides) return;

  for (const [key, value] of Object.entries(overrides)) {
    const rule = resolveRuleId(key);
    if (!rule) {
      warnings.push(`Unknown rule "${key}" in config — ignored.`);
      continue;
    }

    const { enabled, severity } = overrideToState(value, rule.defaultSeverity);
    const overridden = value === "error" || value === "warning" || value === "fyi";
    map.set(rule.code, { enabled, severity, overridden });
  }
}

export function resolveEffectiveRules(config: JournalConfig | null, cwd?: string): EffectiveRules {
  const warnings: string[] = [];
  const map = new Map<string, EffectiveRule>();
  for (const rule of RULES) {
    map.set(rule.code, { enabled: false, severity: rule.defaultSeverity, overridden: false });
  }

  const globalRules: RulesConfig | undefined = config?.rules;
  applyPackage(map, globalRules?.package);
  applyOverrides(map, globalRules?.overrides, warnings);

  const projectName = config ? resolveProjectName(config, cwd) : null;
  const projectRules: RulesConfig | undefined = projectName
    ? config?.journal.projects[projectName]?.rules
    : undefined;
  if (projectRules) {
    if (projectRules.package) applyPackage(map, projectRules.package);
    applyOverrides(map, projectRules.overrides, warnings);
  }

  for (const rule of RULES) {
    if (!rule.locked) continue;
    const effective = map.get(rule.code)!;
    if (!effective.enabled) {
      warnings.push(`${rule.code} ${rule.slug} is locked (safety). Cannot disable — kept on.`);
    }
    if (effective.severity === "info" && rule.defaultSeverity !== "info") {
      warnings.push(
        `${rule.code} ${rule.slug} is locked (safety). Cannot demote to FYI — kept at ${rule.defaultSeverity}.`,
      );
    }
    map.set(rule.code, { enabled: true, severity: rule.defaultSeverity, overridden: false });
  }

  return { map, warnings };
}
