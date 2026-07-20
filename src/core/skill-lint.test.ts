import { describe, it, test, expect } from "bun:test";
import { buildLintPrompt, runJudge, type LintOutput } from "./skill-lint.js";
import type { Capabilities } from "./capability-detect.js";

const exampleModel = {
  data: { name: "my-skill", description: "Does something useful" },
  content: "## Instructions\n\nDo the thing when asked.",
};

const NO_API: Capabilities = { api: false, preferred: "none" };
const AGENT = { command: "" };
const EVAL = { model: "", max_tool_calls: 200, save_history: true, judge: "auto" as const };

describe("buildLintPrompt", () => {
  it("includes frontmatter fields", () => {
    const prompt = buildLintPrompt(exampleModel);
    expect(prompt).toContain("name: my-skill");
    expect(prompt).toContain("description: Does something useful");
  });

  it("includes body content", () => {
    const prompt = buildLintPrompt(exampleModel);
    expect(prompt).toContain("Do the thing when asked.");
  });

  it("instructs to return JSON", () => {
    const prompt = buildLintPrompt(exampleModel);
    expect(prompt).toContain("overall");
    expect(prompt).toContain("findings");
  });

  it("injects claude platform context when --for claude", () => {
    const prompt = buildLintPrompt(exampleModel, "claude");
    expect(prompt).toContain("PLATFORM CONTEXT");
    expect(prompt).toContain("Claude Code");
    expect(prompt).toContain("$ARGUMENTS");
  });

  it("injects cursor platform context when --for cursor", () => {
    const prompt = buildLintPrompt(exampleModel, "cursor");
    expect(prompt).toContain("PLATFORM CONTEXT");
    expect(prompt).toContain("Cursor");
    expect(prompt).toContain(".mdc");
  });

  it("no platform section when --for omitted", () => {
    const prompt = buildLintPrompt(exampleModel);
    expect(prompt).not.toContain("PLATFORM CONTEXT");
  });

  it("no platform section for unknown platform", () => {
    const prompt = buildLintPrompt(exampleModel, "unknown-platform");
    expect(prompt).not.toContain("PLATFORM CONTEXT");
  });

  it("injects project principles rubric when provided", () => {
    const rubric = "## Project Principles\n- [w9] never use default exports";
    const prompt = buildLintPrompt(exampleModel, undefined, rubric);
    expect(prompt).toContain("PROJECT PRINCIPLES");
    expect(prompt).toContain("never use default exports");
    // The rubric must come with an instruction that tells the judge to enforce it.
    expect(prompt.toLowerCase()).toContain("violat");
  });

  it("rubric and platform sections compose", () => {
    const prompt = buildLintPrompt(exampleModel, "claude", "- [w8] prefer named exports");
    expect(prompt).toContain("PLATFORM CONTEXT");
    expect(prompt).toContain("PROJECT PRINCIPLES");
  });

  it("no principles section when rubric omitted or empty", () => {
    expect(buildLintPrompt(exampleModel)).not.toContain("PROJECT PRINCIPLES");
    expect(buildLintPrompt(exampleModel, undefined, "")).not.toContain("PROJECT PRINCIPLES");
  });
});

describe("LintOutput shape (type safety smoke test)", () => {
  it("pass result accepted by type", () => {
    const result: LintOutput = {
      overall: "pass",
      summary: "Skill looks good",
      findings: [],
    };
    expect(result.overall).toBe("pass");
  });

  it("fail result with findings accepted", () => {
    const result: LintOutput = {
      overall: "fail",
      summary: "Has errors",
      findings: [
        {
          severity: "error",
          category: "clarity",
          finding: "Instructions are ambiguous",
          suggestion: "Be more specific",
        },
      ],
    };
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.severity).toBe("error");
  });
});

describe("runJudge", () => {
  it("returns 'no judge available' error when caps.preferred is 'none' and --ci", async () => {
    const { runJudge } = await import("./skill-lint.js");
    const result = await runJudge(
      "irrelevant prompt",
      { api: false, preferred: "none" },
      { command: "" },
      {},
      { ci: true }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("No judge available");
    }
  });

  test("no key, interactive -> delegated result carrying the prompt", async () => {
    const r = await runJudge("RUBRIC PROMPT BODY", NO_API, AGENT, EVAL, { ci: false });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.method).toBe("delegated");
      expect(r.prompt).toContain("RUBRIC PROMPT BODY");
      expect(r.output.findings).toEqual([]);
    }
  });

  test("no key, --ci -> fail (not ok)", async () => {
    const r = await runJudge("RUBRIC PROMPT BODY", NO_API, AGENT, EVAL, { ci: true });
    expect(r.ok).toBe(false);
  });
});
