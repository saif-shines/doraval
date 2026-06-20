import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { resolve, join, relative } from "path";
import { parseSession, truncateToolCalls, sanitizeSessionId, type ToolCall } from "./session-parse.js";

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

describe("sanitizeSessionId", () => {
  test("passes through safe ids", () => {
    expect(sanitizeSessionId("abc123")).toBe("abc123");
    expect(sanitizeSessionId("my-session_42")).toBe("my-session_42");
  });

  test("sanitizes path traversal attempts", () => {
    // some inputs collapse to harmless names; key is no traversal possible
    const e1 = sanitizeSessionId("../../evil");
    expect(e1).not.toContain("..");
    expect(e1.startsWith(".")).toBe(false);
    expect(sanitizeSessionId("..")).toMatch(/^unknown-/);
    const e3 = sanitizeSessionId("/etc/passwd");
    expect(e3).not.toContain("..");
    expect(e3).not.toMatch(/^\//);
  });

  test("caps length and collapses separators", () => {
    const long = "a".repeat(100) + "-bad--name";
    const s = sanitizeSessionId(long);
    expect(s.length).toBeLessThanOrEqual(64);
    expect(s).not.toContain("--");
  });

  test("falls back safely on bad input", () => {
    expect(sanitizeSessionId("")).toMatch(/^unknown-/);
    expect(sanitizeSessionId(null)).toMatch(/^unknown-/);
    expect(sanitizeSessionId(undefined)).toMatch(/^unknown-/);
  });

  test("sanitized id produces path inside evals dir", () => {
    const evalsDir = "/tmp/doraval-evals";
    const bad = "../../escape";
    const safe = sanitizeSessionId(bad);
    const p = join(evalsDir, `${safe}-123.json`);
    expect(relative(evalsDir, p)).not.toMatch(/^\.\./);
    expect(p.startsWith(evalsDir)).toBe(true);
  });
});
