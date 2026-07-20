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
  test("codes are frozen R001..R033 in order", () => {
    expect(RULES.map((r) => r.code)).toEqual(
      Array.from({ length: 33 }, (_, i) => `R${String(i + 1).padStart(3, "0")}`),
    );
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
