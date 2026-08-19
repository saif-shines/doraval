export {
  RULES,
  RULE_DOC_BASE,
  resolveRuleId,
  ruleByCode,
  type Rule,
  type RuleSeverity,
  type RuleSource,
  type RuleTier,
} from "./registry.js";
export {
  BUILTIN_PACKAGES,
  DEFAULT_PACKAGE,
  getPackage,
  type Package,
} from "./packages.js";
export {
  overrideToState,
  resolveEffectiveRules,
  type EffectiveRule,
  type EffectiveRules,
} from "./resolve.js";
export { stampRule } from "./apply.js";
export {
  applyOverride,
  applyPackage,
  buildListRows,
  displaySeverity,
  explainRule,
  readScopeRules,
  resolveListPackageName,
  resolveScope,
  validatePackagePreview,
  validateRulesConfig,
  type ConfigResult,
  type MutationResult,
  type RuleRow,
  type Scope,
  type ScopeResult,
} from "./mutate.js";
