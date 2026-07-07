import { describe, expect, test } from "bun:test";
import { collectFixes } from "./fix-engine.js";
import type { ReviewFinding } from "./review.js";

describe("collectFixes", () => {
  test("fixable add_field finding produces mechanical fix", () => {
    const findings: ReviewFinding[] = [
      { id: "struct-001", tier: "structure", severity: "error", message: 'Missing "name" field', fixable: true, fix: { type: "add_field", description: "Add name field from directory name" } },
    ];
    const result = collectFixes(findings, "/some/skill");
    // add_field without readable SKILL.md falls back to judgment
    expect(result.judgment.length).toBe(1);
  });

  test("content fix type goes to judgment", () => {
    const findings: ReviewFinding[] = [
      { id: "heur-001", tier: "heuristics", severity: "warning", message: "No guardrails found", fixable: true, fix: { type: "content", description: "Add MUST/MUST NOT guardrails" } },
    ];
    const result = collectFixes(findings, "/some/skill");
    expect(result.mechanical.length).toBe(0);
    expect(result.judgment.length).toBe(1);
  });

  test("non-fixable findings go to judgment", () => {
    const findings: ReviewFinding[] = [
      { id: "struct-002", tier: "structure", severity: "warning", message: "Unknown field", fixable: false },
    ];
    const result = collectFixes(findings, "/some/skill");
    expect(result.judgment.length).toBe(1);
    expect(result.mechanical.length).toBe(0);
  });

  test("passing findings are ignored", () => {
    const findings: ReviewFinding[] = [
      { id: "struct-001", tier: "structure", severity: "pass", message: "Name present", fixable: false },
    ];
    const result = collectFixes(findings, "/some/skill");
    expect(result.mechanical.length).toBe(0);
    expect(result.judgment.length).toBe(0);
  });
});