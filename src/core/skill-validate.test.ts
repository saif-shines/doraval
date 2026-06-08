import { describe, expect, test } from "bun:test";
import { validateSkillModel } from "./skill-validate.js";

describe("validateSkillModel", () => {
  test("passes a well-formed skill", () => {
    const result = validateSkillModel(
      {
        data: { name: "my-skill", description: "Use when testing." },
        content: "# Steps\n\n1. Run tests",
      },
      { existingDirs: ["references"] }
    );

    expect(result.errors).toEqual([]);
    expect(result.passes).toContain('name: "my-skill"');
    expect(result.passes).toContain("description field present");
    expect(result.passes).toContain("Markdown body is non-empty");
    expect(result.passes).toContain("references/ directory exists");
  });

  test("reports missing name as warning (not error)", () => {
    const result = validateSkillModel({
      data: { description: "No name field." },
      content: "Body",
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.includes("name"))).toBe(true);
  });

  test("reports invalid kebab-case name (still error when bad name supplied)", () => {
    const result = validateSkillModel({
      data: { name: "Bad_Name", description: "desc" },
      content: "Body",
    });

    expect(result.errors[0]).toContain("Invalid name format");
  });

  test("reports name length out of range (still error when bad name supplied)", () => {
    const result = validateSkillModel({
      data: { name: "a", description: "desc" },
      content: "Body",
    });

    expect(result.errors[0]).toContain("Name length out of range");
  });

  test("reports missing description as warning (not error)", () => {
    const result = validateSkillModel({
      data: { name: "my-skill" },
      content: "Body",
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.includes("description"))).toBe(true);
  });

  test("reports empty body (still hard error)", () => {
    const result = validateSkillModel({
      data: { name: "my-skill", description: "desc" },
      content: "   \n  ",
    });

    expect(result.errors).toContain("Markdown body is empty");
  });

  test("reports missing frontmatter as warning (not hard error)", () => {
    const result = validateSkillModel({
      data: {},
      content: "Body only",
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.includes("frontmatter"))).toBe(true);
  });

  test("recognizes advanced frontmatter, dynamic injection, and substitutions", () => {
    const result = validateSkillModel(
      {
        data: {
          name: "rich-example",
          description: "demo",
          "allowed-tools": "Read Grep",
          context: "fork",
          agent: "Explore",
          "disable-model-invocation": true,
        },
        content: `Do the work.

Current state: !\`git status --short\`

Use $ARGUMENTS or $0 and \${CLAUDE_SKILL_DIR}.
`,
      },
      { existingDirs: ["scripts", "examples"] }
    );

    expect(result.errors).toEqual([]);
    expect(result.passes).toContain('name: "rich-example"');
    expect(result.passes.some((p) => p.includes("advanced frontmatter"))).toBe(true);
    expect(result.passes).toContain("uses dynamic context injection (!`...` or ```! blocks)");
    expect(result.passes).toContain("uses argument / session substitutions ($ARGUMENTS, $0, ${CLAUDE_*})");
    expect(result.passes).toContain("scripts/ directory exists");
    expect(result.passes).toContain("examples/ directory exists");
  });
});
