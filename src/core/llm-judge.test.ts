import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  stripReasoningArtifacts,
  extractCandidates,
  hasDirectApiCredentials,
  canUseApiJudge,
  resolveDirectCredentials,
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
