import { describe, expect, test, beforeEach } from "bun:test";
import { detectContext } from "./context.js";
import { decidePath } from "./new.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const tmp = join(import.meta.dir, "tmp-context-test");

describe("claude context detection", () => {
  beforeEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
  });

  test("detects empty directory", () => {
    const ctx = detectContext(tmp);
    expect(ctx.hasClaudeDir).toBe(false);
    expect(ctx.hasPluginManifest).toBe(false);
    expect(ctx.looseSkillFiles.length).toBe(0);
    expect(ctx.isEmpty).toBe(true);
  });

  test("detects loose SKILL.md", () => {
    writeFileSync(join(tmp, "my-skill.md"), "---\nname: test\n---\nBody");
    const ctx = detectContext(tmp);
    expect(ctx.looseSkillFiles.length).toBe(1);
    expect(ctx.looseSkillFiles[0]).toContain("my-skill.md");
  });

  // Add more tests for .claude/, .claude-plugin/, etc. in next steps if needed

  test("detects loose SKILL.md and no formal structure", () => {
    writeFileSync(join(tmp, "foo-skill.md"), "---\nname: foo\n---\ncontent");
    const ctx = detectContext(tmp);
    expect(ctx.looseSkillFiles.length).toBe(1);
    expect(ctx.hasClaudeDir).toBe(false);
    expect(ctx.hasPluginManifest).toBe(false);
  });

  test("decides plugin sibling for loose SKILL + self-later", () => {
    const ctx = {
      cwd: "/tmp",
      hasPluginManifest: false,
      hasAgentDir: false,
      looseSkillFiles: ["/tmp/foo.md"],
      isEmpty: false,
      agentSurfaceCount: 0,
      hasAgentsMd: false,
      hasClaudeMd: false,
      hasCursorRules: false,
      hasCopilotInstructions: false,
    };
    const d = decidePath({
      type: "skill",
      provider: "claude",
      intent: "self-later",
      name: "my-helper",
      cwd: "/tmp",
      ctx,
    });
    expect(d.path).toBe("plugin");
    expect(d.targetDir).toContain("my-helper");
    expect(d.migrateExisting).toBe(true);
  });
});
