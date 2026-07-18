import { describe, expect, test } from "bun:test";
import { detectSkillShadows, skillLeafName, shadowWarningText } from "./skill-shadow.js";

describe("detectSkillShadows", () => {
  test("empty when names unique", () => {
    expect(detectSkillShadows([".claude/skills/a", ".grok/skills/b"])).toEqual([]);
  });

  test("orders Grok path first for shared name", () => {
    const s = detectSkillShadows([".claude/skills/review", ".grok/skills/review", ".agents/skills/review"]);
    expect(s).toHaveLength(1);
    expect(s[0]!.name).toBe("review");
    expect(s[0]!.paths).toEqual([
      ".grok/skills/review",
      ".agents/skills/review",
      ".claude/skills/review",
    ]);
  });

  test("skillLeafName is basename", () => {
    expect(skillLeafName(".grok/skills/deploy")).toBe("deploy");
  });

  test("warning names winner for shadowed path", () => {
    const shadow = { name: "x", paths: [".grok/skills/x", ".claude/skills/x"] };
    expect(shadowWarningText(shadow, ".claude/skills/x")).toContain("Grok prefers .grok/skills/x");
    expect(shadowWarningText(shadow, ".grok/skills/x")).toContain("prefers this path");
  });
});
