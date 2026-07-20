import { describe, expect, test } from "bun:test";
import { stampRule } from "./apply.js";
import type { EffectiveRule } from "./resolve.js";

const effective = (rules: Record<string, EffectiveRule>) => new Map(Object.entries(rules));

describe("stampRule", () => {
  test("stamps identity and applies an explicit severity override", () => {
    const result = stampRule(
      { severity: "error" as const },
      "R005",
      effective({ R005: { enabled: true, severity: "warning", overridden: true } }),
    );
    expect(result).toMatchObject({ code: "R005", slug: "description", severity: "warning" });
    expect(result?.docUrl).toContain("/reference/rules/R005");
  });

  test("preserves emitted severity without an explicit override", () => {
    const result = stampRule(
      { severity: "error" as const },
      "R005",
      effective({ R005: { enabled: true, severity: "warning", overridden: false } }),
    );
    expect(result?.severity).toBe("error");
  });

  test("drops disabled findings including pass findings", () => {
    const rules = effective({ R005: { enabled: false, severity: "warning", overridden: false } });
    expect(stampRule({ severity: "error" as const }, "R005", rules)).toBeNull();
    expect(stampRule({ severity: "pass" as const }, "R005", rules)).toBeNull();
  });

  test("never re-levels pass findings", () => {
    const result = stampRule(
      { severity: "pass" as const },
      "R005",
      effective({ R005: { enabled: true, severity: "error", overridden: true } }),
    );
    expect(result?.severity).toBe("pass");
  });

  test("keepSeverity preserves principle weight severity but still honors disabled", () => {
    const on = effective({ R021: { enabled: true, severity: "warning", overridden: true } });
    expect(stampRule({ severity: "error" as const }, "R021", on, { keepSeverity: true })?.severity).toBe("error");
    const off = effective({ R021: { enabled: false, severity: "warning", overridden: false } });
    expect(stampRule({ severity: "error" as const }, "R021", off, { keepSeverity: true })).toBeNull();
  });
});
