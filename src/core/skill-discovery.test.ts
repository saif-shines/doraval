import { describe, expect, test } from "bun:test";
import { resolve } from "path";
import { normalizeSkillPath, isSkillDir, findSkillDirs } from "./skill-discovery.js";

const fixtures = resolve(import.meta.dir, "../../test/fixtures");

describe("normalizeSkillPath", () => {
  test("strips a trailing SKILL.md to its directory", () => {
    expect(normalizeSkillPath("/a/b/my-skill/SKILL.md")).toBe("/a/b/my-skill");
  });

  test("leaves a directory path unchanged", () => {
    expect(normalizeSkillPath("/a/b/my-skill")).toBe("/a/b/my-skill");
  });
});

describe("isSkillDir", () => {
  test("true for a directory containing SKILL.md", () => {
    expect(isSkillDir(resolve(fixtures, "skills/minimal-good"))).toBe(true);
  });

  test("false for a directory without SKILL.md", () => {
    expect(isSkillDir(resolve(fixtures, "claude-md"))).toBe(false);
  });

  test("false for a nonexistent directory", () => {
    expect(isSkillDir(resolve(fixtures, "does-not-exist"))).toBe(false);
  });
});

describe("findSkillDirs", () => {
  const repo = resolve(fixtures, "agentskills-repo");

  test("finds skills nested under multiple subtrees", () => {
    const dirs = findSkillDirs(repo).map((d) => d.slice(repo.length + 1));
    expect(dirs.sort()).toEqual(["packages/x/skills/c", "skills/a", "skills/b"].sort());
  });

  test("a skill directory itself is returned as its own single result", () => {
    const dir = resolve(fixtures, "skills/minimal-good");
    expect(findSkillDirs(dir)).toEqual([resolve(dir)]);
  });

  test("does not descend into a skill's own supporting files", () => {
    // rich-modern has a references/ dir; ensure we don't misreport nested paths inside it
    const dir = resolve(fixtures, "skills/rich-modern");
    expect(findSkillDirs(dir)).toEqual([resolve(dir)]);
  });

  test("returns empty for a directory with no skills", () => {
    expect(findSkillDirs(resolve(fixtures, "claude-md"))).toEqual([]);
  });

  test("respects maxDepth", () => {
    // packages/x/skills/c is 3 levels deep from repo root; maxDepth 1 should miss it
    const dirs = findSkillDirs(repo, { maxDepth: 1 }).map((d) => d.slice(repo.length + 1));
    expect(dirs).not.toContain("packages/x/skills/c");
  });

  test("ignores node_modules and .git by default", async () => {
    const tmp = resolve(import.meta.dir, "../../test/tmp-discovery-ignore-test");
    try {
      await Bun.write(resolve(tmp, "node_modules/pkg/SKILL.md"), "---\nname: pkg\n---\nbody");
      await Bun.write(resolve(tmp, "real/SKILL.md"), "---\nname: real\n---\nbody");
      const dirs = findSkillDirs(tmp).map((d) => d.slice(tmp.length + 1));
      expect(dirs).toEqual(["real"]);
    } finally {
      await Bun.$`rm -rf ${tmp}`.quiet();
    }
  });
});
