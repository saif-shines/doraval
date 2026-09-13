import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { z } from "zod";
import type { AgentConfig } from "./agent-invoke.js";
import { runAgentSession } from "./agent-invoke.js";
import { judge, type JudgeRequest } from "./judge.js";
import type { EvalConfig } from "./journal-config.js";
import type { Scenario } from "./scenarios.js";

export const LiveRunSchema = z.object({
  verdict: z.enum(["PASS", "FAIL", "UNKNOWN"]),
  detail: z.string(),
});

export type LiveRunVerdict = z.infer<typeof LiveRunSchema>;

export interface LiveRunFinding {
  when: string;
  verdict: LiveRunVerdict["verdict"];
  detail: string;
}

export interface LiveRunDeps {
  runSession?: (prompt: string, cwd: string, home: string) => Promise<string>;
  score?: (trace: string, scenario: Scenario) => Promise<LiveRunVerdict>;
}

function skillPrompt(skillName: string, skillContent: string, when: string): string {
  return `Follow this skill. Do the user ask. Stay in the working directory.

SKILL: ${skillName}

${skillContent}

ASK:
${when}
`;
}

export function buildLiveScorePrompt(trace: string, scenario: Scenario): string {
  return [
    "Score whether the agent met the scenario.",
    `When: ${scenario.when}`,
    `Expect: ${scenario.expect}`,
    scenario.must_not ? `Must not: ${scenario.must_not}` : "",
    "",
    "TRANSCRIPT:",
    trace.slice(0, 8000),
    "",
    'Return ONLY JSON: {"verdict":"PASS"|"FAIL"|"UNKNOWN","detail":"<one sentence>"}',
  ].filter(Boolean).join("\n");
}

async function defaultScore(
  trace: string,
  scenario: Scenario,
  evalCfg: Partial<EvalConfig>,
  ci: boolean | undefined,
  judgeFn: typeof judge,
): Promise<LiveRunVerdict> {
  const outcome = await judgeFn({
    prompt: buildLiveScorePrompt(trace, scenario),
    schema: LiveRunSchema,
    ci,
    evalCfg,
  } as JudgeRequest<LiveRunVerdict>);
  if (outcome.mode === "api" && outcome.ok) return outcome.data;
  if (outcome.mode === "delegate") {
    return { verdict: "UNKNOWN", detail: "Judge delegated; live-run needs an API judge" };
  }
  const err = outcome.mode === "api" ? outcome.error : "no judge";
  return { verdict: "UNKNOWN", detail: err };
}

/** Isolated HOME + cwd so host skills do not leak into the run. */
export async function runLiveScenarios(opts: {
  skillName: string;
  skillContent: string;
  scenarios: Scenario[];
  agent: AgentConfig;
  evalCfg: Partial<EvalConfig>;
  ci?: boolean;
  judge?: typeof judge;
  deps?: LiveRunDeps;
}): Promise<LiveRunFinding[]> {
  if (opts.scenarios.length === 0) return [];

  const parent = mkdtempSync(join(tmpdir(), "dora-live-"));
  const workspace = join(parent, "workspace");
  const home = join(parent, "home");
  mkdirSync(workspace);
  mkdirSync(home);

  const runSession = opts.deps?.runSession ?? ((prompt, cwd, isolatedHome) =>
    runAgentSession(prompt, opts.agent, {
      cwd,
      alwaysApprove: true,
      stream: false,
      env: { HOME: isolatedHome, CLAUDE_CONFIG_DIR: join(isolatedHome, ".claude") },
    }));

  const score = opts.deps?.score ?? ((trace, scenario) =>
    defaultScore(trace, scenario, opts.evalCfg, opts.ci, opts.judge ?? judge));

  try {
    const out: LiveRunFinding[] = [];
    for (const scenario of opts.scenarios) {
      const prompt = skillPrompt(opts.skillName, opts.skillContent, scenario.when);
      const trace = await runSession(prompt, workspace, home);
      const scored = await score(trace, scenario);
      out.push({ when: scenario.when, verdict: scored.verdict, detail: scored.detail });
    }
    return out;
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}
