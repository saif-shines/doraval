import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const JUDGE_FILES = [
  "src/core/skill-lint.ts",
  "src/core/session-eval.ts",
  "src/core/capability-detect.ts",
];

describe("no CLI-spawn in judge paths", () => {
  for (const f of JUDGE_FILES) {
    test(`${f} does not call invokeAgent`, () => {
      const src = readFileSync(f, "utf8");
      expect(src.includes("invokeAgent(")).toBe(false);
    });
  }
});
