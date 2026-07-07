import { describe, expect, test } from "bun:test";
import { reviewSkill, reviewAll } from "./review.js";
import { resolve } from "path";

const FIXTURES = resolve(import.meta.dir, "../../test/fixtures");

describe("reviewSkill", () => {
  test("valid skill produces passing structure + heuristic findings", async () => {
    const result = await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), { quick: true });
    expect(result.tiers.structure.errors).toBe(0);
    expect(result.summary.errors).toBe(0);
    expect(result.tiers.structure.findings.length).toBeGreaterThan(0);
    expect(result.tiers.structure.findings.every(f => f.tier === "structure")).toBe(true);
    expect(result.tiers.llm).toBeUndefined();
  });

  test("invalid skill dir returns a load-error finding", async () => {
    const result = await reviewSkill("/nonexistent/skill", { quick: true });
    expect(result.summary.errors).toBeGreaterThan(0);
    expect(result.tiers.structure.findings.some(f => f.severity === "error")).toBe(true);
  });

  test("findings have sequential ids per tier", async () => {
    const result = await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), { quick: true });
    const structIds = result.tiers.structure.findings.map(f => f.id);
    const heurIds = result.tiers.heuristics.findings.map(f => f.id);
    expect(structIds.every(id => id.startsWith("struct-"))).toBe(true);
    expect(heurIds.every(id => id.startsWith("heur-"))).toBe(true);
  });

  test("origin is classified correctly", async () => {
    const result = await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), { quick: true });
    expect(["authored", "imported", "global"]).toContain(result.origin);
  });

  test("sessions tier is stubbed as unavailable", async () => {
    const result = await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), { quick: true });
    expect(result.tiers.sessions).toBeDefined();
    expect(result.tiers.sessions!.available).toBe(false);
  });

  test("deep mode without LLM throws PrerequisiteError", async () => {
    try {
      await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), { deep: true });
    } catch (e: any) {
      expect(e.code).toBe("E-PRE-002");
    }
  });
});

describe("reviewAll", () => {
  test("reviews all skills found under a root", async () => {
    const results = await reviewAll(resolve(FIXTURES), { quick: true });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.path && r.tiers.structure)).toBe(true);
  });

  test("results sorted by error count descending", async () => {
    const results = await reviewAll(resolve(FIXTURES), { quick: true });
    if (results.length > 1) {
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].summary.errors).toBeGreaterThanOrEqual(results[i].summary.errors);
      }
    }
  });
});
