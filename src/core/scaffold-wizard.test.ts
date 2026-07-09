import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  decidePath,
  detectScaffoldContext,
  recommendConfigTarget,
  sanitizeName,
  parseProviderId,
  parseScaffoldType,
} from "./scaffold-wizard.js";
import { writeScaffold } from "./scaffold.js";

function tempDir(): string {
  const dir = join(tmpdir(), `dora-scaffold-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("sanitizeName / parsers", () => {
  test("sanitizeName lowercases and hyphenates", () => {
    expect(sanitizeName("My Cool Skill")).toBe("my-cool-skill");
  });

  test("parseProviderId accepts known providers", () => {
    expect(parseProviderId("claude")).toBe("claude");
    expect(parseProviderId("nope")).toBeNull();
  });

  test("parseScaffoldType accepts types", () => {
    expect(parseScaffoldType("skill")).toBe("skill");
    expect(parseScaffoldType("rule")).toBe("rule");
    expect(parseScaffoldType("x")).toBeNull();
  });
});

describe("recommendConfigTarget", () => {
  test("existing AGENTS.md always wins", () => {
    const cwd = tempDir();
    writeFileSync(join(cwd, "AGENTS.md"), "# hi\n");
    const ctx = detectScaffoldContext(cwd, "claude");
    expect(recommendConfigTarget(ctx, "claude", "style").kind).toBe("agents-md");
    rmSync(cwd, { recursive: true, force: true });
  });

  test("claude-only repo recommends CLAUDE.md", () => {
    const cwd = tempDir();
    mkdirSync(join(cwd, ".claude"), { recursive: true });
    const ctx = detectScaffoldContext(cwd, "claude");
    expect(recommendConfigTarget(ctx, "claude", "style").kind).toBe("claude-md");
    rmSync(cwd, { recursive: true, force: true });
  });

  test("cursor provider recommends .cursor/rules", () => {
    const cwd = tempDir();
    const ctx = detectScaffoldContext(cwd, "cursor");
    const t = recommendConfigTarget(ctx, "cursor", "no-defaults");
    expect(t.kind).toBe("cursor-rule");
    if (t.kind === "cursor-rule") {
      expect(t.file).toBe(".cursor/rules/no-defaults.md");
    }
    rmSync(cwd, { recursive: true, force: true });
  });
});

describe("decidePath", () => {
  test("skill + self → standalone", () => {
    const cwd = tempDir();
    const d = decidePath({
      type: "skill",
      provider: "claude",
      intent: "self",
      cwd,
    });
    expect(d.path).toBe("standalone");
    expect(d.primaryPath).toContain(join(".claude", "skills"));
    rmSync(cwd, { recursive: true, force: true });
  });

  test("skill + distribute + name → plugin subdir", () => {
    const cwd = tempDir();
    const d = decidePath({
      type: "skill",
      provider: "claude",
      intent: "distribute",
      name: "test-helper",
      cwd,
    });
    expect(d.path).toBe("plugin");
    expect(d.shouldCreateDir).toBe(true);
    expect(d.targetDir).toBe(join(cwd, "test-helper"));
    rmSync(cwd, { recursive: true, force: true });
  });

  test("plugin type forces plugin path", () => {
    const cwd = tempDir();
    const d = decidePath({
      type: "plugin",
      provider: "codex",
      intent: "self",
      name: "p",
      cwd,
    });
    expect(d.path).toBe("plugin");
    rmSync(cwd, { recursive: true, force: true });
  });

  test("--native + distribute throws", () => {
    expect(() =>
      decidePath({
        type: "skill",
        provider: "claude",
        intent: "distribute",
        native: true,
      }),
    ).toThrow(/--native conflicts/);
  });

  test("rule is always native-rule", () => {
    const cwd = tempDir();
    const d = decidePath({
      type: "rule",
      provider: "cursor",
      intent: "self",
      name: "no-default-exports",
      cwd,
    });
    expect(d.path).toBe("native-rule");
    expect(d.ruleTarget?.kind).toBe("cursor-rule");
    rmSync(cwd, { recursive: true, force: true });
  });

  test("agent is always native-agent", () => {
    const cwd = tempDir();
    const d = decidePath({
      type: "agent",
      provider: "claude",
      intent: "self",
      name: "reviewer",
      cwd,
    });
    expect(d.path).toBe("native-agent");
    expect(d.primaryPath).toContain(join(".claude", "agents", "reviewer.md"));
    rmSync(cwd, { recursive: true, force: true });
  });
});

describe("writeScaffold", () => {
  test("writes claude plugin manifest + skill", () => {
    const cwd = tempDir();
    const d = decidePath({
      type: "plugin",
      provider: "claude",
      intent: "distribute",
      name: "demo-plug",
      description: "Demo",
      cwd,
    });
    const r = writeScaffold(d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(existsSync(join(cwd, "demo-plug", ".claude-plugin", "plugin.json"))).toBe(true);
    expect(existsSync(join(cwd, "demo-plug", "skills", "doraval", "SKILL.md"))).toBe(true);
    rmSync(cwd, { recursive: true, force: true });
  });

  test("writes codex plugin with interface block", () => {
    const cwd = tempDir();
    const d = decidePath({
      type: "plugin",
      provider: "codex",
      intent: "distribute",
      name: "codex-plug",
      cwd,
    });
    const r = writeScaffold(d);
    expect(r.ok).toBe(true);
    const plugin = JSON.parse(
      readFileSync(join(cwd, "codex-plug", ".codex-plugin", "plugin.json"), "utf-8"),
    );
    expect(plugin.interface.displayName).toBe("codex-plug");
    expect(existsSync(join(cwd, "codex-plug", ".agents", "plugins", "marketplace.json"))).toBe(true);
    rmSync(cwd, { recursive: true, force: true });
  });

  test("writes cursor standalone skill", () => {
    const cwd = tempDir();
    const d = decidePath({
      type: "skill",
      provider: "cursor",
      intent: "self",
      name: "local-skill",
      cwd,
    });
    const r = writeScaffold(d);
    expect(r.ok).toBe(true);
    expect(existsSync(join(cwd, "skills", "local-skill", "SKILL.md"))).toBe(true);
    rmSync(cwd, { recursive: true, force: true });
  });

  test("writes rule into .cursor/rules", () => {
    const cwd = tempDir();
    const d = decidePath({
      type: "rule",
      provider: "cursor",
      intent: "self",
      name: "no-defaults",
      description: "Never use default exports",
      cwd,
    });
    const r = writeScaffold(d);
    expect(r.ok).toBe(true);
    expect(existsSync(join(cwd, ".cursor", "rules", "no-defaults.md"))).toBe(true);
    rmSync(cwd, { recursive: true, force: true });
  });

  test("writes claude agent definition", () => {
    const cwd = tempDir();
    const d = decidePath({
      type: "agent",
      provider: "claude",
      intent: "self",
      name: "explorer",
      description: "Explores the codebase",
      cwd,
    });
    const r = writeScaffold(d);
    expect(r.ok).toBe(true);
    expect(existsSync(join(cwd, ".claude", "agents", "explorer.md"))).toBe(true);
    rmSync(cwd, { recursive: true, force: true });
  });
});
