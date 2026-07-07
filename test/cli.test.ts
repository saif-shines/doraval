import { describe, expect, test } from "bun:test";
import pkg from "../package.json" with { type: "json" };
import { fixturePath, runDoraval } from "./helpers/spawn-cli.js";
import { join } from "path";
import { tmpdir } from "os";
import { rmSync, mkdirSync, mkdtempSync, writeFileSync, existsSync } from "fs";

describe("doraval CLI", () => {
  describe("help and version", () => {
    test("--help lists skill subcommands", () => {
      const { exitCode, stdout } = runDoraval(["--help"]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("skill");
      expect(stdout).toMatch(/validate|drift|judge/);
    });

    test("--version prints package version", () => {
      const { exitCode, stdout, stderr } = runDoraval(["--version"]);
      const output = stdout + stderr;
      expect(exitCode).toBe(0);
      expect(output).toContain(pkg.version);
    });

    test("skill --help lists subcommands", () => {
      const { exitCode, stdout } = runDoraval(["skill", "--help"]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("validate");
      expect(stdout).toContain("drift");
      expect(stdout).toContain("judge");
    });
  });

  describe("skill validate", () => {
    test("passes minimal-good fixture with JSON on stdout", () => {
      const skillDir = fixturePath("minimal-good");
      const { exitCode, stdout, stderr } = runDoraval([
        "skill",
        "validate",
        skillDir,
        "--format",
        "json",
      ]);

      expect(exitCode).toBe(0);
      expect(stderr).toBe("");
      const result = JSON.parse(stdout);
      expect(result.errors).toEqual([]);
      expect(result.passes.some((p: any) => p.text === 'name: "minimal-good"')).toBe(true);
    });

    test("reports missing name as warning and exits 0", () => {
      const skillDir = fixturePath("missing-name");
      const { exitCode, stdout } = runDoraval([
        "skill",
        "validate",
        skillDir,
        "--format",
        "json",
      ]);

      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.errors).toEqual([]);
      expect(result.warnings.some((w: any) => w.text.includes("name"))).toBe(true);
    });

    test("exits 1 for invalid YAML frontmatter", () => {
      const skillDir = fixturePath("bad-frontmatter");
      const { exitCode, stderr } = runDoraval([
        "skill",
        "validate",
        skillDir,
      ]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Failed to parse YAML frontmatter in SKILL.md");
      expect(stderr).toContain("Fix the YAML syntax");
    });

    test("exits 1 for missing path", () => {
      const { exitCode, stderr } = runDoraval([
        "skill",
        "validate",
        "/nonexistent/doraval-test-path",
      ]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("E-VAL-001");
      expect(stderr).toContain("Path not found");
    });

    test("table mode writes diagnostics to stderr only", () => {
      const skillDir = fixturePath("minimal-good");
      const { exitCode, stdout, stderr } = runDoraval([
        "skill",
        "validate",
        skillDir,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toBe("");
      expect(stderr).toContain("Structural validation");
      expect(stderr).toContain("minimal-good");
      expect(stderr).toContain("Next:");
      expect(stderr).toContain("passed");
    });

    test("validates CRLF fixture on disk", () => {
      const skillDir = fixturePath("crlf-lines");
      const { exitCode, stdout } = runDoraval([
        "skill",
        "validate",
        skillDir,
        "--format",
        "json",
      ]);

      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.errors).toEqual([]);
      expect(result.passes.some((p: any) => p.text === 'name: "crlf-lines"')).toBe(true);
    });
  });

  describe("skill drift", () => {
    test("session-grounded json output includes skill and session fields", () => {
      const skillDir = fixturePath("minimal-good");
      const { exitCode, stdout } = runDoraval([
        "skill",
        "drift",
        skillDir,
        "--format",
        "json",
      ]);

      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      // New session-grounded format — old regex fields are gone
      expect(result).toHaveProperty("skill");
      expect(result).toHaveProperty("sessionsChecked");
      expect(result).toHaveProperty("sessionsMatched");
      expect(result).toHaveProperty("results");
      expect(Array.isArray(result.results)).toBe(true);
    });

    test("exits 0 when no sessions matched (no coding agent history)", () => {
      // In CI / test environment there's no agent session history, so no sessions match.
      const skillDir = fixturePath("minimal-good");
      const { exitCode } = runDoraval([
        "skill",
        "drift",
        skillDir,
        "--format",
        "json",
      ]);

      // Should always exit 0 when no drift found (0 DRIFTED items)
      expect(exitCode).toBe(0);
    });

    test("exits 0 without --ci and no drift detected", () => {
      const skillDir = fixturePath("minimal-good");
      const { exitCode } = runDoraval([
        "skill",
        "drift",
        skillDir,
        "--format",
        "json",
        "--ci",
      ]);

      // No sessions matched → no DRIFTED items → exit 0 even with --ci
      expect(exitCode).toBe(0);
    });

    test("table mode writes drift output to stderr only", () => {
      const skillDir = fixturePath("minimal-good");
      const { exitCode, stdout, stderr } = runDoraval([
        "skill",
        "drift",
        skillDir,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toBe("");
      expect(stderr).toContain("session-grounded behavioral analysis");
    });
  });

  describe("skill judge", () => {
    test("exits non-zero when no API key configured (session-free rubric mode)", () => {
      const skillDir = fixturePath("minimal-good");
      const { exitCode, stdout, stderr } = runDoraval(
        ["skill", "judge", skillDir],
        { env: { DORAVAL_HOME: "/tmp/doraval-test-no-config" } },
      );

      // judge is session-free; it exits non-zero on failure (no sessions required)
      expect(exitCode).toBe(1);
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
