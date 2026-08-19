import { describe, expect, test } from "bun:test";
import { formatFindingText, publicRuleCode, severityLabel, shouldAskReviewLimit } from "./review.js";

describe("severityLabel", () => {
  test("renders info as FYI without changing other severities", () => {
    expect(severityLabel("info")).toBe("FYI");
    expect(severityLabel("error")).toBe("error");
    expect(severityLabel("warning")).toBe("warning");
    expect(severityLabel("pass")).toBe("pass");
  });
});

describe("formatFindingText", () => {
  test("leads with public rule codes", () => {
    expect(publicRuleCode({ code: "R014" })).toBe("R014");
    expect(publicRuleCode({ code: "E-SCAN-SHADOW" })).toBeUndefined();
    expect(formatFindingText({ code: "R014", message: "No trigger phrases found" })).toBe(
      "R014  No trigger phrases found",
    );
    expect(formatFindingText({ code: "E-SCAN-SHADOW", message: "shadowed" })).toBe("shadowed");
    expect(formatFindingText({ message: "plain" })).toBe("plain");
  });
});

describe("shouldAskReviewLimit", () => {
  test("asks on an interactive table TTY", () => {
    expect(shouldAskReviewLimit({ format: "table", all: false, stdinTty: true, stderrTty: true })).toBe(true);
  });

  test("skips for --all, json, and non-TTY", () => {
    expect(shouldAskReviewLimit({ format: "table", all: true, stdinTty: true, stderrTty: true })).toBe(false);
    expect(shouldAskReviewLimit({ format: "json", all: false, stdinTty: true, stderrTty: true })).toBe(false);
    expect(shouldAskReviewLimit({ format: "table", all: false, stdinTty: false, stderrTty: true })).toBe(false);
  });
});
