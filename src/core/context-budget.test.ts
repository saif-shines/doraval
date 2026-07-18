import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  ALWAYS_ON_LINES_WARN,
  MCP_SERVERS_WARN,
  countMcpServers,
  measureContextBudget,
} from "./context-budget.js";

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "dora-budget-"));
  mkdirSync(join(root, ".git"));
  return root;
}

describe("measureContextBudget", () => {
  test("empty repo → status empty", () => {
    const root = makeRepo();
    const b = measureContextBudget(root, 0);
    expect(b.status).toBe("empty");
    expect(b.alwaysOnLines).toBe(0);
    expect(b.mcpServerCount).toBe(0);
  });

  test("counts CLAUDE.md + AGENTS.md tokens and skills", () => {
    const root = makeRepo();
    writeFileSync(join(root, "CLAUDE.md"), "# Rules\n\nUse bun.\n");
    writeFileSync(join(root, "AGENTS.md"), "# Shared\n\nBe concise.\n");
    const b = measureContextBudget(root, 3);
    expect(b.status).toBe("ok");
    expect(b.alwaysOn.map((f) => f.path).sort()).toEqual(["AGENTS.md", "CLAUDE.md"]);
    expect(b.alwaysOnLines).toBeGreaterThan(0);
    expect(b.alwaysOnTokens).toBeGreaterThan(0);
    expect(b.skillCount).toBe(3);
    expect(b.summary).toContain("Always-on");
    expect(b.summary).toContain("3 skills");
  });

  test("warns when always-on lines exceed soft budget", () => {
    const root = makeRepo();
    const body = Array.from({ length: ALWAYS_ON_LINES_WARN + 20 }, (_, i) => `line ${i}`).join("\n");
    writeFileSync(join(root, "CLAUDE.md"), body + "\n");
    const b = measureContextBudget(root, 0);
    expect(b.status).toBe("warn");
    expect(b.alwaysOnLines).toBeGreaterThan(ALWAYS_ON_LINES_WARN);
    expect(b.hint).toMatch(/Always-on over|CLAUDE\.md/);
  });

  test("includes .cursor/rules and .grok/rules", () => {
    const root = makeRepo();
    mkdirSync(join(root, ".cursor", "rules"), { recursive: true });
    mkdirSync(join(root, ".grok", "rules"), { recursive: true });
    writeFileSync(join(root, ".cursor", "rules", "style.md"), "Use 2-space indent.\n");
    writeFileSync(join(root, ".grok", "rules", "tone.md"), "Be direct.\n");
    const b = measureContextBudget(root, 0);
    const paths = b.alwaysOn.map((f) => f.path.replace(/\\/g, "/"));
    expect(paths).toContain(".cursor/rules/style.md");
    expect(paths).toContain(".grok/rules/tone.md");
    expect(b.status).toBe("ok");
  });

  test("countMcpServers reads mcpServers map", () => {
    const root = makeRepo();
    writeFileSync(
      join(root, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          a: { command: "npx", args: ["a"] },
          b: { url: "https://example.com" },
        },
      }),
    );
    expect(countMcpServers(root)).toBe(2);
  });

  test("warns when MCP server count is high", () => {
    const root = makeRepo();
    const servers: Record<string, { command: string }> = {};
    for (let i = 0; i < MCP_SERVERS_WARN; i++) {
      servers[`s${i}`] = { command: `bin-${i}` };
    }
    writeFileSync(join(root, ".mcp.json"), JSON.stringify({ mcpServers: servers }));
    const b = measureContextBudget(root, 0);
    expect(b.mcpServerCount).toBe(MCP_SERVERS_WARN);
    expect(b.status).toBe("warn");
    expect(b.hint).toMatch(/MCP/);
  });
});
