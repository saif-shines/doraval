import { describe, expect, test } from "bun:test";
import { isAgentCaller, shouldBlockAgentWrite } from "./agent-detect.js";

describe("isAgentCaller", () => {
  test("human env is not an agent", () => {
    expect(isAgentCaller({})).toBe(false);
  });

  test("CI is an agent", () => {
    expect(isAgentCaller({ CI: "1" })).toBe(true);
  });

  test("GIT_TERMINAL_PROMPT=0 is an agent", () => {
    expect(isAgentCaller({ GIT_TERMINAL_PROMPT: "0" })).toBe(true);
  });

  test("known agent CLI env is an agent", () => {
    expect(isAgentCaller({ CLAUDECODE: "1" })).toBe(true);
    expect(isAgentCaller({ GEMINI_CLI: "1" })).toBe(true);
    expect(isAgentCaller({ COPILOT_CLI: "1" })).toBe(true);
    expect(isAgentCaller({ PI_CODING_AGENT: "1" })).toBe(true);
  });
});

describe("shouldBlockAgentWrite", () => {
  test("blocks a detected agent with no write flag", () => {
    expect(shouldBlockAgentWrite({ agent: true, yes: false, dryRun: false })).toBe(true);
  });

  test("allows --yes, --dry-run, --apply, and --brief", () => {
    expect(shouldBlockAgentWrite({ agent: true, yes: true, dryRun: false })).toBe(false);
    expect(shouldBlockAgentWrite({ agent: true, yes: false, dryRun: true })).toBe(false);
    expect(shouldBlockAgentWrite({ agent: true, yes: false, dryRun: false, apply: true })).toBe(false);
    expect(shouldBlockAgentWrite({ agent: true, yes: false, dryRun: false, brief: true })).toBe(false);
  });

  test("does not block a human", () => {
    expect(shouldBlockAgentWrite({ agent: false, yes: false, dryRun: false })).toBe(false);
  });
});
