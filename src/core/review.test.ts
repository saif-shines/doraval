import { describe, expect, test, mock, spyOn } from "bun:test";
import { reviewSkill, reviewAll } from "./review.js";
import { resolve } from "path";

const FIXTURES = resolve(import.meta.dir, "../../test/fixtures");

describe("reviewSkill", () => {
  test("valid skill produces passing structure + heuristic findings", async () => {
    const result = await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), { quick: true });
    expect(result.tiers.structure.errors).toBe(0);
    expect(result.summary.errors).toBe(0);
    expect(result.tiers.structure.findings.length).toBeGreaterThan(0);
    expect(result.tiers.structure.findings.every(f => f.tier === "structure")).toBe(true);
    expect(result.tiers.llm).toBeUndefined();
  });

  test("invalid skill dir returns a load-error finding", async () => {
    const result = await reviewSkill("/nonexistent/skill", { quick: true });
    expect(result.summary.errors).toBeGreaterThan(0);
    expect(result.tiers.structure.findings.some(f => f.severity === "error")).toBe(true);
  });

  test("findings have sequential ids per tier", async () => {
    const result = await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), { quick: true });
    const structIds = result.tiers.structure.findings.map(f => f.id);
    const heurIds = result.tiers.heuristics.findings.map(f => f.id);
    expect(structIds.every(id => id.startsWith("struct-"))).toBe(true);
    expect(heurIds.every(id => id.startsWith("heur-"))).toBe(true);
  });

  test("origin is classified correctly", async () => {
    const result = await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), { quick: true });
    expect(["authored", "imported", "global"]).toContain(result.origin);
  });

  test("sessions tier is omitted entirely in quick mode", async () => {
    const result = await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), { quick: true });
    expect(result.tiers.sessions).toBeUndefined();
  });

  test("deep mode without LLM throws PrerequisiteError", async () => {
    // Mock detectCapabilities to return "none" — avoids real CLI probe + LLM call
    const capsMod = await import("./capability-detect.js");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: false, cli: false, preferred: "none",
      cliCommand: undefined, apiProvider: undefined,
    } as any);
    try {
      await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), { deep: true });
      expect(true).toBe(false); // should not reach here
    } catch (e: any) {
      expect(e.code).toBe("E-PRE-002");
    } finally {
      spy.mockRestore();
    }
  });

  test("deep mode with a judge that FAILS throws E-NET-002 instead of silently degrading", async () => {
    const capsMod = await import("./capability-detect.js");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: false, cli: true, cliCommand: "claude", preferred: "cli",
    } as any);
    try {
      await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), {
        deep: true,
        lintFn: async () => ({ ok: false, error: "judge timed out" }),
      });
      expect(true).toBe(false); // should not reach here
    } catch (e: any) {
      expect(e.code).toBe("E-NET-002");
      expect(e.message).toContain("judge timed out");
    } finally {
      spy.mockRestore();
    }
  });

  test("non-deep mode with a failing judge degrades gracefully (llm unavailable, no throw)", async () => {
    const capsMod = await import("./capability-detect.js");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: false, cli: true, cliCommand: "claude", preferred: "cli",
    } as any);
    try {
      const result = await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), {
        lintFn: async () => ({ ok: false, error: "judge timed out" }),
      });
      expect(result.tiers.llm).toEqual({ available: false, findings: [] });
    } finally {
      spy.mockRestore();
    }
  });

  test("principles rubric reaches the LLM prompt as extraRubric, not as the platform key", async () => {
    // Point DORAVAL_HOME at a temp dir with a recorded principle, then capture
    // exactly what the LLM tier passes to lintSkill.
    const { mkdtempSync, mkdirSync, writeFileSync } = await import("fs");
    const { tmpdir } = await import("os");
    const { join } = await import("path");
    const home = mkdtempSync(join(tmpdir(), "dora-home-"));
    const prev = process.env.DORAVAL_HOME;
    process.env.DORAVAL_HOME = home;
    const globalDir = join(home, "memory", "repo", "global");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(
      join(globalDir, "principles.md"),
      `## Never use default exports\n\n\`\`\`yaml\nid: t1\nweight: 9\ntags: []\ndate: 2026-07-08\nstatus: active\n\`\`\`\n\nDefault exports break re-export ergonomics.\n`
    );

    const capsMod = await import("./capability-detect.js");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: false, cli: true, cliCommand: "claude", preferred: "cli",
    } as any);

    let seenPlatform: string | undefined = "sentinel";
    let seenRubric: string | undefined;
    try {
      await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), {
        lintFn: async (_m, _c, _a, _e, platform, extraRubric) => {
          seenPlatform = platform;
          seenRubric = extraRubric;
          return { ok: true, method: "cli", output: { overall: "pass", summary: "ok", findings: [] } };
        },
      });
      expect(seenPlatform).toBeUndefined();
      expect(seenRubric).toContain("Never use default exports");
    } finally {
      spy.mockRestore();
      if (prev === undefined) delete process.env.DORAVAL_HOME;
      else process.env.DORAVAL_HOME = prev;
    }
  });

  test("onProgress fires before the LLM tier runs, with the skill path", async () => {
    const capsMod = await import("./capability-detect.js");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: false, cli: true, cliCommand: "claude", preferred: "cli",
    } as any);
    const calls: string[] = [];
    const skillDir = resolve(FIXTURES, "skills/minimal-good");
    try {
      await reviewSkill(skillDir, {
        lintFn: async () => ({ ok: true, method: "cli", output: { overall: "pass", summary: "ok", findings: [] } }),
        onProgress: (msg) => calls.push(msg),
      });
      expect(calls.length).toBe(1);
      expect(calls[0]).toContain(skillDir);
    } finally {
      spy.mockRestore();
    }
  });

  test("onProgress does NOT fire in quick mode", async () => {
    const calls: string[] = [];
    await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), {
      quick: true,
      onProgress: (msg) => calls.push(msg),
    });
    expect(calls).toEqual([]);
  });
});

describe("reviewSkill — scenario coverage (tier 3)", () => {
  test("scenario coverage findings from scenarioLintFn appear in the llm tier", async () => {
    const capsMod = await import("./capability-detect.js");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: false, cli: true, cliCommand: "claude", preferred: "cli",
    } as any);
    try {
      const result = await reviewSkill(resolve(FIXTURES, "skills/with-scenarios"), {
        lintFn: async () => ({ ok: true, method: "cli", output: { overall: "pass", summary: "ok", findings: [] } }),
        scenarioLintFn: async () => ({
          ok: true, method: "cli",
          output: {
            overall: "warn", summary: "one uncovered",
            findings: [{ severity: "warning", category: "coverage", finding: 'Scenario 1 ("deploy with failing tests") is UNCOVERED: no guardrail mentioned', suggestion: "add a MUST NOT guardrail" }],
          },
        }),
      });
      expect(result.tiers.llm?.findings.some(f => f.message.includes("UNCOVERED"))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  test("scenarioLintFn is not called when the skill has no scenarios.yaml", async () => {
    const capsMod = await import("./capability-detect.js");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: false, cli: true, cliCommand: "claude", preferred: "cli",
    } as any);
    let called = false;
    try {
      await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), {
        lintFn: async () => ({ ok: true, method: "cli", output: { overall: "pass", summary: "ok", findings: [] } }),
        scenarioLintFn: async () => { called = true; return { ok: true, method: "cli", output: { overall: "pass", summary: "ok", findings: [] } }; },
      });
      expect(called).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  test("scenarioLintFn is not called when quick mode is on", async () => {
    let called = false;
    await reviewSkill(resolve(FIXTURES, "skills/with-scenarios"), {
      quick: true,
      scenarioLintFn: async () => { called = true; return { ok: true, method: "cli", output: { overall: "pass", summary: "ok", findings: [] } }; },
    });
    expect(called).toBe(false);
  });

  test("scenarioLintFn is not attempted when the main skill lint already failed", async () => {
    const capsMod = await import("./capability-detect.js");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: false, cli: true, cliCommand: "claude", preferred: "cli",
    } as any);
    let called = false;
    try {
      await reviewSkill(resolve(FIXTURES, "skills/with-scenarios"), {
        lintFn: async () => ({ ok: false, error: "judge timed out" }),
        scenarioLintFn: async () => { called = true; return { ok: true, method: "cli", output: { overall: "pass", summary: "ok", findings: [] } }; },
      });
      expect(called).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  test("deep mode with a failing scenario judge throws E-NET-002 even though main lint succeeded", async () => {
    const capsMod = await import("./capability-detect.js");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: false, cli: true, cliCommand: "claude", preferred: "cli",
    } as any);
    try {
      await reviewSkill(resolve(FIXTURES, "skills/with-scenarios"), {
        deep: true,
        lintFn: async () => ({ ok: true, method: "cli", output: { overall: "pass", summary: "ok", findings: [] } }),
        scenarioLintFn: async () => ({ ok: false, error: "judge timed out" }),
      });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("E-NET-002");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("reviewAll", () => {
  test("reviews all skills found under a root", async () => {
    const results = await reviewAll(resolve(FIXTURES), { quick: true });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.path && r.tiers.structure)).toBe(true);
  });

  test("results sorted by error count descending", async () => {
    const results = await reviewAll(resolve(FIXTURES), { quick: true });
    if (results.length > 1) {
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.summary.errors).toBeGreaterThanOrEqual(results[i]!.summary.errors);
      }
    }
  });
});
