import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  compareBaseline,
  readBaseline,
  shouldSaveBaseline,
  withSkillEntries,
  writeBaseline,
} from "./run-baseline.js";

describe("run baseline", () => {
  test("PASS to FAIL is a regression; new when is info", () => {
    const notes = compareBaseline(
      {
        updatedAt: "t",
        entries: [
          { skill: "live", agent: "grok", when: "deploy now", variant: "with-skill", verdict: "PASS" },
        ],
      },
      [
        { skill: "live", agent: "grok", when: "deploy now", variant: "with-skill", verdict: "FAIL" },
        { skill: "live", agent: "grok", when: "new ask", variant: "with-skill", verdict: "PASS" },
      ],
    );
    expect(notes).toEqual([
      { when: "deploy now", kind: "regressed", detail: "was PASS, now FAIL" },
      { when: "new ask", kind: "new", detail: "new scenario" },
    ]);
  });

  test("save only when every with-skill verdict is PASS", () => {
    expect(shouldSaveBaseline([
      { skill: "s", agent: "g", when: "a", variant: "with-skill", verdict: "PASS" },
    ])).toBe(true);
    expect(shouldSaveBaseline([
      { skill: "s", agent: "g", when: "a", variant: "with-skill", verdict: "FAIL" },
    ])).toBe(false);
  });

  test("round-trip under DORAVAL_HOME", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-base-"));
    const prev = process.env.DORAVAL_HOME;
    process.env.DORAVAL_HOME = home;
    try {
      writeBaseline([
        { skill: "live", agent: "grok", when: "ask", variant: "with-skill", verdict: "PASS" },
      ]);
      expect(readBaseline()?.entries[0]?.verdict).toBe("PASS");
    } finally {
      if (prev === undefined) delete process.env.DORAVAL_HOME;
      else process.env.DORAVAL_HOME = prev;
    }
  });

  test("withSkillEntries drops no-skill rows", () => {
    const rows = withSkillEntries("live", "grok", [
      { when: "ask", variant: "no-skill", verdict: "FAIL", detail: "x" },
      { when: "ask", variant: "with-skill", verdict: "PASS", detail: "y" },
    ]);
    expect(rows).toEqual([
      { skill: "live", agent: "grok", when: "ask", variant: "with-skill", verdict: "PASS" },
    ]);
  });
});
