import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { runScan } from "./scan.js";

const noneInstalled = { which: () => false };

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "dora-scan-"));
  mkdirSync(join(root, ".git"));
  return root;
}

function writeSkill(root: string, rel: string, frontmatter: string): void {
  const dir = join(root, rel);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `---\n${frontmatter}\n---\n\n1. Run the thing\n`);
}

describe("runScan", () => {
  test("empty repo: empty=true and a 'start' suggestion pointing at dora new", async () => {
    const root = makeRepo();
    const result = await runScan(root, noneInstalled);
    expect(result.empty).toBe(true);
    expect(result.health).toEqual([]);
    expect(result.suggestions.some((s) => s.kind === "start" && s.command.includes("dora new"))).toBe(true);
  });

  test("valid skill passes; invalid skill fails with a fix suggestion", async () => {
    const root = makeRepo();
    writeSkill(root, ".claude/skills/good", 'name: good\ndescription: "Use when deploying to staging"');
    // "Bad_Name" fails NAME_REGEX (kebab-case only) — a real validation error, not just a warning.
    writeSkill(root, ".claude/skills/bad", 'name: Bad_Name\ndescription: "Use when testing bad names"');
    const result = await runScan(root, noneInstalled);

    expect(result.empty).toBe(false);
    const good = result.health.find((h) => h.path.includes("good"))!;
    const bad = result.health.find((h) => h.path.includes("bad"))!;
    expect(good.status).not.toBe("fail");
    expect(bad.status).toBe("fail");
    expect(bad.errors.length).toBeGreaterThan(0);
    expect(result.summary.failed).toBe(1);
    expect(result.suggestions.some((s) => s.kind === "fix" && s.command.includes("bad"))).toBe(true);
  });

  test("skills are labeled with origin", async () => {
    const root = makeRepo();
    writeSkill(root, ".claude/skills/mine", 'name: mine\ndescription: "Use when testing"');
    const result = await runScan(root, noneInstalled);
    expect(result.health[0]!.origin).toBe("authored");
  });

  test("agents and crossAgent surfaces are included", async () => {
    const root = makeRepo();
    writeFileSync(join(root, "AGENTS.md"), "# shared");
    const result = await runScan(root, noneInstalled);
    expect(result.agents.map((a) => a.name)).toContain("claude");
    expect(result.crossAgent.agentsMd).toBe(true);
    expect(result.empty).toBe(false); // AGENTS.md counts as agent context
    expect(result.contradictions).toEqual([]);
  });

  test("contradictions surface in scan JSON when agent configs conflict", async () => {
    const root = makeRepo();
    writeFileSync(join(root, "CLAUDE.md"), "# Claude\n\nUse 2-space indentation.\n");
    writeFileSync(join(root, ".cursorrules"), "# Cursor\n\nUse tabs for indentation.\n");
    const result = await runScan(root, noneInstalled);
    expect(result.contradictions.length).toBeGreaterThan(0);
    expect(result.contradictions.some((c) => c.kind === "conflicting_convention")).toBe(true);
    expect(result.suggestions.some((s) => s.command.includes("reconcile"))).toBe(true);
  });

  test("scan of a 10-skill repo completes under 500ms", async () => {
    const root = makeRepo();
    for (let i = 0; i < 10; i++) {
      writeSkill(root, `.claude/skills/s${i}`, `name: s${i}\ndescription: "Use when doing task ${i}"`);
    }
    const t0 = performance.now();
    await runScan(root, noneInstalled);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});
