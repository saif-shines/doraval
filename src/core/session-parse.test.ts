import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseSession, truncateToolCalls, type ToolCall } from "./session-parse.js";

const miniFixture = readFileSync(
  resolve(import.meta.dir, "../../test/fixtures/sessions/mini-session.jsonl"),
  "utf8"
);
const noSkillsFixture = readFileSync(
  resolve(import.meta.dir, "../../test/fixtures/sessions/no-skills-session.jsonl"),
  "utf8"
);

describe("parseSession", () => {
  test("extracts sessionId, model, agent, cwd from mini fixture", () => {
    const result = parseSession(miniFixture);
    expect(result.sessionId).toBe("test-session-001");
    expect(result.model).toBe("claude-sonnet-4-6");
    expect(result.agent).toBe("claude-code");
    expect(result.cwd).toBe("/Users/test/project");
    expect(result.gitBranch).toBe("main");
  });

  test("extracts session title from ai-title message", () => {
    const result = parseSession(miniFixture);
    expect(result.sessionTitle).toBe("Fix auth bug");
  });

  test("extracts tool calls in order with correct index", () => {
    const result = parseSession(miniFixture);
    expect(result.toolCalls).toHaveLength(3);
    expect(result.toolCalls[0].name).toBe("Skill");
    expect(result.toolCalls[1].name).toBe("Read");
    expect(result.toolCalls[2].name).toBe("Edit");
    expect(result.toolCalls[0].index).toBe(0);
    expect(result.toolCalls[2].index).toBe(2);
  });

  test("extracts skill invocations", () => {
    const result = parseSession(miniFixture);
    expect(result.skillsInvoked).toEqual(["superpowers:systematic-debugging"]);
  });

  test("counts tool calls", () => {
    const result = parseSession(miniFixture);
    expect(result.toolCallCounts["Skill"]).toBe(1);
    expect(result.toolCallCounts["Read"]).toBe(1);
    expect(result.toolCallCounts["Edit"]).toBe(1);
  });

  test("collects user messages (excludes attachment/hook injections)", () => {
    const result = parseSession(miniFixture);
    expect(result.userMessages).toHaveLength(2);
    expect(result.userMessages[0]).toBe("fix the auth bug");
    expect(result.userMessages[1]).toBe("looks good");
  });

  test("counts user turns", () => {
    const result = parseSession(miniFixture);
    expect(result.userTurnCount).toBe(2);
  });

  test("extracts durationMs from system message", () => {
    const result = parseSession(miniFixture);
    expect(result.durationMs).toBe(90000);
  });

  test("handles session with no skills", () => {
    const result = parseSession(noSkillsFixture);
    expect(result.skillsInvoked).toEqual([]);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("Bash");
  });

  test("handles malformed lines gracefully", () => {
    const withBadLine = miniFixture + "\nnot valid json\n";
    expect(() => parseSession(withBadLine)).not.toThrow();
    const result = parseSession(withBadLine);
    expect(result.sessionId).toBe("test-session-001");
  });
});

describe("truncateToolCalls", () => {
  test("keeps all calls when under limit", () => {
    const calls: ToolCall[] = [
      { name: "Bash", input: {}, timestamp: "t", index: 0 },
      { name: "Read", input: {}, timestamp: "t", index: 1 },
    ];
    expect(truncateToolCalls(calls, 10)).toHaveLength(2);
  });

  test("always keeps Skill calls when truncating", () => {
    const calls: ToolCall[] = Array.from({ length: 50 }, (_, i) => ({
      name: i === 25 ? "Skill" : "Bash",
      input: {},
      timestamp: "t",
      index: i,
    }));
    const result = truncateToolCalls(calls, 10);
    expect(result.find((c) => c.name === "Skill")).toBeDefined();
  });

  test("keeps first 5 and last 5 when truncating to 10", () => {
    const calls: ToolCall[] = Array.from({ length: 30 }, (_, i) => ({
      name: "Bash",
      input: { i },
      timestamp: "t",
      index: i,
    }));
    const result = truncateToolCalls(calls, 10);
    expect(result[0].index).toBe(0);
    expect(result[result.length - 1].index).toBe(29);
  });
});
