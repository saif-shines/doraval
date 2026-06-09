import { describe, expect, test } from "bun:test";
import {
  validateSkillModel, merge,
  checkFrontmatterPresence, checkName, checkDescription, checkBody,
  checkAdvancedFields, checkUnknownFields, checkSupportingDirs, checkDynamicInjection,
} from "./skill-validate.js";

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

describe("merge", () => {
  test("combines two empty results", () => {
    const a = { errors: [], warnings: [], passes: [] };
    const b = {};
    expect(merge(a, b)).toEqual({ errors: [], warnings: [], passes: [] });
  });

  test("concatenates errors from both sides", () => {
    const a = { errors: ["e1"], warnings: [], passes: [] };
    const b = { errors: ["e2"] };
    expect(merge(a, b)).toEqual({ errors: ["e1", "e2"], warnings: [], passes: [] });
  });

  test("concatenates warnings and passes", () => {
    const a = { errors: [], warnings: ["w1"], passes: ["p1"] };
    const b = { warnings: ["w2"], passes: ["p2"] };
    expect(merge(a, b)).toEqual({ errors: [], warnings: ["w1", "w2"], passes: ["p1", "p2"] });
  });

  test("does not mutate the accumulator", () => {
    const a = { errors: [], warnings: [], passes: ["p1"] };
    const b = { passes: ["p2"] };
    merge(a, b);
    expect(a.passes).toEqual(["p1"]);
  });
});

describe("checkFrontmatterPresence", () => {
  test("returns warning when frontmatter is empty", () => {
    const result = checkFrontmatterPresence({ data: {}, content: "body" }, { existingDirs: [] });
    expect(result.warnings).toContain("YAML frontmatter is empty (description recommended for discoverability)");
    expect(result.passes).toBeUndefined();
  });

  test("returns pass when frontmatter has keys", () => {
    const result = checkFrontmatterPresence({ data: { name: "x" }, content: "body" }, { existingDirs: [] });
    expect(result.passes).toContain("YAML frontmatter present and parseable");
    expect(result.warnings).toBeUndefined();
  });
});

describe("checkName", () => {
  test("returns warning when name is absent", () => {
    const result = checkName({ data: {}, content: "" }, { existingDirs: [] });
    expect(result.warnings?.[0]).toContain("No \"name\" in frontmatter");
  });

  test("returns error for invalid kebab-case", () => {
    const result = checkName({ data: { name: "Bad_Name" }, content: "" }, { existingDirs: [] });
    expect(result.errors?.[0]).toContain("Invalid name format");
  });

  test("returns error for name too short", () => {
    const result = checkName({ data: { name: "a" }, content: "" }, { existingDirs: [] });
    expect(result.errors?.[0]).toContain("Name length out of range");
  });

  test("returns pass for valid name", () => {
    const result = checkName({ data: { name: "my-skill" }, content: "" }, { existingDirs: [] });
    expect(result.passes).toContain('name: "my-skill"');
  });
});

describe("checkDescription", () => {
  test("returns warning when description absent", () => {
    const result = checkDescription({ data: {}, content: "" }, { existingDirs: [] });
    expect(result.warnings?.[0]).toContain("Missing \"description\"");
  });

  test("returns pass when description present", () => {
    const result = checkDescription({ data: { description: "Use when testing." }, content: "" }, { existingDirs: [] });
    expect(result.passes).toContain("description field present");
  });
});

describe("checkBody", () => {
  test("returns error when content is blank", () => {
    const result = checkBody({ data: {}, content: "   \n  " }, { existingDirs: [] });
    expect(result.errors).toContain("Markdown body is empty");
  });

  test("returns pass when content is non-empty", () => {
    const result = checkBody({ data: {}, content: "# Steps" }, { existingDirs: [] });
    expect(result.passes).toContain("Markdown body is non-empty");
  });
});

describe("checkAdvancedFields", () => {
  test("returns nothing when only name/description present", () => {
    const result = checkAdvancedFields(
      { data: { name: "x", description: "d" }, content: "" },
      { existingDirs: [] }
    );
    expect(result.passes).toBeUndefined();
  });

  test("returns pass listing recognized advanced keys", () => {
    const result = checkAdvancedFields(
      { data: { name: "x", description: "d", "allowed-tools": "Read", context: "fork" }, content: "" },
      { existingDirs: [] }
    );
    expect(result.passes?.[0]).toContain("advanced frontmatter");
    expect(result.passes?.[0]).toContain("allowed-tools");
    expect(result.passes?.[0]).toContain("context");
  });
});

describe("checkUnknownFields", () => {
  test("returns no warnings when all fields are known", () => {
    const result = checkUnknownFields(
      { data: { name: "x", description: "d" }, content: "" },
      { existingDirs: [] }
    );
    expect(result.warnings).toEqual([]);
  });

  test("returns warning for each unknown field", () => {
    const result = checkUnknownFields(
      { data: { name: "x", foo: "bar", baz: "qux" }, content: "" },
      { existingDirs: [] }
    );
    expect(result.warnings?.length).toBe(2);
    expect(result.warnings?.[0]).toContain("foo");
    expect(result.warnings?.[1]).toContain("baz");
  });
});

describe("checkSupportingDirs", () => {
  test("returns empty passes when no dirs exist", () => {
    const result = checkSupportingDirs({ data: {}, content: "" }, { existingDirs: [] });
    expect(result.passes).toEqual([]);
  });

  test("returns pass for each existing supporting dir", () => {
    const result = checkSupportingDirs(
      { data: {}, content: "" },
      { existingDirs: ["references", "scripts"] }
    );
    expect(result.passes).toContain("references/ directory exists");
    expect(result.passes).toContain("scripts/ directory exists");
  });

  test("ignores dirs not in SUPPORTING_DIRS", () => {
    const result = checkSupportingDirs(
      { data: {}, content: "" },
      { existingDirs: ["node_modules", "dist"] }
    );
    expect(result.passes).toEqual([]);
  });
});

describe("checkDynamicInjection", () => {
  test("returns empty passes when no injection or substitution", () => {
    const result = checkDynamicInjection({ data: {}, content: "plain text" }, { existingDirs: [] });
    expect(result.passes).toEqual([]);
  });

  test("detects inline injection", () => {
    const result = checkDynamicInjection(
      { data: {}, content: "State: !`git status`" },
      { existingDirs: [] }
    );
    expect(result.passes).toContain("uses dynamic context injection (!`...` or ```! blocks)");
  });

  test("detects argument substitutions", () => {
    const result = checkDynamicInjection(
      { data: {}, content: "Use $ARGUMENTS here." },
      { existingDirs: [] }
    );
    expect(result.passes).toContain("uses argument / session substitutions ($ARGUMENTS, $0, ${CLAUDE_*})");
  });

  test("detects both injection and substitution independently", () => {
    const result = checkDynamicInjection(
      { data: {}, content: "!`git status` and $ARGUMENTS" },
      { existingDirs: [] }
    );
    expect(result.passes?.length).toBe(2);
  });
});
