import { describe, test, expect } from "bun:test";
import { buildAgentArgv, getDefaultPromptTemplate, resolveAgentConfig } from "./agent-invoke.js";

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
    expect(getDefaultPromptTemplate("claude")).toBe('-p "{{prompt}}" --output-format json --bare');
    expect(getDefaultPromptTemplate("claude-code")).toBe('-p "{{prompt}}" --output-format json --bare');
    expect(getDefaultPromptTemplate("/usr/local/bin/claude")).toBe('-p "{{prompt}}" --output-format json --bare');
  });

  test("returns correct template for grok", () => {
    expect(getDefaultPromptTemplate("grok")).toBe('-p "{{prompt}}" --no-auto-update --no-alt-screen --always-approve');
    expect(getDefaultPromptTemplate("grok-cli")).toBe('-p "{{prompt}}" --no-auto-update --no-alt-screen --always-approve');
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
    expect(resolved.prompt_template).toBe('-p "{{prompt}}" --output-format json --bare');
    expect(resolved.cwd_flag).toBeUndefined();
  });

  test("strips json output format from grok template", () => {
    const resolved = resolveAgentConfig({
      command: "grok",
      prompt_template: '-p "{{prompt}}" --output-format json --bare',
    });
    expect(resolved.prompt_template).toBe(
      '-p "{{prompt}}" --no-auto-update --no-alt-screen --always-approve'
    );
  });

  test("keeps custom claude template when compatible", () => {
    const custom = '-p "{{prompt}}" --output-format json --bare --model sonnet';
    const resolved = resolveAgentConfig({ command: "claude", prompt_template: custom });
    expect(resolved.prompt_template).toBe(custom);
  });

  test("fills in default template when none set", () => {
    const resolved = resolveAgentConfig({ command: "claude" });
    expect(resolved.prompt_template).toBe('-p "{{prompt}}" --output-format json --bare');
  });
});
