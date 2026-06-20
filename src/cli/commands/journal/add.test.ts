import { describe, expect, test } from "bun:test";
import { buildAgentArgv } from "../../../core/agent-invoke.js";

describe("buildAgentArgv (for on-the-fly agent enrichment)", () => {
  test("keeps the full multiline prompt as a single argv element", () => {
    const template = '-p "{{prompt}}" --output-format json';
    const prompt = 'Line one\nLine two with "quotes" and {json}';
    const argv = buildAgentArgv(template, prompt);

    expect(argv).toEqual([
      "-p",
      'Line one\nLine two with "quotes" and {json}',
      "--output-format",
      "json",
    ]);
    // Critical: the prompt must not have been split
    expect(argv.filter(a => a.includes("\n")).length).toBe(1);
  });

  test("handles templates without surrounding quotes around {{prompt}}", () => {
    const template = "--prompt {{prompt}} --json";
    const prompt = "simple title here";
    const argv = buildAgentArgv(template, prompt);
    expect(argv).toEqual(["--prompt", "simple title here", "--json"]);
  });

  test("strips single quotes around placeholder from template", () => {
    const template = "-p '{{prompt}}' --foo";
    const prompt = "hello world";
    const argv = buildAgentArgv(template, prompt);
    expect(argv).toEqual(["-p", "hello world", "--foo"]);
  });

  test("falls back to a sane default template when none stored", () => {
    const prompt = "X";
    const argv = buildAgentArgv('-p "{{prompt}}" --output-format json', prompt);
    expect(argv[0]).toBe("-p");
    expect(argv[1]).toBe("X");
  });
});
