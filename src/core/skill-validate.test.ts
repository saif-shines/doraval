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

  test("reports missing name", () => {
    const result = validateSkillModel({
      data: { description: "No name field." },
      content: "Body",
    });

    expect(result.errors).toContain('Missing required field: "name"');
  });

  test("reports invalid kebab-case name", () => {
    const result = validateSkillModel({
      data: { name: "Bad_Name", description: "desc" },
      content: "Body",
    });

    expect(result.errors[0]).toContain("Invalid name format");
  });

  test("reports name length out of range", () => {
    const result = validateSkillModel({
      data: { name: "a", description: "desc" },
      content: "Body",
    });

    expect(result.errors[0]).toContain("Name length out of range");
  });

  test("reports missing description", () => {
    const result = validateSkillModel({
      data: { name: "my-skill" },
      content: "Body",
    });

    expect(result.errors).toContain('Missing required field: "description"');
  });

  test("reports empty body", () => {
    const result = validateSkillModel({
      data: { name: "my-skill", description: "desc" },
      content: "   \n  ",
    });

    expect(result.errors).toContain("Markdown body is empty");
  });

  test("reports missing frontmatter", () => {
    const result = validateSkillModel({
      data: {},
      content: "Body only",
    });

    expect(result.errors).toContain("YAML frontmatter is empty or missing");
  });
});
