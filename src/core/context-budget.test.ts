import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  ALWAYS_ON_LINES_WARN,
  MCP_SERVERS_WARN,
  countDeclaredMcpTools,
  countMcpServers,
  isAlwaysOnRule,
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
    // claude's window = its own CLAUDE.md + shared AGENTS.md
    expect(b.windows).toHaveLength(1);
    expect(b.windows[0]!.agent).toBe("claude");
    expect(b.heaviestWindowLines).toBe(b.windows[0]!.lines);
  });

  test("warns when a single agent's always-on window exceeds soft budget", () => {
    const root = makeRepo();
    const body = Array.from({ length: ALWAYS_ON_LINES_WARN + 20 }, (_, i) => `line ${i}`).join("\n");
    writeFileSync(join(root, "CLAUDE.md"), body + "\n");
    const b = measureContextBudget(root, 0);
    expect(b.status).toBe("warn");
    expect(b.heaviestWindowLines).toBeGreaterThan(ALWAYS_ON_LINES_WARN);
    expect(b.hint).toMatch(/claude always-on|CLAUDE\.md/);
    expect(b.largestAlwaysOn?.path).toBe("CLAUDE.md");
  });

  test("names a reference-shaped section as an extraction candidate", () => {
    const root = makeRepo();
    const filler = Array.from(
      { length: ALWAYS_ON_LINES_WARN + 20 },
      (_, i) => `Reference detail line ${i} about the release process.`,
    ).join("\n");
    const body = [
      "# Rules",
      "",
      "## Release / npm platform packages (learned the hard way)",
      "",
      filler,
      "",
      "```bash",
      "npm publish --access public",
      "```",
      "",
    ].join("\n");
    writeFileSync(join(root, "CLAUDE.md"), body + "\n");
    const b = measureContextBudget(root, 0);
    expect(b.status).toBe("warn");
    expect(b.candidates?.[0]?.heading).toBe("## Release / npm platform packages (learned the hard way)");
    expect(b.hint).toContain("Release / npm platform packages");
  });

  test("per-agent window does not sum across agents", () => {
    const root = makeRepo();
    const bodyLines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i}`).join("\n");
    writeFileSync(join(root, "CLAUDE.md"), bodyLines(150) + "\n");
    writeFileSync(join(root, ".cursorrules"), bodyLines(150) + "\n");
    const b = measureContextBudget(root, 0);
    // Repo-wide total is ~300 lines, but no single agent's window sums both files.
    expect(b.alwaysOnLines).toBeGreaterThan(ALWAYS_ON_LINES_WARN);
    expect(b.windows).toHaveLength(2);
    for (const w of b.windows) {
      expect(w.lines).toBeLessThan(ALWAYS_ON_LINES_WARN);
    }
    expect(b.heaviestWindowLines).toBeLessThan(ALWAYS_ON_LINES_WARN);
    expect(b.status).toBe("ok");
  });

  test("path-scoped cursor rule is not counted as always-on", () => {
    const root = makeRepo();
    mkdirSync(join(root, ".cursor", "rules"), { recursive: true });
    writeFileSync(join(root, ".cursor", "rules", "scoped.mdc"), '---\nglobs: "*.ts"\n---\nScoped body.\n');
    writeFileSync(join(root, ".cursor", "rules", "always.mdc"), "Plain always-on body.\n");
    const b = measureContextBudget(root, 0);
    const paths = b.alwaysOn.map((f) => f.path.replace(/\\/g, "/"));
    expect(paths).toContain(".cursor/rules/always.mdc");
    expect(paths).not.toContain(".cursor/rules/scoped.mdc");
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

  test("countDeclaredMcpTools sums declared tools", () => {
    const root = makeRepo();
    writeFileSync(
      join(root, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          a: { command: "npx", tools: ["x", "y"] },
          b: { url: "https://example.com", toolCount: 3 },
        },
      }),
    );
    expect(countDeclaredMcpTools(root)).toBe(5);
  });

  test("countDeclaredMcpTools returns undefined when none declared", () => {
    const root = makeRepo();
    writeFileSync(
      join(root, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          a: { command: "npx" },
          b: { url: "https://example.com" },
        },
      }),
    );
    expect(countDeclaredMcpTools(root)).toBeUndefined();
  });

  test("MCP hint mentions tool count when declared", () => {
    const root = makeRepo();
    const servers: Record<string, { command: string; toolCount?: number }> = {};
    for (let i = 0; i < MCP_SERVERS_WARN; i++) {
      servers[`s${i}`] = { command: `bin-${i}`, toolCount: 10 };
    }
    writeFileSync(join(root, ".mcp.json"), JSON.stringify({ mcpServers: servers }));
    const b = measureContextBudget(root, 0);
    const expectedTotal = MCP_SERVERS_WARN * 10;
    expect(b.declaredMcpTools).toBe(expectedTotal);
    expect(b.status).toBe("warn");
    expect(b.hint).toContain(`${expectedTotal} MCP tools`);
    expect(b.summary).toContain(`${MCP_SERVERS_WARN} MCP (${expectedTotal} tools)`);
  });
});

describe("isAlwaysOnRule", () => {
  test("plain rule with no frontmatter is always-on", () => {
    expect(isAlwaysOnRule("Just some rule text.\n")).toBe(true);
  });

  test("alwaysApply: true is always-on", () => {
    expect(isAlwaysOnRule("---\nalwaysApply: true\n---\nBody.\n")).toBe(true);
  });

  test("alwaysApply: false is JIT, not always-on", () => {
    expect(isAlwaysOnRule("---\nalwaysApply: false\n---\nBody.\n")).toBe(false);
  });

  test("non-empty globs is JIT, not always-on", () => {
    expect(isAlwaysOnRule('---\nglobs: "*.ts"\n---\nBody.\n')).toBe(false);
  });

  test("non-empty globs array is JIT, not always-on", () => {
    expect(isAlwaysOnRule("---\nglobs:\n  - '*.ts'\n  - '*.tsx'\n---\nBody.\n")).toBe(false);
  });

  test("malformed frontmatter falls back to always-on", () => {
    expect(isAlwaysOnRule("---\nglobs: [unterminated\n---\nBody.\n")).toBe(true);
  });
});
