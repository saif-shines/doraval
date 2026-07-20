import { describe, test, expect } from "bun:test";
import { resolveJudgeMode, detectCapabilities } from "./capability-detect.js";

describe("resolveJudgeMode (auto)", () => {
  test("api key present -> api", () => {
    expect(resolveJudgeMode({ apiAvailable: true, ci: false, judgePref: "auto" })).toBe("api");
    expect(resolveJudgeMode({ apiAvailable: true, ci: true, judgePref: "auto" })).toBe("api");
  });
  test("no key, interactive -> delegate", () => {
    expect(resolveJudgeMode({ apiAvailable: false, ci: false, judgePref: "auto" })).toBe("delegate");
  });
  test("no key, --ci -> fail", () => {
    expect(resolveJudgeMode({ apiAvailable: false, ci: true, judgePref: "auto" })).toBe("fail");
  });
});

describe("resolveJudgeMode (explicit)", () => {
  test("judge=api with no key -> fail (never silently delegates)", () => {
    expect(resolveJudgeMode({ apiAvailable: false, ci: false, judgePref: "api" })).toBe("fail");
  });
  test("judge=api with key -> api", () => {
    expect(resolveJudgeMode({ apiAvailable: true, ci: true, judgePref: "api" })).toBe("api");
  });
  test("judge=delegate -> always delegate, even under --ci", () => {
    expect(resolveJudgeMode({ apiAvailable: false, ci: true, judgePref: "delegate" })).toBe("delegate");
    expect(resolveJudgeMode({ apiAvailable: true, ci: true, judgePref: "delegate" })).toBe("delegate");
  });
});

describe("detectCapabilities", () => {
  test("preferred is api or none only", () => {
    const caps = detectCapabilities({ model: "", max_tool_calls: 200, save_history: true });
    expect(["api", "none"]).toContain(caps.preferred);
  });
});
