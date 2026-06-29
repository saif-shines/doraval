import { describe, it, expect } from "bun:test";
import { buildLintPrompt, type LintOutput } from "./skill-lint.js";

const exampleModel = {
  data: { name: "my-skill", description: "Does something useful" },
  content: "## Instructions\n\nDo the thing when asked.",
};

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
