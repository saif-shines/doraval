import { describe, expect, test } from "bun:test";
import { llmTierPlan, review, type ReviewOptions, type ReviewResult } from "./review.js";
import { resolveEffectiveRules } from "./rules/resolve.js";
import { join, resolve } from "path";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "fs";
import { tmpdir } from "os";

const FIXTURES = resolve(import.meta.dir, "../../test/fixtures");
const SANDBOX = mkdtempSync(join(tmpdir(), "dora-review-cwd-"));

async function reviewOne(path: string, opts: ReviewOptions = {}): Promise<ReviewResult> {
  const results = await review(path, { cwd: SANDBOX, ...opts });
  return results.find((r) => r.path === path) ?? results[0]!;
}

const passData = { overall: "pass" as const, summary: "ok", findings: [] };
const passJudge: NonNullable<ReviewOptions["judge"]> = async () => ({
  mode: "api", ok: true, data: passData,
});

async function withPrincipleRule(
  enabled: boolean,
  run: () => Promise<void>,
): Promise<void> {
  const home = mkdtempSync(join(tmpdir(), "dora-principles-"));
  const previous = process.env.DORAVAL_HOME;
  process.env.DORAVAL_HOME = home;
  writeFileSync(join(home, "config.yml"), [
    "journal:", "  repo: ''", "  projects: {}", "rules:", "  package: recommended", "  overrides:",
    `    R021: ${enabled ? "on" : "off"}`, "",
  ].join("\n"));
  const globalDir = join(home, "memory", "repo", "global");
  mkdirSync(globalDir, { recursive: true });
  writeFileSync(
    join(globalDir, "principles.md"),
    `## Never use skill\n\n\`\`\`yaml\nid: t1\nweight: 9\ntags: []\ndate: 2026-07-08\nstatus: active\n\`\`\`\n\nPrinciple fixture.\n`,
  );
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.DORAVAL_HOME;
    else process.env.DORAVAL_HOME = previous;
  }
}

describe("review", () => {
  test("valid skill produces passing structure + heuristic findings", async () => {
    const result = await reviewOne(resolve(FIXTURES, "skills/minimal-good"), { quick: true });
    expect(result.tiers.structure.errors).toBe(0);
    expect(result.summary.errors).toBe(0);
    expect(result.tiers.structure.findings.length).toBeGreaterThan(0);
    expect(result.tiers.structure.findings.every(f => f.tier === "structure")).toBe(true);
    expect(result.tiers.llm).toBeUndefined();
  });

  test("invalid skill dir returns a stamped load-error finding", async () => {
    const result = await reviewOne(resolve(FIXTURES, "skills/bad-frontmatter"), { quick: true });
    expect(result.summary.errors).toBeGreaterThan(0);
    expect(result.tiers.structure.findings[0]).toMatchObject({
      severity: "error", code: "R002", slug: "frontmatter-parse",
    });
    expect(result.tiers.structure.findings[0]?.docUrl).toContain("/reference/rules/R002");
  });

  test("findings have sequential ids per tier", async () => {
    const result = await reviewOne(resolve(FIXTURES, "skills/minimal-good"), { quick: true });
    const structIds = result.tiers.structure.findings.map(f => f.id);
    const heurIds = result.tiers.heuristics.findings.map(f => f.id);
    expect(structIds.every(id => id.startsWith("struct-"))).toBe(true);
    expect(heurIds.every(id => id.startsWith("heur-"))).toBe(true);
  });

  test("origin is classified correctly", async () => {
    const result = await reviewOne(resolve(FIXTURES, "skills/minimal-good"), { quick: true });
    expect(["authored", "imported", "global"]).toContain(result.origin);
  });

  test("sessions tier is omitted entirely in quick mode", async () => {
    const result = await reviewOne(resolve(FIXTURES, "skills/minimal-good"), { quick: true });
    expect(result.tiers.sessions).toBeUndefined();
  });

  test("mechanical findings carry public rule identity", async () => {
    const result = await reviewOne(resolve(FIXTURES, "skills/minimal-good"), { quick: true });
    for (const finding of [...result.tiers.structure.findings, ...result.tiers.heuristics.findings]) {
      expect(finding.code).toMatch(/^R\d{3}$/);
      expect(finding.slug).toBeTruthy();
      expect(finding.docUrl).toContain(`/reference/rules/${finding.code}`);
    }
  });

  test("deep mode without LLM under --ci throws PrerequisiteError", async () => {
    try {
      await reviewOne(resolve(FIXTURES, "skills/minimal-good"), {
        deep: true, ci: true, judge: async () => ({ mode: "fail" }),
      });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("E-PRE-004");
    }
  });

  test("deep mode with a judge that FAILS throws E-NET-002 instead of silently degrading", async () => {
    try {
      await reviewOne(resolve(FIXTURES, "skills/minimal-good"), {
        deep: true,
        judge: async () => ({ mode: "api", ok: false, error: "judge timed out" }),
      });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("E-NET-002");
      expect(e.message).toContain("judge timed out");
    }
  });

  test("non-deep mode with a failing judge degrades gracefully (llm unavailable, no throw)", async () => {
    const result = await reviewOne(resolve(FIXTURES, "skills/minimal-good"), {
      judge: async () => ({ mode: "api", ok: false, error: "judge timed out" }),
    });
    expect(result.tiers.llm).toEqual({ available: false, findings: [] });
  });

  test("principles rubric reaches the LLM prompt, not as platform context", async () => {
    const home = mkdtempSync(join(tmpdir(), "dora-home-"));
    const prev = process.env.DORAVAL_HOME;
    process.env.DORAVAL_HOME = home;
    const globalDir = join(home, "memory", "repo", "global");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(
      join(globalDir, "principles.md"),
      `## Never use default exports\n\n\`\`\`yaml\nid: t1\nweight: 9\ntags: []\ndate: 2026-07-08\nstatus: active\n\`\`\`\n\nDefault exports break re-export ergonomics.\n`
    );

    let prompt = "";
    try {
      await reviewOne(resolve(FIXTURES, "skills/minimal-good"), {
        judge: async (req) => {
          prompt = req.prompt;
          return { mode: "api", ok: true, data: passData };
        },
      });
      expect(prompt).not.toContain("PLATFORM CONTEXT");
      expect(prompt).toContain("Never use default exports");
    } finally {
      if (prev === undefined) delete process.env.DORAVAL_HOME;
      else process.env.DORAVAL_HOME = prev;
    }
  });

  test("R021 off skips mechanical principles and API rubric injection", async () => {
    let prompt = "sentinel";
    await withPrincipleRule(false, async () => {
      const result = await reviewOne(resolve(FIXTURES, "skills/minimal-good"), {
        judge: async (req) => {
          prompt = req.prompt;
          return { mode: "api", ok: true, data: passData };
        },
      });
      expect(result.tiers.heuristics.findings.some((finding) => finding.code === "R021")).toBe(false);
    });
    expect(prompt).not.toContain("Project Principles");
    expect(prompt).not.toContain("Never use skill");
  });

  test("R021 enabled keeps weight-derived mechanical severity", async () => {
    await withPrincipleRule(true, async () => {
      const result = await reviewOne(resolve(FIXTURES, "skills/minimal-good"), { quick: true });
      expect(result.tiers.heuristics.findings.find((finding) => finding.code === "R021")?.severity).toBe("error");
    });
  });

  test("onProgress fires before the LLM tier runs, with the skill path", async () => {
    const calls: string[] = [];
    const skillDir = resolve(FIXTURES, "skills/minimal-good");
    await reviewOne(skillDir, {
      judge: passJudge,
      onProgress: (msg) => calls.push(msg),
    });
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain(skillDir);
  });

  test("Authored never-invoked old Skill emits R034 not R029", async () => {
    const dir = join(SANDBOX, ".claude", "skills", "ghost");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), `---\nname: ghost\ndescription: "Use when testing remove candidates"\n---\n\n1. Do the thing\n`);
    const old = Date.now() / 1000 - 40 * 24 * 60 * 60;
    utimesSync(join(dir, "SKILL.md"), old, old);
    utimesSync(dir, old, old);
    const loadedSessions = {
      sessions: [{
        agent: "claude-code",
        path: "/tmp/s.jsonl",
        mtime: Date.now(),
        primitives: {
          sessionId: "s1", model: "m", agent: "claude-code", cwd: SANDBOX,
          toolCalls: [], toolCallCounts: {}, skillsInvoked: [],
          userMessages: [], userTurnCount: 0, assistantText: [],
        },
      }],
      adaptersDetected: ["claude-code"],
      skipped: {},
    };
    const result = await reviewOne(dir, { loadedSessions, judge: passJudge });
    const codes = (result.tiers.sessions?.findings ?? []).map((f) => f.code);
    expect(codes).toContain("R034");
    expect(codes).not.toContain("R029");
    expect(result.sessionHealth?.sessionCount).toBe(1);
    expect(result.sessionHealth?.signals).toEqual([]);
    expect(result.sessionHealth?.window).toEqual({ last: 30, maxAgeDays: 90 });
    expect(result.tiers.sessions?.findings.some((f) => (f as { code?: string }).code === "cache-read")).toBe(false);
  });

  test("quick mode omits Session health", async () => {
    const dir = join(SANDBOX, ".claude", "skills", "health-quick");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), `---\nname: health-quick\ndescription: "Use when testing Session health skip"\n---\n\n1. Do the thing\n`);
    const result = await reviewOne(dir, { quick: true });
    expect(result.sessionHealth).toBeUndefined();
  });

  test("R034 off still emits Never invoked as R029", async () => {
    const dir = join(SANDBOX, ".claude", "skills", "ghost-off");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), `---\nname: ghost-off\ndescription: "Use when testing R034 off"\n---\n\n1. Do the thing\n`);
    const old = Date.now() / 1000 - 40 * 24 * 60 * 60;
    utimesSync(join(dir, "SKILL.md"), old, old);
    const home = mkdtempSync(join(tmpdir(), "dora-r034-off-"));
    const previous = process.env.DORAVAL_HOME;
    process.env.DORAVAL_HOME = home;
    writeFileSync(join(home, "config.yml"), [
      "journal:", "  repo: ''", "  projects: {}", "rules:", "  package: recommended", "  overrides:",
      "    R034: off", "",
    ].join("\n"));
    try {
      const result = await reviewOne(dir, {
        judge: passJudge,
        loadedSessions: {
          sessions: [{
            agent: "claude-code", path: "/tmp/s.jsonl", mtime: Date.now(),
            primitives: {
              sessionId: "s1", model: "m", agent: "claude-code", cwd: SANDBOX,
              toolCalls: [], toolCallCounts: {}, skillsInvoked: [],
              userMessages: [], userTurnCount: 0, assistantText: [],
            },
          }],
          adaptersDetected: ["claude-code"],
          skipped: {},
        },
      });
      const codes = (result.tiers.sessions?.findings ?? []).map((f) => f.code);
      expect(codes).toContain("R029");
      expect(codes).not.toContain("R034");
    } finally {
      if (previous === undefined) delete process.env.DORAVAL_HOME;
      else process.env.DORAVAL_HOME = previous;
    }
  });

  test("onProgress does NOT fire in quick mode", async () => {
    const calls: string[] = [];
    await reviewOne(resolve(FIXTURES, "skills/minimal-good"), {
      quick: true,
      onProgress: (msg) => calls.push(msg),
    });
    expect(calls).toEqual([]);
  });
});

describe("llmTierPlan", () => {
  test("coarse-skips independently disabled lint and scenario calls", () => {
    const all = resolveEffectiveRules(null).map;
    expect(llmTierPlan(all)).toEqual({ runLint: true, runScenario: true });

    const off = resolveEffectiveRules({
      journal: { repo: "", projects: {} },
      rules: { package: "minimal" },
    }).map;
    expect(llmTierPlan(off)).toEqual({ runLint: false, runScenario: false });
  });
});

describe("review — scenario coverage (tier 3)", () => {
  test("scenario coverage findings appear in the llm tier", async () => {
    const result = await reviewOne(resolve(FIXTURES, "skills/with-scenarios"), {
      judge: async ({ prompt }) => {
        if (prompt.includes("## Scenario Coverage Check")) {
          return {
            mode: "api", ok: true,
            data: {
              overall: "warn", summary: "one uncovered",
              findings: [{ severity: "warning", category: "coverage", finding: 'Scenario 1 ("deploy with failing tests") is UNCOVERED: no guardrail mentioned', suggestion: "add a MUST NOT guardrail" }],
            },
          };
        }
        return { mode: "api", ok: true, data: passData };
      },
    });
    expect(result.tiers.llm?.findings.some(f => f.message.includes("UNCOVERED"))).toBe(true);
  });

  test("scenario judge is not called when the skill has no scenarios.yaml", async () => {
    let calls = 0;
    await reviewOne(resolve(FIXTURES, "skills/minimal-good"), {
      judge: async () => {
        calls++;
        return { mode: "api", ok: true, data: passData };
      },
    });
    expect(calls).toBe(1);
  });

  test("judge is not called when quick mode is on", async () => {
    let called = false;
    await reviewOne(resolve(FIXTURES, "skills/with-scenarios"), {
      quick: true,
      judge: async () => { called = true; return { mode: "api", ok: true, data: passData }; },
    });
    expect(called).toBe(false);
  });

  test("scenario judge is not attempted when the main skill lint already failed", async () => {
    let calls = 0;
    await reviewOne(resolve(FIXTURES, "skills/with-scenarios"), {
      judge: async () => {
        calls++;
        return { mode: "api", ok: false, error: "judge timed out" };
      },
    });
    expect(calls).toBe(1);
  });

  test("deep mode with a failing scenario judge throws E-NET-002 even though main lint succeeded", async () => {
    try {
      await reviewOne(resolve(FIXTURES, "skills/with-scenarios"), {
        deep: true,
        judge: async ({ prompt }) => {
          if (prompt.includes("## Scenario Coverage Check")) return { mode: "api", ok: false, error: "judge timed out" };
          return { mode: "api", ok: true, data: passData };
        },
      });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe("E-NET-002");
    }
  });
});

describe("review — workspace", () => {
  test("reviews all skills found under a root", async () => {
    const results = await review(resolve(FIXTURES), { quick: true, cwd: SANDBOX });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.path && r.tiers.structure)).toBe(true);
  });
});

describe("review — delegate mode (no API key, not --ci)", () => {
  test("R021 off omits principles from delegated prompts", async () => {
    await withPrincipleRule(false, async () => {
      const result = await reviewOne(resolve(FIXTURES, "skills/minimal-good"), {
        judge: async ({ prompt }) => ({ mode: "delegate", prompt }),
      });
      expect(result.tiers.llm?.method).toBe("delegated");
      expect(result.tiers.llm?.prompt).not.toContain("Project Principles");
      expect(result.tiers.llm?.prompt).not.toContain("Never use skill");
    });
  });
  test("delegate mode: llm tier carries a prompt, no findings, no throw under --deep", async () => {
    const home = mkdtempSync(join(tmpdir(), "dora-home-"));
    const prevHome = process.env.DORAVAL_HOME;
    const keysToClear = [
      "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GROQ_API_KEY", "ZAI_API_KEY",
      "ZHIPU_API_KEY", "GLM_API_KEY", "OPENROUTER_API_KEY",
      "ZAI_BASE_URL", "OPENAI_BASE_URL",
    ];
    const prevValues: Record<string, string | undefined> = {};
    for (const k of keysToClear) {
      prevValues[k] = process.env[k];
      delete process.env[k];
    }
    process.env.DORAVAL_HOME = home;
    try {
      const r = await reviewOne(resolve(FIXTURES, "skills/with-scenarios"), { deep: false, ci: false });
      expect(r.tiers.llm?.available).toBe(true);
      expect(r.tiers.llm?.method).toBe("delegated");
      expect(typeof r.tiers.llm?.prompt).toBe("string");
      expect(r.tiers.llm?.prompt?.match(/CRITICAL: Return ONLY/g)?.length).toBe(1);
      expect(r.tiers.llm?.prompt?.match(/\nBODY:\n/g)?.length).toBe(1);
      expect(r.tiers.llm?.prompt).toContain("## Scenario Coverage Check");
      expect(r.tiers.llm?.findings).toEqual([]);
    } finally {
      if (prevHome === undefined) delete process.env.DORAVAL_HOME;
      else process.env.DORAVAL_HOME = prevHome;
      for (const k of keysToClear) {
        if (prevValues[k] !== undefined) process.env[k] = prevValues[k];
      }
    }
  });
});
