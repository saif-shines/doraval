import { describe, expect, test } from "bun:test";
import { canPromptInteractively } from "./fix.js";

describe("canPromptInteractively", () => {
  test("true only for interactive human runs", () => {
    expect(canPromptInteractively(false, false, "table", true)).toBe(true);
  });
  test("false when --yes (pre-approved)", () => {
    expect(canPromptInteractively(true, false, "table", true)).toBe(false);
  });
  test("false when --dry-run", () => {
    expect(canPromptInteractively(false, true, "table", true)).toBe(false);
  });
  test("false in json mode", () => {
    expect(canPromptInteractively(false, false, "json", true)).toBe(false);
  });
  test("false without a TTY", () => {
    expect(canPromptInteractively(false, false, "table", false)).toBe(false);
  });
});
