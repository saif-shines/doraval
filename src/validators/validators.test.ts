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
import { claudeLspValidator } from "./claude/lsp.js";
import { claudeMonitorsValidator } from "./claude/monitors.js";

import { codexPluginValidator } from "./codex/plugin.js";
import { codexMarketplaceValidator } from "./codex/marketplace.js";
import { codexMcpValidator } from "./codex/mcp.js";
import { codexSkillValidator } from "./codex/skill.js";

import { cursorPluginValidator } from "./cursor/plugin.js";
import { cursorMarketplaceValidator } from "./cursor/marketplace.js";
import { cursorMcpValidator } from "./cursor/mcp.js";
import { cursorSkillValidator } from "./cursor/skill.js";

import { copilotPluginValidator } from "./copilot/plugin.js";
import { copilotMarketplaceValidator } from "./copilot/marketplace.js";
import { copilotMcpValidator } from "./copilot/mcp.js";
import { copilotSkillValidator } from "./copilot/skill.js";

import { agentskillsSkillValidator } from "./agentskills/skill.js";

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
    expect(claudeIds).toContain("claude:lsp");
    expect(claudeIds).toContain("claude:monitors");
  });

  test("has codex validators registered", () => {
    const codexIds = validators.filter((v) => v.provider === "codex").map((v) => v.id);
    expect(codexIds).toContain("codex:plugin");
    expect(codexIds).toContain("codex:marketplace");
    expect(codexIds).toContain("codex:mcp");
    expect(codexIds).toContain("codex:skill");
  });

  test("has cursor validators registered", () => {
    const cursorIds = validators.filter((v) => v.provider === "cursor").map((v) => v.id);
    expect(cursorIds).toContain("cursor:plugin");
    expect(cursorIds).toContain("cursor:marketplace");
    expect(cursorIds).toContain("cursor:mcp");
    expect(cursorIds).toContain("cursor:skill");
  });

  test("has copilot validators registered", () => {
    const copilotIds = validators.filter((v) => v.provider === "copilot").map((v) => v.id);
    expect(copilotIds).toContain("copilot:plugin");
    expect(copilotIds).toContain("copilot:marketplace");
    expect(copilotIds).toContain("copilot:mcp");
    expect(copilotIds).toContain("copilot:skill");
  });

  test("has grok skill + plugin validators registered", () => {
    const grokIds = validators.filter((v) => v.provider === "grok").map((v) => v.id);
    expect(grokIds).toContain("grok:skill");
    expect(grokIds).toContain("grok:plugin");
  });

  test("has the standalone agentskills validator registered", () => {
    const ids = validators.filter((v) => v.provider === "agentskills").map((v) => v.id);
    expect(ids).toContain("agentskills:skill");
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

  test("filters by codex provider", () => {
    const { matched } = resolveFor("codex");
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every((v) => v.provider === "codex")).toBe(true);
  });

  test("exact match by codex id", () => {
    const { matched } = resolveFor("codex:plugin");
    expect(matched.length).toBe(1);
    expect(matched[0]!.id).toBe("codex:plugin");
  });

  test("filters by agentskills provider (standalone, not from an adapter)", () => {
    const { matched } = resolveFor("agentskills");
    expect(matched.length).toBe(1);
    expect(matched[0]!.id).toBe("agentskills:skill");
  });

  test("exact match by agentskills id", () => {
    const { matched } = resolveFor("agentskills:skill");
    expect(matched.length).toBe(1);
    expect(matched[0]!.id).toBe("agentskills:skill");
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

  test("reports static check failures for a drifted skill", async () => {
    const result = await claudeSkillValidator.validate(
      resolve(fixtures, "skills/drifted"),
      { format: "table", verbose: false, ci: false }
    );
    // drifted fixture has no steps, no code examples, no guardrails
    expect(result.errors.some(e => e.text.includes("[static] Structure"))).toBe(true);
    expect(result.errors.some(e => e.text.includes("[static] Example"))).toBe(true);
    expect(result.errors.some(e => e.text.includes("[static] Guardrail"))).toBe(true);
    // all static errors are prefixed with "[static]"
    expect(result.errors.every(e => e.text.startsWith("[static]"))).toBe(true);
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
    expect(result.passes.some(p => p.text.includes('name: "test-plugin"'))).toBe(true);
  });

  test("warns on unrecognized fields (with suggestion) and version semantics", async () => {
    // Use a temp dir to test new rules without polluting fixtures
    const tmp = resolve(import.meta.dir, "../../test/tmp-plugin-validate-test");
    try {
      await Bun.write(resolve(tmp, ".claude-plugin/plugin.json"), JSON.stringify({
        name: "demo",
        version: "1.2.3",
        foobar: "x",           // unknown
        licence: "MIT",        // common typo -> suggestion
      }, null, 2));
      const result = await claudePluginValidator.validate(tmp, { format: "table", verbose: false, ci: false });
      expect(result.errors).toEqual([]);
      expect(result.warnings.some(w => w.text.includes("Unrecognized") && w.text.includes("foobar"))).toBe(true);
      expect(result.warnings.some(w => w.text.includes("licence") && w.text.includes("license"))).toBe(true);
      expect(result.passes.some(p => p.text.includes("explicit") && p.text.includes("1.2.3"))).toBe(true);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });

  test("warns on .claude-plugin/ purity violation", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-plugin-purity-test");
    try {
      await Bun.write(resolve(tmp, ".claude-plugin/plugin.json"), JSON.stringify({ name: "purity-test" }));
      await Bun.write(resolve(tmp, ".claude-plugin/evil.txt"), "oops");
      const result = await claudePluginValidator.validate(tmp, { format: "table", verbose: false, ci: false });
      expect(result.warnings.some(w => w.text.includes("Unexpected") && w.text.includes("evil.txt"))).toBe(true);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
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

  test("detects and validates .claude-plugin/marketplace.json layout (string sources)", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-claude-mkt-detect");
    try {
      const mkt = {
        $schema: "https://anthropic.com/claude-code/marketplace.schema.json",
        name: "test-mkt",
        description: "Test",
        owner: { name: "Test" },
        plugins: [
          { name: "p1", source: "./plugins/p1", category: "Test" }
        ]
      };
      await Bun.write(resolve(tmp, ".claude-plugin/marketplace.json"), JSON.stringify(mkt, null, 2));
      // create source dir with skills/ to satisfy source existence check
      await Bun.write(resolve(tmp, "plugins/p1/skills/demo/SKILL.md"), "# test\n");
      expect(claudeMarketplaceValidator.detect(tmp)).toBe(true);
      const result = await claudeMarketplaceValidator.validate(tmp, { format: "table", verbose: false, ci: false });
      expect(result.errors).toEqual([]);
      expect(result.passes).toContain('name: "test-mkt"');
      expect(result.passes.some(p => p.includes("plugins[0].source"))).toBe(true);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
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

  test("validates nested plugin hooks layout", async () => {
    const result = await claudeHooksValidator.validate(
      resolve(fixtures, "hooks-plugin"),
      { format: "table", verbose: false, ci: false }
    );
    expect(result.errors).toEqual([]);
    expect(result.passes).toContain('Uses nested "hooks" object (plugin/settings layout)');
    expect(result.passes).toContain('Event "SessionStart" is a known lifecycle event');
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

  test("validates .mcp.json wrapped in mcpServers", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-claude-mcp-wrapped");
    try {
      await Bun.write(resolve(tmp, ".mcp.json"), JSON.stringify({
        mcpServers: {
          scalekit: { type: "http", url: "https://mcp.scalekit.com" }
        }
      }, null, 2));
      const result = await claudeMcpValidator.validate(tmp, { format: "table", verbose: false, ci: false });
      expect(result.errors).toEqual([]);
      expect(result.passes).toContain("1 server(s) defined");
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
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
    expect(result.passes.some((p) => p.text === "CLAUDE.md is non-empty")).toBe(true);
  });

  test("warns on dead relative markdown links", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-claude-memory-dead-link");
    try {
      await Bun.write(
        resolve(tmp, "CLAUDE.md"),
        "# Rules\n\nSee the [guide](missing-style.md) for details.\n",
      );
      const result = await claudeMemoryValidator.validate(tmp, {
        format: "table",
        verbose: false,
        ci: false,
      });
      expect(
        result.warnings.some((w) => w.text.includes("Dead link reference: missing-style.md")),
      ).toBe(true);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });

  test("warns on duplicate instruction lines", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-claude-memory-dup");
    try {
      await Bun.write(
        resolve(tmp, "CLAUDE.md"),
        "# Rules\n\nRun tests before committing.\nRun tests before committing.\n",
      );
      const result = await claudeMemoryValidator.validate(tmp, {
        format: "table",
        verbose: false,
        ci: false,
      });
      expect(
        result.warnings.some(
          (w) => w.text.includes("Duplicate instruction") && w.text.includes("run tests"),
        ),
      ).toBe(true);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });

  test("skips http and hash links for dead-link checks", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-claude-memory-http");
    try {
      await Bun.write(
        resolve(tmp, "CLAUDE.md"),
        "# Rules\n\nSee [docs](https://example.com) and [local](#heading).\n",
      );
      const result = await claudeMemoryValidator.validate(tmp, {
        format: "table",
        verbose: false,
        ci: false,
      });
      expect(result.warnings.some((w) => w.text.includes("Dead link"))).toBe(false);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });
});

// ── Codex validators (new) ───────────────────────────────────────

describe("codex:plugin", () => {
  test("detects .codex-plugin/plugin.json", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-codex-plugin-detect");
    try {
      await Bun.write(resolve(tmp, ".codex-plugin/plugin.json"), JSON.stringify({ name: "test" }));
      expect(codexPluginValidator.detect(tmp)).toBe(true);
      expect(codexPluginValidator.detect(resolve(fixtures, "skills/minimal-good"))).toBe(false);
    } finally {
      Bun.$`rm -rf ${tmp}`.quiet();
    }
  });

  test("validates a good codex plugin", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-codex-plugin-good");
    try {
      await Bun.write(resolve(tmp, ".codex-plugin/plugin.json"), JSON.stringify({
        name: "test-codex",
        version: "1.0.0",
        description: "A test",
        skills: "./skills/",
        interface: { displayName: "Test", category: "Productivity" }
      }, null, 2));
      await Bun.write(resolve(tmp, "skills/hello/SKILL.md"), `---
name: hello
description: hi
---
body`);
      const result = await codexPluginValidator.validate(tmp, { format: "table", verbose: false, ci: false });
      expect(result.errors).toEqual([]);
      expect(result.passes).toContain('name: "test-codex"');
      expect(result.passes.some(p => p.includes("interface block present"))).toBe(true);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });
});

describe("codex:marketplace", () => {
  test("detects .agents/plugins/marketplace.json", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-codex-mkt-detect");
    try {
      await Bun.write(resolve(tmp, ".agents/plugins/marketplace.json"), JSON.stringify({ name: "m", plugins: [] }));
      expect(codexMarketplaceValidator.detect(tmp)).toBe(true);
      expect(codexMarketplaceValidator.detect(resolve(fixtures, "skills/minimal-good"))).toBe(false);
    } finally {
      Bun.$`rm -rf ${tmp}`.quiet();
    }
  });

  test("validates a good codex marketplace", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-codex-mkt-good");
    try {
      await Bun.write(resolve(tmp, ".agents/plugins/marketplace.json"), JSON.stringify({
        name: "test-mkt",
        interface: { displayName: "Test" },
        plugins: [{
          name: "p1",
          source: { source: "local", path: "./plugins/p1" },
          policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
          category: "Test"
        }]
      }, null, 2));
      const result = await codexMarketplaceValidator.validate(tmp, { format: "table", verbose: false, ci: false });
      expect(result.errors).toEqual([]);
      expect(result.passes).toContain('name: "test-mkt"');
      expect(result.passes.some(p => p.includes("plugins[0].source.source"))).toBe(true);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });
});

describe("codex:mcp", () => {
  test("detects .mcp.json", () => {
    expect(codexMcpValidator.detect(resolve(fixtures, "mcp"))).toBe(true);
    expect(codexMcpValidator.detect(resolve(fixtures, "claude-md"))).toBe(false);
  });

  test("validates valid mcp config", async () => {
    const result = await codexMcpValidator.validate(
      resolve(fixtures, "mcp"),
      { format: "table", verbose: false, ci: false }
    );
    expect(result.errors).toEqual([]);
    expect(result.passes).toContain("1 server(s) defined");
  });

  test("validates .mcp.json wrapped in mcpServers", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-codex-mcp-wrapped");
    try {
      await Bun.write(resolve(tmp, ".mcp.json"), JSON.stringify({
        mcpServers: {
          scalekit: { type: "http", url: "https://mcp.scalekit.com" }
        }
      }, null, 2));
      const result = await codexMcpValidator.validate(tmp, { format: "table", verbose: false, ci: false });
      expect(result.errors).toEqual([]);
      expect(result.passes).toContain("1 server(s) defined");
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });
});

describe("codex:skill", () => {
  test("detects SKILL.md", () => {
    expect(codexSkillValidator.detect(resolve(fixtures, "skills/minimal-good"))).toBe(true);
    expect(codexSkillValidator.detect(resolve(fixtures, "claude-md"))).toBe(false);
  });

  test("validates a good skill (reuses core)", async () => {
    const result = await codexSkillValidator.validate(
      resolve(fixtures, "skills/minimal-good"),
      { format: "table", verbose: false, ci: false }
    );
    expect(result.errors).toEqual([]);
  });
});

// ── Cursor validators ────────────────────────────────────────────

describe("cursor:plugin", () => {
  test("detects .cursor-plugin/plugin.json", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-cursor-plugin-detect");
    try {
      await Bun.write(resolve(tmp, ".cursor-plugin/plugin.json"), JSON.stringify({ name: "test", skills: "./skills" }));
      expect(cursorPluginValidator.detect(tmp)).toBe(true);
      expect(cursorPluginValidator.detect(resolve(fixtures, "skills/minimal-good"))).toBe(false);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });

  test("validates a good cursor plugin (no interface required)", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-cursor-plugin-good");
    try {
      await Bun.write(resolve(tmp, ".cursor-plugin/plugin.json"), JSON.stringify({
        name: "agentkit",
        displayName: "AgentKit",
        description: "A solid description here",
        skills: "./skills",
        mcpServers: "./mcp.json"
      }, null, 2));
      await Bun.write(resolve(tmp, "skills/demo/SKILL.md"), "# demo\n");
      const result = await cursorPluginValidator.validate(tmp, { format: "table", verbose: false, ci: false });
      expect(result.errors).toEqual([]);
      expect(result.passes).toContain('name: "agentkit"');
      expect(result.passes.some(p => p.includes("skills:"))).toBe(true);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });
});

describe("cursor:marketplace", () => {
  test("detects .cursor-plugin/marketplace.json", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-cursor-mkt-detect");
    try {
      const mkt = { name: "m", metadata: { pluginRoot: "kits" }, plugins: [{ name: "p1", source: "p1" }] };
      await Bun.write(resolve(tmp, ".cursor-plugin/marketplace.json"), JSON.stringify(mkt));
      expect(cursorMarketplaceValidator.detect(tmp)).toBe(true);
      expect(cursorMarketplaceValidator.detect(resolve(fixtures, "skills/minimal-good"))).toBe(false);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });

  test("validates a good cursor marketplace with metadata.pluginRoot + string sources", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-cursor-mkt-good");
    try {
      const mkt = {
        name: "scalekit-authstack",
        metadata: { pluginRoot: "kits", description: "..." },
        plugins: [
          { name: "agentkit", source: "agentkit", description: "...", category: "AI Agent Auth" }
        ]
      };
      await Bun.write(resolve(tmp, ".cursor-plugin/marketplace.json"), JSON.stringify(mkt, null, 2));
      // create the source dir + manifest so checks pass
      await Bun.write(resolve(tmp, "kits/agentkit/.cursor-plugin/plugin.json"), JSON.stringify({ name: "agentkit", skills: "./skills" }));
      const result = await cursorMarketplaceValidator.validate(tmp, { format: "table", verbose: false, ci: false });
      expect(result.errors).toEqual([]);
      expect(result.passes).toContain('name: "scalekit-authstack"');
      expect(result.passes.some(p => p.includes("metadata.pluginRoot"))).toBe(true);
      expect(result.passes.some(p => p.includes("source exists"))).toBe(true);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });
});

describe("cursor:mcp", () => {
  test("detects mcp.json (no dot)", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-cursor-mcp-detect");
    try {
      await Bun.write(resolve(tmp, "mcp.json"), JSON.stringify({ scalekit: { type: "http", url: "https://x" } }));
      expect(cursorMcpValidator.detect(tmp)).toBe(true);
      expect(cursorMcpValidator.detect(resolve(fixtures, "skills/minimal-good"))).toBe(false);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });

  test("validates cursor mcp.json (including mcpServers wrapper)", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-cursor-mcp-good");
    try {
      await Bun.write(resolve(tmp, "mcp.json"), JSON.stringify({
        mcpServers: {
          scalekit: { type: "http", url: "https://mcp.scalekit.com" }
        }
      }, null, 2));
      const result = await cursorMcpValidator.validate(tmp, { format: "table", verbose: false, ci: false });
      expect(result.errors).toEqual([]);
      expect(result.passes).toContain("1 server(s) defined");
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });
});

describe("cursor:skill", () => {
  test("detects SKILL.md", () => {
    expect(cursorSkillValidator.detect(resolve(fixtures, "skills/minimal-good"))).toBe(true);
    expect(cursorSkillValidator.detect(resolve(fixtures, "claude-md"))).toBe(false);
  });

  test("validates a good skill (reuses core)", async () => {
    const result = await cursorSkillValidator.validate(
      resolve(fixtures, "skills/minimal-good"),
      { format: "table", verbose: false, ci: false }
    );
    expect(result.errors).toEqual([]);
  });
});

// ── Copilot validators ───────────────────────────────────────────

describe("copilot:plugin", () => {
  test("detects .github/plugin/plugin.json", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-copilot-plugin-detect");
    try {
      const manifest = {
        name: "agentkit",
        skills: ["./skills/setup"],
        mcpServers: ".mcp.json"
      };
      await Bun.write(resolve(tmp, ".github/plugin/plugin.json"), JSON.stringify(manifest));
      expect(copilotPluginValidator.detect(tmp)).toBe(true);
      expect(copilotPluginValidator.detect(resolve(fixtures, "skills/minimal-good"))).toBe(false);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });

  test("validates a good copilot plugin (skills as array)", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-copilot-plugin-good");
    try {
      const manifest = {
        name: "agentkit",
        description: "A solid description",
        skills: ["./skills/setup"],
        mcpServers: ".mcp.json"
      };
      await Bun.write(resolve(tmp, ".github/plugin/plugin.json"), JSON.stringify(manifest, null, 2));
      await Bun.write(resolve(tmp, "skills/setup/SKILL.md"), "# test\n");
      await Bun.write(resolve(tmp, ".mcp.json"), JSON.stringify({ foo: { url: "https://x" } }));
      const result = await copilotPluginValidator.validate(tmp, { format: "table", verbose: false, ci: false });
      expect(result.errors).toEqual([]);
      expect(result.passes).toContain('name: "agentkit"');
      expect(result.passes.some(p => p.includes("skills: array"))).toBe(true);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });
});

describe("copilot:marketplace", () => {
  test("detects .github/plugin/marketplace.json", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-copilot-mkt-detect");
    try {
      const mkt = {
        name: "m",
        plugins: [{ name: "p1", source: "./kits/p1" }]
      };
      await Bun.write(resolve(tmp, ".github/plugin/marketplace.json"), JSON.stringify(mkt));
      expect(copilotMarketplaceValidator.detect(tmp)).toBe(true);
      expect(copilotMarketplaceValidator.detect(resolve(fixtures, "skills/minimal-good"))).toBe(false);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });

  test("validates a good copilot marketplace with string sources", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-copilot-mkt-good");
    try {
      const mkt = {
        name: "scalekit-authstack",
        metadata: { description: "..." },
        plugins: [
          { name: "agentkit", source: "./kits/agentkit", description: "..." }
        ]
      };
      await Bun.write(resolve(tmp, ".github/plugin/marketplace.json"), JSON.stringify(mkt, null, 2));
      await Bun.write(resolve(tmp, "kits/agentkit/.github/plugin/plugin.json"), JSON.stringify({ name: "a", skills: [] }));
      const result = await copilotMarketplaceValidator.validate(tmp, { format: "table", verbose: false, ci: false });
      expect(result.errors).toEqual([]);
      expect(result.passes).toContain('name: "scalekit-authstack"');
      expect(result.passes.some(p => p.includes("source exists"))).toBe(true);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });
});

describe("copilot:mcp", () => {
  test("detects .mcp.json", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-copilot-mcp-detect");
    try {
      await Bun.write(resolve(tmp, ".mcp.json"), JSON.stringify({ s: { url: "https://x" } }));
      expect(copilotMcpValidator.detect(tmp)).toBe(true);
      expect(copilotMcpValidator.detect(resolve(fixtures, "skills/minimal-good"))).toBe(false);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });

  test("validates copilot .mcp.json (including mcpServers wrapper)", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-copilot-mcp-good");
    try {
      await Bun.write(resolve(tmp, ".mcp.json"), JSON.stringify({
        mcpServers: {
          scalekit: { type: "http", url: "https://mcp.scalekit.com" }
        }
      }, null, 2));
      const result = await copilotMcpValidator.validate(tmp, { format: "table", verbose: false, ci: false });
      expect(result.errors).toEqual([]);
      expect(result.passes).toContain("1 server(s) defined");
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });
});

describe("copilot:skill", () => {
  test("detects SKILL.md", () => {
    expect(copilotSkillValidator.detect(resolve(fixtures, "skills/minimal-good"))).toBe(true);
    expect(copilotSkillValidator.detect(resolve(fixtures, "claude-md"))).toBe(false);
  });

  test("validates a good skill (reuses core)", async () => {
    const result = await copilotSkillValidator.validate(
      resolve(fixtures, "skills/minimal-good"),
      { format: "table", verbose: false, ci: false }
    );
    expect(result.errors).toEqual([]);
  });
});

// ── Agent Skills (open spec) validator ──────────────────────────────

describe("agentskills:skill", () => {
  const opts = { format: "table" as const, verbose: false, ci: false };

  test("detects a single skill directory", () => {
    expect(agentskillsSkillValidator.detect(resolve(fixtures, "skills/agentskills-good"))).toBe(true);
    expect(agentskillsSkillValidator.detect(resolve(fixtures, "claude-md"))).toBe(false);
  });

  test("detects a repo root containing skills (no SKILL.md at the root itself)", () => {
    expect(agentskillsSkillValidator.detect(resolve(fixtures, "agentskills-repo"))).toBe(true);
  });

  test("validates a spec-conformant skill with no errors", async () => {
    const result = await agentskillsSkillValidator.validate(resolve(fixtures, "skills/agentskills-good"), opts);
    expect(result.errors).toEqual([]);
    expect(result.passes.some((p) => p.text.includes("Level 1 (metadata)"))).toBe(true);
    expect(result.passes.some((p) => p.text.includes("Level 2 (instructions)"))).toBe(true);
    expect(result.passes.some((p) => p.text.includes("Level 3 (resources)"))).toBe(true);
  });

  test("accepts a path pointing directly at the SKILL.md file", async () => {
    const result = await agentskillsSkillValidator.validate(
      resolve(fixtures, "skills/agentskills-good/SKILL.md"),
      opts
    );
    expect(result.errors).toEqual([]);
  });

  test("errors on missing description and an oversized name", async () => {
    const result = await agentskillsSkillValidator.validate(resolve(fixtures, "skills/agentskills-bad"), opts);
    expect(result.errors.some((e) => e.text.includes('Missing required "description"'))).toBe(true);
    expect(result.errors.some((e) => e.text.includes("Name length out of range"))).toBe(true);
  });

  test("errors when name does not match the parent directory", async () => {
    const result = await agentskillsSkillValidator.validate(resolve(fixtures, "skills/agentskills-name-mismatch"), opts);
    expect(result.errors.some((e) => e.text.includes("does not match parent directory"))).toBe(true);
  });

  test("warns when the body exceeds the Level 2 line/token budget", async () => {
    const result = await agentskillsSkillValidator.validate(resolve(fixtures, "skills/agentskills-oversized"), opts);
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.text.includes("lines"))).toBe(true);
  });

  test("fans out over a repo with multiple skills, including nested ones", async () => {
    const result = await agentskillsSkillValidator.validate(resolve(fixtures, "agentskills-repo"), opts);
    expect(result.errors).toEqual([]);
    const labels = result.passes.filter((p) => p.text.includes('name: "')).map((p) => p.text.split("]")[0] + "]");
    expect(labels.some((l) => l.includes("skills/a"))).toBe(true);
    expect(labels.some((l) => l.includes("skills/b"))).toBe(true);
    expect(labels.some((l) => l.includes("packages/x/skills/c"))).toBe(true);
  });

  test("reports a clear notice (not an error) when no skills are found", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-agentskills-empty");
    try {
      await Bun.write(resolve(tmp, "README.md"), "nothing here");
      const result = await agentskillsSkillValidator.validate(tmp, opts);
      expect(result.errors).toEqual([]);
      expect(result.warnings.some((w) => w.text.includes("No skills found"))).toBe(true);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });
});
