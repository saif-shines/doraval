import { describe, expect, test } from "bun:test";
import { resolveOutputMode } from "./out.js";

describe("resolveOutputMode", () => {
  test("defaults to table, not ci", () => {
    expect(resolveOutputMode({})).toEqual({ format: "table", ci: false });
    expect(resolveOutputMode()).toEqual({ format: "table", ci: false });
  });

  test("--format json selects json", () => {
    expect(resolveOutputMode({ format: "json" })).toEqual({ format: "json", ci: false });
  });

  test("--ci implies json", () => {
    expect(resolveOutputMode({ ci: true })).toEqual({ format: "json", ci: true });
  });

  test("explicit table + ci still yields json (ci wins)", () => {
    expect(resolveOutputMode({ format: "table", ci: true })).toEqual({ format: "json", ci: true });
  });

  test("unknown format falls back to table", () => {
    expect(resolveOutputMode({ format: "yaml" })).toEqual({ format: "table", ci: false });
  });
});
