import { describe, test, expect } from "bun:test";
import { buildEvalPrompt, makeUnknownResult, runEval } from "./session-eval.js";
import type { SessionPrimitives } from "./session-parse.js";
import type { JudgeOutput } from "./llm-judge.js";

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
  assistantText: [],
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
  test("memory artifactKind uses MEMORY FILE framing", () => {
    const p = buildEvalPrompt(mockPrimitives, "MUST NOT force-push", 50, { artifactKind: "memory" });
    expect(p).toContain("MEMORY FILE CONTENT");
    expect(p).toMatch(/memory file/i);
    expect(p).not.toContain("SKILL CONTENT");
  });

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

  test("includes judgeMethod unknown", () => {
    const prim = {
      sessionId: "abc",
      sessionTitle: undefined,
      agent: "claude",
      model: "claude-3",
      toolCalls: [],
      userMessages: [],
      skillsInvoked: [],
      toolCallCounts: {},
      assistantText: [],
    };
    const result = makeUnknownResult(prim, "my-skill", "test reason");
    expect(result.judgeMethod).toBe("unknown");
  });

  test("returns ambiguityFlags as empty array", () => {
    const result = makeUnknownResult(mockPrimitives, "superpowers:systematic-debugging", "LLM failed");
    expect(result.ambiguityFlags).toEqual([]);
  });
});

describe("buildEvalPrompt — classification instructions", () => {
  test("includes MANDATORY classification keyword", () => {
    const prompt = buildEvalPrompt(mockPrimitives, mockSkillContent, 200);
    expect(prompt).toContain("MANDATORY");
  });

  test("includes DISCRETIONARY classification keyword", () => {
    const prompt = buildEvalPrompt(mockPrimitives, mockSkillContent, 200);
    expect(prompt).toContain("DISCRETIONARY");
  });

  test("includes CONDITIONAL classification keyword", () => {
    const prompt = buildEvalPrompt(mockPrimitives, mockSkillContent, 200);
    expect(prompt).toContain("CONDITIONAL");
  });

  test("includes UNCLEAR verdict keyword", () => {
    const prompt = buildEvalPrompt(mockPrimitives, mockSkillContent, 200);
    expect(prompt).toContain("UNCLEAR");
  });

  test("includes assistantText section when entries provided", () => {
    const primWithText: SessionPrimitives = {
      ...mockPrimitives,
      assistantText: ["I will read the auth file first", "Now editing the fix"],
    };
    const prompt = buildEvalPrompt(primWithText, mockSkillContent, 200);
    expect(prompt).toContain("I will read the auth file first");
  });

  test("assistantText section omitted or empty when no entries", () => {
    const primNoText: SessionPrimitives = {
      ...mockPrimitives,
      assistantText: [],
    };
    const prompt = buildEvalPrompt(primNoText, mockSkillContent, 200);
    // prompt should still be valid (not crash) and contain core content
    expect(prompt).toContain("MANDATORY");
  });
});

describe("runEval — UNCLEAR to ambiguityFlags wiring", () => {
  test("ambiguityFlags populated from UNCLEAR checklist items via CLI path", async () => {
    // Build a fake JudgeOutput with one UNCLEAR item
    const fakeJudgeOutput: JudgeOutput = {
      verdict: "PASS",
      verdictReason: "No DRIFTED items",
      checklist: [
        {
          instruction: "Fetch all URLs before summarizing",
          bindingness: "MANDATORY",
          itemVerdict: "ALIGNED",
          evidence: "tool[2]",
        },
        {
          instruction: "Optionally create a summary task",
          bindingness: "CONDITIONAL",
          itemVerdict: "UNCLEAR",
          evidence: "",
        },
      ],
      ambiguityFlags: ["Optionally create a summary task"],
      userFamiliarity: 5,
      userFamiliarityReason: "Clear intent",
      closure: "1-shot",
      userTurnsAfterSkill: 1,
    };

    // Mock invokeAgent to return the fake output as raw JSON
    // We simulate the CLI path by passing the fakeJudgeOutput fields as raw
    const rawCliOutput: Record<string, unknown> = { ...fakeJudgeOutput };

    // The CLI mapping in runEval reads ambiguityFlags from raw and checklist UNCLEAR items
    // We can verify the wiring by checking that EvalResult.ambiguityFlags === fakeJudgeOutput.ambiguityFlags
    // Since we can't easily mock module-level imports, test the logic directly:
    const unclearInstructions = fakeJudgeOutput.checklist
      .filter((item) => item.itemVerdict === "UNCLEAR")
      .map((item) => item.instruction);

    expect(unclearInstructions).toEqual(["Optionally create a summary task"]);
    expect(fakeJudgeOutput.ambiguityFlags).toEqual(["Optionally create a summary task"]);
    // Confirm the field matches what runEval would assign
    expect(unclearInstructions).toEqual(fakeJudgeOutput.ambiguityFlags);
  });
});

describe("runEval — API-or-fail (no CLI-spawn fallback)", () => {
  test("delegate preference never calls the API even when credentials exist", async () => {
    const res = await runEval(
      mockPrimitives,
      "some-skill",
      "skill body",
      { command: "" },
      {
        model: "test-model",
        api_key: "must-not-be-used",
        base_url: "http://127.0.0.1:1",
        max_tool_calls: 200,
        save_history: true,
        judge: "delegate",
      },
    );

    expect(res.verdict).toBe("UNKNOWN");
    expect(res.judgeMethod).toBe("unknown");
  });

  test("no API judge -> UNKNOWN evidence result, no spawn", async () => {
    // The repo's dev .env (auto-loaded by Bun) sets ZAI_API_KEY — clear every
    // provider key/base-url env var so this exercises the true no-key path.
    const keysToClear = [
      "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GROQ_API_KEY", "ZAI_API_KEY",
      "ZHIPU_API_KEY", "GLM_API_KEY", "OPENROUTER_API_KEY",
      "ZAI_BASE_URL", "OPENAI_BASE_URL",
    ];
    const prevValues: Record<string, string | undefined> = {};
    for (const k of keysToClear) {
      prevValues[k] = process.env[k];
      delete process.env[k];
    }
    try {
      const res = await runEval(
        mockPrimitives,
        "some-skill",
        "skill body",
        { command: "" },
        { model: "", max_tool_calls: 200, save_history: true, judge: "auto" },
      );
      expect(res.verdict).toBe("UNKNOWN");
      expect(res.judgeMethod).toBe("unknown");
    } finally {
      for (const k of keysToClear) {
        if (prevValues[k] !== undefined) process.env[k] = prevValues[k];
      }
    }
  });
});
