import { describe, expect, test } from "bun:test";
import { resolve } from "path";
import { reviewMemoryFile, MEMORY_FILE_NAMES } from "./memory-file-review.js";

const FIXTURES = resolve(import.meta.dir, "../../test/fixtures/memory-files");

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

  test("sessions tier is stubbed unavailable", async () => {
    const result = await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), { quick: true });
    expect(result.tiers.sessions).toEqual({ available: false, findings: [] });
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
  test("deep mode without a judge throws PrerequisiteError", async () => {
    const capsMod = await import("./capability-detect.js");
    const { spyOn } = await import("bun:test");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: false, cli: false, cliCommand: null, preferred: "none",
    });
    try {
      await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), { deep: true });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("E-PRE-002");
    } finally {
      spy.mockRestore();
    }
  });

  test("quick mode never invokes the judge", async () => {
    let called = false;
    await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), {
      quick: true,
      memoryLintFn: async () => { called = true; return { ok: true, method: "cli", output: { overall: "pass", summary: "ok", findings: [] } }; },
    });
    expect(called).toBe(false);
  });

  test("judge findings map into the llm tier with sequential ids", async () => {
    const capsMod = await import("./capability-detect.js");
    const { spyOn } = await import("bun:test");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: false, cli: true, cliCommand: "claude", preferred: "cli",
    });
    try {
      const result = await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), {
        memoryLintFn: async () => ({
          ok: true, method: "cli",
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
      api: false, cli: true, cliCommand: "claude", preferred: "cli",
    });
    try {
      await reviewMemoryFile(resolve(FIXTURES, "valid-CLAUDE.md"), {
        deep: true,
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
