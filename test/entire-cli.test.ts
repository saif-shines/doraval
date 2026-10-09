import { describe, expect, test } from "bun:test";
import { spawnSync } from "child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { delimiter, dirname, join } from "path";
import { runDoraval } from "./helpers/spawn-cli.js";

const NOTICE = "Entire is enabled. Dora will use it while it checks this repo.";
const PROMPT = "Add the settings page\nand keep this second line that is longer than one hundred and sixty characters so a cut would drop the tail of the sentence.";

function git(repo: string, args: string[], input?: string): string {
  const result = spawnSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    input,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  });
  if (result.status !== 0) throw new Error(`${args.join(" ")}\n${result.stderr}`);
  return (result.stdout ?? "").trim();
}

function fakeEntire(statusJson: string): string {
  const dir = mkdtempSync(join(tmpdir(), "dora-fake-entire-"));
  const bin = join(dir, "entire");
  writeFileSync(
    bin,
    [
      "#!/bin/sh",
      'if [ "$1" = "status" ]; then',
      `  printf '%s\\n' '${statusJson}'`,
      "  exit 0",
      "fi",
      'if [ "$1" = "search" ]; then',
      "  printf '%s\\n' 'found login'",
      "  exit 0",
      "fi",
      "echo bad command >&2",
      "exit 1",
      "",
    ].join("\n"),
  );
  chmodSync(bin, 0o755);
  return dir;
}

function pathWith(binDir: string | null): string {
  const bunDir = dirname(Bun.which("bun") ?? "");
  const kept = (process.env.PATH ?? "")
    .split(delimiter)
    .filter((dir) => dir && dir !== bunDir);
  const base = [bunDir, ...kept].filter(Boolean).join(delimiter);
  if (binDir) return `${binDir}${delimiter}${base}`;
  return base
    .split(delimiter)
    .filter((dir) => dir && !existsSync(join(dir, "entire")))
    .join(delimiter);
}

function repoWithPrompt(): string {
  const repo = mkdtempSync(join(tmpdir(), "dora-e2e-entire-"));
  const id = "01KVBJCWYA4YW6J5M9GP655HZN";
  for (const name of ["one", "two"]) {
    const skill = join(repo, name);
    mkdirSync(skill);
    writeFileSync(join(skill, "SKILL.md"), `---\nname: ${name}\ndescription: A test skill for fixture purposes\n---\n\n# ${name}\n`);
  }
  git(repo, ["init", "-b", "main"]);
  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", `add skills\n\nEntire-Checkpoint: ${id}`]);
  const blob = git(repo, ["hash-object", "-w", "--stdin"], PROMPT);
  const fileTree = git(repo, ["mktree"], `100644 blob ${blob}\tprompt.txt\n`);
  const sessionTree = git(repo, ["mktree"], `040000 tree ${fileTree}\t1\n`);
  const commit = git(repo, ["commit-tree", sessionTree, "-m", "checkpoint"]);
  git(repo, ["update-ref", `refs/entire/checkpoints/${id.slice(-2)}/${id}`, commit]);
  return repo;
}

function envFor(binDir: string | null, home: string): { PATH: string; HOME: string } {
  return { PATH: pathWith(binDir), HOME: home };
}

describe("dora search end to end", () => {
  test("empty query exits 2", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-e2e-home-"));
    const { exitCode, stderr } = runDoraval(["search"], { env: envFor(null, home) });
    expect(exitCode).toBe(2);
    expect(stderr).toContain("Pass the words to search for.");
  });

  test("a missing entire binary exits 2 and does not say Entire is off", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-e2e-home-"));
    const { exitCode, stdout, stderr } = runDoraval(["search", "login"], { env: envFor(null, home) });
    expect(exitCode).toBe(2);
    expect(stderr).toContain("entire is not installed");
    expect(stderr).not.toContain("Entire is not enabled");
    expect(stdout).toBe("");
  });

  test("Entire off exits 0 and prints nothing", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-e2e-home-"));
    const bin = fakeEntire('{"enabled":false}');
    const human = runDoraval(["search", "login"], { env: envFor(bin, home) });
    expect(human.exitCode).toBe(0);
    expect(human.stdout).toBe("");
    expect(human.stderr).not.toContain(NOTICE);
    const json = runDoraval(["search", "login", "--json"], { env: envFor(bin, home) });
    expect(json.exitCode).toBe(0);
    expect(JSON.parse(json.stdout)).toEqual({ enabled: false, query: "login", text: "" });
    expect(json.stderr).not.toContain(NOTICE);
  });

  test("Entire on prints the notice once and the search text", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-e2e-home-"));
    const bin = fakeEntire('{"enabled":true}');
    const { exitCode, stdout, stderr } = runDoraval(["search", "login"], { env: envFor(bin, home) });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("found login");
    expect(stderr.split(NOTICE).length - 1).toBe(1);
  });
});

describe("dora review and scan end to end", () => {
  test("review prints the notice once and the full prompt, including on a list", () => {
    const repo = repoWithPrompt();
    const home = mkdtempSync(join(tmpdir(), "dora-e2e-home-"));
    const bin = fakeEntire('{"enabled":true}');
    const env = envFor(bin, home);
    const one = runDoraval(["review", "--quick", "one", "--cwd", repo], { cwd: repo, env });
    expect(one.exitCode).toBe(0);
    expect(one.stderr.split(NOTICE).length - 1).toBe(1);
    expect(one.stderr).toContain("01KVBJCWYA4YW6J5M9GP655HZN");
    expect(one.stderr).toContain("and keep this second line");
    expect(one.stderr).toContain("one hundred and sixty characters");

    const list = runDoraval(["review", "--all", "--quick", "--cwd", repo], { cwd: repo, env });
    expect(list.stderr).toContain("Checkpoint  01KVBJCWYA4YW6J5M9GP655HZN");
    expect(list.stderr).toContain("and keep this second line");

    const json = runDoraval(["review", "--quick", "one", "--json", "--cwd", repo], { cwd: repo, env });
    expect(json.stderr).not.toContain(NOTICE);
    const rows = JSON.parse(json.stdout) as { checkpoint?: { id: string; prompt: string } }[];
    expect(rows[0]?.checkpoint).toEqual({
      id: "01KVBJCWYA4YW6J5M9GP655HZN",
      prompt: PROMPT.trim(),
    });
  });

  test("scan prints the notice once for a human and stays silent in JSON", () => {
    const repo = repoWithPrompt();
    const home = mkdtempSync(join(tmpdir(), "dora-e2e-home-"));
    const bin = fakeEntire('{"enabled":true}');
    const env = envFor(bin, home);
    const human = runDoraval(["scan", "--yes", "--cwd", repo], { cwd: repo, env });
    expect(human.stderr.split(NOTICE).length - 1).toBe(1);
    const json = runDoraval(["scan", "--yes", "--json", "--cwd", repo], { cwd: repo, env });
    expect(json.stderr).not.toContain(NOTICE);
  });

  test("review stays quiet when Entire is off", () => {
    const repo = repoWithPrompt();
    const home = mkdtempSync(join(tmpdir(), "dora-e2e-home-"));
    const bin = fakeEntire('{"enabled":false}');
    const { stderr, stdout } = runDoraval(["review", "--quick", "one", "--json", "--cwd", repo], {
      cwd: repo,
      env: envFor(bin, home),
    });
    expect(stderr).not.toContain(NOTICE);
    const rows = JSON.parse(stdout) as { checkpoint?: unknown }[];
    expect(rows[0]?.checkpoint).toBeUndefined();
  });
});
