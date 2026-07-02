import { describe, expect, test } from "bun:test";
import { resolve } from "path";
import {
  validateAgentSkill,
  checkName, checkDescription, checkCompatibility, checkMetadata,
  checkUnknownFields, checkBody, checkLevel1Metadata, checkLevel2Budget, checkLevel3References,
  estimateTokens,
} from "./agentskills-validate.js";

const skillDir = resolve(import.meta.dir, "../../test/fixtures/skills/agentskills-good");
const ctx = { skillDir, existingDirs: [] as string[] };

describe("checkName", () => {
  test("errors when name is missing", () => {
    const result = checkName({ data: {}, content: "" }, ctx);
    expect(result.errors?.[0]?.text).toContain('Missing required "name"');
  });

  test("errors on invalid characters", () => {
    const result = checkName({ data: { name: "Bad_Name" }, content: "" }, ctx);
    expect(result.errors?.some((e) => e.text.includes("Invalid name format"))).toBe(true);
  });

  test("errors when name is too long", () => {
    const longName = "a".repeat(65);
    const result = checkName({ data: { name: longName } , content: "" }, { skillDir: resolve(skillDir, "../", longName), existingDirs: [] });
    expect(result.errors?.some((e) => e.text.includes("Name length out of range"))).toBe(true);
  });

  test("errors when name does not match parent directory", () => {
    const result = checkName({ data: { name: "not-the-dir-name" }, content: "" }, ctx);
    expect(result.errors?.some((e) => e.text.includes("does not match parent directory"))).toBe(true);
  });

  test("passes when name matches parent directory and is valid", () => {
    const result = checkName({ data: { name: "agentskills-good" }, content: "" }, ctx);
    expect(result.errors).toBeUndefined();
    expect(result.passes?.[0]?.text).toContain("matches directory");
  });
});

describe("checkDescription", () => {
  test("errors when description is missing", () => {
    const result = checkDescription({ data: {}, content: "" }, ctx);
    expect(result.errors?.[0]?.text).toContain('Missing required "description"');
  });

  test("errors when description is empty string", () => {
    const result = checkDescription({ data: { description: "   " }, content: "" }, ctx);
    expect(result.errors?.[0]?.text).toContain('Missing required "description"');
  });

  test("errors when description exceeds 1024 chars", () => {
    const result = checkDescription({ data: { description: "x".repeat(1025) }, content: "" }, ctx);
    expect(result.errors?.[0]?.text).toContain("Description length out of range");
  });

  test("passes for a valid description", () => {
    const result = checkDescription({ data: { description: "Use when testing." }, content: "" }, ctx);
    expect(result.passes?.[0]?.text).toContain("description field present");
  });
});

describe("checkCompatibility", () => {
  test("no-op when absent", () => {
    expect(checkCompatibility({ data: {}, content: "" }, ctx)).toEqual({});
  });

  test("warns when too long", () => {
    const result = checkCompatibility({ data: { compatibility: "x".repeat(501) }, content: "" }, ctx);
    expect(result.warnings?.[0]?.text).toContain("compatibility length out of range");
  });

  test("passes when within limit", () => {
    const result = checkCompatibility({ data: { compatibility: "Requires git" }, content: "" }, ctx);
    expect(result.passes?.[0]?.text).toContain("within length limit");
  });
});

describe("checkMetadata", () => {
  test("no-op when absent", () => {
    expect(checkMetadata({ data: {}, content: "" }, ctx)).toEqual({});
  });

  test("warns when not an object", () => {
    const result = checkMetadata({ data: { metadata: "nope" }, content: "" }, ctx);
    expect(result.warnings?.[0]?.text).toContain("map of string keys");
  });

  test("warns when values are not strings", () => {
    const result = checkMetadata({ data: { metadata: { version: 1 } }, content: "" }, ctx);
    expect(result.warnings?.[0]?.text).toContain("non-string keys");
  });

  test("passes for a valid string map", () => {
    const result = checkMetadata({ data: { metadata: { author: "me", version: "1.0" } }, content: "" }, ctx);
    expect(result.passes?.[0]?.text).toContain("valid string map");
  });
});

describe("checkUnknownFields", () => {
  test("flags Claude-specific fields as unknown under the open spec", () => {
    const result = checkUnknownFields({ data: { name: "x", when_to_use: "y", model: "z" }, content: "" }, ctx);
    expect(result.warnings?.length).toBe(2);
  });

  test("no warnings for spec-recognized fields", () => {
    const result = checkUnknownFields(
      { data: { name: "x", description: "d", license: "MIT", compatibility: "c", metadata: {}, "allowed-tools": "Read" }, content: "" },
      ctx
    );
    expect(result.warnings).toEqual([]);
  });
});

describe("checkBody", () => {
  test("errors when empty", () => {
    expect(checkBody({ data: {}, content: "   " }, ctx).errors?.[0]?.text).toContain("empty");
  });

  test("passes when non-empty", () => {
    expect(checkBody({ data: {}, content: "# Steps" }, ctx).passes?.[0]?.text).toContain("non-empty");
  });
});

describe("checkLevel1Metadata / estimateTokens", () => {
  test("estimateTokens is roughly chars/4", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("")).toBe(0);
  });

  test("reports a token estimate", () => {
    const result = checkLevel1Metadata({ data: { name: "x", description: "short" }, content: "" }, ctx);
    expect(result.passes?.[0]?.text).toContain("Level 1 (metadata)");
  });
});

describe("checkLevel2Budget", () => {
  test("passes within budget", () => {
    const result = checkLevel2Budget({ data: {}, content: "short body\n" }, ctx);
    expect(result.passes?.[0]?.text).toContain("within budget");
  });

  test("warns when line count exceeds budget", () => {
    const content = Array.from({ length: 501 }, (_, i) => `line ${i}`).join("\n");
    const result = checkLevel2Budget({ data: {}, content }, ctx);
    expect(result.warnings?.some((w) => w.text.includes("lines"))).toBe(true);
  });

  test("warns when token count exceeds budget", () => {
    const content = "x".repeat(5001 * 4);
    const result = checkLevel2Budget({ data: {}, content }, ctx);
    expect(result.warnings?.some((w) => w.text.includes("tokens"))).toBe(true);
  });
});

describe("checkLevel3References", () => {
  test("passes when there are no references", () => {
    const result = checkLevel3References({ data: {}, content: "plain body" }, ctx);
    expect(result.passes?.[0]?.text).toContain("no file references");
  });

  test("passes for a resolvable one-level-deep reference", () => {
    const result = checkLevel3References(
      { data: {}, content: "See [ref](references/REFERENCE.md)." },
      ctx // agentskills-good fixture has references/REFERENCE.md
    );
    expect(result.passes?.[0]?.text).toContain("resolvable");
  });

  test("warns when a reference is nested more than one level deep", () => {
    const result = checkLevel3References(
      { data: {}, content: "See [ref](references/sub/DEEP.md)." },
      ctx
    );
    expect(result.warnings?.some((w) => w.text.includes("nested more than one level"))).toBe(true);
  });

  test("warns when a referenced file is missing", () => {
    const result = checkLevel3References(
      { data: {}, content: "See [ref](references/MISSING.md)." },
      ctx
    );
    expect(result.warnings?.some((w) => w.text.includes("does not exist"))).toBe(true);
  });

  test("detects bare (non-link) references into supporting dirs", () => {
    const result = checkLevel3References(
      { data: {}, content: "Run the helper: scripts/extract.py" },
      ctx
    );
    expect(result.warnings?.some((w) => w.text.includes("scripts/extract.py") && w.text.includes("does not exist"))).toBe(true);
  });
});

describe("validateAgentSkill", () => {
  test("a fully valid skill has no errors or warnings", () => {
    const result = validateAgentSkill(
      {
        data: { name: "agentskills-good", description: "Use when testing." },
        content: "# Steps\n\n1. Run tests\n\nSee [ref](references/REFERENCE.md).",
      },
      ctx
    );
    expect(result.errors).toEqual([]);
  });

  test("missing name and description both produce errors", () => {
    const result = validateAgentSkill({ data: {}, content: "body" }, ctx);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
