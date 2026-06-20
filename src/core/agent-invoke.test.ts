import { describe, test, expect } from "bun:test";
import { buildAgentArgv } from "./agent-invoke.js";

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
