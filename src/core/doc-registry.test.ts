import { describe, expect, test } from "bun:test";
import { getDocUrl, getProviderDocUrl, getFindingDocUrl, withDocUrl } from "./doc-registry.js";

const SITE = "https://doraval.thehacksmith.dev";

describe("getDocUrl", () => {
  test("maps a known code prefix to its doc page", () => {
    expect(getDocUrl("E-PRE-002")).toBe(`${SITE}/concepts/review-tiers/`);
  });

  test("maps exact finding codes", () => {
    expect(getDocUrl("sess-003")).toBe(`${SITE}/concepts/review-tiers/`);
    expect(getDocUrl("E-SCAN-SHADOW")).toBe(`${SITE}/commands/scan/`);
    expect(getDocUrl("E-INSTALL-MISSING")).toBe(`${SITE}/get-started/installation/`);
  });

  test("returns undefined for an unmapped prefix", () => {
    expect(getDocUrl("E-UPD-001")).toBeUndefined();
  });
});

describe("getFindingDocUrl", () => {
  test("prefers exact code over tier", () => {
    expect(getFindingDocUrl({ code: "E-SCAN-SHADOW", tier: "structure" })).toBe(
      `${SITE}/commands/scan/`,
    );
  });

  test("falls back to tier when no code", () => {
    expect(getFindingDocUrl({ tier: "sessions" })).toBe(`${SITE}/concepts/review-tiers/`);
  });

  test("falls back to provider docs", () => {
    expect(getFindingDocUrl({ provider: "claude" })).toBe("https://code.claude.com/llms.txt");
  });

  test("undefined when nothing maps", () => {
    expect(getFindingDocUrl({})).toBeUndefined();
    expect(getFindingDocUrl({ code: "nope-999" })).toBeUndefined();
  });
});

describe("withDocUrl", () => {
  test("attaches docUrl from code", () => {
    const f = withDocUrl({ code: "sess-002", message: "x" });
    expect(f.docUrl).toBe(`${SITE}/concepts/review-tiers/`);
  });

  test("preserves existing docUrl", () => {
    const f = withDocUrl({ code: "sess-002", docUrl: "https://example.com/keep", message: "x" });
    expect(f.docUrl).toBe("https://example.com/keep");
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
