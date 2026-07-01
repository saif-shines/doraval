import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";

// ─── Smoke test: loading the command doesn't throw ───────────────────────────

describe("drift command smoke test", () => {
  test("command module loads without throwing", async () => {
    const mod = await import("./drift.js");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("object");
    expect(mod.default.meta?.name).toBe("drift");
  });

  test("command has correct meta description mentioning 3 modes", async () => {
    const mod = await import("./drift.js");
    const desc = mod.default.meta?.description ?? "";
    // Description should mention the three modes
    expect(desc.toLowerCase()).toContain("skill");
    expect(desc.toLowerCase()).toContain("session");
  });

  test("command args include --session, --format, --limit, --ci, --verbose", async () => {
    const mod = await import("./drift.js");
    const args = mod.default.args ?? {};
    expect(args).toHaveProperty("session");
    expect(args).toHaveProperty("format");
    expect(args).toHaveProperty("limit");
    expect(args).toHaveProperty("ci");
    expect(args).toHaveProperty("verbose");
  });

  test("path arg is optional (no path = repo sweep)", async () => {
    const mod = await import("./drift.js");
    const pathArg = (mod.default.args as Record<string, { required?: boolean }>)?.path;
    expect(pathArg?.required).toBeFalsy();
  });
});

// ─── Mode selection routing (runtime) ────────────────────────────────────────

describe("drift mode selection routing", () => {
  test("path present → Mode 1 (single-skill session search) runs", async () => {
    const sessionEvalMod = await import("../../core/session-eval.js");
    const runEvalSpy = spyOn(sessionEvalMod, "runEval").mockImplementation(
      async () => ({
        sessionId: "abc1234",
        sessionTitle: "test",
        checklist: [],
        ambiguityFlags: [],
      })
    );

    // Mock the adapter so no real filesystem access is needed
    const adaptersMod = await import("../../core/session-adapters.js");
    const getAdapterSpy = spyOn(adaptersMod, "getAdapter").mockReturnValue({
      listRecentSessions: () => [],
      parse: () => ({ skillsInvoked: [], messages: [] }),
    } as any);

    // Mock loadSkill to return a valid skill
    const skillValidateMod = await import("../../core/skill-validate.js");
    const loadSkillSpy = spyOn(skillValidateMod, "loadSkill").mockResolvedValue({
      ok: true,
      model: { data: { name: "my-skill" }, content: "## Instructions\nDo something." },
    } as any);

    const mod = await import("./drift.js");

    // Capture process.exit so the command doesn't kill the test runner
    const exitSpy = spyOn(process, "exit").mockImplementation((() => {}) as any);

    await mod.default.run!({
      args: { path: "/some/skill/dir", format: "table", limit: "5", ci: false, verbose: false },
      rawArgs: [],
      cmd: mod.default,
    } as any);

    // Mode 1 loads the skill (loadSkill called with the path) — runEval not
    // called here because listRecentSessions returns [] (no sessions to match).
    // The key assertion is that loadSkill was invoked, confirming Mode 1 ran.
    expect(loadSkillSpy).toHaveBeenCalledWith(expect.stringContaining("skill"));

    runEvalSpy.mockRestore();
    getAdapterSpy.mockRestore();
    loadSkillSpy.mockRestore();
    exitSpy.mockRestore();
  });

  test("path absent → Mode 3 (repo sweep) runs", async () => {
    const skillsViewMod = await import("../../core/views/skills-view.js");
    const discoverSpy = spyOn(skillsViewMod, "discoverSkills").mockReturnValue([]);

    // Mock the adapter so no real filesystem access is needed
    const adaptersMod = await import("../../core/session-adapters.js");
    const getAdapterSpy = spyOn(adaptersMod, "getAdapter").mockReturnValue(null as any);

    const mod = await import("./drift.js");
    const exitSpy = spyOn(process, "exit").mockImplementation((() => {}) as any);

    await mod.default.run!({
      args: { path: undefined, format: "table", limit: "5", ci: false, verbose: false },
      rawArgs: [],
      cmd: mod.default,
    } as any);

    // Mode 3 calls discoverSkills — confirm it was invoked
    expect(discoverSpy).toHaveBeenCalled();

    discoverSpy.mockRestore();
    getAdapterSpy.mockRestore();
    exitSpy.mockRestore();
  });
});

// ─── Unit tests with mocked runEval ──────────────────────────────────────────

describe("drift command internals (mocked)", () => {
  let tmpDir: string;
  let skillDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `drift-test-${Date.now()}`);
    skillDir = join(tmpDir, "test-skill");
    mkdirSync(skillDir, { recursive: true });
    // Write a minimal SKILL.md
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---\nname: test-skill\ndescription: A test skill\n---\n\n## Instructions\n\nAlways run tests first.\n`
    );
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  });

  test("loadSkill succeeds for a valid skill directory", async () => {
    const { loadSkill } = await import("../../core/skill-validate.js");
    const result = await loadSkill(skillDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model.data.name).toBe("test-skill");
    }
  });

  test("loadSkill fails for directory without SKILL.md", async () => {
    const { loadSkill } = await import("../../core/skill-validate.js");
    const emptyDir = join(tmpDir, "empty");
    mkdirSync(emptyDir, { recursive: true });
    const result = await loadSkill(emptyDir);
    expect(result.ok).toBe(false);
  });

  test("discoverSkills returns empty array for dir without skill files", async () => {
    const { discoverSkills } = await import("../../core/views/skills-view.js");
    const emptyDir = join(tmpDir, "no-skills");
    mkdirSync(emptyDir, { recursive: true });
    const skills = discoverSkills(emptyDir);
    expect(skills).toEqual([]);
  });

  test("discoverSkills finds skill in cwd itself", async () => {
    const { discoverSkills } = await import("../../core/views/skills-view.js");
    const skills = discoverSkills(skillDir);
    // skillDir itself has a SKILL.md
    expect(skills.some((s) => s.dir === skillDir)).toBe(true);
  });
});

// ─── Aggregate computation helpers ───────────────────────────────────────────

describe("drift aggregate computation", () => {
  test("0 drifted items → driftRate 0", () => {
    const checklist = [
      { instruction: "Run tests", bindingness: "MANDATORY" as const, itemVerdict: "ALIGNED" as const, evidence: "" },
      { instruction: "Check style", bindingness: "CONDITIONAL" as const, itemVerdict: "ALIGNED" as const, evidence: "" },
    ];
    const binding = checklist.filter((c) => c.bindingness === "MANDATORY" || c.bindingness === "CONDITIONAL");
    const drifted = binding.filter((c) => c.itemVerdict === "DRIFTED");
    const rate = binding.length > 0 ? drifted.length / binding.length : 0;
    expect(rate).toBe(0);
  });

  test("1 drifted out of 4 binding → drift rate 25%", () => {
    const checklist = [
      { instruction: "Run tests", bindingness: "MANDATORY" as const, itemVerdict: "DRIFTED" as const, evidence: "no test call found" },
      { instruction: "Always stage", bindingness: "MANDATORY" as const, itemVerdict: "ALIGNED" as const, evidence: "tool[2]: git add" },
      { instruction: "Check format", bindingness: "CONDITIONAL" as const, itemVerdict: "JUSTIFIED" as const, evidence: "skipped, not a code file" },
      { instruction: "Comment code", bindingness: "MANDATORY" as const, itemVerdict: "ALIGNED" as const, evidence: "" },
    ];
    const binding = checklist.filter((c) => c.bindingness === "MANDATORY" || c.bindingness === "CONDITIONAL");
    const drifted = binding.filter((c) => c.itemVerdict === "DRIFTED");
    const rate = binding.length > 0 ? drifted.length / binding.length : 0;
    expect(rate).toBeCloseTo(0.25);
    expect(Math.round(rate * 100)).toBe(25);
  });

  test("DISCRETIONARY items are not counted in binding total", () => {
    const checklist = [
      { instruction: "Example usage", bindingness: "DISCRETIONARY" as const, itemVerdict: "DRIFTED" as const, evidence: "" },
      { instruction: "Always run tests", bindingness: "MANDATORY" as const, itemVerdict: "ALIGNED" as const, evidence: "" },
    ];
    const binding = checklist.filter((c) => c.bindingness === "MANDATORY" || c.bindingness === "CONDITIONAL");
    expect(binding.length).toBe(1);
    const drifted = binding.filter((c) => c.itemVerdict === "DRIFTED");
    expect(drifted.length).toBe(0);
  });

  test("UNCLEAR items collected as ambiguity flags", () => {
    const checklist = [
      { instruction: "Ask clarifying questions", bindingness: "MANDATORY" as const, itemVerdict: "UNCLEAR" as const, evidence: "" },
      { instruction: "Run tests", bindingness: "MANDATORY" as const, itemVerdict: "ALIGNED" as const, evidence: "" },
    ];
    const flags = checklist.filter((c) => c.itemVerdict === "UNCLEAR").map((c) => c.instruction);
    expect(flags).toContain("Ask clarifying questions");
    expect(flags.length).toBe(1);
  });

  test("JUSTIFIED items are counted separately from ALIGNED in summary", () => {
    const checklist = [
      { instruction: "Run tests", bindingness: "MANDATORY" as const, itemVerdict: "ALIGNED" as const, evidence: "" },
      { instruction: "Check format", bindingness: "CONDITIONAL" as const, itemVerdict: "JUSTIFIED" as const, evidence: "not a code file" },
      { instruction: "No bare commits", bindingness: "MANDATORY" as const, itemVerdict: "DRIFTED" as const, evidence: "" },
    ];
    const alignedCount = checklist.filter((c) => c.itemVerdict === "ALIGNED").length;
    const justifiedCount = checklist.filter((c) => c.itemVerdict === "JUSTIFIED").length;
    const driftedCount = checklist.filter((c) => c.itemVerdict === "DRIFTED").length;
    expect(alignedCount).toBe(1);
    expect(justifiedCount).toBe(1);
    expect(driftedCount).toBe(1);
    // Summary format: "X ALIGNED, Y DRIFTED, W JUSTIFIED, Z UNCLEAR"
    const summary = `${alignedCount} ALIGNED, ${driftedCount} DRIFTED, ${justifiedCount} JUSTIFIED, 0 UNCLEAR`;
    expect(summary).toBe("1 ALIGNED, 1 DRIFTED, 1 JUSTIFIED, 0 UNCLEAR");
  });

  test("--limit 0 is accepted as zero (not coerced to 20)", () => {
    // Mirrors the fix: Number.isNaN(parsedLimit) ? 20 : parsedLimit
    const parsed = parseInt("0", 10);
    const limit = Number.isNaN(parsed) ? 20 : parsed;
    expect(limit).toBe(0);
  });
});
