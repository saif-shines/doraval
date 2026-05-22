import { describe, expect, test } from "bun:test";
import { parseFrontmatter } from "./frontmatter.js";

describe("parseFrontmatter", () => {
  test("returns empty data when no frontmatter block", () => {
    const raw = "# Hello\n\nBody text.";
    expect(parseFrontmatter(raw)).toEqual({
      data: {},
      content: raw,
    });
  });

  test("parses valid YAML frontmatter and body", () => {
    const raw = `---
name: my-skill
description: Use when testing.
---

# Title

Body content.`;

    const result = parseFrontmatter(raw);
    expect(result.data.name).toBe("my-skill");
    expect(result.data.description).toBe("Use when testing.");
    expect(result.content).toBe("\n# Title\n\nBody content.");
  });

  test("handles CRLF line endings", () => {
    const raw =
      "---\r\nname: crlf-skill\r\ndescription: Windows line endings.\r\n---\r\n\r\nBody.\r\n";
    const result = parseFrontmatter(raw);
    expect(result.data.name).toBe("crlf-skill");
    expect(result.content).toBe("\r\nBody.\r\n");
  });

  test("returns empty body when frontmatter is followed by nothing", () => {
    const raw = "---\nname: empty-body\n---\n";
    const result = parseFrontmatter(raw);
    expect(result.data.name).toBe("empty-body");
    expect(result.content).toBe("");
  });

  test("throws on invalid YAML", () => {
    const raw = "---\nname: [unclosed\n---\nBody";
    expect(() => parseFrontmatter(raw)).toThrow();
  });
});
