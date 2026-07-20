import { describe, test, expect } from "bun:test";
import { BUILTIN_PACKAGES, getPackage, DEFAULT_PACKAGE } from "./packages.js";
import { RULES } from "./registry.js";

describe("built-in packages", () => {
  test("recommended, strict, minimal exist", () => {
    expect(Object.keys(BUILTIN_PACKAGES).sort()).toEqual(["minimal", "recommended", "strict"]);
  });
  test("strict enables every rule", () => {
    expect([...BUILTIN_PACKAGES.strict.rules].sort()).toEqual(RULES.map((r) => r.code).sort());
  });
  test("all package rule codes are real", () => {
    const valid = new Set(RULES.map((r) => r.code));
    for (const p of Object.values(BUILTIN_PACKAGES)) {
      for (const c of p.rules) expect(valid.has(c)).toBe(true);
    }
  });
  test("minimal includes the locked set", () => {
    for (const c of ["R002", "R003", "R020"]) expect(BUILTIN_PACKAGES.minimal.rules).toContain(c);
  });
  test("DEFAULT_PACKAGE is recommended", () => {
    expect(DEFAULT_PACKAGE).toBe("recommended");
    expect(getPackage(DEFAULT_PACKAGE)).toBeDefined();
  });
});
