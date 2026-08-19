import { describe, test, expect } from "bun:test";
import { padIdx, tallyFindings, reviewEval } from "./review-control.js";

describe("padIdx", () => {
  test("zero-pads to 3", () => {
    expect(padIdx(1)).toBe("001");
    expect(padIdx(42)).toBe("042");
  });
});

describe("tallyFindings", () => {
  test("counts severities", () => {
    const t = tallyFindings([
      { severity: "pass" as const },
      { severity: "warning" as const },
      { severity: "error" as const },
      { severity: "pass" as const },
    ]);
    expect(t.passed).toBe(2);
    expect(t.warnings).toBe(1);
    expect(t.errors).toBe(1);
  });
});

describe("reviewEval", () => {
  test("empty config yields default eval and empty agent command", () => {
    const ctx = reviewEval(null);
    expect(ctx.agentCfg.command).toBe("");
    expect(ctx.evalCfg.judge).toBeDefined();
  });
});
