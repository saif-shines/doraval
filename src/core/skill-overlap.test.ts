import { describe, expect, test } from "bun:test";
import {
  detectSkillOverlaps,
  detectMcpNameCollisions,
  mcpNameStem,
  significantTokens,
  DESC_JACCARD_WARN,
} from "./skill-overlap.js";

describe("significantTokens", () => {
  test("drops stop words and short tokens", () => {
    const t = significantTokens('Use when reviewing pull requests with TypeScript tests');
    expect(t).toContain("reviewing");
    expect(t).toContain("typescript");
    expect(t).not.toContain("when");
    expect(t).not.toContain("use");
  });
});

describe("detectSkillOverlaps", () => {
  test("flags competing descriptions", () => {
    const overlaps = detectSkillOverlaps([
      {
        path: ".claude/skills/review-pr",
        name: "review-pr",
        description: "Use when reviewing pull requests for TypeScript and testing quality",
      },
      {
        path: ".claude/skills/pr-review",
        name: "pr-review",
        description: "Use when reviewing pull requests for TypeScript testing and quality checks",
      },
      {
        path: ".claude/skills/deploy",
        name: "deploy",
        description: "Use when shipping production releases with bun and netlify",
      },
    ]);
    expect(overlaps.length).toBeGreaterThanOrEqual(1);
    const hit = overlaps.find(
      (o) =>
        (o.a.includes("review-pr") && o.b.includes("pr-review")) ||
        (o.a.includes("pr-review") && o.b.includes("review-pr")),
    );
    expect(hit).toBeDefined();
    expect(hit!.score).toBeGreaterThanOrEqual(DESC_JACCARD_WARN);
    // deploy should not pair with review skills
    expect(overlaps.every((o) => !o.a.includes("deploy") && !o.b.includes("deploy"))).toBe(true);
  });

  test("skips same leaf name (shadow territory)", () => {
    const overlaps = detectSkillOverlaps([
      {
        path: ".claude/skills/review",
        name: "review",
        description: "Use when reviewing pull requests for TypeScript quality",
      },
      {
        path: ".grok/skills/review",
        name: "review",
        description: "Use when reviewing pull requests for TypeScript quality",
      },
    ]);
    expect(overlaps).toEqual([]);
  });

  test("ignores thin descriptions", () => {
    const overlaps = detectSkillOverlaps([
      { path: "a", name: "a", description: "help" },
      { path: "b", name: "b", description: "help code" },
    ]);
    expect(overlaps).toEqual([]);
  });
});

describe("detectMcpNameCollisions", () => {
  test("stem strips -mcp / -api suffixes", () => {
    expect(mcpNameStem("github-mcp")).toBe("github");
    expect(mcpNameStem("linear_api")).toBe("linear");
  });

  test("flags github vs github-api", () => {
    const c = detectMcpNameCollisions(["github", "github-api", "slack"]);
    expect(c.length).toBe(1);
    expect(c[0]!.a).toBe("github");
    expect(c[0]!.b).toBe("github-api");
  });

  test("no collision for distinct products", () => {
    expect(detectMcpNameCollisions(["github", "slack", "linear"])).toEqual([]);
  });
});
