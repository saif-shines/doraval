import { describe, expect, test } from "bun:test";
import {
  STRUCTURE_CHECK_CODES,
  DRIFT_CATEGORY_CODES,
  LINT_CATEGORY_CODES,
  SESSION_CODES,
  PARSE_FAILURE_CODE,
  SCENARIO_FILE_CODE,
  SCRIPT_SECURITY_CODE,
  PRINCIPLE_CODE,
} from "./bindings.js";
import { ruleByCode } from "./registry.js";

const allCodes = [
  ...Object.values(STRUCTURE_CHECK_CODES),
  ...Object.values(DRIFT_CATEGORY_CODES),
  ...Object.values(LINT_CATEGORY_CODES),
  ...Object.values(SESSION_CODES),
  PARSE_FAILURE_CODE,
  SCENARIO_FILE_CODE,
  SCRIPT_SECURITY_CODE,
  PRINCIPLE_CODE,
];

describe("bindings", () => {
  test("every bound code is a real registry code", () => {
    for (const code of allCodes) expect(ruleByCode(code), `missing ${code}`).toBeDefined();
  });

  test("all structure/heuristic/llm/session rules are covered exactly once", () => {
    const counts = new Map<string, number>();
    for (const code of allCodes) counts.set(code, (counts.get(code) ?? 0) + 1);
    for (let i = 1; i <= 33; i++) {
      const code = `R${String(i).padStart(3, "0")}`;
      expect(counts.get(code), `code ${code} bound ${counts.get(code) ?? 0}x`).toBe(1);
    }
  });

  test("session map covers sess-001..006", () => {
    expect(Object.keys(SESSION_CODES).sort()).toEqual([
      "sess-001", "sess-002", "sess-003", "sess-004", "sess-005", "sess-006",
    ]);
  });
});
