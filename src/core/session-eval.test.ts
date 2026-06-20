import { describe, test, expect } from "bun:test";
import { buildEvalPrompt, makeUnknownResult } from "./session-eval.js";
import type { SessionPrimitives } from "./session-parse.js";

const mockPrimitives: SessionPrimitives = {
  sessionId: "test-session-001",
  sessionTitle: "Fix auth bug",
  model: "claude-sonnet-4-6",
  agent: "claude-code",
  cwd: "/Users/test/project",
  gitBranch: "main",
  toolCalls: [
    { name: "Skill", input: { skill: "superpowers:systematic-debugging" }, timestamp: "t", index: 0 },
    { name: "Read", input: { file_path: "src/auth.ts" }, timestamp: "t", index: 1 },
    { name: "Edit", input: { file_path: "src/auth.ts" }, timestamp: "t", index: 2 },
  ],
  toolCallCounts: { Skill: 1, Read: 1, Edit: 1 },
  skillsInvoked: ["superpowers:systematic-debugging"],
  userMessages: ["fix the auth bug", "looks good"],
  userTurnCount: 2,
  durationMs: 90000,
};

const mockSkillContent = `---
name: systematic-debugging
description: Use when debugging a bug
---

## Steps
1. Read the failing code
2. Edit the fix
`;

describe("buildEvalPrompt", () => {
  test("includes skill content in prompt", () => {
    const prompt = buildEvalPrompt(mockPrimitives, mockSkillContent, 200);
    expect(prompt).toContain("systematic-debugging");
    expect(prompt).toContain("Read the failing code");
  });

  test("includes tool call sequence", () => {
    const prompt = buildEvalPrompt(mockPrimitives, mockSkillContent, 200);
    expect(prompt).toContain("Skill");
    expect(prompt).toContain("Read");
    expect(prompt).toContain("Edit");
  });

  test("includes user messages", () => {
    const prompt = buildEvalPrompt(mockPrimitives, mockSkillContent, 200);
    expect(prompt).toContain("fix the auth bug");
  });

  test("respects maxToolCalls truncation", () => {
    const manyCallsPrimitives = {
      ...mockPrimitives,
      toolCalls: Array.from({ length: 300 }, (_, i) => ({
        name: "Bash",
        input: { command: `cmd-${i}` },
        timestamp: "t",
        index: i,
      })),
    };
    const prompt = buildEvalPrompt(manyCallsPrimitives, mockSkillContent, 10);
    // Should have truncation note
    expect(prompt).toContain("truncated");
  });
});

describe("makeUnknownResult", () => {
  test("returns UNKNOWN verdict with reason", () => {
    const result = makeUnknownResult(mockPrimitives, "superpowers:systematic-debugging", "LLM failed");
    expect(result.verdict).toBe("UNKNOWN");
    expect(result.verdictReason).toBe("LLM failed");
    expect(result.schemaVersion).toBe(1);
    expect(result.skill).toBe("superpowers:systematic-debugging");
  });
});
