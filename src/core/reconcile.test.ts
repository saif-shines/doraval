import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  applyReconcile,
  mergeReconcileSection,
  planReconcile,
  stripClaudeOnlyLines,
  stripTopicLines,
  RECONCILE_START,
} from "./reconcile.js";
import {
  actorTag,
  detectContradictions,
  formatContradictionHeadline,
  withActors,
  type Contradiction,
} from "./cross-agent.js";

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "dora-reconcile-"));
  return root;
}

describe("strip helpers", () => {
  test("stripTopicLines removes indent conventions", () => {
    const src = "# x\n\nUse 2-space indentation.\nKeep me.\n";
    const out = stripTopicLines(src, "indent");
    expect(out).not.toContain("2-space");
    expect(out).toContain("Keep me.");
  });

  test("stripClaudeOnlyLines pulls $ARGUMENTS", () => {
    const { cleaned, removed } = stripClaudeOnlyLines("# Shared\n\nPass $ARGUMENTS here.\nOK line.\n");
    expect(cleaned).toContain("OK line");
    expect(cleaned).not.toContain("$ARGUMENTS");
    expect(removed.some((l) => l.includes("$ARGUMENTS"))).toBe(true);
  });
});

describe("mergeReconcileSection", () => {
  test("creates AGENTS.md body", () => {
    const out = mergeReconcileSection("", ["**indent**: Use 2-space"]);
    expect(out).toContain(RECONCILE_START);
    expect(out).toContain("**indent**: Use 2-space");
  });
});

describe("planReconcile / applyReconcile", () => {
  test("nothing to do on empty repo", () => {
    const root = makeRepo();
    const plan = planReconcile(root);
    expect(plan.nothingToDo).toBe(true);
    expect(plan.fileEdits).toHaveLength(0);
  });

  test("conflicting indent → AGENTS.md + strip agent files", () => {
    const root = makeRepo();
    writeFileSync(join(root, "CLAUDE.md"), "# Claude\n\nUse 2-space indentation.\n");
    writeFileSync(join(root, ".cursorrules"), "# Cursor\n\nUse tabs for indentation.\n");

    const before = detectContradictions(root);
    expect(before.some((c) => c.kind === "conflicting_convention")).toBe(true);

    const plan = planReconcile(root);
    expect(plan.nothingToDo).toBe(false);
    expect(plan.fileEdits.some((e) => e.file === "AGENTS.md")).toBe(true);

    applyReconcile(plan);

    const agents = readFileSync(join(root, "AGENTS.md"), "utf-8");
    expect(agents).toContain("Shared conventions");
    expect(agents).toContain(RECONCILE_START);

    const claude = readFileSync(join(root, "CLAUDE.md"), "utf-8");
    expect(claude).toContain("@AGENTS.md");
    expect(claude).not.toMatch(/2-space indentation/i);

    const cursor = readFileSync(join(root, ".cursorrules"), "utf-8");
    expect(cursor).not.toMatch(/tabs for indentation/i);

    const after = detectContradictions(root);
    expect(after.some((c) => c.kind === "conflicting_convention" && c.message.includes("indent"))).toBe(
      false,
    );
  });

  test("agent_specific_in_shared moves markers to CLAUDE.md", () => {
    const root = makeRepo();
    writeFileSync(join(root, "AGENTS.md"), "# Shared\n\nPass $ARGUMENTS to the skill.\nBe concise.\n");

    const plan = planReconcile(root);
    expect(plan.items.some((i) => i.contradiction.kind === "agent_specific_in_shared")).toBe(true);
    applyReconcile(plan);

    const agents = readFileSync(join(root, "AGENTS.md"), "utf-8");
    expect(agents).not.toContain("$ARGUMENTS");
    expect(agents).toContain("Be concise");
    expect(existsSync(join(root, "CLAUDE.md"))).toBe(true);
    const claude = readFileSync(join(root, "CLAUDE.md"), "utf-8");
    expect(claude).toContain("$ARGUMENTS");
  });

  test("duplicate_intent is skipped with reason", () => {
    const root = makeRepo();
    // two skill dirs same name
    const { mkdirSync } = require("fs");
    mkdirSync(join(root, ".claude/skills/review"), { recursive: true });
    mkdirSync(join(root, "skills/review"), { recursive: true });
    writeFileSync(
      join(root, ".claude/skills/review/SKILL.md"),
      "---\nname: review\ndescription: A\n---\n\nBody one\n",
    );
    writeFileSync(
      join(root, "skills/review/SKILL.md"),
      "---\nname: review\ndescription: A\n---\n\nBody two different\n",
    );
    const plan = planReconcile(root);
    const dup = plan.items.find((i) => i.contradiction.kind === "duplicate_intent");
    expect(dup).toBeDefined();
    expect(dup!.skipReason).toBeDefined();
    expect(dup!.edits).toHaveLength(0);
  });

  test("pick skip leaves files unchanged", () => {
    const root = makeRepo();
    writeFileSync(join(root, "CLAUDE.md"), "# Claude\n\nUse 2-space indentation.\n");
    writeFileSync(join(root, ".cursorrules"), "# Cursor\n\nUse tabs for indentation.\n");
    const plan = planReconcile(root, () => ({ action: "skip", label: "leave it" }));
    expect(plan.items.every((i) => i.skipReason || i.chosen.action === "skip")).toBe(true);
    expect(plan.fileEdits).toHaveLength(0);
  });
});

describe("B36 human labels + actors", () => {
  test("formatContradictionHeadline leads with kind not bare id", () => {
    const cx: Contradiction = {
      id: "cx-001",
      kind: "duplicate_intent",
      severity: "conflict",
      message: 'Skill "review" has 2 copies with different bodies',
      sources: [
        { agent: "shared", file: ".claude/skills/review/SKILL.md", text: "a" },
        { agent: "shared", file: "skills/review/SKILL.md", text: "b" },
      ],
      resolution: [],
    };
    const h = formatContradictionHeadline(cx);
    expect(h).toContain("duplicate_intent");
    expect(h).toContain("review");
    expect(h).not.toMatch(/^cx-/);
  });

  test("withActors tags mechanical vs judgment", () => {
    const opts = withActors([
      { action: "create_agents_md", label: "x", file: "AGENTS.md" },
      { action: "skip", label: "y" },
      { action: "update_file", label: "pick body" },
    ]);
    expect(opts[0]!.actor).toBe("dora");
    expect(opts[1]!.actor).toBe("you");
    expect(opts[2]!.actor).toBe("you");
    expect(actorTag("dora")).toContain("dora writes");
    expect(actorTag("you")).toContain("you choose");
  });

  test("duplicate_intent dry plan yields judgment skip and no edits", () => {
    const root = makeRepo();
    const { mkdirSync } = require("fs");
    mkdirSync(join(root, ".claude/skills/review"), { recursive: true });
    mkdirSync(join(root, "skills/review"), { recursive: true });
    writeFileSync(
      join(root, ".claude/skills/review/SKILL.md"),
      "---\nname: review\ndescription: A\n---\n\nBody one\n",
    );
    writeFileSync(
      join(root, "skills/review/SKILL.md"),
      "---\nname: review\ndescription: A\n---\n\nBody two different\n",
    );
    const plan = planReconcile(root);
    expect(plan.fileEdits).toHaveLength(0);
    const dup = plan.items.find((i) => i.contradiction.kind === "duplicate_intent");
    expect(dup?.chosen.actor).toBe("you");
    const h = formatContradictionHeadline(dup!.contradiction);
    expect(h.startsWith("duplicate_intent")).toBe(true);
  });
});
