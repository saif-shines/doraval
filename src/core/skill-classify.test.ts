import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { classifySkillDir, isPluginOwned, pluginRoot } from "./skill-classify.js";

const cwd = "/repo/my-app";
const home = "/Users/me";

describe("classifySkillDir", () => {
  test("skill inside the project is authored", () => {
    expect(classifySkillDir("/repo/my-app/.claude/skills/review", { cwd, home })).toBe("authored");
    expect(classifySkillDir("/repo/my-app/skills/deploy", { cwd, home })).toBe("authored");
  });

  test("node_modules and plugin cache are imported", () => {
    expect(
      classifySkillDir("/repo/my-app/node_modules/pkg/skills/x", { cwd, home })
    ).toBe("imported");
    expect(
      classifySkillDir("/Users/me/.claude/plugins/cache/some/skill", { cwd, home })
    ).toBe("imported");
  });

  test("home-level skills are global", () => {
    expect(classifySkillDir("/Users/me/.claude/skills/standup", { cwd, home })).toBe("global");
    expect(classifySkillDir("/Users/me/.cursor/rules", { cwd, home })).toBe("global");
  });

  test("anything else outside cwd defaults to global", () => {
    expect(classifySkillDir("/somewhere/else/skill", { cwd, home })).toBe("global");
  });
});

describe("isPluginOwned", () => {
  test("Skill under a directory with a Plugin manifest is Plugin-owned", () => {
    const root = mkdtempSync(join(tmpdir(), "dora-plug-"));
    const plug = join(root, "my-plug");
    const skill = join(plug, "skills", "ghost");
    mkdirSync(join(plug, ".claude-plugin"), { recursive: true });
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(plug, ".claude-plugin", "plugin.json"), "{}");
    writeFileSync(join(skill, "SKILL.md"), "---\nname: ghost\n---\n");
    try {
      expect(isPluginOwned(skill, root)).toBe(true);
      expect(pluginRoot(skill, root)).toBe(plug);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("Imported cache Skill is Imported, not Plugin-owned", () => {
    const root = mkdtempSync(join(tmpdir(), "dora-plug-"));
    const skill = join(root, "node_modules", "pkg", "skills", "x");
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, "SKILL.md"), "---\nname: x\n---\n");
    try {
      expect(classifySkillDir(skill, { cwd: root, home: "/Users/me" })).toBe("imported");
      expect(isPluginOwned(skill, root)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a Plugin manifest above stopAt does not own the Skill", () => {
    const root = mkdtempSync(join(tmpdir(), "dora-plug-"));
    mkdirSync(join(root, ".claude-plugin"), { recursive: true });
    writeFileSync(join(root, ".claude-plugin", "plugin.json"), "{}");
    const proj = join(root, "proj");
    const skill = join(proj, ".claude", "skills", "ghost");
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, "SKILL.md"), "---\nname: ghost\n---\n");
    try {
      expect(isPluginOwned(skill, proj)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("standalone Authored Skill is not Plugin-owned", () => {
    const root = mkdtempSync(join(tmpdir(), "dora-plug-"));
    const skill = join(root, ".claude", "skills", "ghost");
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, "SKILL.md"), "---\nname: ghost\n---\n");
    try {
      expect(isPluginOwned(skill, root)).toBe(false);
      expect(pluginRoot(skill, root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
