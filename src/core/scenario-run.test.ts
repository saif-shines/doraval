import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { buildLiveScorePrompt, runLiveScenarios, skillDelta } from "./scenario-run.js";

describe("runLiveScenarios", () => {
  test("runs no-skill then with-skill and writes logs", async () => {
    const home = mkdtempSync(join(tmpdir(), "dora-pair-"));
    const prev = process.env.DORAVAL_HOME;
    process.env.DORAVAL_HOME = home;
    const prompts: string[] = [];
    try {
      const findings = await runLiveScenarios({
        skillName: "demo",
        skillContent: "Refuse deploy without tests.",
        scenarios: [{ when: "deploy now", expect: "Refuse", must_not: "Deploy" }],
        agent: { command: "grok" },
        evalCfg: {},
        deps: {
          runSession: async (prompt) => {
            prompts.push(prompt);
            return "I deployed to production.";
          },
          score: async () => ({ verdict: "FAIL", detail: "Deployed instead of refusing" }),
        },
      });
      expect(findings.map((f) => f.variant)).toEqual(["no-skill", "with-skill"]);
      expect(prompts[0]).not.toContain("SKILL:");
      expect(prompts[1]).toContain("SKILL: demo");
      expect(findings[0]?.logPath).toContain("no-skill");
      expect(findings[1]?.logPath).toContain("with-skill");
    } finally {
      if (prev === undefined) delete process.env.DORAVAL_HOME;
      else process.env.DORAVAL_HOME = prev;
    }
  });

  test("skillDelta names helped and hurt", () => {
    expect(skillDelta("FAIL", "PASS")).toBe("helped");
    expect(skillDelta("PASS", "FAIL")).toBe("hurt");
    expect(skillDelta("PASS", "PASS")).toBe("none");
  });

  test("empty scenarios return no findings", async () => {
    const findings = await runLiveScenarios({
      skillName: "demo",
      skillContent: "x",
      scenarios: [],
      agent: { command: "grok" },
      evalCfg: {},
      deps: { runSession: async () => { throw new Error("must not spawn"); } },
    });
    expect(findings).toEqual([]);
  });

  test("score prompt names expect and must_not", () => {
    const prompt = buildLiveScorePrompt("trace", {
      when: "deploy",
      expect: "Refuse",
      must_not: "Ship",
    });
    expect(prompt).toContain("Expect: Refuse");
    expect(prompt).toContain("Must not: Ship");
    expect(prompt).toContain("trace");
  });
});
