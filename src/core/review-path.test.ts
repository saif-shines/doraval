import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { listReviewTargets, review } from "./review.js";

function writeSkill(dir: string, name: string): string {
  const skill = join(dir, name);
  mkdirSync(skill, { recursive: true });
  writeFileSync(
    skill + "/SKILL.md",
    `---\nname: ${name}\ndescription: Use when testing review(path).\n---\n\n1. Do the thing.\n`,
  );
  return skill;
}

describe("review(path)", () => {
  test("named Memory file is a valid Review", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dora-review-"));
    const agents = join(dir, "AGENTS.md");
    writeFileSync(agents, "# Project\n\nAlways write tests.\n");
    try {
      const results = await review(agents, { quick: true, cwd: dir });
      expect(results).toHaveLength(1);
      expect(results[0]!.path).toBe(agents);
      expect(results[0]!.summary.errors).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("Skill directory is a valid Review", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dora-review-"));
    const skill = writeSkill(dir, "alpha");
    try {
      const results = await review(skill, { quick: true, cwd: dir });
      expect(results.some((r) => r.path === skill)).toBe(true);
      expect(results.find((r) => r.path === skill)!.summary.errors).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("Skill review also includes Memory files from cwd", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dora-review-"));
    const skill = writeSkill(dir, "alpha");
    const agents = join(dir, "AGENTS.md");
    writeFileSync(agents, "# Project\n\nAlways write tests.\n");
    try {
      const results = await review(skill, { quick: true, cwd: dir });
      const paths = results.map((r) => r.path);
      expect(paths).toContain(skill);
      expect(paths).toContain(agents);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("directory review includes skills under the path and Memory from cwd", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dora-review-"));
    const skill = writeSkill(join(dir, ".claude", "skills"), "alpha");
    const agents = join(dir, "AGENTS.md");
    writeFileSync(agents, "# Project\n\nAlways write tests.\n");
    try {
      const results = await review(dir, { quick: true, cwd: dir });
      const paths = results.map((r) => r.path);
      expect(paths).toContain(skill);
      expect(paths).toContain(agents);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("results are sorted by path", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dora-review-"));
    const zebra = writeSkill(dir, "zebra");
    const alpha = writeSkill(dir, "alpha");
    const agents = join(dir, "AGENTS.md");
    writeFileSync(agents, "# Project\n\nAlways write tests.\n");
    try {
      const results = await review(dir, { quick: true, cwd: dir });
      expect(results.map((r) => r.path)).toEqual([agents, alpha, zebra].sort());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("judge fake supplies LLM findings", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dora-review-"));
    const skill = writeSkill(dir, "alpha");
    try {
      const results = await review(skill, {
        cwd: dir,
        ci: true,
        judge: async () => ({
          mode: "api",
          ok: true,
          data: {
            overall: "warn",
            summary: "one issue",
            findings: [
              {
                severity: "warning",
                category: "clarity",
                finding: "description is vague",
                suggestion: "name the trigger",
              },
            ],
          },
        }),
      });
      const llm = results.find((r) => r.path === skill)?.tiers.llm;
      expect(llm?.available).toBe(true);
      expect(llm?.findings.some((f) => f.message === "description is vague")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("listReviewTargets lists skills and cwd Memory, sorted", () => {
    const dir = mkdtempSync(join(tmpdir(), "dora-review-"));
    const zebra = writeSkill(dir, "zebra");
    const alpha = writeSkill(dir, "alpha");
    const agents = join(dir, "AGENTS.md");
    writeFileSync(agents, "# Project\n\nAlways write tests.\n");
    try {
      expect(listReviewTargets(dir, dir)).toEqual([agents, alpha, zebra]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("limit reviews only the first N paths", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dora-review-"));
    for (let i = 0; i < 12; i++) writeSkill(dir, `s${String(i).padStart(2, "0")}`);
    try {
      const results = await review(dir, { quick: true, cwd: dir, limit: 10 });
      expect(results).toHaveLength(10);
      expect(results.map((r) => r.path)).toEqual(listReviewTargets(dir, dir).slice(0, 10));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
