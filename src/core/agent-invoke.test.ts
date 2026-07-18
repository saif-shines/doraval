import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  buildAgentArgv,
  extractCandidates,
  getDefaultPromptTemplate,
  resolveAgentConfig,
} from "./agent-invoke.js";
import { canUseApiJudge } from "./llm-judge.js";

describe("buildAgentArgv", () => {
  test("substitutes prompt marker into argv", () => {
    const result = buildAgentArgv('-p "{{prompt}}" --output-format json', "hello world");
    expect(result).toEqual(["-p", "hello world", "--output-format", "json"]);
  });

  test("handles template without quotes around marker", () => {
    const result = buildAgentArgv('-p {{prompt}} --output-format json', "test prompt");
    expect(result).toEqual(["-p", "test prompt", "--output-format", "json"]);
  });

  test("handles multiline prompt as single arg", () => {
    const result = buildAgentArgv('-p "{{prompt}}"', "line one\nline two");
    expect(result).toEqual(["-p", "line one\nline two"]);
  });
});

describe("getDefaultPromptTemplate", () => {
  test("returns correct template for claude", () => {
    expect(getDefaultPromptTemplate("claude")).toBe('-p "{{prompt}}" --output-format json');
    expect(getDefaultPromptTemplate("claude-code")).toBe('-p "{{prompt}}" --output-format json');
    expect(getDefaultPromptTemplate("/usr/local/bin/claude")).toBe('-p "{{prompt}}" --output-format json');
  });

  test("returns correct template for grok (JSON headless + hygiene flags)", () => {
    const expected =
      '-p "{{prompt}}" --output-format json --no-auto-update --no-alt-screen --always-approve';
    expect(getDefaultPromptTemplate("grok")).toBe(expected);
    expect(getDefaultPromptTemplate("grok-cli")).toBe(expected);
    expect(getDefaultPromptTemplate("/usr/local/bin/grok")).toBe(expected);
  });

  test("returns generic fallback for unknown agents", () => {
    expect(getDefaultPromptTemplate("cursor")).toBe('-p "{{prompt}}"');
    expect(getDefaultPromptTemplate("aider")).toBe('-p "{{prompt}}"');
    expect(getDefaultPromptTemplate("")).toBe('-p "{{prompt}}"');
  });
});

describe("resolveAgentConfig", () => {
  test("strips grok flags from claude template", () => {
    const resolved = resolveAgentConfig({
      command: "claude",
      prompt_template: '-p "{{prompt}}" --output-format json --no-auto-update --no-alt-screen',
      cwd_flag: "--cwd",
    });
    expect(resolved.prompt_template).toBe('-p "{{prompt}}" --output-format json');
    expect(resolved.cwd_flag).toBeUndefined();
  });

  test("keeps grok --output-format json (B-x live-verified)", () => {
    const withJson = '-p "{{prompt}}" --output-format json --no-auto-update --no-alt-screen --always-approve';
    const resolved = resolveAgentConfig({
      command: "grok",
      prompt_template: withJson,
    });
    expect(resolved.prompt_template).toBe(withJson);
  });

  test("fills grok default with json when no template set", () => {
    const resolved = resolveAgentConfig({ command: "grok" });
    expect(resolved.prompt_template).toContain("--output-format json");
    expect(resolved.prompt_template).toContain("--always-approve");
    expect(resolved.prompt_template).toContain("--no-auto-update");
    expect(resolved.prompt_template).toContain("--no-alt-screen");
  });

  test("keeps custom claude template when compatible", () => {
    const custom = '-p "{{prompt}}" --output-format json --model sonnet';
    const resolved = resolveAgentConfig({ command: "claude", prompt_template: custom });
    expect(resolved.prompt_template).toBe(custom);
  });

  test("fills in default template when none set", () => {
    const resolved = resolveAgentConfig({ command: "claude" });
    expect(resolved.prompt_template).toBe('-p "{{prompt}}" --output-format json');
  });
});

describe("extractCandidates (Grok envelope)", () => {
  test("unwraps Grok --output-format json text field (fenced model JSON)", () => {
    const stdout = JSON.stringify({
      text: '```json\n{"overall":"pass","findings":[]}\n```',
      sessionId: "019f-test",
      stopReason: "EndTurn",
      usage: { total_tokens: 100 },
    });
    const candidates = extractCandidates(stdout);
    expect(candidates.some((c) => c.overall === "pass")).toBe(true);
    expect(candidates.some((c) => Array.isArray(c.findings))).toBe(true);
    expect(candidates.some((c) => c.sessionId === "019f-test")).toBe(true);
  });
});

describe("canUseApiJudge", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ZAI_API_KEY;
    delete process.env.ZHIPU_API_KEY;
    delete process.env.GLM_API_KEY;
    delete process.env.OPENAI_BASE_URL;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  test("returns false with no keys and no config", () => {
    expect(canUseApiJudge({ model: "", api_key: undefined, base_url: undefined, max_tool_calls: 200, save_history: true, judge: 'auto' })).toBe(false);
  });

  test("returns true when base_url is set", () => {
    expect(canUseApiJudge({ model: "glm-5-turbo", api_key: undefined, base_url: "https://example.com/v1", max_tool_calls: 200, save_history: true, judge: 'auto' })).toBe(true);
  });

  test("returns true when OPENAI_BASE_URL or ZAI_BASE_URL is set in env", () => {
    process.env.OPENAI_BASE_URL = "https://example.com/v1";
    expect(canUseApiJudge({ model: "glm-5-turbo", api_key: undefined, base_url: undefined, max_tool_calls: 200, save_history: true, judge: 'auto' })).toBe(true);

    delete process.env.OPENAI_BASE_URL;
    process.env.ZAI_BASE_URL = "https://example.com/v1";
    expect(canUseApiJudge({ model: "glm-5-turbo", api_key: undefined, base_url: undefined, max_tool_calls: 200, save_history: true, judge: 'auto' })).toBe(true);
  });

  test("returns true when api_key in eval config", () => {
    expect(canUseApiJudge({ model: "glm-5-turbo", api_key: "sk-test", base_url: undefined, max_tool_calls: 200, save_history: true, judge: 'auto' })).toBe(true);
  });

  test("returns true when ZAI_API_KEY in env", () => {
    process.env.ZAI_API_KEY = "sk-zai";
    expect(canUseApiJudge({ model: "glm-5-turbo", api_key: undefined, base_url: undefined, max_tool_calls: 200, save_history: true, judge: 'auto' })).toBe(true);
  });
});
