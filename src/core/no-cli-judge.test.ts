import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const JUDGE_FILES = [
  "src/core/skill-lint.ts",
  "src/core/session-eval.ts",
  "src/core/capability-detect.ts",
];

const JUDGE_PRODUCTION_FILES = [
  ...JUDGE_FILES,
  "src/core/llm-judge.ts",
  "src/core/memory-file-review.ts",
];

describe("no CLI-spawn in judge paths", () => {
  for (const f of JUDGE_FILES) {
    test(`${f} does not call invokeAgent`, () => {
      const src = readFileSync(f, "utf8");
      expect(src.includes("invokeAgent(")).toBe(false);
    });
  }

  test("judge paths do not recommend removed CLI judge configuration", () => {
    for (const f of JUDGE_PRODUCTION_FILES) {
      const src = readFileSync(f, "utf8");
      expect(src.includes("eval.judge=cli")).toBe(false);
      expect(src.includes("install a coding agent CLI")).toBe(false);
      expect(src.includes("judge CLI/API")).toBe(false);
    }
  });
});
