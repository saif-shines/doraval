import { describe, expect, test } from "bun:test";
import { shouldUpdate, buildUpgradeCommand } from "./update.js";

describe("update core", () => {
  test("shouldUpdate detects newer version", () => {
    expect(shouldUpdate("0.2.23", "0.2.24")).toBe(true);
    expect(shouldUpdate("0.2.24", "0.2.24")).toBe(false);
  });

  test("buildUpgradeCommand for homebrew", () => {
    const cmd = buildUpgradeCommand({ type: "homebrew" });
    expect(cmd).toEqual(["brew", "upgrade", "doraval"]);
  });
});
