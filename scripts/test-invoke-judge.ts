#!/usr/bin/env bun

/**
 * Test the REAL invokeJudge implementation used by doraval eval.
 *
 * This exercises the exact code path that `doraval eval` will use.
 * No extra proxy server is required.
 *
 * Lightest usage:
 *   ZAI_API_KEY=sk-... EVAL_MODEL=glm-5-turbo bun run scripts/test-invoke-judge.ts
 *
 * With explicit base (e.g. Coding Plan or custom proxy):
 *   OPENAI_BASE_URL=https://api.z.ai/api/coding/paas/v4 ZAI_API_KEY=sk-... EVAL_MODEL=glm-5-turbo bun run scripts/test-invoke-judge.ts
 *   # ZAI_BASE_URL also works (ZAI_* naming)
 */

import { invokeJudge, canUseApiJudge } from "../src/core/llm-judge.js";
import type { EvalConfig } from "../src/core/journal-config.js";

const apiKey =
  process.env.OPENAI_API_KEY ||
  process.env.ZAI_API_KEY ||
  process.env.ZHIPU_API_KEY ||
  process.env.GLM_API_KEY ||
  process.env.ANTHROPIC_API_KEY;

const baseURL = process.env.OPENAI_BASE_URL;
const model = process.env.EVAL_MODEL || "glm-5-turbo";

const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

if ((!apiKey && !baseURL) || isCI) {
  console.log("⚠️  Skipping live API test (no key or running in CI)");
  console.log("   These are manual integration tests only.");
  process.exit(0);
}

const evalCfg: EvalConfig = {
  model,
  api_key: apiKey,
  base_url: baseURL,
  max_tool_calls: 50,
  save_history: false,
};

console.log("Testing real invokeJudge() path");
console.log("  model    :", model);
console.log("  base_url :", baseURL || "(default)");
console.log("  canUseApiJudge:", canUseApiJudge(evalCfg));

const prompt = `You are evaluating whether a coding agent followed a skill.

SKILL CONTENT:
Always call the "Skill" tool first. Read the main file.

TOOL CALL SEQUENCE:
Skill: {"skill":"test-skill"}
Read: {"file_path":"README.md"}

Return ONLY valid JSON:
{
  "userFamiliarity": 5,
  "userFamiliarityReason": "short prompt",
  "closure": "1-shot",
  "userTurnsAfterSkill": 0,
  "verdict": "PASS",
  "verdictReason": "followed the steps",
  "checklist": [{ "instruction": "call Skill first", "pass": true }]
}`;

const start = Date.now();
const outcome = await invokeJudge(prompt, evalCfg);
const elapsed = Date.now() - start;

console.log(`\ninvokeJudge took ${elapsed}ms`);
console.log("Result:");
console.dir(outcome, { depth: 2 });

if (outcome.success && outcome.data && (outcome.data.verdict || outcome.data.checklist)) {
  console.log("\n✅ invokeJudge returned a usable object.");
} else {
  console.log("\n⚠️  invokeJudge returned error.");
  console.log("Error:", outcome.success ? 'no data' : outcome.error);
}
