import { describe, test, expect } from "bun:test";
import { RULES, ruleByCode, ruleBySlug, resolveRuleId, RULE_DOC_BASE } from "./registry.js";

describe("registry integrity", () => {
  test("codes are unique", () => {
    const codes = RULES.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
  test("slugs are unique", () => {
    const slugs = RULES.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
  test("rule identity metadata is frozen", () => {
    expect(RULES.map(({ code, slug, tier, defaultSeverity, source, locked }) =>
      [code, slug, tier, defaultSeverity, source, locked]
    )).toEqual([
      ["R001", "frontmatter-presence", "structure", "error", "check", false],
      ["R002", "frontmatter-parse", "structure", "error", "check", true],
      ["R003", "no-injection", "structure", "error", "check", true],
      ["R004", "skill-name", "structure", "error", "check", false],
      ["R005", "description", "structure", "warning", "check", false],
      ["R006", "body-present", "structure", "error", "check", false],
      ["R007", "body-size", "structure", "warning", "check", false],
      ["R008", "allowed-tools-portability", "structure", "warning", "check", false],
      ["R009", "advanced-fields", "structure", "info", "check", false],
      ["R010", "unknown-fields", "structure", "warning", "check", false],
      ["R011", "supporting-dirs", "structure", "info", "check", false],
      ["R012", "dynamic-injection", "structure", "warning", "check", false],
      ["R013", "scenario-file-valid", "structure", "error", "check", false],
      ["R014", "drift-trigger", "heuristic", "warning", "check", false],
      ["R015", "drift-structure", "heuristic", "warning", "check", false],
      ["R016", "drift-voice", "heuristic", "warning", "check", false],
      ["R017", "drift-example", "heuristic", "warning", "check", false],
      ["R018", "drift-guardrail", "heuristic", "warning", "check", false],
      ["R019", "drift-clarity", "heuristic", "warning", "check", false],
      ["R020", "script-security", "heuristic", "warning", "check", true],
      ["R021", "principle-adherence", "heuristic", "warning", "check", false],
      ["R022", "llm-clarity", "llm", "warning", "llm-lint", false],
      ["R023", "llm-actionability", "llm", "warning", "llm-lint", false],
      ["R024", "llm-contradiction", "llm", "error", "llm-lint", false],
      ["R025", "llm-trigger", "llm", "warning", "llm-lint", false],
      ["R026", "llm-scope", "llm", "warning", "llm-lint", false],
      ["R027", "scenario-coverage", "llm", "warning", "llm-scenario", false],
      ["R028", "session-invoked", "session", "info", "session", false],
      ["R029", "session-not-invoked", "session", "warning", "session", false],
      ["R030", "session-none", "session", "info", "session", false],
      ["R031", "memory-session-presence", "session", "info", "session", false],
      ["R032", "binding-rule-inventory", "session", "info", "session", false],
      ["R033", "memory-rule-adherence", "session", "warning", "session", false],
    ]);
  });
  test("every rule has a docUrl under the rules base", () => {
    for (const r of RULES) expect(r.docUrl).toBe(`${RULE_DOC_BASE}/${r.code}`);
  });
  test("locked set is exactly R002, R003, R020", () => {
    expect(RULES.filter((r) => r.locked).map((r) => r.code)).toEqual(["R002", "R003", "R020"]);
  });
  test("resolveRuleId accepts code and slug", () => {
    expect(resolveRuleId("R003")?.slug).toBe("no-injection");
    expect(resolveRuleId("no-injection")?.code).toBe("R003");
    expect(resolveRuleId("nope")).toBeUndefined();
  });
  test("lookups", () => {
    expect(ruleByCode("R001")?.slug).toBe("frontmatter-presence");
    expect(ruleBySlug("body-size")?.code).toBe("R007");
  });
});
