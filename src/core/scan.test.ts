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

  test("Grok-only skill appears in health and Grok agent surfaces", async () => {
    const root = makeRepo();
    writeSkill(root, ".grok/skills/deploy", 'name: deploy\ndescription: "Use when shipping"');
    const result = await runScan(root, noneInstalled);

    expect(result.empty).toBe(false);
    const entry = result.health.find((h) => h.path.includes("deploy"));
    expect(entry).toBeDefined();
    expect(entry!.status).not.toBe("fail");

    const grok = result.agents.find((a) => a.name === "grok")!;
    expect(grok.configuredInRepo).toBe(true);
    expect(grok.surfaces.skillRoots).toContain(".grok/skills");
  });

  test("same skill name under .claude and .grok reports shadowing (Grok prefers .grok)", async () => {
    const root = makeRepo();
    writeSkill(root, ".claude/skills/review", 'name: review\ndescription: "Use when reviewing Claude-side"');
    writeSkill(root, ".grok/skills/review", 'name: review\ndescription: "Use when reviewing Grok-side"');
    const result = await runScan(root, noneInstalled);

    expect(result.shadows.length).toBe(1);
    const shadow = result.shadows[0]!;
    expect(shadow.name).toBe("review");
    // Winner first (Grok host priority: .grok before .claude)
    const paths = shadow.paths.map((p) => p.replace(/\\/g, "/"));
    expect(paths[0]).toBe(".grok/skills/review");
    expect(paths).toContain(".claude/skills/review");

    // Health entries carry a warning so human scan notices
    const grokHit = result.health.find((h) => h.path.replace(/\\/g, "/").includes(".grok/skills/review"))!;
    const claudeHit = result.health.find((h) => h.path.replace(/\\/g, "/").includes(".claude/skills/review"))!;
    expect(grokHit.warnings.some((w) => /shadow|also at|prefer/i.test(w.text))).toBe(true);
    expect(claudeHit.warnings.some((w) => /shadow|also at|prefer/i.test(w.text))).toBe(true);
  });

  test("intelligence.install reflects platform doctor (source skip by default)", async () => {
    const root = makeRepo();
    const result = await runScan(root, noneInstalled);
    expect(result.intelligence.install).toBeDefined();
    // Repo package.json has no optionalDependencies → source/dev skip
    expect(["skip", "ok", "warn", "fail"]).toContain(result.intelligence.install.status);
    expect(result.intelligence.install.expectedVersion).toBeTruthy();
  });

  test("health items with codes carry docUrl for JSON consumers", async () => {
    const root = makeRepo();
    writeSkill(root, ".claude/skills/bad", 'name: Bad_Name\ndescription: "Use when testing"');
    const result = await runScan(root, noneInstalled);
    const bad = result.health.find((h) => h.path.includes("bad"))!;
    expect(bad.status).toBe("fail");
    expect(bad.errors[0]?.code).toBeTruthy();
    expect(bad.errors[0]?.docUrl).toMatch(/doraval\.thehacksmith\.dev/);
  });

  test("shadow warnings include E-SCAN-SHADOW docUrl", async () => {
    const root = makeRepo();
    writeSkill(root, ".claude/skills/dup", 'name: dup\ndescription: "Use when A"');
    writeSkill(root, ".grok/skills/dup", 'name: dup\ndescription: "Use when B"');
    const result = await runScan(root, noneInstalled);
    const warn = result.health.flatMap((h) => h.warnings).find((w) => w.code === "E-SCAN-SHADOW");
    expect(warn?.docUrl).toContain("/commands/scan/");
  });

  test("intelligence.install fail surfaces reinstall suggestion", async () => {
    const root = makeRepo();
    const result = await runScan(root, noneInstalled, {
      installDeps: {
        platform: "linux",
        arch: "x64",
        expectedVersion: "0.6.6",
        hasOptionalDepsDeclared: true,
        resolvePlatform: () => null,
      },
    });
    expect(result.intelligence.install.status).toBe("fail");
    expect(result.intelligence.install.code).toBe("E-INSTALL-MISSING");
    expect(
      result.suggestions.some(
        (s) => s.kind === "fix" && s.command.includes("npm install @hacksmith/doraval"),
      ),
    ).toBe(true);
  });

  test("skill under gitignored-looking path still appears (discovery ignores gitignore)", async () => {
    // findSkillDirs never consults .gitignore — only name-based ignore (node_modules, .git, …).
    // Teams often gitignore .claude/** while Grok still loads those skills.
    const root = makeRepo();
    writeFileSync(join(root, ".gitignore"), ".claude/\n.grok/\n");
    writeSkill(root, ".claude/skills/hidden", 'name: hidden\ndescription: "Use when testing ignore"');
    writeSkill(root, ".grok/skills/hidden-g", 'name: hidden-g\ndescription: "Use when testing grok ignore"');
    const result = await runScan(root, noneInstalled);
    expect(result.health.some((h) => h.path.includes("hidden"))).toBe(true);
    expect(result.health.some((h) => h.path.includes("hidden-g"))).toBe(true);
  });
});
