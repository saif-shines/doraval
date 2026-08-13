import { describe, test, expect } from "bun:test";
import { decideJudgeMode } from "./judge-runtime.js";

const base = { model: "gpt-4o-mini", max_tool_calls: 200, save_history: true };

describe("decideJudgeMode", () => {
  test("auto + apiAvailable -> api", () => {
    expect(
      decideJudgeMode({ ...base, judge: "auto" }, { apiAvailable: true, ci: false }),
    ).toBe("api");
  });

  test("auto + no api + interactive -> delegate", () => {
    expect(
      decideJudgeMode({ ...base, judge: "auto" }, { apiAvailable: false, ci: false }),
    ).toBe("delegate");
  });

  test("auto + no api + ci -> fail", () => {
    expect(
      decideJudgeMode({ ...base, judge: "auto" }, { apiAvailable: false, ci: true }),
    ).toBe("fail");
  });

  test("explicit delegate ignores api and ci", () => {
    expect(
      decideJudgeMode({ ...base, judge: "delegate" }, { apiAvailable: true, ci: true }),
    ).toBe("delegate");
  });

  test("explicit api without key -> fail", () => {
    expect(
      decideJudgeMode({ ...base, judge: "api" }, { apiAvailable: false, ci: false }),
    ).toBe("fail");
  });
});
