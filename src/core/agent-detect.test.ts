import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { detectAllAgents, scanCrossAgent } from "./agent-detect.js";

function tmpRepo(): string {
  return mkdtempSync(join(tmpdir(), "dora-detect-"));
}

const noneInstalled = { which: () => false };
const allInstalled = { which: () => true };

describe("detectAllAgents", () => {
  test("returns all five agents, unconfigured in an empty dir", () => {
    const dir = tmpRepo();
    const result = detectAllAgents(dir, noneInstalled);
    expect(result.map((a) => a.name).sort()).toEqual(
      ["claude", "codex", "copilot", "cursor", "grok"]
    );
    for (const a of result) {
      expect(a.installed).toBe(false);
      expect(a.configuredInRepo).toBe(false);
      expect(a.surfaces.configFiles).toEqual([]);
    }
  });

  test("detects Claude surfaces: .claude/skills, CLAUDE.md", () => {
    const dir = tmpRepo();
    mkdirSync(join(dir, ".claude", "skills", "review"), { recursive: true });
    writeFileSync(join(dir, ".claude", "skills", "review", "SKILL.md"), "---\nname: review\n---\nbody");
    writeFileSync(join(dir, "CLAUDE.md"), "# rules");
    const claude = detectAllAgents(dir, noneInstalled).find((a) => a.name === "claude")!;
    expect(claude.configuredInRepo).toBe(true);
    expect(claude.surfaces.configFiles).toContain("CLAUDE.md");
    expect(claude.surfaces.skillRoots).toContain(".claude/skills");
  });

  test("detects Cursor rules and Copilot instructions", () => {
    const dir = tmpRepo();
    mkdirSync(join(dir, ".cursor", "rules"), { recursive: true });
    writeFileSync(join(dir, ".cursor", "rules", "style.md"), "tabs");
    mkdirSync(join(dir, ".github"), { recursive: true });
    writeFileSync(join(dir, ".github", "copilot-instructions.md"), "hi");
    const byName = Object.fromEntries(detectAllAgents(dir, noneInstalled).map((a) => [a.name, a]));
    expect(byName.cursor!.configuredInRepo).toBe(true);
    expect(byName.copilot!.configuredInRepo).toBe(true);
  });

  test("detects Grok surfaces: .grok/skills, .agents/skills, plugin manifests", () => {
    const dir = tmpRepo();
    mkdirSync(join(dir, ".grok", "skills", "review"), { recursive: true });
    writeFileSync(join(dir, ".grok", "skills", "review", "SKILL.md"), "---\nname: review\n---\nbody");
    mkdirSync(join(dir, ".agents", "skills", "shared"), { recursive: true });
    writeFileSync(join(dir, ".agents", "skills", "shared", "SKILL.md"), "---\nname: shared\n---\nbody");
    mkdirSync(join(dir, ".grok", "rules"), { recursive: true });
    writeFileSync(join(dir, ".grok", "rules", "style.md"), "tabs");
    mkdirSync(join(dir, ".grok-plugin"), { recursive: true });
    writeFileSync(join(dir, ".grok-plugin", "plugin.json"), "{}");

    const grok = detectAllAgents(dir, noneInstalled).find((a) => a.name === "grok")!;
    expect(grok.configuredInRepo).toBe(true);
    expect(grok.surfaces.skillRoots).toContain(".grok/skills");
    expect(grok.surfaces.skillRoots).toContain(".agents/skills");
    expect(grok.surfaces.configFiles).toContain(".grok/rules");
    expect(grok.surfaces.configFiles).toContain(".grok-plugin/plugin.json");
  });

  test("Grok-only skill root marks configured without Claude paths", () => {
    const dir = tmpRepo();
    mkdirSync(join(dir, ".grok", "skills", "only"), { recursive: true });
    writeFileSync(join(dir, ".grok", "skills", "only", "SKILL.md"), "---\nname: only\n---\nx");
    const byName = Object.fromEntries(detectAllAgents(dir, noneInstalled).map((a) => [a.name, a]));
    expect(byName.grok!.configuredInRepo).toBe(true);
    expect(byName.claude!.configuredInRepo).toBe(false);
  });

  test("installed flag comes from the injected which()", () => {
    const dir = tmpRepo();
    const result = detectAllAgents(dir, allInstalled);
    expect(result.every((a) => a.installed)).toBe(true);
  });
});

describe("scanCrossAgent", () => {
  test("flags AGENTS.md and .mcp.json when present", () => {
    const dir = tmpRepo();
    expect(scanCrossAgent(dir)).toEqual({ agentsMd: false, mcpJson: false });
    writeFileSync(join(dir, "AGENTS.md"), "# shared");
    writeFileSync(join(dir, ".mcp.json"), "{}");
    expect(scanCrossAgent(dir)).toEqual({ agentsMd: true, mcpJson: true });
  });
});
