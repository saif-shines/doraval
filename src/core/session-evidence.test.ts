import { describe, expect, test } from "bun:test";
import { collectSessionEvidence, type LoadResult, type LoadedSession } from "./session-evidence.js";
import type { Session } from "./session-parse.js";

function prim(over: Partial<Session>): Session {
  return {
    sessionId: "s1", model: "m", agent: "claude-code", cwd: "/p",
    toolCalls: [], toolCallCounts: {}, skillsInvoked: [],
    userMessages: [], userTurnCount: 0, assistantText: [],
    events: [], skillInvokes: [],
    ...over,
  };
}
function sess(agent: string, over: Partial<Session>): LoadedSession {
  return { agent, path: `/tmp/${agent}.jsonl`, mtime: Date.now(), primitives: prim(over) };
}
function loadResult(sessions: LoadedSession[], agents = ["claude-code"]): LoadResult {
  return { sessions, adaptersDetected: agents, skipped: {} };
}

describe("collectSessionEvidence", () => {
  test("Skill invoke record counts as invoked", () => {
    const lr = loadResult([sess("claude-code", {
      skillInvokes: [{ name: "my-skill", signal: "skill_tool_use", eventIds: ["t1"] }],
    })]);
    const f = collectSessionEvidence("my-skill", "/repo/.claude/skills/my-skill", lr, { required: false });
    expect(f[0]!.severity).toBe("pass");
    expect(f[0]!.message).toContain("native");
  });

  test("native attribution counts as invoked (pass)", () => {
    const lr = loadResult([sess("claude-code", { skillsInvoked: ["my-skill"] })]);
    const f = collectSessionEvidence("my-skill", "/repo/.claude/skills/my-skill", lr, { required: false });
    expect(f).toHaveLength(1);
    expect(f[0]!.severity).toBe("pass");
    expect(f[0]!.message).toContain("Invoked in 1 of 1");
    expect(f[0]!.message).toContain("native");
    expect(f[0]).toMatchObject({ id: "sess-001", code: "R028", slug: "session-invoked" });
    expect(f[0]!.docUrl).toContain("/reference/rules/R028");
  });

  test("tool-call input path match counts as invoked", () => {
    const lr = loadResult([sess("cursor", {
      toolCalls: [{ name: "Read", input: { path: "/repo/.claude/skills/my-skill/SKILL.md" }, timestamp: "", index: 0 }],
    })], ["cursor"]);
    const f = collectSessionEvidence("my-skill", "/repo/.claude/skills/my-skill", lr, { required: false });
    expect(f[0]!.severity).toBe("pass");
    expect(f[0]!.message).toContain("path");
  });

  test("slash mention matches at word boundary only", () => {
    const hit = loadResult([sess("claude-code", { userMessages: ["please run /my-skill now"] })]);
    expect(collectSessionEvidence("my-skill", "/x/my-skill", hit, { required: false })[0]!.severity).toBe("pass");
    // "/review" must NOT match a session that only mentions "/review-pr"
    const miss = loadResult([sess("claude-code", { userMessages: ["use /review-pr here"] })]);
    expect(collectSessionEvidence("review", "/x/review", miss, { required: false })[0]!.severity).toBe("info");
    // "/review" must NOT match a path fragment like "src/review.ts" — no left
    // boundary (start-of-string or whitespace) precedes the slash there.
    const pathMiss = loadResult([sess("claude-code", { userMessages: ["see src/review.ts"] })]);
    expect(collectSessionEvidence("review", "/x/review", pathMiss, { required: false })[0]!.severity).toBe("info");
  });

  test("never invoked: info by default, warning when required", () => {
    const lr = loadResult([sess("claude-code", {}), sess("codex", {})], ["claude-code", "codex"]);
    expect(collectSessionEvidence("ghost", "/x/ghost", lr, { required: false })[0]!.severity).toBe("info");
    expect(collectSessionEvidence("ghost", "/x/ghost", lr, { required: true })[0]!.severity).toBe("warning");
  });

  const oldMtime = Date.now() - 40 * 24 * 60 * 60 * 1000;
  const youngMtime = Date.now() - 24 * 60 * 60 * 1000;

  test("Authored + never invoked + old install emits R034 only", () => {
    const lr = loadResult([sess("claude-code", {})]);
    const f = collectSessionEvidence("ghost", "/repo/.claude/skills/ghost", lr, {
      required: false,
      origin: "authored",
      mtimeMs: oldMtime,
    });
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ id: "sess-007", code: "R034", slug: "remove-candidate" });
    expect(f[0]!.message).toMatch(/Remove candidate/i);
    expect(f[0]!.message).not.toMatch(/unused|stash/i);
    expect(f[0]!.docUrl).toContain("/reference/rules/R034");
  });

  test("Recent install + never invoked emits R029 only", () => {
    const lr = loadResult([sess("claude-code", {})]);
    const f = collectSessionEvidence("ghost", "/repo/.claude/skills/ghost", lr, {
      required: false,
      origin: "authored",
      mtimeMs: youngMtime,
    });
    expect(f[0]).toMatchObject({ id: "sess-002", code: "R029" });
    expect(f[0]!.code).not.toBe("R034");
  });

  test("Global + never invoked emits R029 only", () => {
    const lr = loadResult([sess("claude-code", {})]);
    const f = collectSessionEvidence("ghost", "/Users/me/.claude/skills/ghost", lr, {
      required: false,
      origin: "global",
      mtimeMs: oldMtime,
    });
    expect(f[0]).toMatchObject({ id: "sess-002", code: "R029" });
    expect(f[0]!.code).not.toBe("R034");
  });

  test("Invoked Authored Skill emits R028, not R034", () => {
    const lr = loadResult([sess("claude-code", { skillsInvoked: ["ghost"] })]);
    const f = collectSessionEvidence("ghost", "/repo/.claude/skills/ghost", lr, {
      required: false,
      origin: "authored",
      mtimeMs: oldMtime,
    });
    expect(f[0]).toMatchObject({ id: "sess-001", code: "R028" });
    expect(f[0]!.code).not.toBe("R034");
  });

  test("zero sessions with adapters detected → info guidance", () => {
    const lr = loadResult([], ["claude-code"]);
    const f = collectSessionEvidence("any", "/x/any", lr, { required: false });
    expect(f[0]!.severity).toBe("info");
    expect(f[0]!.message).toContain("No sessions found");
    expect(f[0]!.code).toBe("R030");
  });

  test("per-agent breakdown in message", () => {
    const lr = loadResult([
      sess("claude-code", { skillsInvoked: ["s"] }),
      sess("cursor", { toolCalls: [{ name: "Read", input: { p: "/x/s/SKILL.md" }, timestamp: "", index: 0 }] }),
      sess("codex", {}),
    ], ["claude-code", "cursor", "codex"]);
    const msg = collectSessionEvidence("s", "/x/s", lr, { required: false })[0]!.message;
    expect(msg).toContain("2 of 3");
    expect(msg).toContain("claude-code: 1 native");
    expect(msg).toContain("cursor: 1 path");
  });
});

describe("loadRecentSessions", () => {
  test("excludes sessions older than 30 days; counts unparseable as skipped", async () => {
    const { loadRecentSessions } = await import("./session-evidence.js");
    const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const fresh = Date.now() - 1 * 24 * 60 * 60 * 1000;
    // Fake adapter — no filesystem needed except one real tiny file for statSync
    const { mkdtempSync, writeFileSync } = await import("fs");
    const { join } = await import("path");
    const { tmpdir } = await import("os");
    const dir = mkdtempSync(join(tmpdir(), "ev-load-"));
    const freshPath = join(dir, "fresh.jsonl");
    writeFileSync(freshPath, "{}\n");
    const fake = {
      agent: "fake",
      detect: () => true,
      findLatestSession: () => null,
      listRecentSessions: () => [
        { path: freshPath, mtime: fresh, skillCount: 0 },
        { path: join(dir, "old.jsonl"), mtime: old, skillCount: 0 },        // out of window
        { path: join(dir, "missing.jsonl"), mtime: fresh, skillCount: 0 },  // statSync throws → skipped
      ],
      parse: () => prim({}),
    };
    const lr = loadRecentSessions("/any", [fake]);
    expect(lr.sessions).toHaveLength(1);
    expect(lr.sessions[0]!.path).toBe(freshPath);
    expect(lr.skipped["fake"]).toBe(1);
    expect(lr.adaptersDetected).toEqual(["fake"]);
  });
});
