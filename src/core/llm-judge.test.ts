import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  stripReasoningArtifacts,
  extractCandidates,
  hasDirectApiCredentials,
  canUseApiJudge,
  resolveDirectCredentials,
  JudgeSchema,
} from "./llm-judge.js";

describe("stripReasoningArtifacts", () => {
  test("removes think blocks and leaves JSON", () => {
    const raw = `<think>
reasoning here
</think>
{"verdict":"PASS","checklist":[]}`;
    const stripped = stripReasoningArtifacts(raw);
    expect(stripped).not.toContain("<think>");
    expect(stripped).toContain('"verdict"');
  });

  test("extractCandidates finds verdict after think block", () => {
    const raw = `<think>ignore me</think>\n{"verdict":"FAIL","checklist":[{"item":"x","pass":false}]}`;
    const candidates = extractCandidates(raw);
    const hit = candidates.find((c) => c.verdict === "FAIL");
    expect(hit).toBeDefined();
    expect(Array.isArray(hit?.checklist)).toBe(true);
  });
});

describe("hasDirectApiCredentials / resolveDirectCredentials", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    for (const k of [
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "ZAI_API_KEY",
      "ZHIPU_API_KEY",
      "GLM_API_KEY",
      "OPENAI_BASE_URL",
      "ZAI_BASE_URL",
    ]) {
      delete process.env[k];
    }
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  test("false with nothing configured", () => {
    expect(hasDirectApiCredentials()).toBe(false);
    expect(canUseApiJudge({ model: "", max_tool_calls: 200, save_history: true })).toBe(false);
  });

  test("true when ZAI_API_KEY set (parity with init)", () => {
    process.env.ZAI_API_KEY = "sk-zai";
    expect(hasDirectApiCredentials()).toBe(true);
  });

  test("resolveDirectCredentials returns model default and key from env", () => {
    process.env.OPENAI_API_KEY = "sk-oai";
    const creds = resolveDirectCredentials({ model: "gpt-4o-mini" });
    expect(creds.apiKey).toBe("sk-oai");
    expect(creds.model).toBe("gpt-4o-mini");
    expect(creds.baseUrl).toContain("openai.com");
  });

  test("zai provider resolves z.ai base URL", () => {
    // Provider is now explicit — model alone doesn't infer the provider
    const creds = resolveDirectCredentials({ model: "glm-4", provider: "zai" });
    expect(creds.baseUrl).toContain("z.ai");
    expect(creds.providerName).toBe("zai");
  });

  test("env ZAI_API_KEY detection resolves zai provider and z.ai base", () => {
    process.env.ZAI_API_KEY = "sk-zai";
    const creds = resolveDirectCredentials({ model: "glm-4" });
    expect(creds.apiKey).toBe("sk-zai");
    expect(creds.baseUrl).toContain("z.ai");
  });
});

describe("JudgeSchema — new 4-state checklist shape", () => {
  const validObject = {
    verdict: "PASS",
    verdictReason: "All instructions followed",
    checklist: [
      {
        instruction: "Invoke the Skill tool",
        bindingness: "MANDATORY",
        itemVerdict: "ALIGNED",
        evidence: "tool-call index 0",
        detail: "Skill was called first",
      },
      {
        instruction: "Read the failing code",
        bindingness: "CONDITIONAL",
        itemVerdict: "JUSTIFIED",
        evidence: "",
      },
    ],
    ambiguityFlags: [],
    userFamiliarity: 7,
    userFamiliarityReason: "User provided precise paths",
    closure: "1-shot",
    userTurnsAfterSkill: 1,
  };

  test("parses a valid object with new fields", () => {
    const result = JudgeSchema.safeParse(validObject);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.checklist[0]?.bindingness).toBe("MANDATORY");
      expect(result.data.checklist[0]?.itemVerdict).toBe("ALIGNED");
      expect(result.data.checklist[0]?.evidence).toBe("tool-call index 0");
      expect(result.data.ambiguityFlags).toEqual([]);
      expect(result.data.verdict).toBe("PASS");
    }
  });

  test("parses all itemVerdict states", () => {
    for (const itemVerdict of ["ALIGNED", "DRIFTED", "JUSTIFIED", "UNCLEAR"] as const) {
      const obj = {
        ...validObject,
        checklist: [{ ...validObject.checklist[0]!, itemVerdict }],
      };
      const result = JudgeSchema.safeParse(obj);
      expect(result.success).toBe(true);
    }
  });

  test("parses all bindingness levels", () => {
    for (const bindingness of ["MANDATORY", "CONDITIONAL", "DISCRETIONARY"] as const) {
      const obj = {
        ...validObject,
        checklist: [{ ...validObject.checklist[0]!, bindingness }],
      };
      const result = JudgeSchema.safeParse(obj);
      expect(result.success).toBe(true);
    }
  });

  test("parses object with ambiguityFlags populated", () => {
    const obj = { ...validObject, ambiguityFlags: ["Step 3 is vague", "No tool specified"] };
    const result = JudgeSchema.safeParse(obj);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ambiguityFlags).toHaveLength(2);
    }
  });

  test("rejects object missing bindingness", () => {
    const obj = {
      ...validObject,
      checklist: [{ instruction: "x", itemVerdict: "ALIGNED", evidence: "" }],
    };
    const result = JudgeSchema.safeParse(obj);
    expect(result.success).toBe(false);
  });

  test("rejects object missing itemVerdict", () => {
    const obj = {
      ...validObject,
      checklist: [{ instruction: "x", bindingness: "MANDATORY", evidence: "" }],
    };
    const result = JudgeSchema.safeParse(obj);
    expect(result.success).toBe(false);
  });

  test("rejects old pass: boolean shape", () => {
    const obj = {
      ...validObject,
      checklist: [{ instruction: "x", pass: true, bindingness: "MANDATORY", evidence: "" }],
    };
    // pass is not part of schema; but missing itemVerdict means it should fail
    const result = JudgeSchema.safeParse(obj);
    expect(result.success).toBe(false);
  });

  test("rejects object missing ambiguityFlags", () => {
    const { ambiguityFlags: _dropped, ...objWithout } = validObject;
    const result = JudgeSchema.safeParse(objWithout);
    expect(result.success).toBe(false);
  });

  test("evidence is required (not undefined)", () => {
    const obj = {
      ...validObject,
      checklist: [{ instruction: "x", bindingness: "MANDATORY", itemVerdict: "ALIGNED" }],
    };
    const result = JudgeSchema.safeParse(obj);
    expect(result.success).toBe(false);
  });

  test("evidence can be empty string", () => {
    const obj = {
      ...validObject,
      checklist: [{ instruction: "x", bindingness: "MANDATORY", itemVerdict: "ALIGNED", evidence: "" }],
    };
    const result = JudgeSchema.safeParse(obj);
    expect(result.success).toBe(true);
  });

  test("top-level verdict stays PASS|FAIL binary", () => {
    const passObj = { ...validObject, verdict: "PASS" };
    const failObj = { ...validObject, verdict: "FAIL" };
    const unknownObj = { ...validObject, verdict: "UNKNOWN" };
    expect(JudgeSchema.safeParse(passObj).success).toBe(true);
    expect(JudgeSchema.safeParse(failObj).success).toBe(true);
    expect(JudgeSchema.safeParse(unknownObj).success).toBe(false);
  });
});
