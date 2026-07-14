import { describe, expect, test } from "bun:test";
import {
  formatConfigTable,
  getNestedValue,
  listConfigRows,
  setNestedValue,
  KNOWN_CONFIG_KEYS,
  displayConfigValue,
  isSecretKey,
  formatSetDisplay,
  validateConfigValue,
  editableConfigKeys,
  coerceValue,
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
    // legacy unset keys are omitted
    expect(rows.every((r) => r.value === "(not set)")).toBe(true);
    expect(rows.some((r) => r.key === "eval.model")).toBe(true);
    expect(rows.some((r) => r.key === "journal.repo")).toBe(false);
  });

  test("listConfigRows shows legacy only when set", () => {
    const rows = listConfigRows({ journal: { repo: "me/old", projects: {} } });
    expect(rows.some((r) => r.key === "journal.repo" && r.value === "me/old")).toBe(true);
  });

  test("formatConfigTable has header and keys", () => {
    const table = formatConfigTable(listConfigRows({ eval: { model: "m" } }));
    expect(table).toContain("eval.model");
    expect(table).toContain("key");
    expect(table).toContain("m");
  });

  test("secrets are masked in display and table", () => {
    expect(isSecretKey("eval.api_key")).toBe(true);
    expect(isSecretKey("eval.model")).toBe(false);
    const secret = "sk-abcdefghijklmnop";
    expect(displayConfigValue("eval.api_key", secret)).toBe("sk-a…mnop");
    expect(displayConfigValue("eval.api_key", undefined)).toBe("(not set)");
    expect(formatSetDisplay("eval.api_key", secret)).toBe("(set)");
    expect(formatSetDisplay("eval.model", "gpt")).toBe('"gpt"');

    const table = formatConfigTable(
      listConfigRows({ eval: { api_key: secret, model: "m" } }),
    );
    expect(table).not.toContain(secret);
    expect(table).toContain("sk-a…mnop");
  });

  test("validateConfigValue enforces judge enum", () => {
    expect(validateConfigValue("eval.judge", "auto")).toBeNull();
    expect(validateConfigValue("eval.judge", "nope")).toContain("must be one of");
    expect(validateConfigValue("eval.model", "anything")).toBeNull();
  });

  test("editableConfigKeys excludes legacy", () => {
    expect(editableConfigKeys().every((k) => !k.legacy)).toBe(true);
    expect(editableConfigKeys().some((k) => k.key === "journal.repo")).toBe(false);
  });

  test("coerceValue", () => {
    expect(coerceValue("true")).toBe(true);
    expect(coerceValue("42")).toBe(42);
    expect(coerceValue("gpt")).toBe("gpt");
  });
});
