import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  applyPromote,
  buildPrinciplesSection,
  isPrincipleReflected,
  mergeAgentsMd,
  planPromote,
  principleKeywords,
  PROMOTE_END,
  PROMOTE_START,
} from "./memory-promote.js";
import type { Principle } from "./memory-rubric.js";

function p(partial: Partial<Principle> & { title: string }): Principle {
  return {
    id: partial.id ?? "ID000000000000000000000001",
    title: partial.title,
    body: partial.body ?? "",
    weight: partial.weight ?? 8,
    tags: partial.tags ?? [],
    status: partial.status ?? "active",
    source: partial.source ?? "project",
  };
}

describe("principleKeywords / isPrincipleReflected", () => {
  test("keywords drop stopwords", () => {
    expect(principleKeywords("Never use default exports")).toContain("default");
    expect(principleKeywords("Never use default exports")).toContain("exports");
    expect(principleKeywords("Never use default exports")).not.toContain("never");
  });

  test("reflected when title present", () => {
    const agents = "# Agent\n\nPrefer named exports always.\n";
    expect(isPrincipleReflected(p({ title: "Prefer named exports" }), agents)).toBe(true);
  });

  test("not reflected when unrelated", () => {
    const agents = "# Agent\n\nBe nice.\n";
    expect(isPrincipleReflected(p({ title: "Never use default exports" }), agents)).toBe(false);
  });
});

describe("mergeAgentsMd / buildPrinciplesSection", () => {
  test("creates file body from empty", () => {
    const section = buildPrinciplesSection([p({ title: "Run tests first", weight: 8 })]);
    const out = mergeAgentsMd("", section);
    expect(out).toContain("# Agent instructions");
    expect(out).toContain(PROMOTE_START);
    expect(out).toContain("Run tests first");
    expect(out).toContain(PROMOTE_END);
  });

  test("replaces existing managed section", () => {
    const old = `# Agent\n\n${PROMOTE_START}\n## old\n${PROMOTE_END}\n\n## Other\nKeep me.\n`;
    const section = buildPrinciplesSection([p({ title: "New rule" })]);
    const out = mergeAgentsMd(old, section);
    expect(out).toContain("New rule");
    expect(out).not.toContain("## old");
    expect(out).toContain("## Other");
    expect(out).toContain("Keep me.");
  });
});

describe("planPromote / applyPromote", () => {
  test("noop when no high-weight principles", () => {
    const root = mkdtempSync(join(tmpdir(), "promote-"));
    const plan = planPromote(root, {
      principles: [p({ title: "Soft tip", weight: 3 })],
    });
    expect(plan.noop).toBe(true);
    expect(plan.candidates).toHaveLength(0);
  });

  test("plans write for missing high-weight principle", () => {
    const root = mkdtempSync(join(tmpdir(), "promote-"));
    writeFileSync(join(root, "AGENTS.md"), "# Agent\n\nBe concise.\n");
    const plan = planPromote(root, {
      principles: [p({ title: "Never use default exports", weight: 8, body: "Breaks re-exports." })],
    });
    expect(plan.noop).toBe(false);
    expect(plan.candidates).toHaveLength(1);
    expect(plan.after).toContain("Never use default exports");
    expect(plan.diff).toContain("+");
  });

  test("skips principles already reflected", () => {
    const root = mkdtempSync(join(tmpdir(), "promote-"));
    writeFileSync(join(root, "AGENTS.md"), "# Agent\n\nNever use default exports in this repo.\n");
    const plan = planPromote(root, {
      principles: [p({ title: "Never use default exports", weight: 9 })],
    });
    expect(plan.noop).toBe(true);
    expect(plan.alreadyPresent).toHaveLength(1);
  });

  test("applyPromote writes AGENTS.md", () => {
    const root = mkdtempSync(join(tmpdir(), "promote-"));
    mkdirSync(root, { recursive: true });
    const plan = planPromote(root, {
      principles: [p({ title: "Run bun test before commit", weight: 8 })],
    });
    applyPromote(plan);
    const written = readFileSync(join(root, "AGENTS.md"), "utf-8");
    expect(written).toContain("Run bun test before commit");
    expect(written).toContain(PROMOTE_START);
  });
});
