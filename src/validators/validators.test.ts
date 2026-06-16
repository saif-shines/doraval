import { describe, expect, test } from "bun:test";
import { resolve } from "path";
import { validators, resolveFor } from "./index.js";
import { claudeSkillValidator } from "./claude/skill.js";
import { claudePluginValidator } from "./claude/plugin.js";
import { claudeMarketplaceValidator } from "./claude/marketplace.js";
import { claudeHooksValidator } from "./claude/hooks.js";
import { claudeMcpValidator } from "./claude/mcp.js";
import { claudeSubagentValidator } from "./claude/subagent.js";
import { claudeCommandValidator } from "./claude/command.js";
import { claudeMemoryValidator } from "./claude/memory.js";

const fixtures = resolve(import.meta.dir, "../../test/fixtures");

// ── Registry ─────────────────────────────────────────────────────

describe("registry", () => {
  test("has all claude validators registered", () => {
    const claudeIds = validators.filter((v) => v.provider === "claude").map((v) => v.id);
    expect(claudeIds).toContain("claude:skill");
    expect(claudeIds).toContain("claude:plugin");
    expect(claudeIds).toContain("claude:marketplace");
    expect(claudeIds).toContain("claude:hooks");
    expect(claudeIds).toContain("claude:mcp");
    expect(claudeIds).toContain("claude:subagent");
    expect(claudeIds).toContain("claude:command");
    expect(claudeIds).toContain("claude:memory");
  });

  test("all validators have unique ids", () => {
    const ids = validators.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── resolveFor ───────────────────────────────────────────────────

describe("resolveFor", () => {
  test("returns all validators when no flag", () => {
    const { matched } = resolveFor(undefined);
    expect(matched.length).toBe(validators.length);
  });

  test("filters by provider", () => {
    const { matched } = resolveFor("claude");
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every((v) => v.provider === "claude")).toBe(true);
  });

  test("exact match by id", () => {
    const { matched } = resolveFor("claude:plugin");
    expect(matched.length).toBe(1);
    expect(matched[0]!.id).toBe("claude:plugin");
  });

  test("errors on unknown provider", () => {
    const { matched, error } = resolveFor("nonexistent");
    expect(matched.length).toBe(0);
    expect(error).toContain("Unknown provider");
  });

  test("errors on unknown id", () => {
    const { matched, error } = resolveFor("claude:nonexistent");
    expect(matched.length).toBe(0);
    expect(error).toContain("Unknown validator");
  });
});

// ── Skill validator ──────────────────────────────────────────────

describe("claude:skill", () => {
  test("detects SKILL.md", () => {
    expect(claudeSkillValidator.detect(resolve(fixtures, "skills/minimal-good"))).toBe(true);
    expect(claudeSkillValidator.detect(resolve(fixtures, "claude-md"))).toBe(false);
  });

  test("validates a good skill", async () => {
    const result = await claudeSkillValidator.validate(
      resolve(fixtures, "skills/minimal-good"),
      { format: "table", verbose: false, ci: false }
    );
    expect(result.errors).toEqual([]);
  });
});

// ── Plugin validator ─────────────────────────────────────────────

describe("claude:plugin", () => {
  test("detects .claude-plugin/plugin.json", () => {
    expect(claudePluginValidator.detect(resolve(fixtures, "claude-plugin/good"))).toBe(true);
    expect(claudePluginValidator.detect(resolve(fixtures, "skills/minimal-good"))).toBe(false);
  });

  test("validates a good plugin", async () => {
    const result = await claudePluginValidator.validate(
      resolve(fixtures, "claude-plugin/good"),
      { format: "table", verbose: false, ci: false }
    );
    expect(result.errors).toEqual([]);
    expect(result.passes).toContain('name: "test-plugin"');
  });
});

// ── Marketplace validator ────────────────────────────────────────

describe("claude:marketplace", () => {
  test("detects plugins/ with skill subdirectories", () => {
    expect(claudeMarketplaceValidator.detect(resolve(fixtures, "marketplace/good"))).toBe(true);
    expect(claudeMarketplaceValidator.detect(resolve(fixtures, "skills/minimal-good"))).toBe(false);
  });

  test("validates a good marketplace", async () => {
    const result = await claudeMarketplaceValidator.validate(
      resolve(fixtures, "marketplace/good"),
      { format: "table", verbose: false, ci: false }
    );
    expect(result.errors).toEqual([]);
    expect(result.passes).toContain("README.md exists at marketplace root");
  });
});

// ── Hooks validator ──────────────────────────────────────────────

describe("claude:hooks", () => {
  test("detects hooks.json", () => {
    expect(claudeHooksValidator.detect(resolve(fixtures, "hooks"))).toBe(true);
    expect(claudeHooksValidator.detect(resolve(fixtures, "claude-md"))).toBe(false);
  });

  test("validates valid hooks", async () => {
    const result = await claudeHooksValidator.validate(
      resolve(fixtures, "hooks"),
      { format: "table", verbose: false, ci: false }
    );
    expect(result.errors).toEqual([]);
    expect(result.passes).toContain('Event "PreToolUse" is a known lifecycle event');
  });
});

// ── MCP validator ────────────────────────────────────────────────

describe("claude:mcp", () => {
  test("detects .mcp.json", () => {
    expect(claudeMcpValidator.detect(resolve(fixtures, "mcp"))).toBe(true);
    expect(claudeMcpValidator.detect(resolve(fixtures, "claude-md"))).toBe(false);
  });

  test("validates valid mcp config", async () => {
    const result = await claudeMcpValidator.validate(
      resolve(fixtures, "mcp"),
      { format: "table", verbose: false, ci: false }
    );
    expect(result.errors).toEqual([]);
    expect(result.passes).toContain("1 server(s) defined");
  });
});

// ── Subagent validator ───────────────────────────────────────────

describe("claude:subagent", () => {
  test("detects agents/ with .md files", () => {
    expect(claudeSubagentValidator.detect(resolve(fixtures, "agents-dir"))).toBe(true);
    expect(claudeSubagentValidator.detect(resolve(fixtures, "claude-md"))).toBe(false);
  });

  test("validates valid agent definitions", async () => {
    const result = await claudeSubagentValidator.validate(
      resolve(fixtures, "agents-dir"),
      { format: "table", verbose: false, ci: false }
    );
    expect(result.errors).toEqual([]);
    expect(result.passes).toContain("reviewer.md: has frontmatter with description");
  });
});

// ── Command validator ────────────────────────────────────────────

describe("claude:command", () => {
  test("detects commands/ with .md files", () => {
    expect(claudeCommandValidator.detect(resolve(fixtures, "commands-dir"))).toBe(true);
    expect(claudeCommandValidator.detect(resolve(fixtures, "claude-md"))).toBe(false);
  });

  test("validates valid command definitions", async () => {
    const result = await claudeCommandValidator.validate(
      resolve(fixtures, "commands-dir"),
      { format: "table", verbose: false, ci: false }
    );
    expect(result.errors).toEqual([]);
    expect(result.passes).toContain("deploy.md: has frontmatter with description");
  });
});

// ── Memory validator ─────────────────────────────────────────────

describe("claude:memory", () => {
  test("detects CLAUDE.md", () => {
    expect(claudeMemoryValidator.detect(resolve(fixtures, "claude-md"))).toBe(true);
    expect(claudeMemoryValidator.detect(resolve(fixtures, "mcp"))).toBe(false);
  });

  test("validates valid CLAUDE.md", async () => {
    const result = await claudeMemoryValidator.validate(
      resolve(fixtures, "claude-md"),
      { format: "table", verbose: false, ci: false }
    );
    expect(result.errors).toEqual([]);
    expect(result.passes).toContain("CLAUDE.md is non-empty");
  });
});