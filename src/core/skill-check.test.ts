import { describe, expect, test } from "bun:test";
import { resolve } from "path";
import { checkSkill } from "./skill-check.js";
import { resolveEffectiveRules } from "./rules/resolve.js";

const FIXTURES = resolve(import.meta.dir, "../../test/fixtures");
const rules = () => resolveEffectiveRules(null).map;

describe("checkSkill", () => {
  test("valid skill yields stamped structure and heuristic Findings", async () => {
    const result = await checkSkill(resolve(FIXTURES, "skills/minimal-good"), rules());
    expect(result.model).toBeDefined();
    expect(result.findings.some((f) => f.tier === "structure" && f.code === "R006")).toBe(true);
    expect(result.findings.some((f) => f.tier === "heuristics")).toBe(true);
    expect(result.findings.every((f) => f.tier === "structure" || f.tier === "heuristics")).toBe(true);
    for (const f of result.findings) {
      expect(f.code).toMatch(/^R\d{3}$/);
      expect(f.slug).toBeTruthy();
    }
  });

  test("load failure is one stamped structure Finding", async () => {
    const result = await checkSkill("/nonexistent/skill", rules());
    expect(result.model).toBeUndefined();
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      tier: "structure",
      severity: "error",
      code: "R002",
      slug: "frontmatter-parse",
    });
  });
});
