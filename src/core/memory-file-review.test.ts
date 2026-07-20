import { describe, expect, test } from "bun:test";
import { resolve } from "path";
import {
  reviewMemoryFile,
  MEMORY_FILE_NAMES,
  memorySessionPresence,
  extractBindingRules,
  memorySessionRuleInventory,
  mapEvalToMemoryFindings,
} from "./memory-file-review.js";
import type { LoadResult } from "./session-evidence.js";
import type { EvalResult } from "./session-eval.js";

const FIXTURES = resolve(import.meta.dir, "../../test/fixtures/memory-files");

const NO_ADAPTERS: LoadResult = { sessions: [], adaptersDetected: [], skipped: {} };
const EMPTY_LOAD: LoadResult = { sessions: [], adaptersDetected: ["claude-code"], skipped: {} };
function emptyPrims(sessionId: string, agent: string) {
  return {
    sessionId,
    model: "unknown",
    agent,
    cwd: "/proj",
    toolCalls: [] as [],
    toolCallCounts: {},
    skillsInvoked: [] as string[],
    userMessages: [] as string[],
    userTurnCount: 0,
    assistantText: [] as string[],
  };
}

const SOME_SESSIONS: LoadResult = {
  sessions: [
    { agent: "claude-code", path: "/tmp/a.jsonl", mtime: Date.now(), primitives: emptyPrims("s1", "claude-code") },
    { agent: "cursor", path: "/tmp/b.jsonl", mtime: Date.now(), primitives: emptyPrims("s2", "cursor") },
  ],
  adaptersDetected: ["claude-code", "cursor"],
  skipped: {},
};

/** Skip real session/judge I/O when a test only cares about another tier. */
const hermetic = { loadedSessions: NO_ADAPTERS };

describe("MEMORY_FILE_NAMES", () => {
  test("contains the four known memory file basenames", () => {
    expect(MEMORY_FILE_NAMES.has("CLAUDE.md")).toBe(true);
    expect(MEMORY_FILE_NAMES.has("AGENTS.md")).toBe(true);
    expect(MEMORY_FILE_NAMES.has(".cursorrules")).toBe(true);
    expect(MEMORY_FILE_NAMES.has("copilot-instructions.md")).toBe(true);
  });
});

describe("reviewMemoryFile — tier 1 (structure)", () => {
  test("valid file with a resolving @import passes structure tier", async () => {
    const result = await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), { quick: true });
    expect(result.tiers.structure.errors).toBe(0);
    expect(result.tiers.structure.findings.some(f => f.severity === "pass")).toBe(true);
  });

  test("empty file produces a structure error", async () => {
    const result = await reviewMemoryFile(resolve(FIXTURES, "empty-AGENTS.md"), { quick: true });
    expect(result.tiers.structure.errors).toBeGreaterThan(0);
    expect(result.tiers.structure.findings.some(f => f.severity === "error" && f.message.toLowerCase().includes("empty"))).toBe(true);
  });

  test("unresolved @import produces a structure error", async () => {
    const result = await reviewMemoryFile(resolve(FIXTURES, "broken-import-CLAUDE.md"), { quick: true });
    expect(result.tiers.structure.errors).toBeGreaterThan(0);
    expect(result.tiers.structure.findings.some(f => f.severity === "error" && f.message.includes("does-not-exist.md"))).toBe(true);
  });

  test("findings have sequential struct- ids", async () => {
    const result = await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), { quick: true });
    expect(result.tiers.structure.findings.every(f => f.id.startsWith("struct-"))).toBe(true);
  });

  test("origin is classified", async () => {
    const result = await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), { quick: true });
    expect(["authored", "imported", "global"]).toContain(result.origin);
  });

  test("quick mode omits sessions tier", async () => {
    const result = await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), { quick: true });
    expect(result.tiers.sessions).toBeUndefined();
  });
});

describe("reviewMemoryFile — tier 2 (heuristics)", () => {
  test("dead markdown link produces a heuristics warning", async () => {
    const result = await reviewMemoryFile(resolve(FIXTURES, "heuristics-CLAUDE.md"), { quick: true });
    expect(result.tiers.heuristics.findings.some(
      f => f.severity === "warning" && f.message.includes("missing-style-guide.md")
    )).toBe(true);
  });

  test("duplicate line produces a heuristics warning", async () => {
    const result = await reviewMemoryFile(resolve(FIXTURES, "heuristics-CLAUDE.md"), { quick: true });
    expect(result.tiers.heuristics.findings.some(
      f => f.severity === "warning" && f.message.toLowerCase().includes("duplicate")
    )).toBe(true);
  });

  test("AGENTS.md with $ARGUMENTS gets flagged as Claude-only syntax in a shared file", async () => {
    const result = await reviewMemoryFile(resolve(FIXTURES, "claude-syntax-shared/AGENTS.md"), { quick: true });
    expect(result.tiers.heuristics.findings.some(
      f => f.severity === "warning" && f.message.includes("$ARGUMENTS")
    )).toBe(true);
  });

  test("CLAUDE.md itself is NOT flagged for Claude-only syntax", async () => {
    // valid-CLAUDE.md contains an @import — Claude-only syntax — but since
    // the file IS CLAUDE.md (not the shared AGENTS.md), this check doesn't apply.
    const result = await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), { quick: true });
    expect(result.tiers.heuristics.findings.some(f => f.message.includes("Claude-only"))).toBe(false);
  });
});

describe("reviewMemoryFile — tier 3 (llm)", () => {
  test("deep mode without a judge under --ci throws E-PRE-004", async () => {
    const capsMod = await import("./capability-detect.js");
    const { spyOn } = await import("bun:test");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: false, preferred: "none",
    });
    try {
      await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), { deep: true, ci: true, ...hermetic });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("E-PRE-004");
    } finally {
      spy.mockRestore();
    }
  });

  test("quick mode never invokes the judge", async () => {
    let called = false;
    await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), {
      quick: true,
      memoryLintFn: async () => { called = true; return { ok: true, method: "api", output: { overall: "pass", summary: "ok", findings: [] } }; },
    });
    expect(called).toBe(false);
  });

  test("judge findings map into the llm tier with sequential ids", async () => {
    const capsMod = await import("./capability-detect.js");
    const { spyOn } = await import("bun:test");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: true, preferred: "api",
    });
    try {
      const result = await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), {
        ...hermetic,
        memoryLintFn: async () => ({
          ok: true, method: "api",
          output: { overall: "warn", summary: "one issue", findings: [
            { severity: "warning", category: "contradiction", finding: "conflicting rules", suggestion: "pick one" },
          ] },
        }),
      });
      expect(result.tiers.llm?.available).toBe(true);
      expect(result.tiers.llm?.findings[0]?.id).toBe("llm-001");
      expect(result.tiers.llm?.findings[0]?.message).toBe("conflicting rules");
    } finally {
      spy.mockRestore();
    }
  });

  test("deep mode with a failing judge throws E-NET-002", async () => {
    const capsMod = await import("./capability-detect.js");
    const { spyOn } = await import("bun:test");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: true, preferred: "api",
    });
    try {
      await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), {
        deep: true,
        ...hermetic,
        memoryLintFn: async () => ({ ok: false, error: "judge timed out" }),
      });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("E-NET-002");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("memorySessionPresence", () => {
  test("zero sessions → sess-003 info", () => {
    const f = memorySessionPresence(EMPTY_LOAD);
    expect(f).toHaveLength(1);
    expect(f[0]!.id).toBe("sess-003");
    expect(f[0]!.severity).toBe("info");
  });

  test("sessions present → sess-004 pass with agent list", () => {
    const f = memorySessionPresence(SOME_SESSIONS);
    expect(f[0]!.id).toBe("sess-004");
    expect(f[0]!.severity).toBe("pass");
    expect(f[0]!.message).toContain("2 recent sessions");
    expect(f[0]!.message).toContain("claude-code");
    expect(f[0]!.message).toContain("cursor");
  });

  test("session findings include code + docUrl", () => {
    const f = memorySessionPresence(EMPTY_LOAD);
    expect(f[0]!.code).toBe("sess-003");
    expect(f[0]!.docUrl).toContain("/concepts/review-tiers/");
  });
});

describe("extractBindingRules + inventory", () => {
  test("extracts MUST / MUST NOT / NEVER lines", () => {
    const rules = extractBindingRules(`# Rules
- MUST run tests before commit
- MUST NOT force-push to main
NEVER commit secrets
Always prefer bun over npm
plain prose is ignored
`);
    expect(rules.length).toBeGreaterThanOrEqual(3);
    expect(rules.some((r) => r.kind === "must" && /tests/i.test(r.text))).toBe(true);
    expect(rules.some((r) => r.kind === "must_not" && /force-push|secrets/i.test(r.text))).toBe(true);
  });

  test("inventory reports count or empty info", () => {
    const empty = memorySessionRuleInventory("Hello world\nno rules here\n");
    expect(empty[0]!.id).toBe("sess-005");
    expect(empty[0]!.severity).toBe("info");

    const has = memorySessionRuleInventory("- MUST NOT skip hooks\n");
    expect(has[0]!.id).toBe("sess-005");
    expect(has[0]!.severity).toBe("pass");
    expect(has[0]!.message).toMatch(/1 binding rule/);
  });
});

describe("mapEvalToMemoryFindings", () => {
  const base = (): EvalResult => ({
    schemaVersion: 1,
    sessionId: "019f-abcd-1234-5678",
    timestamp: new Date().toISOString(),
    agent: "claude-code",
    model: "x",
    skill: "CLAUDE.md",
    userFamiliarity: 5,
    userFamiliarityReason: "",
    closure: "1-shot",
    userTurnsAfterSkill: 1,
    skillsInvoked: [],
    toolCallCounts: {},
    verdict: "PASS",
    verdictReason: "ok",
    checklist: [],
    ambiguityFlags: [],
    judgeMethod: "api",
  });

  test("PASS → sess-006 aligned", () => {
    const f = mapEvalToMemoryFindings(base());
    expect(f[0]!.id).toBe("sess-006");
    expect(f[0]!.severity).toBe("pass");
    expect(f[0]!.message).toMatch(/aligned/i);
  });

  test("DRIFTED MANDATORY → error findings", () => {
    const r = base();
    r.verdict = "FAIL";
    r.checklist = [{
      instruction: "MUST NOT force-push",
      bindingness: "MANDATORY",
      itemVerdict: "DRIFTED",
      evidence: "tool #3 git push --force",
    }];
    const f = mapEvalToMemoryFindings(r);
    expect(f.some((x) => x.severity === "error" && /force-push/i.test(x.message))).toBe(true);
  });
});

describe("reviewMemoryFile — tier 4 (sessions presence)", () => {
  // Skip live judge — these tests only assert tiers.sessions.
  const skipLlm = {
    memoryLintFn: async () => ({ ok: false, error: "skip" }) as any,
  };

  test("no adapters → sessions available false", async () => {
    const capsMod = await import("./capability-detect.js");
    const { spyOn } = await import("bun:test");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: true, preferred: "api",
    });
    try {
      const result = await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), {
        loadedSessions: NO_ADAPTERS,
        ...skipLlm,
      });
      expect(result.tiers.sessions).toEqual({ available: false, findings: [] });
    } finally {
      spy.mockRestore();
    }
  });

  test("adapters + sessions → available with count, sess-004, and rule inventory", async () => {
    const capsMod = await import("./capability-detect.js");
    const { spyOn } = await import("bun:test");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: true, preferred: "api",
    });
    try {
      const result = await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), {
        loadedSessions: SOME_SESSIONS,
        ...skipLlm,
      });
      expect(result.tiers.sessions?.available).toBe(true);
      expect(result.tiers.sessions?.count).toBe(2);
      const ids = result.tiers.sessions?.findings.map((f) => f.id) ?? [];
      expect(ids).toContain("sess-004");
      expect(ids).toContain("sess-005");
      // without --sessions, no LLM adherence call
      expect(ids.some((id) => id === "sess-006")).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  test("--sessions runs adherence eval seam and maps DRIFTED findings", async () => {
    const capsMod = await import("./capability-detect.js");
    const { spyOn } = await import("bun:test");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: true, preferred: "api",
    });
    try {
      const result = await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), {
        sessions: true,
        loadedSessions: SOME_SESSIONS,
        ...skipLlm,
        memorySessionEvalFn: async () => ({
          schemaVersion: 1 as const,
          sessionId: "s1",
          timestamp: new Date().toISOString(),
          agent: "claude-code",
          model: "x",
          skill: "CLAUDE.md",
          userFamiliarity: 5,
          userFamiliarityReason: "",
          closure: "1-shot" as const,
          userTurnsAfterSkill: 1,
          skillsInvoked: [],
          toolCallCounts: {},
          verdict: "FAIL" as const,
          verdictReason: "drifted",
          checklist: [{
            instruction: "MUST NOT force-push",
            bindingness: "MANDATORY" as const,
            itemVerdict: "DRIFTED" as const,
            evidence: "git push --force",
          }],
          ambiguityFlags: [],
          judgeMethod: "api" as const,
        }),
      });
      const msgs = result.tiers.sessions?.findings.map((f) => f.message).join("\n") ?? "";
      expect(msgs).toMatch(/Rule drift|force-push/);
      expect(result.summary.errors).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
    }
  });

  test("--sessions with zero sessions throws E-PRE-003", async () => {
    const capsMod = await import("./capability-detect.js");
    const { spyOn } = await import("bun:test");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: true, preferred: "api",
    });
    try {
      await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), {
        sessions: true,
        loadedSessions: EMPTY_LOAD,
        ...skipLlm,
      });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("E-PRE-003");
    } finally {
      spy.mockRestore();
    }
  });

  test("--sessions with zero adapters throws E-PRE-003", async () => {
    const capsMod = await import("./capability-detect.js");
    const { spyOn } = await import("bun:test");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: true, preferred: "api",
    });
    try {
      await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), {
        sessions: true,
        loadedSessions: NO_ADAPTERS,
        ...skipLlm,
      });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("E-PRE-003");
    } finally {
      spy.mockRestore();
    }
  });
});
