import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { reviewSkill } from "./review.js";
import type { LoadResult } from "./session-evidence.js";

function skillFixture(name: string): { root: string; dir: string } {
  const root = mkdtempSync(join(tmpdir(), "dora-sess-"));
  const dir = join(root, ".claude", "skills", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: does a thing. Use when testing.\n---\n\nMUST do it.\n`);
  return { root, dir };
}

const EMPTY_LOAD: LoadResult = { sessions: [], adaptersDetected: ["claude-code"], skipped: {} };
const NO_ADAPTERS: LoadResult = { sessions: [], adaptersDetected: [], skipped: {} };

// Test seam: this dev machine has a real judge CLI configured, so the
// non-quick LLM tier would otherwise attempt a live agent invocation and
// time out. Skip it — these tests only assert on tiers.sessions.
const skipLlm = { lintFn: async () => ({ ok: false, error: "skip" }) as any };

describe("review tier 4 wiring", () => {
  test("--quick omits the sessions tier entirely", async () => {
    const { root, dir } = skillFixture("t1");
    const r = await reviewSkill(dir, { quick: true, cwd: root });
    expect(r.tiers.sessions).toBeUndefined();
    rmSync(root, { recursive: true, force: true });
  });

  test("no adapters → available:false (legacy shape)", async () => {
    const { root, dir } = skillFixture("t2");
    const r = await reviewSkill(dir, { quick: false, cwd: root, loadedSessions: NO_ADAPTERS, ...skipLlm });
    expect(r.tiers.sessions).toEqual({ available: false, findings: [] });
    rmSync(root, { recursive: true, force: true });
  });

  test("adapters but zero sessions → available:true, count 0, info finding", async () => {
    const { root, dir } = skillFixture("t3");
    const r = await reviewSkill(dir, { quick: false, cwd: root, loadedSessions: EMPTY_LOAD, ...skipLlm });
    expect(r.tiers.sessions?.available).toBe(true);
    expect(r.tiers.sessions?.count).toBe(0);
    expect(r.tiers.sessions?.findings[0]?.message).toContain("No sessions found");
    rmSync(root, { recursive: true, force: true });
  });

  test("--sessions with zero sessions throws E-PRE-003", async () => {
    const { root, dir } = skillFixture("t4");
    await expect(
      reviewSkill(dir, { quick: false, sessions: true, cwd: root, loadedSessions: EMPTY_LOAD, ...skipLlm })
    ).rejects.toThrow(/No sessions found/);
    rmSync(root, { recursive: true, force: true });
  });
});
