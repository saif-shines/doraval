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
      expect(stdout).toContain("skill");
      expect(stdout).toContain("npx skills add saif-shines/doraval");
      expect(stdout).toContain("dora review --quick");
      expect(stdout).toContain("https://doraval.dev");
      // Root COMMANDS blurbs stay short (detail lives on subcommand --help).
      expect(stdout).not.toContain("skill = reusable SKILL.md");
      expect(stdout).not.toContain("common: eval.model");
    });

    test("review --help shows examples and exit codes", () => {
      const { exitCode, stdout } = runDoraval(["review", "--help"]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("dora review --quick");
      expect(stdout).toMatch(/0.*clean/);
      expect(stdout).toMatch(/1.*issues/);
      expect(stdout).toMatch(/2.*could not run/);
    });

    test("fix --help shows dry-run then yes", () => {
      const { exitCode, stdout } = runDoraval(["fix", "--help"]);
      expect(exitCode).toBe(0);
      const dry = stdout.indexOf("--dry-run");
      const yes = stdout.indexOf("--yes");
      expect(dry).toBeGreaterThan(-1);
      expect(yes).toBeGreaterThan(dry);
    });

    test("scan --help shows bare dora and json/yes", () => {
      const { exitCode, stdout } = runDoraval(["scan", "--help"]);
      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/\bdora\b/);
      expect(stdout).toContain("--json");
      expect(stdout).toContain("--yes");
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

    test("review --json is an alias for --format json", () => {
      const dir = emptyRepo();
      const viaFlag = runDoraval(["review", "--quick", "--json", "--cwd", dir]);
      const viaFormat = runDoraval(["review", "--quick", "--format", "json", "--cwd", dir]);
      expect(viaFlag.exitCode).toBe(viaFormat.exitCode);
      expect(JSON.parse(viaFlag.stdout)).toEqual(JSON.parse(viaFormat.stdout));
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
    test("old skill validate is gone", () => {
      const { exitCode, stdout, stderr } = runDoraval(["skill", "validate", "."]);
      expect(exitCode).not.toBe(0);
      expect(stdout + stderr).toContain("Unknown command validate");
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
    test("unknown command is one line plus Next, no help dump", () => {
      const { exitCode, stdout, stderr } = runDoraval(["nosuch"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Unknown command: nosuch");
      expect(stderr).toContain("Next: dora --help");
      expect(stdout).not.toContain("USAGE");
      expect(stdout).not.toContain("COMMANDS");
      expect(stderr).not.toContain("USAGE");
    });

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

  describe("dora agent-help", () => {
    test("lists every verb with a read-only or writes label", () => {
      const { exitCode, stdout, stderr } = runDoraval(["agent-help"]);
      const out = stdout + stderr;
      expect(exitCode).toBe(0);
      expect(out).toContain("review");
      expect(out).toContain("fix");
      expect(out).toContain("read-only");
      expect(out).toContain("writes");
      expect(out).toContain("dora review --quick");
    });

    test("lists skill as writes", () => {
      const { exitCode, stdout, stderr } = runDoraval(["agent-help"]);
      const out = stdout + stderr;
      expect(exitCode).toBe(0);
      expect(out).toMatch(/skill\s+writes/);
    });

    test("--json is the same tree", () => {
      const { exitCode, stdout } = runDoraval(["agent-help", "--json"]);
      expect(exitCode).toBe(0);
      const m = JSON.parse(stdout);
      expect(m.commands.some((c: { name: string; label: string }) => c.name === "review" && c.label === "read-only")).toBe(true);
      expect(m.commands.some((c: { name: string; label: string }) => c.name === "fix" && c.label === "writes")).toBe(true);
      expect(m.commands.find((c: { name: string }) => c.name === "scan").examples.length).toBeGreaterThan(0);
    });

    test("agent-help review drills into one verb", () => {
      const { exitCode, stdout, stderr } = runDoraval(["agent-help", "review"]);
      const out = stdout + stderr;
      expect(exitCode).toBe(0);
      expect(out).toContain("review");
      expect(out).toContain("read-only");
      expect(out).toContain("--quick");
    });

    test("unknown name exits 1 with Next", () => {
      const { exitCode, stderr } = runDoraval(["agent-help", "nosuch"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Next: dora agent-help");
    });
  });

  describe("dora skill remove", () => {
    function authoredRepo(name = "ghost"): string {
      const dir = mkdtempSync(join(tmpdir(), "dora-skill-rm-"));
      mkdirSync(join(dir, ".git"));
      const skill = join(dir, ".claude", "skills", name);
      mkdirSync(skill, { recursive: true });
      writeFileSync(
        join(skill, "SKILL.md"),
        `---\nname: ${name}\ndescription: "Use when testing remove"\n---\n\n1. Do the thing\n`,
      );
      return dir;
    }

    test("skill --help and skill remove --help exist", () => {
      const group = runDoraval(["skill", "--help"]);
      expect(group.exitCode).toBe(0);
      expect(group.stdout + group.stderr).toContain("remove");
      expect(group.stdout + group.stderr).toContain("restore");
      const help = runDoraval(["skill", "remove", "--help"]);
      expect(help.exitCode).toBe(0);
      expect(help.stdout).toContain("--dry-run");
      expect(help.stdout).toContain("--yes");
      expect(help.stdout).toContain("--global");
    });

    test("--yes deletes a unique Authored Skill", () => {
      const dir = authoredRepo();
      const skill = join(dir, ".claude", "skills", "ghost");
      const { exitCode } = runDoraval(["skill", "remove", "ghost", "--yes", "--cwd", dir], { env: { CI: "1", HOME: dir } });
      expect(exitCode).toBe(0);
      expect(existsSync(skill)).toBe(false);
      rmSync(dir, { recursive: true, force: true });
    });

    test("--dry-run writes nothing", () => {
      const dir = authoredRepo();
      const skill = join(dir, ".claude", "skills", "ghost");
      const { exitCode, stdout, stderr } = runDoraval(
        ["skill", "remove", "ghost", "--dry-run", "--cwd", dir],
        { env: { CI: "1", HOME: dir } },
      );
      expect(exitCode).toBe(0);
      expect(existsSync(skill)).toBe(true);
      expect(stdout + stderr).toMatch(/Would delete|dry-run|ghost/i);
      rmSync(dir, { recursive: true, force: true });
    });

    test("detected agent without --yes or --dry-run exits 2 and writes nothing", () => {
      const dir = authoredRepo();
      const skill = join(dir, ".claude", "skills", "ghost");
      const { exitCode, stderr } = runDoraval(["skill", "remove", "ghost", "--cwd", dir], { env: { CI: "1", HOME: dir } });
      expect(exitCode).toBe(2);
      expect(stderr).toContain("Next:");
      expect(stderr).toContain("--dry-run");
      expect(existsSync(skill)).toBe(true);
      rmSync(dir, { recursive: true, force: true });
    });

    test("unknown name exits 1 with Next", () => {
      const dir = authoredRepo();
      const { exitCode, stderr } = runDoraval(
        ["skill", "remove", "nosuch", "--yes", "--cwd", dir],
        { env: { CI: "1", HOME: dir } },
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Next: dora skill remove");
      rmSync(dir, { recursive: true, force: true });
    });

    test("--for claude deletes only the Claude copy", () => {
      const dir = authoredRepo();
      const grok = join(dir, ".grok", "skills", "ghost");
      mkdirSync(grok, { recursive: true });
      writeFileSync(join(grok, "SKILL.md"), `---\nname: ghost\ndescription: "Use when grok"\n---\n\n1. Go\n`);
      const { exitCode } = runDoraval(
        ["skill", "remove", "ghost", "--for", "claude", "--yes", "--cwd", dir],
        { env: { CI: "1", HOME: dir } },
      );
      expect(exitCode).toBe(0);
      expect(existsSync(join(dir, ".claude", "skills", "ghost"))).toBe(false);
      expect(existsSync(grok)).toBe(true);
      rmSync(dir, { recursive: true, force: true });
    });

    test("ambiguous name does not delete", () => {
      const dir = authoredRepo();
      const grok = join(dir, ".grok", "skills", "ghost");
      mkdirSync(grok, { recursive: true });
      writeFileSync(join(grok, "SKILL.md"), `---\nname: ghost\ndescription: "Use when grok"\n---\n\n1. Go\n`);
      const { exitCode, stderr } = runDoraval(
        ["skill", "remove", "ghost", "--yes", "--cwd", dir],
        { env: { CI: "1", HOME: dir } },
      );
      expect(exitCode).toBe(2);
      expect(stderr).toMatch(/more than one|ambiguous|--for/i);
      expect(existsSync(join(dir, ".claude", "skills", "ghost"))).toBe(true);
      expect(existsSync(grok)).toBe(true);
      rmSync(dir, { recursive: true, force: true });
    });

    test("--json dry-run emits a plan and writes nothing", () => {
      const dir = authoredRepo();
      const { exitCode, stdout } = runDoraval(
        ["skill", "remove", "ghost", "--dry-run", "--json", "--cwd", dir],
        { env: { CI: "1", HOME: dir } },
      );
      expect(exitCode).toBe(0);
      const body = JSON.parse(stdout);
      expect(body.applied).toBe(false);
      expect(body.plan.action).toBe("delete");
      expect(existsSync(join(dir, ".claude", "skills", "ghost"))).toBe(true);
      rmSync(dir, { recursive: true, force: true });
    });

    test("path argument selects that directory", () => {
      const dir = authoredRepo();
      const grok = join(dir, ".grok", "skills", "ghost");
      mkdirSync(grok, { recursive: true });
      writeFileSync(join(grok, "SKILL.md"), `---\nname: ghost\ndescription: "Use when grok"\n---\n\n1. Go\n`);
      const target = join(dir, ".claude", "skills", "ghost");
      const { exitCode } = runDoraval(
        ["skill", "remove", target, "--yes", "--cwd", dir],
        { env: { CI: "1", HOME: dir } },
      );
      expect(exitCode).toBe(0);
      expect(existsSync(target)).toBe(false);
      expect(existsSync(grok)).toBe(true);
      rmSync(dir, { recursive: true, force: true });
    });

    test("Authored + Global clash: Runner exits 2; --global picks home", () => {
      const dir = authoredRepo();
      const home = mkdtempSync(join(tmpdir(), "dora-home-"));
      const globalDir = join(home, ".claude", "skills", "ghost");
      mkdirSync(globalDir, { recursive: true });
      writeFileSync(join(globalDir, "SKILL.md"), `---\nname: ghost\ndescription: "Use when global"\n---\n\n1. Go\n`);
      const clash = runDoraval(
        ["skill", "remove", "ghost", "--yes", "--cwd", dir],
        { env: { CI: "1", HOME: home } },
      );
      expect(clash.exitCode).toBe(2);
      expect(clash.stderr).toMatch(/more than one|--for|--global/i);
      expect(existsSync(join(dir, ".claude", "skills", "ghost"))).toBe(true);
      expect(existsSync(globalDir)).toBe(true);
      const doraHome = mkdtempSync(join(tmpdir(), "dora-qh-"));
      const picked = runDoraval(
        ["skill", "remove", "ghost", "--global", "--yes", "--cwd", dir],
        { env: { CI: "1", HOME: home, DORAVAL_HOME: doraHome } },
      );
      expect(picked.exitCode).toBe(0);
      expect(existsSync(globalDir)).toBe(false);
      expect(existsSync(join(dir, ".claude", "skills", "ghost"))).toBe(true);
      rmSync(doraHome, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    });

    test("Global Remove Quarantines; restore puts it back", () => {
      const dir = authoredRepo("other");
      const home = mkdtempSync(join(tmpdir(), "dora-home-"));
      const doraHome = mkdtempSync(join(tmpdir(), "dora-qh-"));
      const globalDir = join(home, ".claude", "skills", "ghost");
      mkdirSync(globalDir, { recursive: true });
      writeFileSync(join(globalDir, "SKILL.md"), `---\nname: ghost\ndescription: "Use when global"\n---\n\n1. Go\n`);
      const env = { CI: "1", HOME: home, DORAVAL_HOME: doraHome };
      const rm = runDoraval(["skill", "remove", "ghost", "--yes", "--cwd", dir], { env });
      expect(rm.exitCode).toBe(0);
      expect(existsSync(globalDir)).toBe(false);
      expect(rm.stdout + rm.stderr).not.toMatch(/stash/i);
      const back = runDoraval(["skill", "restore", "ghost", "--yes"], { env });
      expect(back.exitCode).toBe(0);
      expect(existsSync(join(globalDir, "SKILL.md"))).toBe(true);
      rmSync(dir, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
      rmSync(doraHome, { recursive: true, force: true });
    });

    test("restore occupied path exits 1 and writes nothing extra", () => {
      const dir = authoredRepo("other");
      const home = mkdtempSync(join(tmpdir(), "dora-home-"));
      const doraHome = mkdtempSync(join(tmpdir(), "dora-qh-"));
      const globalDir = join(home, ".claude", "skills", "ghost");
      mkdirSync(globalDir, { recursive: true });
      writeFileSync(join(globalDir, "SKILL.md"), `---\nname: ghost\ndescription: "Use when global"\n---\n\n1. Go\n`);
      const env = { CI: "1", HOME: home, DORAVAL_HOME: doraHome };
      runDoraval(["skill", "remove", "ghost", "--yes", "--cwd", dir], { env });
      mkdirSync(globalDir, { recursive: true });
      writeFileSync(join(globalDir, "SKILL.md"), `---\nname: ghost\ndescription: "reinstalled"\n---\n\n1. Go\n`);
      const back = runDoraval(["skill", "restore", "ghost", "--yes"], { env });
      expect(back.exitCode).toBe(1);
      expect(back.stderr).toMatch(/occupied/i);
      rmSync(dir, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
      rmSync(doraHome, { recursive: true, force: true });
    });

    test("restore missing name does not claim success", () => {
      const doraHome = mkdtempSync(join(tmpdir(), "dora-qh-"));
      const { exitCode, stdout, stderr } = runDoraval(["skill", "restore", "nosuch", "--yes"], {
        env: { CI: "1", DORAVAL_HOME: doraHome },
      });
      expect(exitCode).toBe(1);
      expect(stdout + stderr).not.toMatch(/Restored/i);
      rmSync(doraHome, { recursive: true, force: true });
    });

    test("bare restore as Runner exits 2", () => {
      const { exitCode, stderr } = runDoraval(["skill", "restore"], { env: { CI: "1" } });
      expect(exitCode).toBe(2);
      expect(stderr).toContain("Next:");
    });

    test("restore without --yes or --dry-run as Runner exits 2", () => {
      const { exitCode, stderr } = runDoraval(["skill", "restore", "ghost"], { env: { CI: "1" } });
      expect(exitCode).toBe(2);
      expect(stderr).toContain("--dry-run");
    });

    test("imported Skill is refused", () => {
      const dir = mkdtempSync(join(tmpdir(), "dora-skill-imp-"));
      mkdirSync(join(dir, ".git"));
      const imp = join(dir, ".claude", "plugins", "cache", "pkg", "ghost");
      mkdirSync(imp, { recursive: true });
      writeFileSync(join(imp, "SKILL.md"), `---\nname: ghost\ndescription: "Use when imported"\n---\n\n1. Go\n`);
      const { exitCode, stderr } = runDoraval(
        ["skill", "remove", "ghost", "--yes", "--cwd", dir],
        { env: { CI: "1", HOME: dir } },
      );
      expect(exitCode).toBe(1);
      expect(stderr).toMatch(/Imported|refusing/i);
      expect(existsSync(imp)).toBe(true);
      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe("dora --capabilities", () => {
    test("is gone", () => {
      const { exitCode, stdout, stderr } = runDoraval(["--capabilities"]);
      expect(exitCode).not.toBe(0);
      expect(stdout + stderr).not.toMatch(/"commands"\s*:/);
    });
  });

  describe("dora fix exit contract", () => {
    function fixableSkillRepo(): string {
      const dir = mkdtempSync(join(tmpdir(), "dora-fix-"));
      mkdirSync(join(dir, ".git"));
      const skill = join(dir, ".claude", "skills", "noname");
      mkdirSync(skill, { recursive: true });
      // Missing "name" → mechanical add_field fix (derivable from dir name; other
      // missing fields have no safe auto-value and go to judgment instead)
      writeFileSync(
        join(skill, "SKILL.md"),
        '---\ndescription: does a thing\n---\n\n1. Use when testing. Run the thing.\n\nMUST do it. Example:\n```bash\necho ok\n```\n'
      );
      return dir;
    }

    test("detected agent without --yes or --dry-run exits 2 and writes nothing", () => {
      const dir = fixableSkillRepo();
      const { exitCode, stderr } = runDoraval(["fix", ".", "--cwd", dir], { env: { CI: "1" } });
      expect(exitCode).toBe(2);
      expect(stderr).toContain("Next:");
      expect(stderr).toContain("--dry-run");
      rmSync(dir, { recursive: true, force: true });
    });

    test("detected agent reconcile and promote also exit 2", () => {
      const dir = fixableSkillRepo();
      const rec = runDoraval(["reconcile", "--cwd", dir], { env: { CI: "1" } });
      expect(rec.exitCode).toBe(2);
      expect(rec.stderr).toContain("reconcile --dry-run");
      const pro = runDoraval(["memory", "promote", "--cwd", dir], { env: { CI: "1" } });
      expect(pro.exitCode).toBe(2);
      expect(pro.stderr).toContain("promote --dry-run");
      rmSync(dir, { recursive: true, force: true });
    });

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

  describe("dora review (workspace)", () => {
    test("bare review includes cwd Memory files", () => {
      const dir = mkdtempSync(join(tmpdir(), "dora-review-bare-"));
      mkdirSync(join(dir, ".git"));
      const skill = join(dir, ".claude", "skills", "solo");
      mkdirSync(skill, { recursive: true });
      writeFileSync(
        join(skill, "SKILL.md"),
        '---\nname: solo\ndescription: "Use when testing bare review"\n---\n\n1. Run it\n',
      );
      writeFileSync(join(dir, "AGENTS.md"), "# Project\n\nAlways write tests.\n");
      const { stdout } = runDoraval(["review", ".", "--quick", "--format", "json", "--cwd", dir]);
      const parsed = JSON.parse(stdout);
      const paths = parsed.map((r: { path: string }) => r.path);
      expect(paths.some((p: string) => p.endsWith("AGENTS.md"))).toBe(true);
      expect(paths.some((p: string) => p.endsWith("solo"))).toBe(true);
      rmSync(dir, { recursive: true, force: true });
    });

    test("json without --all reviews first 10 of a large set", () => {
      const dir = mkdtempSync(join(tmpdir(), "dora-review-cap-"));
      mkdirSync(join(dir, ".git"));
      for (let i = 0; i < 12; i++) {
        const skill = join(dir, ".claude", "skills", `s${String(i).padStart(2, "0")}`);
        mkdirSync(skill, { recursive: true });
        writeFileSync(
          join(skill, "SKILL.md"),
          `---\nname: s${String(i).padStart(2, "0")}\ndescription: "Use when testing review cap"\n---\n\n1. Run it\n`,
        );
      }
      const { stdout, stderr } = runDoraval(["review", ".", "--quick", "--format", "json", "--cwd", dir]);
      const parsed = JSON.parse(stdout);
      expect(parsed).toHaveLength(10);
      expect(stderr).toContain("first 10");
      expect(stderr).toContain("--all");
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
