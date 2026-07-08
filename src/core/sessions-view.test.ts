import { describe, expect, test } from "bun:test";
import { resolve } from "path";
import { readFileSync } from "fs";
import { resolveAgentAlias, isKnownAgent, listSessions, type SessionListEntry } from "./sessions-view.js";
import type { SessionAdapter } from "./session-adapters.js";
import { parseSession } from "./session-parse.js";

const FIXTURES = resolve(import.meta.dir, "../../test/fixtures/sessions");

function fakeAdapter(agent: string, fixtureFile: string, mtime: number): SessionAdapter {
  const path = resolve(FIXTURES, fixtureFile);
  return {
    agent,
    detect: () => true,
    findLatestSession: () => path,
    listRecentSessions: () => [{ path, mtime, skillCount: 0 }],
    parse: (p: string) => parseSession(readFileSync(p, "utf-8")),
  };
}

describe("resolveAgentAlias", () => {
  test("maps 'claude' to the adapter's real name 'claude-code'", () => {
    expect(resolveAgentAlias("claude")).toBe("claude-code");
  });

  test("passes through unrecognized names unchanged", () => {
    expect(resolveAgentAlias("grok")).toBe("grok");
    expect(resolveAgentAlias("codex")).toBe("codex");
  });
});

describe("isKnownAgent", () => {
  test("true for claude and claude-code (aliased)", () => {
    expect(isKnownAgent("claude")).toBe(true);
    expect(isKnownAgent("claude-code")).toBe(true);
  });

  test("true for grok", () => {
    expect(isKnownAgent("grok")).toBe(true);
  });

  test("false for an agent with no adapter yet", () => {
    expect(isKnownAgent("codex")).toBe(false);
  });
});

describe("listSessions", () => {
  test("builds entries from injected adapters using real fixture data", () => {
    const adapters = [fakeAdapter("claude-code", "mini-session.jsonl", 1000)];
    const entries = listSessions("/any/cwd", { adapters });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.sessionId).toBe("test-session-001");
    expect(entries[0]!.agent).toBe("claude-code");
    expect(entries[0]!.tokens).toBeNull();
  });

  test("sorts combined entries across adapters by mtime descending", () => {
    const adapters = [
      fakeAdapter("claude-code", "mini-session.jsonl", 1000),
      fakeAdapter("grok", "no-skills-session.jsonl", 2000),
    ];
    const entries = listSessions("/any/cwd", { adapters });
    expect(entries).toHaveLength(2);
    expect(entries[0]!.agent).toBe("grok"); // mtime 2000, newer
    expect(entries[1]!.agent).toBe("claude-code");
  });

  test("filters by agent, resolving the alias", () => {
    const adapters = [
      fakeAdapter("claude-code", "mini-session.jsonl", 1000),
      fakeAdapter("grok", "no-skills-session.jsonl", 2000),
    ];
    const entries = listSessions("/any/cwd", { adapters, agent: "claude" });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.agent).toBe("claude-code");
  });

  test("turns and toolCalls come from the parsed primitives", () => {
    const adapters = [fakeAdapter("claude-code", "mini-session.jsonl", 1000)];
    const entries = listSessions("/any/cwd", { adapters });
    expect(entries[0]!.toolCalls).toBeGreaterThan(0);
  });
});
