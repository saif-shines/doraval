export type RuleTier = "structure" | "heuristic" | "llm" | "session";
export type RuleSeverity = "error" | "warning" | "info";
export type RuleSource = "check" | "llm-lint" | "llm-scenario" | "session";

export interface Rule {
  code: string;
  slug: string;
  title: string;
  tier: RuleTier;
  defaultSeverity: RuleSeverity;
  locked?: boolean;
  docUrl: string;
  source: RuleSource;
}

export const RULE_DOC_BASE = "https://doraval.thehacksmith.dev/reference/rules";

function rule(
  code: string,
  slug: string,
  title: string,
  tier: RuleTier,
  defaultSeverity: RuleSeverity,
  source: RuleSource,
  locked = false,
): Rule {
  return { code, slug, title, tier, defaultSeverity, source, locked, docUrl: `${RULE_DOC_BASE}/${code}` };
}

export const RULES: readonly Rule[] = [
  rule("R001", "frontmatter-presence", "Frontmatter block present", "structure", "error", "check"),
  rule("R002", "frontmatter-parse", "Frontmatter parses as valid YAML", "structure", "error", "check", true),
  rule("R003", "no-injection", "Frontmatter free of injection vectors", "structure", "error", "check", true),
  rule("R004", "skill-name", "Skill name valid", "structure", "error", "check"),
  rule("R005", "description", "Description present and well-sized", "structure", "warning", "check"),
  rule("R006", "body-present", "Body content present", "structure", "error", "check"),
  rule("R007", "body-size", "Body within size budget", "structure", "warning", "check"),
  rule("R008", "allowed-tools-portability", "allowed-tools is portable", "structure", "warning", "check"),
  rule("R009", "advanced-fields", "Advanced frontmatter fields used correctly", "structure", "info", "check"),
  rule("R010", "unknown-fields", "No unknown frontmatter fields", "structure", "warning", "check"),
  rule("R011", "supporting-dirs", "Supporting directories recognized", "structure", "info", "check"),
  rule("R012", "dynamic-injection", "Dynamic injection markers valid", "structure", "warning", "check"),
  rule("R013", "scenario-file-valid", "scenarios.yaml is valid", "structure", "error", "check"),
  rule("R014", "drift-trigger", "Trigger clarity (heuristic)", "heuristic", "warning", "check"),
  rule("R015", "drift-structure", "Structure consistency (heuristic)", "heuristic", "warning", "check"),
  rule("R016", "drift-voice", "Imperative voice (heuristic)", "heuristic", "warning", "check"),
  rule("R017", "drift-example", "Example presence (heuristic)", "heuristic", "warning", "check"),
  rule("R018", "drift-guardrail", "Guardrail presence (heuristic)", "heuristic", "warning", "check"),
  rule("R019", "drift-clarity", "Clarity (heuristic)", "heuristic", "warning", "check"),
  rule("R020", "script-security", "Bundled scripts free of dangerous patterns", "heuristic", "warning", "check", true),
  rule("R021", "principle-adherence", "Content honors recorded principles", "heuristic", "warning", "check"),
  rule("R022", "llm-clarity", "LLM: instructions unambiguous", "llm", "warning", "llm-lint"),
  rule("R023", "llm-actionability", "LLM: instructions executable", "llm", "warning", "llm-lint"),
  rule("R024", "llm-contradiction", "LLM: no contradictions", "llm", "error", "llm-lint"),
  rule("R025", "llm-trigger", "LLM: trigger specific", "llm", "warning", "llm-lint"),
  rule("R026", "llm-scope", "LLM: focused scope", "llm", "warning", "llm-lint"),
  rule("R027", "scenario-coverage", "LLM: documented scenarios covered", "llm", "warning", "llm-scenario"),
  rule("R028", "session-invoked", "Skill invoked in recent sessions", "session", "info", "session"),
  rule("R029", "session-not-invoked", "Skill never invoked in recent sessions", "session", "warning", "session"),
  rule("R030", "session-none", "No recent sessions found", "session", "info", "session"),
  rule("R031", "memory-session-presence", "Memory file present in recent sessions", "session", "info", "session"),
  rule("R032", "binding-rule-inventory", "Binding MUST/NEVER rules inventoried", "session", "info", "session"),
  rule("R033", "memory-rule-adherence", "Sessions adhere to memory rules", "session", "warning", "session"),
];

const BY_CODE = new Map(RULES.map((r) => [r.code, r]));
const BY_SLUG = new Map(RULES.map((r) => [r.slug, r]));

export function ruleByCode(code: string): Rule | undefined {
  return BY_CODE.get(code);
}

export function ruleBySlug(slug: string): Rule | undefined {
  return BY_SLUG.get(slug);
}

export function resolveRuleId(idOrSlug: string): Rule | undefined {
  return BY_CODE.get(idOrSlug) ?? BY_SLUG.get(idOrSlug);
}
