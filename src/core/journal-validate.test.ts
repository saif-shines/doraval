import { describe, expect, test } from "bun:test";
import { validateEntry, CANONICAL_SCOPES, VALID_STATUSES } from "./journal-validate.js";

describe("validateEntry", () => {
  test("accepts a fully valid entry", () => {
    const result = validateEntry({
      title: "Test decision",
      pushback: 7,
      scope: ["naming", "cli"],
      author: "human",
      date: "2026-05-25",
      status: "active",
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("reports missing required fields", () => {
    const result = validateEntry({});

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("pushback is required");
    expect(result.errors).toContain("scope is required and must be a non-empty array");
    expect(result.errors).toContain("author is required");
    expect(result.errors).toContain("date is required");
    expect(result.errors).toContain("status must be one of: active, superseded, retired");
  });

  test("validates pushback range and type", () => {
    expect(validateEntry({ pushback: 0, scope: ["cli"], author: "human", date: "2026-05-25", status: "active" }).errors).toContain("pushback must be an integer between 1 and 10");
    expect(validateEntry({ pushback: 11, scope: ["cli"], author: "human", date: "2026-05-25", status: "active" }).errors).toContain("pushback must be an integer between 1 and 10");
    expect(validateEntry({ pushback: 3.5, scope: ["cli"], author: "human", date: "2026-05-25", status: "active" }).errors).toContain("pushback must be an integer between 1 and 10");
  });

  test("warns on non-canonical scopes but still accepts", () => {
    const result = validateEntry({
      title: "Test with custom scope",
      pushback: 5,
      scope: ["custom-tag", "naming"],
      author: "human",
      date: "2026-05-25",
      status: "active",
    });

    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("custom-tag");
  });

  test("warns on non-standard author format", () => {
    const result = validateEntry({
      pushback: 4,
      scope: ["cli"],
      author: "saif",
      date: "2026-05-25",
      status: "active",
    });

    expect(result.warnings.some(w => w.includes("recommended pattern"))).toBe(true);
  });

  test("exports constants", () => {
    expect(CANONICAL_SCOPES).toContain("naming");
    expect(VALID_STATUSES).toContain("active");
  });
});
