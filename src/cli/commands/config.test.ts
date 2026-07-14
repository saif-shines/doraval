import { describe, expect, test } from "bun:test";
import {
  formatConfigTable,
  getNestedValue,
  listConfigRows,
  setNestedValue,
  KNOWN_CONFIG_KEYS,
} from "./config.js";

describe("config helpers (B37)", () => {
  test("KNOWN_CONFIG_KEYS includes eval.model", () => {
    expect(KNOWN_CONFIG_KEYS.some((k) => k.key === "eval.model")).toBe(true);
  });

  test("getNestedValue / setNestedValue", () => {
    const o: Record<string, unknown> = {};
    setNestedValue(o, "eval.model", "gpt-4o-mini");
    expect(getNestedValue(o, "eval.model")).toBe("gpt-4o-mini");
    expect(getNestedValue(o, "eval.missing")).toBeUndefined();
  });

  test("listConfigRows shows not set when empty", () => {
    const rows = listConfigRows(null);
    expect(rows.length).toBe(KNOWN_CONFIG_KEYS.length);
    expect(rows.every((r) => r.value === "(not set)")).toBe(true);
  });

  test("formatConfigTable has header and keys", () => {
    const table = formatConfigTable(listConfigRows({ eval: { model: "m" } }));
    expect(table).toContain("eval.model");
    expect(table).toContain("key");
    expect(table).toContain("m");
  });
});
