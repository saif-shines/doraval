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
      expect(stdout).toContain("Primary:");
      expect(stdout).toContain("point a coding agent");
      expect(stdout).toContain("https://doraval.thehacksmith.dev");
      // Root COMMANDS blurbs stay short (detail lives on subcommand --help).
      expect(stdout).not.toContain("skill = reusable SKILL.md");
      expect(stdout).not.toContain("common: eval.model");
    });

    test("--version prints package version", () => {
      const { exitCode, stdout, stderr } = runDoraval(["--version"]);
      const output = stdout + stderr;
      expect(exitCode).toBe(0);
      expect(output).toContain(pkg.version);
    });


  });

  test("dora new skill --for claude --yes scaffolds standalone", () => {
    const tmp = join(import.meta.dir, "../../tmp-dora-new-skill-test");
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });

    const { exitCode, stdout, stderr } = runDoraval(
      ["new", "skill", "review-pr", "--for", "claude", "--intent", "self", "--yes", "--description", "Reviews PRs"],
      { cwd: tmp },
    );

    expect(exitCode).toBe(0);
    expect(stdout + stderr).toContain("skill");
    expect(existsSync(join(tmp, ".claude", "skills", "review-pr", "SKILL.md"))).toBe(true);

    rmSync(tmp, { recursive: true, force: true });
  });

  test("dora new rule --for cursor --yes writes .cursor/rules", () => {
    const tmp = join(import.meta.dir, "../../tmp-dora-new-rule-test");
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });

    const { exitCode } = runDoraval(
      ["new", "rule", "no-defaults", "--for", "cursor", "--yes", "--description", "Never use default exports"],
      { cwd: tmp },
    );

    expect(exitCode).toBe(0);
    expect(existsSync(join(tmp, ".cursor", "rules", "no-defaults.md"))).toBe(true);

    rmSync(tmp, { recursive: true, force: true });
  });

  test("dora new agent --for claude --yes writes subagent file", () => {
    const tmp = join(import.meta.dir, "../../tmp-dora-new-agent-test");
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });

    const { exitCode } = runDoraval(
      ["new", "agent", "explorer", "--for", "claude", "--yes", "--description", "Explores code"],
      { cwd: tmp },
    );

    expect(exitCode).toBe(0);
    expect(existsSync(join(tmp, ".claude", "agents", "explorer.md"))).toBe(true);

    rmSync(tmp, { recursive: true, force: true });
  });

  test("dora new plugin --for codex --yes scaffolds plugin packaging", () => {
    const tmp = join(import.meta.dir, "../../tmp-dora-new-plugin-test");
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });

    const { exitCode } = runDoraval(
      ["new", "plugin", "ship-it", "--for", "codex", "--yes", "--description", "Ship it"],
      { cwd: tmp },
    );

    expect(exitCode).toBe(0);
    expect(existsSync(join(tmp, "ship-it", ".codex-plugin", "plugin.json"))).toBe(true);
    expect(existsSync(join(tmp, "ship-it", "skills", "doraval", "SKILL.md"))).toBe(true);

    rmSync(tmp, { recursive: true, force: true });
  });

  test("dora providers is packaging/spec reference (not repo support)", () => {
    const { exitCode, stdout, stderr } = runDoraval(["providers"]);
    const out = stdout + stderr;
    expect(exitCode).toBe(0);
    expect(out).toMatch(/packaging\/spec/i);
    expect(out).toContain("dora");
    expect(out).toMatch(/claude/i);
  });

  test("unknown provider group is rejected (Q2: wrappers removed)", () => {
    const { exitCode, stdout, stderr } = runDoraval(["claude", "new", "--yes"]);
    const out = stdout + stderr;
    expect(exitCode).not.toBe(0);
    expect(out.toLowerCase()).toMatch(/unknown|invalid|not found|usage|command/i);
  });

  test("--completion zsh prints a script; completion subcommand is gone", () => {
    const flag = runDoraval(["--completion", "zsh"]);
    expect(flag.exitCode).toBe(0);
    expect(flag.stdout).toContain("compdef");
    expect(flag.stdout).toContain("doraval");

    const gone = runDoraval(["completion", "zsh"]);
    expect(gone.exitCode).not.toBe(0);
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

    test("journal group is gone (memory is the only path)", () => {
      const { exitCode, stdout, stderr } = runDoraval(["journal"]);
      expect(exitCode).not.toBe(0);
      expect((stdout + stderr).toLowerCase()).toContain("unknown command");
      // Root help must not list journal as a command either.
      const help = runDoraval(["--help"]);
      expect(help.stdout + help.stderr).not.toMatch(/\bjournal\b/);
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

  describe("dora fix exit contract", () => {
    function fixableSkillRepo(): string {
      const dir = mkdtempSync(join(tmpdir(), "dora-fix-"));
      mkdirSync(join(dir, ".git"));
      const skill = join(dir, ".claude", "skills", "nodesc");
      mkdirSync(skill, { recursive: true });
      // Missing "description" → mechanical add_field fix
      writeFileSync(
        join(skill, "SKILL.md"),
        '---\nname: nodesc\n---\n\n1. Use when testing. Run the thing.\n\nMUST do it. Example:\n```bash\necho ok\n```\n'
      );
      return dir;
    }

    test("--dry-run with outstanding mechanical fixes exits 1, not 0", () => {
      const dir = fixableSkillRepo();
      const { exitCode, stdout } = runDoraval(
        ["fix", ".", "--dry-run", "--format", "json", "--cwd", dir]
      );
      const parsed = JSON.parse(stdout);
      expect(parsed.mechanical).toBeGreaterThan(0);
      expect(parsed.applied).toBe(0);
      expect(exitCode).toBe(1); // issues present but not applied
      rmSync(dir, { recursive: true, force: true });
    });

    test("--yes applies fixes and exits 0 when nothing remains", () => {
      const dir = fixableSkillRepo();
      const { exitCode, stdout } = runDoraval(
        ["fix", ".", "--yes", "--format", "json", "--cwd", dir]
      );
      const parsed = JSON.parse(stdout);
      expect(parsed.applied).toBe(parsed.mechanical);
      if (parsed.judgment.length === 0) expect(exitCode).toBe(0);
      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe("dora fix --brief multi-skill", () => {
    test("brief attributes issues per skill and never reads a nonexistent root SKILL.md", () => {
      const dir = mkdtempSync(join(tmpdir(), "dora-brief-"));
      mkdirSync(join(dir, ".git"));
      for (const name of ["alpha", "beta"]) {
        const skill = join(dir, ".claude", "skills", name);
        mkdirSync(skill, { recursive: true });
        // Passive voice + no trigger phrases → judgment (content) findings
        writeFileSync(
          join(skill, "SKILL.md"),
          `---\nname: ${name}\ndescription: "some things could maybe be done"\n---\n\nIt might be considered that things could be handled.\n`
        );
      }
      const { stdout, stderr } = runDoraval(["fix", ".", "--brief", "--cwd", dir]);
      const out = stdout + stderr;
      // Each skill gets its own attributed section with its own content
      expect(out).toContain("alpha");
      expect(out).toContain("beta");
      expect(out).not.toContain("## Current SKILL.md\n```markdown\n\n```"); // no empty root read
      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe("dora review JSON shape", () => {
    test("top-level JSON is always an array, regardless of skill count", () => {
      const dir = mkdtempSync(join(tmpdir(), "dora-shape-"));
      mkdirSync(join(dir, ".git"));
      const skill = join(dir, ".claude", "skills", "solo");
      mkdirSync(skill, { recursive: true });
      writeFileSync(
        join(skill, "SKILL.md"),
        '---\nname: solo\ndescription: "Use when testing shapes"\n---\n\n1. Run it\n'
      );
      const { stdout } = runDoraval(["review", ".", "--quick", "--format", "json", "--cwd", dir]);
      const parsed = JSON.parse(stdout);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe("dora review <memory-file>", () => {
    test("reviews CLAUDE.md directly, not as a skill directory scan", () => {
      const dir = mkdtempSync(join(tmpdir(), "dora-memfile-"));
      writeFileSync(join(dir, "CLAUDE.md"), "# Instructions\n\n@missing.md\n");
      const { stdout, exitCode } = runDoraval(
        ["review", "CLAUDE.md", "--quick", "--format", "json", "--cwd", dir]
      );
      const results = JSON.parse(stdout);
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(1);
      expect(results[0].tiers.structure.errors).toBeGreaterThan(0);
      expect(results[0].tiers.structure.findings.some((f: any) => f.message.includes("missing.md"))).toBe(true);
      expect(exitCode).toBe(1);
      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe("dora sessions", () => {
    test("lists sessions from an injected-free real run (no adapters detected in a scratch dir is fine — just must not crash)", () => {
      const dir = mkdtempSync(join(tmpdir(), "dora-sessions-"));
      const { stdout, exitCode } = runDoraval(["sessions", "--format", "json"], { cwd: dir });
      const parsed = JSON.parse(stdout);
      expect(Array.isArray(parsed)).toBe(true);
      expect(exitCode).toBe(0);
      rmSync(dir, { recursive: true, force: true });
    });

    test("unknown --agent name gets an empty list, not a crash", () => {
      const dir = mkdtempSync(join(tmpdir(), "dora-sessions-"));
      const { stdout, exitCode } = runDoraval(["sessions", "--agent", "codex", "--format", "json"], { cwd: dir });
      const parsed = JSON.parse(stdout);
      expect(parsed).toEqual([]);
      expect(exitCode).toBe(0);
      rmSync(dir, { recursive: true, force: true });
    });

    test("show with an id that doesn't exist exits 1", () => {
      const dir = mkdtempSync(join(tmpdir(), "dora-sessions-"));
      const { exitCode } = runDoraval(["sessions", "show", "no-such-session-id"], { cwd: dir });
      expect(exitCode).toBe(1);
      rmSync(dir, { recursive: true, force: true });
    });

    test("sessions --help does not accidentally run show", () => {
      const { stdout, stderr, exitCode } = runDoraval(["sessions", "--help"]);
      expect(exitCode).toBe(0);
      expect((stdout + stderr)).toContain("show");
    });
  });
});
