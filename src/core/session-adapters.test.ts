import { describe, test, expect } from "bun:test";
import { resolve } from "path";
import { claudeCodeAdapter } from "./session-adapters.js";

describe("claudeCodeAdapter", () => {
  test("agent name is claude-code", () => {
    expect(claudeCodeAdapter.agent).toBe("claude-code");
  });

  test("parse() reads fixture file correctly", () => {
    const fixturePath = resolve(
      import.meta.dir,
      "../../test/fixtures/sessions/mini-session.jsonl"
    );
    const result = claudeCodeAdapter.parse(fixturePath);
    expect(result.sessionId).toBe("test-session-001");
    expect(result.skillsInvoked).toContain("superpowers:systematic-debugging");
  });

  test("parse() handles no-skills fixture", () => {
    const fixturePath = resolve(
      import.meta.dir,
      "../../test/fixtures/sessions/no-skills-session.jsonl"
    );
    const result = claudeCodeAdapter.parse(fixturePath);
    expect(result.skillsInvoked).toEqual([]);
  });
});
