import { describe, expect, test } from "bun:test";
import { classifySkillDir } from "./skill-classify.js";

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
