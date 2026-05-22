import { describe, expect, test } from "bun:test";
import pkg from "../package.json" with { type: "json" };
import { fixturePath, runDoraval } from "./helpers/spawn-cli.js";

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
      expect(result.passes).toContain('name: "minimal-good"');
    });

    test("exits 1 for missing name", () => {
      const skillDir = fixturePath("missing-name");
      const { exitCode, stdout } = runDoraval([
        "skill",
        "validate",
        skillDir,
        "--format",
        "json",
      ]);

      expect(exitCode).toBe(1);
      const result = JSON.parse(stdout);
      expect(result.errors).toContain('Missing required field: "name"');
    });

    test("exits 1 for invalid YAML frontmatter", () => {
      const skillDir = fixturePath("bad-frontmatter");
      const { exitCode, stderr } = runDoraval([
        "skill",
        "validate",
        skillDir,
      ]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Failed to parse YAML frontmatter");
    });

    test("exits 1 for missing path", () => {
      const { exitCode, stderr } = runDoraval([
        "skill",
        "validate",
        "/nonexistent/doraval-test-path",
      ]);

      expect(exitCode).toBe(1);
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
      expect(result.passes).toContain('name: "crlf-lines"');
    });
  });

  describe("skill drift", () => {
    test("reports zero drift for minimal-good", () => {
      const skillDir = fixturePath("minimal-good");
      const { exitCode, stdout, stderr } = runDoraval([
        "skill",
        "drift",
        skillDir,
        "--format",
        "json",
      ]);

      expect(exitCode).toBe(0);
      expect(stderr).toBe("");
      const result = JSON.parse(stdout);
      expect(result.driftCount).toBe(0);
      expect(result.total).toBe(6);
    });

    test("exits 0 without --ci when drift exists", () => {
      const skillDir = fixturePath("drifted");
      const { exitCode, stdout } = runDoraval([
        "skill",
        "drift",
        skillDir,
        "--format",
        "json",
      ]);

      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.driftCount).toBeGreaterThan(0);
    });

    test("exits 1 with --ci when drift exists", () => {
      const skillDir = fixturePath("drifted");
      const { exitCode } = runDoraval([
        "skill",
        "drift",
        skillDir,
        "--format",
        "json",
        "--ci",
      ]);

      expect(exitCode).toBe(1);
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
      expect(stderr).toContain("Measuring rubric drift");
    });
  });

  describe("skill judge", () => {
    test("stub exits 2 with not-implemented message", () => {
      const skillDir = fixturePath("minimal-good");
      const { exitCode, stdout, stderr } = runDoraval([
        "skill",
        "judge",
        skillDir,
      ]);

      expect(exitCode).toBe(2);
      expect(stdout + stderr).toContain("Not yet implemented");
    });
  });
});
