import { describe, test, expect } from "bun:test";
import { getEvalsDir, getEvalConfig, getDoravalDir } from "./journal-config.js";
import { join } from "path";

describe("getEvalsDir", () => {
  test("returns evals/ under doraval dir", () => {
    const result = getEvalsDir();
    expect(result).toBe(join(getDoravalDir(), "evals"));
  });
});

describe("getEvalConfig", () => {
  test("returns defaults when config is null", () => {
    const result = getEvalConfig(null);
    expect(result.max_tool_calls).toBe(200);
    expect(result.save_history).toBe(true);
    expect(result.model).toBe("");
  });

  test("returns values from config when present", () => {
    const config = {
      journal: { repo: "test/repo", projects: {} },
      eval: { model: "claude-sonnet-4-6", max_tool_calls: 300, save_history: false },
    };
    const result = getEvalConfig(config);
    expect(result.model).toBe("claude-sonnet-4-6");
    expect(result.max_tool_calls).toBe(300);
    expect(result.save_history).toBe(false);
  });
});
