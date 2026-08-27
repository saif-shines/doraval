import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { collectFixes } from "./fix-engine.js";
import type { ReviewFinding } from "./review.js";

const FALLBACK = "Edit only the span this Finding names. Leave the rest.";

describe("collectFixes", () => {
  test("add_field without readable SKILL.md is a Judgment object", () => {
    const findings: ReviewFinding[] = [
      { id: "struct-001", tier: "structure", severity: "error", message: 'Missing "name" field', fixable: true, fix: { type: "add_field", description: "Add name field from directory name" } },
    ];
    const result = collectFixes(findings, "/some/skill");
    expect(result.mechanical).toEqual([]);
    expect(result.judgment).toHaveLength(1);
    expect(result.judgment[0]).toMatchObject({
      message: 'Missing "name" field',
      severity: "error",
      hint: FALLBACK,
    });
    expect(result.judgment[0]!.code).toBeUndefined();
    expect(result.judgment[0]!.docUrl).toBeUndefined();
  });

  test("content Finding becomes a Judgment object with Finding hint first", () => {
    const findings: ReviewFinding[] = [
      {
        id: "heur-001",
        tier: "heuristics",
        severity: "warning",
        message: "No guardrails found",
        hint: "Add a MUST or MUST NOT line",
        code: "R018",
        docUrl: "https://doraval.dev/reference/rules/R018",
        fixable: true,
        fix: { type: "content", description: "Add MUST/MUST NOT guardrails" },
      },
    ];
    const result = collectFixes(findings, "/some/skill");
    expect(result.mechanical).toEqual([]);
    expect(result.judgment).toEqual([
      {
        message: "No guardrails found",
        severity: "warning",
        hint: "Add a MUST or MUST NOT line",
        code: "R018",
        docUrl: "https://doraval.dev/reference/rules/R018",
      },
    ]);
  });

  test("hint does not use the rule catalog title", () => {
    const findings: ReviewFinding[] = [
      {
        id: "heur-002",
        tier: "heuristics",
        severity: "warning",
        message: "No trigger phrases",
        code: "R014",
        fixable: true,
        fix: { type: "content", description: "Add trigger phrases" },
      },
    ];
    const result = collectFixes(findings, "/some/skill");
    expect(result.judgment[0]!.hint).toBe(FALLBACK);
    expect(result.judgment[0]!.hint).not.toBe("Trigger clarity (heuristic)");
    expect(result.judgment[0]!.docUrl).toBe("https://doraval.dev/reference/rules/R014");
  });

  test("hint falls back to the generic line when there is no Finding hint and no rule", () => {
    const findings: ReviewFinding[] = [
      { id: "struct-002", tier: "structure", severity: "warning", message: "Unknown field", fixable: false },
    ];
    const result = collectFixes(findings, "/some/skill");
    expect(result.judgment).toEqual([
      { message: "Unknown field", severity: "warning", hint: FALLBACK },
    ]);
  });

  test("pass and info Findings are not Judgment items", () => {
    const findings: ReviewFinding[] = [
      { id: "struct-001", tier: "structure", severity: "pass", message: "Name present", fixable: false },
      { id: "sess-001", tier: "sessions", severity: "info", message: "Never invoked", fixable: false, code: "R028" },
    ];
    const result = collectFixes(findings, "/some/skill");
    expect(result.mechanical).toEqual([]);
    expect(result.judgment).toEqual([]);
  });

  test("mechanical name add_field stays mechanical", () => {
    const dir = mkdtempSync(join(tmpdir(), "dora-fix-mech-"));
    writeFileSync(join(dir, "SKILL.md"), "---\ndescription: does a thing\n---\n\n1. Run it.\n");
    const findings: ReviewFinding[] = [
      { id: "struct-001", tier: "structure", severity: "error", message: 'Missing "name" field', fixable: true, fix: { type: "add_field", description: "Add name field from directory name" } },
    ];
    const result = collectFixes(findings, dir);
    expect(result.mechanical).toHaveLength(1);
    expect(result.judgment).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});