import { describe, expect, test } from "bun:test";
import { getDocUrl, getProviderDocUrl } from "./doc-registry.js";

describe("getDocUrl", () => {
  test("maps a known code prefix to its doc page", () => {
    expect(getDocUrl("E-PRE-002")).toBe("https://doraval.thehacksmith.dev/concepts/review-tiers/");
  });

  test("returns undefined for an unmapped prefix", () => {
    expect(getDocUrl("E-UPD-001")).toBeUndefined();
  });
});

describe("getProviderDocUrl", () => {
  test("maps a known provider to its own docs", () => {
    expect(getProviderDocUrl("claude")).toBe("https://code.claude.com/llms.txt");
  });

  test("returns undefined for a provider with no mapped docs", () => {
    expect(getProviderDocUrl("grok")).toBeUndefined();
  });
});
