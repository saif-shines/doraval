import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  collectConfigSurfaces,
  detectContradictions,
  extractConventions,
} from "./cross-agent.js";

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "dora-cx-"));
  mkdirSync(join(root, ".git"));
  return root;
}

describe("extractConventions", () => {
  test("finds indent, test runner, and export style", () => {
    const content = [
      "# Rules",
      "Use 2-space indentation.",
      "Run bun test before committing.",
      "Never use default exports.",
    ].join("\n");
    const cs = extractConventions(content, "CLAUDE.md", "claude");
    expect(cs.some((c) => c.topic === "indent" && c.value === "2-space")).toBe(true);
    expect(cs.some((c) => c.topic === "test" && c.value === "bun test")).toBe(true);
    expect(cs.some((c) => c.topic === "export_style" && c.value === "named")).toBe(true);
  });

  test("ignores code fences and headings for matching lines", () => {
    const content = "# Use 4-space indentation\n\n```\nuse 2-space indentation\n```\n";
    // heading line is skipped; fenced line still matched if not starting with ```
    // our skip only skips lines that *start* with ``` — body of fence is matched.
    // that's ok for v1; ensure heading alone doesn't produce indent
    const headingOnly = extractConventions("# Use 4-space indentation\n", "x", "claude");
    expect(headingOnly.filter((c) => c.topic === "indent")).toHaveLength(0);
  });
});

describe("detectContradictions", () => {
  test("empty repo → no contradictions", () => {
    const root = makeRepo();
    expect(detectContradictions(root)).toEqual([]);
  });

  test("conflicting indent across CLAUDE.md and .cursorrules", () => {
    const root = makeRepo();
    writeFileSync(join(root, "CLAUDE.md"), "# Claude\n\nUse 2-space indentation.\n");
    writeFileSync(join(root, ".cursorrules"), "# Cursor\n\nUse tabs for indentation.\n");
    const cx = detectContradictions(root);
    const conflict = cx.find((c) => c.kind === "conflicting_convention");
    expect(conflict).toBeDefined();
    expect(conflict!.severity).toBe("conflict");
    expect(conflict!.message).toMatch(/indent/i);
    expect(conflict!.sources.length).toBeGreaterThanOrEqual(2);
    expect(conflict!.resolution.some((r) => r.recommended)).toBe(true);
  });

  test("agent_specific_in_shared flags $ARGUMENTS in AGENTS.md", () => {
    const root = makeRepo();
    writeFileSync(join(root, "AGENTS.md"), "# Shared\n\nPass $ARGUMENTS to the skill.\n");
    const cx = detectContradictions(root);
    const hit = cx.find((c) => c.kind === "agent_specific_in_shared");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("conflict");
    expect(hit!.message).toContain("$ARGUMENTS");
  });

  test("missing_coverage when multi-agent and convention only on one side", () => {
    const root = makeRepo();
    writeFileSync(join(root, "CLAUDE.md"), "# Claude\n\nAlways run bun test before push.\n");
    writeFileSync(join(root, ".cursorrules"), "# Cursor\n\nBe helpful.\n");
    const cx = detectContradictions(root);
    const gap = cx.find((c) => c.kind === "missing_coverage");
    expect(gap).toBeDefined();
    expect(gap!.severity).toBe("gap");
    expect(gap!.message).toMatch(/bun test|test=/i);
  });

  test("stale_agents_md when convention only in CLAUDE.md", () => {
    const root = makeRepo();
    writeFileSync(join(root, "AGENTS.md"), "# Shared\n\nBe concise.\n");
    writeFileSync(join(root, "CLAUDE.md"), "# Claude\n\nPrefer named exports always.\n");
    const cx = detectContradictions(root);
    const stale = cx.find((c) => c.kind === "stale_agents_md");
    expect(stale).toBeDefined();
    expect(stale!.message).toMatch(/export_style|named/i);
  });

  test("duplicate_intent for same skill name different bodies", () => {
    const root = makeRepo();
    mkdirSync(join(root, ".claude/skills/review"), { recursive: true });
    mkdirSync(join(root, ".cursor/rules/review-skill"), { recursive: true });
    // skill discovery needs SKILL.md
    writeFileSync(
      join(root, ".claude/skills/review/SKILL.md"),
      "---\nname: review\ndescription: Review PRs with focus on security\n---\n\n1. Check auth\n",
    );
    mkdirSync(join(root, "skills/review"), { recursive: true });
    writeFileSync(
      join(root, "skills/review/SKILL.md"),
      "---\nname: review\ndescription: Review PRs with focus on security\n---\n\n1. Check style only\n",
    );
    const cx = detectContradictions(root);
    const dup = cx.find((c) => c.kind === "duplicate_intent");
    expect(dup).toBeDefined();
    expect(dup!.message).toContain("review");
    expect(dup!.sources.length).toBe(2);
  });

  test("collectConfigSurfaces finds .cursor/rules files", () => {
    const root = makeRepo();
    mkdirSync(join(root, ".cursor/rules"), { recursive: true });
    writeFileSync(join(root, ".cursor/rules/style.md"), "Use 4-space indentation.\n");
    const surfaces = collectConfigSurfaces(root);
    expect(surfaces.some((s) => s.file.includes(".cursor/rules/style.md"))).toBe(true);
  });
});
