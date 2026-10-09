import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";
import { review } from "./review.js";
import { entireEnabled, ENTIRE_ENABLED_NOTICE, promptInvokesSkill, readCheckpoint, searchPastWork } from "./entire.js";

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

function repoWithCheckpoint(id: string, prompt: string | null): { repo: string; skill: string } {
  const repo = mkdtempSync(join(tmpdir(), "dora-entire-"));
  const skill = join(repo, "my-skill");
  mkdirSync(skill);
  writeFileSync(join(skill, "SKILL.md"), "---\nname: my-skill\ndescription: A test skill for fixture purposes\n---\n\n# My Skill\n");
  git(repo, ["init", "-b", "main"]);
  git(repo, ["add", "my-skill"]);
  git(repo, ["commit", "-m", `add skill\n\nEntire-Checkpoint: ${id}`]);
  if (prompt != null) {
    const blob = git(repo, ["hash-object", "-w", "--stdin"], prompt);
    const tree = git(repo, ["mktree"], `100644 blob ${blob}\tprompt.txt\n`);
    const root = git(repo, ["mktree"], `040000 tree ${tree}\t1\n`);
    const commit = git(repo, ["commit-tree", root, "-m", "checkpoint"]);
    git(repo, ["update-ref", `refs/entire/checkpoints/${id.slice(-2)}/${id}`, commit]);
  }
  return { repo, skill };
}

describe("readCheckpoint", () => {
  test("review returns the prompt that wrote the skill", async () => {
    const id = "01KVBJCWYA4YW6J5M9GP655HZN";
    const { repo, skill } = repoWithCheckpoint(id, "Add the settings page\n");
    const hit = readCheckpoint(repo, "my-skill");
    expect(hit).toEqual({ id, prompt: "Add the settings page" });
    const results = await review(skill, { cwd: repo, quick: true, entireEnabled: true });
    const row = results.find((item) => item.path === skill);
    expect(row?.checkpoint).toEqual({ id, prompt: "Add the settings page" });
  });

  test("review skips the prompt when Entire is not enabled", async () => {
    const { repo, skill } = repoWithCheckpoint("01KVBJCWYA4YW6J5M9GP655HZN", "Add the settings page\n");
    const results = await review(skill, { cwd: repo, quick: true, entireEnabled: false });
    const row = results.find((item) => item.path === skill);
    expect(row?.checkpoint).toBeUndefined();
  });

  test("a commit with no trailer has no checkpoint", () => {
    const repo = mkdtempSync(join(tmpdir(), "dora-entire-none-"));
    writeFileSync(join(repo, "note.txt"), "hello\n");
    git(repo, ["init", "-b", "main"]);
    git(repo, ["add", "note.txt"]);
    git(repo, ["commit", "-m", "add note"]);
    expect(readCheckpoint(repo, "note.txt")).toBeNull();
  });

  test("a trailer with no stored prompt still returns the id", () => {
    const { repo } = repoWithCheckpoint("01KVBJCWYA4YW6J5M9GP655HZN", null);
    expect(readCheckpoint(repo, "my-skill")).toEqual({
      id: "01KVBJCWYA4YW6J5M9GP655HZN",
      prompt: null,
    });
  });
});

describe("promptInvokesSkill", () => {
  test("a slash command in the prompt counts", () => {
    expect(promptInvokesSkill("please run /my-skill now", "my-skill")).toBe(true);
  });

  test("a different skill name does not count", () => {
    expect(promptInvokesSkill("please run /review-pr", "review")).toBe(false);
  });
});

describe("entireEnabled", () => {
  test("true when Entire reports enabled", () => {
    const on = entireEnabled("/tmp", () => ({ status: 0, stdout: "{\"enabled\":true}\n", stderr: "" }));
    expect(on).toBe(true);
  });

  test("false when Entire is off or missing", () => {
    expect(entireEnabled("/tmp", () => ({ status: 0, stdout: "{\"enabled\":false}", stderr: "" }))).toBe(false);
    expect(entireEnabled("/tmp", () => ({ status: null, stdout: "", stderr: "", code: "ENOENT" }))).toBe(false);
  });

  test("the notice names Entire and the check", () => {
    expect(ENTIRE_ENABLED_NOTICE).toBe("Entire is enabled. Dora will use it while it checks this repo.");
  });
});

describe("searchPastWork", () => {
  test("returns Entire's text when the command succeeds", () => {
    const hit = searchPastWork("login", "/tmp", () => ({ status: 0, stdout: "found login\n", stderr: "" }));
    expect(hit).toEqual({ ok: true, text: "found login\n" });
  });

  test("says Entire is missing when the command is not installed", () => {
    const hit = searchPastWork("login", "/tmp", () => ({ status: null, stdout: "", stderr: "", code: "ENOENT" }));
    expect(hit.ok).toBe(false);
    if (!hit.ok) expect(hit.message).toBe("entire is not installed");
  });
});
