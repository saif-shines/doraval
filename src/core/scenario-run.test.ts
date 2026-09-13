import { describe, expect, test } from "bun:test";
import { buildLiveScorePrompt, runLiveScenarios } from "./scenario-run.js";

describe("runLiveScenarios", () => {
  test("FAIL when the injected score says the expect was missed", async () => {
    const findings = await runLiveScenarios({
      skillName: "demo",
      skillContent: "Refuse deploy without tests.",
      scenarios: [{ when: "deploy now", expect: "Refuse", must_not: "Deploy" }],
      agent: { command: "grok" },
      evalCfg: {},
      deps: {
        runSession: async () => "I deployed to production.",
        score: async () => ({ verdict: "FAIL", detail: "Deployed instead of refusing" }),
      },
    });
    expect(findings).toEqual([
      { when: "deploy now", verdict: "FAIL", detail: "Deployed instead of refusing" },
    ]);
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
