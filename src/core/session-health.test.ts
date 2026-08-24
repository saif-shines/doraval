import { describe, expect, test } from "bun:test";
import { collectSessionHealth } from "./session-health.js";
import type { LoadResult, LoadedSession } from "./session-evidence.js";
import type { Event, Session } from "./session-parse.js";

function session(over: Partial<Session> & { agent?: string }): LoadedSession {
  const events = over.events ?? [];
  const prim: Session = {
    sessionId: over.sessionId ?? "s1",
    model: "m",
    agent: over.agent ?? "claude-code",
    cwd: "/p",
    toolCalls: [],
    toolCallCounts: {},
    skillsInvoked: [],
    userMessages: [],
    userTurnCount: over.userTurnCount ?? 0,
    assistantText: [],
    events,
    skillInvokes: [],
    inputTokens: over.inputTokens,
    outputTokens: over.outputTokens,
    cacheReadTokens: over.cacheReadTokens,
  };
  return { agent: over.agent ?? "claude-code", path: "/tmp/s.jsonl", mtime: Date.now(), primitives: prim };
}

function load(sessions: LoadedSession[]): LoadResult {
  return { sessions, adaptersDetected: ["claude-code"], skipped: {} };
}

function calls(n: number): Event[] {
  return Array.from({ length: n }, (_, i) => ({
    sessionId: "s1",
    seq: i,
    type: "tool_call" as const,
    toolName: "Bash",
  }));
}

describe("collectSessionHealth", () => {
  test("empty window reports count 0 and no signals", () => {
    const h = collectSessionHealth(load([]));
    expect(h.sessionCount).toBe(0);
    expect(h.signals).toEqual([]);
    expect(h.window.last).toBe(10);
    expect(h.window.maxAgeDays).toBe(30);
  });

  test("under all thresholds is quiet", () => {
    const h = collectSessionHealth(load([session({ userTurnCount: 2, events: calls(3), inputTokens: 10, outputTokens: 10 })]));
    expect(h.signals).toEqual([]);
    expect(h.sessionCount).toBe(1);
  });

  test("cache-read ≥ 80% fires when tokens exist", () => {
    const h = collectSessionHealth(load([session({
      sessionId: "hot",
      inputTokens: 10,
      outputTokens: 10,
      cacheReadTokens: 80,
    })]));
    expect(h.signals).toEqual([
      { code: "cache-read", sessionId: "hot", agent: "claude-code", detail: "80% cache-read" },
    ]);
  });

  test("omits cache-read when no token fields", () => {
    const h = collectSessionHealth(load([session({ agent: "cursor", sessionId: "c1" })]));
    expect(h.signals.filter((s) => s.code === "cache-read")).toEqual([]);
  });

  test("omits cache-read when only cache is set (does not invent zeros)", () => {
    const h = collectSessionHealth(load([session({ sessionId: "c2", cacheReadTokens: 80 })]));
    expect(h.signals.filter((s) => s.code === "cache-read")).toEqual([]);
  });

  test("call count ≥ 20 fires", () => {
    const h = collectSessionHealth(load([session({ sessionId: "busy", events: calls(20) })]));
    expect(h.signals.some((s) => s.code === "call-count" && s.detail === "20 calls")).toBe(true);
  });

  test("user turns ≥ 10 fires", () => {
    const h = collectSessionHealth(load([session({ sessionId: "long", userTurnCount: 10 })]));
    expect(h.signals).toContainEqual({
      code: "turn-count",
      sessionId: "long",
      agent: "claude-code",
      detail: "10 turns",
    });
  });
});
