import { describe, expect, test } from "bun:test";
import pkg from "../package.json" with { type: "json" };
import { fixturePath, runDoraval } from "./helpers/spawn-cli.js";
import { join } from "path";
import { tmpdir } from "os";
import { rmSync, mkdirSync, mkdtempSync, writeFileSync, existsSync } from "fs";

describe("doraval CLI", () => {
  describe("help and version", () => {
    test("--help lists core commands", () => {
      const { exitCode, stdout } = runDoraval(["--help"]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("scan");
      expect(stdout).toContain("review");
      expect(stdout).toContain("fix");
    });

    test("--version prints package version", () => {
      const { exitCode, stdout, stderr } = runDoraval(["--version"]);
      const output = stdout + stderr;
      expect(exitCode).toBe(0);
      expect(output).toContain(pkg.version);
    });


  });

  test("claude new --yes scaffolds plugin in temp dir", () => {
    const tmp = join(import.meta.dir, "../../tmp-claude-new-test");
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    writeFileSync(join(tmp, "existing.md"), "---\nname: existing\n---\nold content");

    const { exitCode, stdout, stderr } = runDoraval([
      "claude", "new",
      "--yes",
      "--intent", "self-later",
      "--name", "test-helper",
    ], { cwd: tmp });  // Extend spawn helper if needed for cwd

    expect(exitCode).toBe(0);
    expect(stdout + stderr).toContain("plugin");
    expect(existsSync(join(tmp, "test-helper", ".claude-plugin", "plugin.json"))).toBe(true);

    rmSync(tmp, { recursive: true, force: true });
  });

  test("claude new --yes scaffolds standalone in temp dir", () => {
    const tmp = join(import.meta.dir, "../../tmp-claude-new-standalone-test");
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });

    const { exitCode, stdout, stderr } = runDoraval([
      "claude", "new",
      "--yes",
      "--intent", "self",
    ], { cwd: tmp });

    expect(exitCode).toBe(0);
    expect(stdout + stderr).toContain("standalone");
    expect(existsSync(join(tmp, ".claude", "skills", "my-skill", "SKILL.md"))).toBe(true);

    rmSync(tmp, { recursive: true, force: true });
  });

  test("codex new --yes scaffolds plugin in temp dir", () => {
    const tmp = join(import.meta.dir, "../../tmp-codex-new-test");
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });

    const { exitCode, stdout, stderr } = runDoraval([
      "codex", "new",
      "--yes",
      "--intent", "distribute",
      "--name", "test-codex-plugin",
    ], { cwd: tmp });

    expect(exitCode).toBe(0);
    expect(stdout + stderr).toContain("plugin");
    expect(existsSync(join(tmp, "test-codex-plugin", ".codex-plugin", "plugin.json"))).toBe(true);
    expect(existsSync(join(tmp, "test-codex-plugin", ".agents", "plugins", "marketplace.json"))).toBe(true);
    expect(existsSync(join(tmp, "test-codex-plugin", "skills", "doraval", "SKILL.md"))).toBe(true);

    rmSync(tmp, { recursive: true, force: true });
  });

  test("codex new --yes scaffolds local skill (standalone) in temp dir", () => {
    const tmp = join(import.meta.dir, "../../tmp-codex-new-standalone-test");
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });

    const { exitCode, stdout, stderr } = runDoraval([
      "codex", "new",
      "--yes",
      "--intent", "self",
    ], { cwd: tmp });

    expect(exitCode).toBe(0);
    expect(stdout + stderr).toContain("standalone");
    expect(existsSync(join(tmp, "skills", "doraval", "SKILL.md"))).toBe(true);

    rmSync(tmp, { recursive: true, force: true });
  });

  test("update --check exits 0 and reports up to date when current version matches latest", () => {
    const { exitCode, stdout, stderr } = runDoraval(["update", "--check"], { env: { DORAVAL_TEST: "1" } });
    const output = stdout + stderr;
    expect(exitCode).toBe(0);
    expect(output).toContain("up to date");
  });

  describe("dora scan (bare default)", () => {
    function emptyRepo(): string {
      const dir = mkdtempSync(join(tmpdir(), "dora-cli-scan-"));
      mkdirSync(join(dir, ".git"));
      return dir;
    }

    test("scan --format json on an empty repo: valid JSON, exit 0, empty=true", () => {
      const dir = emptyRepo();
      const { stdout, exitCode } = runDoraval(["scan", "--format", "json", "--cwd", dir]);
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.empty).toBe(true);
      expect(Array.isArray(parsed.agents)).toBe(true);
      expect(parsed.suggestions[0].command).toContain("dora new");
      rmSync(dir, { recursive: true, force: true });
    });

    test("scan exits 1 when a skill fails validation", () => {
      const dir = emptyRepo();
      const skill = join(dir, ".claude", "skills", "broken");
      mkdirSync(skill, { recursive: true });
      writeFileSync(join(skill, "SKILL.md"), "---\nname: Bad_Name\ndescription: bad name format\n---\nbody");
      const { exitCode, stdout } = runDoraval(["scan", "--format", "json", "--cwd", dir]);
      expect(exitCode).toBe(1);
      expect(JSON.parse(stdout).summary.failed).toBe(1);
      rmSync(dir, { recursive: true, force: true });
    });

    test("bare invocation accepts --format json in both space and equals form", () => {
      const dir = emptyRepo();
      const spaceForm = runDoraval(["--format", "json", "--cwd", dir]);
      expect(spaceForm.exitCode).toBe(0);
      expect(JSON.parse(spaceForm.stdout).empty).toBe(true);

      const equalsForm = runDoraval(["--format=json", "--cwd", dir]);
      expect(equalsForm.exitCode).toBe(0);
      expect(JSON.parse(equalsForm.stdout).empty).toBe(true);
      rmSync(dir, { recursive: true, force: true });
    });

    test("human output ends with Next actions", () => {
      const dir = emptyRepo();
      const { stdout, stderr } = runDoraval(["scan", "--cwd", dir]);
      expect(stdout).toBe(""); // table mode: diagnostics on stderr, stdout stays JSON-only
      expect(stderr).toContain("No agent context found");
      expect(stderr).toContain("dora new");
      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe("B13 command cleanup — removed commands", () => {
    test("skill group is gone", () => {
      const { exitCode, stderr } = runDoraval(["skill", "validate", "."]);
      expect(exitCode).not.toBe(0);
    });

    test("top-level validate is gone", () => {
      const { exitCode } = runDoraval(["validate", "."]);
      expect(exitCode).not.toBe(0);
    });

    test("eval/evals are gone", () => {
      const r1 = runDoraval(["eval", "."]);
      expect(r1.exitCode).not.toBe(0);
      const r2 = runDoraval(["evals", "."]);
      expect(r2.exitCode).not.toBe(0);
    });

    test("top-level drift is gone", () => {
      const { exitCode } = runDoraval(["drift", "."]);
      expect(exitCode).not.toBe(0);
    });
  });

  describe("dora init removal", () => {
    test("top-level init is gone", () => {
      const { exitCode, stderr } = runDoraval(["init"]);
      expect(exitCode).not.toBe(0);
      expect(stderr.toLowerCase()).toContain("unknown command");
    });

    test("journal init still exists", () => {
      const { stdout, stderr } = runDoraval(["journal", "--help"]);
      expect(stdout + stderr).toContain("init");
    });
  });

  describe("bare dora", () => {
    test("no args runs the scan, not the banner", () => {
      const dir = mkdtempSync(join(tmpdir(), "dora-bare-"));
      mkdirSync(join(dir, ".git"));
      const { stdout, stderr, exitCode } = runDoraval([], { cwd: dir });
      expect(exitCode).toBe(0);
      expect(stderr).toContain("No agent context found");
      expect(stdout + stderr).not.toContain("⣿"); // Doraemon ASCII art is gone
      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe("dora --capabilities", () => {
    test("emits a valid manifest", () => {
      const { stdout, exitCode } = runDoraval(["--capabilities"]);
      expect(exitCode).toBe(0);
      const m = JSON.parse(stdout);
      expect(m.commands.some((c: { name: string }) => c.name === "scan")).toBe(true);
      expect(m.intelligence.mechanical).toBe(true);
    });
  });
});
