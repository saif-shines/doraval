import { describe, test, expect, spyOn, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";

// ─── Smoke test: module loads, meta is correct ────────────────────────────────

describe("judge command smoke test", () => {
  test("command module loads without throwing", async () => {
    const mod = await import("./judge.js");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("object");
    expect(mod.default.meta?.name).toBe("judge");
  });

  test("meta description mentions rubric or artifact", async () => {
    const mod = await import("./judge.js");
    const desc = (mod.default.meta?.description ?? "").toLowerCase();
    // Must mention the rubric/artifact purpose
    expect(desc).toContain("rubric");
  });

  test("command args include path, --rubric, --for, --format, --ci, --verbose", async () => {
    const mod = await import("./judge.js");
    const args = mod.default.args ?? {};
    expect(args).toHaveProperty("path");
    expect(args).toHaveProperty("rubric");
    expect(args).toHaveProperty("for");
    expect(args).toHaveProperty("format");
    expect(args).toHaveProperty("ci");
    expect(args).toHaveProperty("verbose");
  });

  test("path arg is positional and required", async () => {
    const mod = await import("./judge.js");
    const pathArg = (mod.default.args as Record<string, { type?: string; required?: boolean }>)?.path;
    expect(pathArg?.type).toBe("positional");
    expect(pathArg?.required).toBe(true);
  });
});

// ─── No session imports ───────────────────────────────────────────────────────

describe("judge command is session-free", () => {
  test("judge.ts source does not import session-adapters", async () => {
    // Read the compiled module's source via the raw import — we just check
    // that the module graph does NOT pull in session-adapters by verifying
    // it is not referenced in the module.
    // The simplest approach: read the ts source directly.
    const src = await Bun.file(
      new URL("./judge.ts", import.meta.url).pathname
    ).text();
    expect(src).not.toContain("session-adapters");
    expect(src).not.toContain("parseSession");
    expect(src).not.toContain("runEval");
  });
});

// ─── Default rubric selection ─────────────────────────────────────────────────

describe("judge default rubric selection", () => {
  test("PLATFORM_CONTEXT has claude key", async () => {
    const { PLATFORM_CONTEXT } = await import("../../core/skill-lint.js");
    expect(typeof PLATFORM_CONTEXT["claude"]).toBe("string");
    expect(PLATFORM_CONTEXT["claude"].length).toBeGreaterThan(10);
  });

  test("PLATFORM_CONTEXT has all four platforms", async () => {
    const { PLATFORM_CONTEXT } = await import("../../core/skill-lint.js");
    for (const p of ["claude", "codex", "cursor", "copilot"]) {
      expect(typeof PLATFORM_CONTEXT[p]).toBe("string");
    }
  });
});

// ─── JSON envelope shape (mocked invokeJudge) ────────────────────────────────

describe("judge command JSON envelope shape", () => {
  let tmpDir: string;
  let skillDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `judge-test-${Date.now()}`);
    skillDir = join(tmpDir, "my-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---\nname: my-skill\ndescription: A test skill for judge\n---\n\n## Instructions\n\nAlways run tests before committing.\n`
    );
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  });

  test("run with --format json produces signed verdict envelope", async () => {
    // Mock invokeJudge to avoid real API calls
    const llmJudgeMod = await import("../../core/llm-judge.js");
    const invokeJudgeSpy = spyOn(llmJudgeMod, "invokeJudge").mockResolvedValue({
      success: true,
      data: {
        verdict: "PASS",
        verdictReason: "All criteria met.",
        checklist: [
          {
            instruction: "Skill body must be non-empty",
            bindingness: "MANDATORY" as const,
            itemVerdict: "ALIGNED" as const,
            evidence: "body has content",
          },
        ],
        ambiguityFlags: [],
        userFamiliarity: 5,
        userFamiliarityReason: "not applicable (rubric mode)",
        closure: "1-shot" as const,
        userTurnsAfterSkill: 0,
      },
    });

    // Capture stdout
    const chunks: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(
      (chunk: string | Uint8Array, ...rest: unknown[]) => {
        if (typeof chunk === "string") chunks.push(chunk);
        return true;
      }
    );

    const exitSpy = spyOn(process, "exit").mockImplementation((() => {}) as any);

    const mod = await import("./judge.js");
    await mod.default.run!({
      args: {
        path: skillDir,
        rubric: undefined,
        for: "claude",
        format: "json",
        ci: false,
        verbose: false,
      },
      rawArgs: [],
      cmd: mod.default,
    } as any);

    const output = chunks.join("");
    let envelope: Record<string, unknown> | null = null;
    try {
      envelope = JSON.parse(output);
    } catch {
      // ignore parse errors — checked below
    }

    expect(envelope).not.toBeNull();
    if (envelope) {
      // All required signed-verdict fields must be present
      expect(envelope).toHaveProperty("verdict");
      expect(envelope).toHaveProperty("verdictReason");
      expect(envelope).toHaveProperty("rubricRef");
      expect(envelope).toHaveProperty("model");
      expect(envelope).toHaveProperty("provider");
      expect(envelope).toHaveProperty("judgeMethod");
      expect(envelope).toHaveProperty("timestamp");
      expect(envelope).toHaveProperty("doravalVersion");
      expect(envelope).toHaveProperty("checklist");
      expect(envelope).toHaveProperty("ambiguityFlags");

      // Values
      expect(envelope.verdict).toBe("PASS");
      expect(envelope.rubricRef).toBe("built-in:claude");
      expect(envelope.judgeMethod).toBe("api");
      expect(typeof envelope.timestamp).toBe("string");
      expect(typeof envelope.doravalVersion).toBe("string");
      expect(Array.isArray(envelope.checklist)).toBe(true);
      expect(Array.isArray(envelope.ambiguityFlags)).toBe(true);
    }

    invokeJudgeSpy.mockRestore();
    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  test("--rubric <file> injects file content and sets rubricRef to file path", async () => {
    const rubricFile = join(tmpDir, "custom-rubric.md");
    writeFileSync(rubricFile, "# Custom Rubric\n- Always document public APIs.\n");

    const llmJudgeMod = await import("../../core/llm-judge.js");
    const invokeJudgeSpy = spyOn(llmJudgeMod, "invokeJudge").mockResolvedValue({
      success: true,
      data: {
        verdict: "PASS",
        verdictReason: "Custom rubric satisfied.",
        checklist: [],
        ambiguityFlags: [],
        userFamiliarity: 5,
        userFamiliarityReason: "not applicable (rubric mode)",
        closure: "1-shot" as const,
        userTurnsAfterSkill: 0,
      },
    });

    const chunks: string[] = [];
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(
      (chunk: string | Uint8Array, ...rest: unknown[]) => {
        if (typeof chunk === "string") chunks.push(chunk);
        return true;
      }
    );
    const exitSpy = spyOn(process, "exit").mockImplementation((() => {}) as any);

    const mod = await import("./judge.js");
    await mod.default.run!({
      args: {
        path: skillDir,
        rubric: rubricFile,
        for: "claude",
        format: "json",
        ci: false,
        verbose: false,
      },
      rawArgs: [],
      cmd: mod.default,
    } as any);

    // The prompt passed to invokeJudge should include the custom rubric content
    const callArg = invokeJudgeSpy.mock.calls[0]?.[0] as string;
    expect(callArg).toContain("Custom Rubric");

    // The envelope should reference the custom file path
    const output = chunks.join("");
    let envelope: Record<string, unknown> | null = null;
    try {
      envelope = JSON.parse(output);
    } catch {}
    expect(envelope?.rubricRef).toBe(rubricFile);

    invokeJudgeSpy.mockRestore();
    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
