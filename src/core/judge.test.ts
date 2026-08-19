import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { decideJudgeMode, judge } from "./judge.js";

const base = { model: "gpt-4o-mini", max_tool_calls: 200, save_history: true };
const Tiny = z.object({ ok: z.boolean() });

describe("decideJudgeMode", () => {
  test("auto + apiAvailable -> api", () => {
    expect(decideJudgeMode({ ...base, judge: "auto" }, { apiAvailable: true, ci: false })).toBe("api");
  });

  test("auto + no api + interactive -> delegate", () => {
    expect(decideJudgeMode({ ...base, judge: "auto" }, { apiAvailable: false, ci: false })).toBe("delegate");
  });

  test("auto + no api + ci -> fail", () => {
    expect(decideJudgeMode({ ...base, judge: "auto" }, { apiAvailable: false, ci: true })).toBe("fail");
  });

  test("explicit delegate ignores api and ci", () => {
    expect(decideJudgeMode({ ...base, judge: "delegate" }, { apiAvailable: true, ci: true })).toBe("delegate");
  });

  test("explicit api without key -> fail", () => {
    expect(decideJudgeMode({ ...base, judge: "api" }, { apiAvailable: false, ci: false })).toBe("fail");
  });
});

describe("judge", () => {
  test("delegate pref returns the prompt and does not call the API", async () => {
    const result = await judge({
      prompt: "RUBRIC PROMPT BODY",
      schema: Tiny,
      ci: true,
      evalCfg: { ...base, judge: "delegate" },
    });
    expect(result).toEqual({ mode: "delegate", prompt: "RUBRIC PROMPT BODY" });
  });

  test("fail when auto, ci, and no API", async () => {
    const result = await judge({
      prompt: "P",
      schema: Tiny,
      ci: true,
      evalCfg: { ...base, judge: "auto" },
      apiAvailable: false,
    });
    expect(result).toEqual({ mode: "fail" });
  });
});
