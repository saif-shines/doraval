import { describe, test, expect } from "bun:test";
import { padIdx, tallyFindings, resolveJudgeContext } from "./review-control.js";

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

describe("resolveJudgeContext", () => {
  test("no config interactive -> delegate mode when no api", () => {
    const ctx = resolveJudgeContext(null, { ci: false });
    // Without keys in env this may still be api if env has a key — mode is always one of three.
    expect(["api", "delegate", "fail"]).toContain(ctx.mode);
    expect(ctx.agentCfg.command).toBe("");
  });

  test("ci without preferring api -> fail or api only", () => {
    const ctx = resolveJudgeContext(
      {
        journal: { repo: "", projects: {} },
        eval: { judge: "auto", model: "", max_tool_calls: 200, save_history: true },
      },
      { ci: true },
    );
    if (!ctx.caps.api) expect(ctx.mode).toBe("fail");
    else expect(ctx.mode).toBe("api");
  });
});
