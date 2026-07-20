import { describe, expect, test, mock, spyOn } from "bun:test";
import { llmTierPlan, reviewSkill, reviewAll } from "./review.js";
import { resolveEffectiveRules } from "./rules/resolve.js";
import { join, resolve } from "path";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";

const FIXTURES = resolve(import.meta.dir, "../../test/fixtures");

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

describe("reviewSkill", () => {
  test("valid skill produces passing structure + heuristic findings", async () => {
    const result = await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), { quick: true });
    expect(result.tiers.structure.errors).toBe(0);
    expect(result.summary.errors).toBe(0);
    expect(result.tiers.structure.findings.length).toBeGreaterThan(0);
    expect(result.tiers.structure.findings.every(f => f.tier === "structure")).toBe(true);
    expect(result.tiers.llm).toBeUndefined();
  });

  test("invalid skill dir returns a stamped load-error finding", async () => {
    const result = await reviewSkill("/nonexistent/skill", { quick: true });
    expect(result.summary.errors).toBeGreaterThan(0);
    expect(result.tiers.structure.findings[0]).toMatchObject({
      severity: "error", code: "R002", slug: "frontmatter-parse",
    });
    expect(result.tiers.structure.findings[0]?.docUrl).toContain("/reference/rules/R002");
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

  test("mechanical findings carry public rule identity", async () => {
    const result = await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), { quick: true });
    for (const finding of [...result.tiers.structure.findings, ...result.tiers.heuristics.findings]) {
      expect(finding.code).toMatch(/^R\d{3}$/);
      expect(finding.slug).toBeTruthy();
      expect(finding.docUrl).toContain(`/reference/rules/${finding.code}`);
    }
  });

  test("deep mode without LLM under --ci throws PrerequisiteError", async () => {
    // Mock detectCapabilities to return "none" — avoids real API call.
    // ci:true forces mode="fail" (no caller to delegate to in a headless context).
    const capsMod = await import("./capability-detect.js");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: false, preferred: "none",
    } as any);
    try {
      await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), { deep: true, ci: true });
      expect(true).toBe(false); // should not reach here
    } catch (e: any) {
      expect(e.code).toBe("E-PRE-004");
    } finally {
      spy.mockRestore();
    }
  });

  test("deep mode with a judge that FAILS throws E-NET-002 instead of silently degrading", async () => {
    const capsMod = await import("./capability-detect.js");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: true, preferred: "api",
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
      api: true, preferred: "api",
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
      api: true, preferred: "api",
    } as any);

    let seenPlatform: string | undefined = "sentinel";
    let seenRubric: string | undefined;
    try {
      await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), {
        lintFn: async (_m, _c, _a, _e, platform, extraRubric) => {
          seenPlatform = platform;
          seenRubric = extraRubric;
          return { ok: true, method: "api", output: { overall: "pass", summary: "ok", findings: [] } };
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

  test("R021 off skips mechanical principles and API rubric injection", async () => {
    const capsMod = await import("./capability-detect.js");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({ api: true, preferred: "api" } as any);
    let rubric: string | undefined = "sentinel";
    try {
      await withPrincipleRule(false, async () => {
        const result = await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), {
          lintFn: async (_model, _caps, _agent, _eval, _platform, extraRubric) => {
            rubric = extraRubric;
            return { ok: true, method: "api", output: { overall: "pass", summary: "ok", findings: [] } };
          },
        });
        expect(result.tiers.heuristics.findings.some((finding) => finding.code === "R021")).toBe(false);
      });
      expect(rubric).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });

  test("R021 enabled keeps weight-derived mechanical severity", async () => {
    await withPrincipleRule(true, async () => {
      const result = await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), { quick: true });
      expect(result.tiers.heuristics.findings.find((finding) => finding.code === "R021")?.severity).toBe("error");
    });
  });

  test("onProgress fires before the LLM tier runs, with the skill path", async () => {
    const capsMod = await import("./capability-detect.js");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: true, preferred: "api",
    } as any);
    const calls: string[] = [];
    const skillDir = resolve(FIXTURES, "skills/minimal-good");
    try {
      await reviewSkill(skillDir, {
        lintFn: async () => ({ ok: true, method: "api", output: { overall: "pass", summary: "ok", findings: [] } }),
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

describe("reviewSkill — scenario coverage (tier 3)", () => {
  test("scenario coverage findings from scenarioLintFn appear in the llm tier", async () => {
    const capsMod = await import("./capability-detect.js");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: true, preferred: "api",
    } as any);
    try {
      const result = await reviewSkill(resolve(FIXTURES, "skills/with-scenarios"), {
        lintFn: async () => ({ ok: true, method: "api", output: { overall: "pass", summary: "ok", findings: [] } }),
        scenarioLintFn: async () => ({
          ok: true, method: "api",
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
      api: true, preferred: "api",
    } as any);
    let called = false;
    try {
      await reviewSkill(resolve(FIXTURES, "skills/minimal-good"), {
        lintFn: async () => ({ ok: true, method: "api", output: { overall: "pass", summary: "ok", findings: [] } }),
        scenarioLintFn: async () => { called = true; return { ok: true, method: "api", output: { overall: "pass", summary: "ok", findings: [] } }; },
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
      scenarioLintFn: async () => { called = true; return { ok: true, method: "api", output: { overall: "pass", summary: "ok", findings: [] } }; },
    });
    expect(called).toBe(false);
  });

  test("scenarioLintFn is not attempted when the main skill lint already failed", async () => {
    const capsMod = await import("./capability-detect.js");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: true, preferred: "api",
    } as any);
    let called = false;
    try {
      await reviewSkill(resolve(FIXTURES, "skills/with-scenarios"), {
        lintFn: async () => ({ ok: false, error: "judge timed out" }),
        scenarioLintFn: async () => { called = true; return { ok: true, method: "api", output: { overall: "pass", summary: "ok", findings: [] } }; },
      });
      expect(called).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  test("deep mode with a failing scenario judge throws E-NET-002 even though main lint succeeded", async () => {
    const capsMod = await import("./capability-detect.js");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({
      api: true, preferred: "api",
    } as any);
    try {
      await reviewSkill(resolve(FIXTURES, "skills/with-scenarios"), {
        deep: true,
        lintFn: async () => ({ ok: true, method: "api", output: { overall: "pass", summary: "ok", findings: [] } }),
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

describe("reviewSkill — delegate mode (no API key, not --ci)", () => {
  test("R021 off omits principles from delegated prompts", async () => {
    const capsMod = await import("./capability-detect.js");
    const spy = spyOn(capsMod, "detectCapabilities").mockReturnValue({ api: false, preferred: "none" } as any);
    try {
      await withPrincipleRule(false, async () => {
        const result = await reviewSkill(resolve(FIXTURES, "skills/minimal-good"));
        expect(result.tiers.llm?.method).toBe("delegated");
        expect(result.tiers.llm?.prompt).not.toContain("Project Principles");
        expect(result.tiers.llm?.prompt).not.toContain("Never use skill");
      });
    } finally {
      spy.mockRestore();
    }
  });
  test("delegate mode: llm tier carries a prompt, no findings, no throw under --deep", async () => {
    // Isolate from any real ~/.doraval/config.yml on the dev machine (which may
    // have a configured api_key) — point DORAVAL_HOME at an empty temp dir so
    // readConfig() sees no eval config, in addition to clearing env keys.
    const { mkdtempSync } = await import("fs");
    const { tmpdir } = await import("os");
    const { join } = await import("path");
    const home = mkdtempSync(join(tmpdir(), "dora-home-"));
    const prevHome = process.env.DORAVAL_HOME;
    // The repo's dev .env (auto-loaded by Bun) sets ZAI_API_KEY — clear every
    // provider key/base-url env var, not just OPENAI/ANTHROPIC, so this
    // exercises the true no-key path regardless of local dev configuration.
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
      const r = await reviewSkill(resolve(FIXTURES, "skills/with-scenarios"), { deep: false, ci: false });
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
