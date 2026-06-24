#!/usr/bin/env bun

/**
 * Simple raw API call tester for the eval judge path.
 *
 * Lightest usage (no proxy/gateway server needed):
 *   ZAI_API_KEY=sk-xxx EVAL_MODEL=glm-5-turbo bun run scripts/test-judge-api.ts
 *
 *   # You can also point at any OpenAI-compatible endpoint directly (e.g. coding plan):
 *   OPENAI_BASE_URL=https://api.z.ai/api/coding/paas/v4 OPENAI_API_KEY=sk-xxx EVAL_MODEL=glm-5-turbo bun run scripts/test-judge-api.ts
 *   # ZAI_BASE_URL=... also supported for ZAI_* naming preference
 *
 *   # Or through a gateway if you want one later (LiteLLM, OpenRouter, etc.)
 *   OPENAI_BASE_URL=http://localhost:4000 OPENAI_API_KEY=dummy EVAL_MODEL=glm-5-turbo bun run scripts/test-judge-api.ts
 */

const apiKey =
  process.env.OPENAI_API_KEY ||
  process.env.ZAI_API_KEY ||
  process.env.ZHIPU_API_KEY ||
  process.env.GLM_API_KEY ||
  process.env.ANTHROPIC_API_KEY;

const baseURL = process.env.OPENAI_BASE_URL || "https://api.z.ai/api/paas/v4";
const model = process.env.EVAL_MODEL || "glm-5-turbo";

const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

if (!apiKey || isCI) {
  console.log("⚠️  Skipping live API test (no key or running in CI)");
  console.log("   These are manual integration tests only.");
  process.exit(0);
}

const url = `${baseURL.replace(/\/+$/, "")}/chat/completions`;

const evalPrompt = `You are evaluating whether a coding agent followed a skill's instructions.

SKILL CONTENT:
Use the "Skill" tool exactly once at the start. Then use Read on at least 2 files.

TOOL CALL SEQUENCE (ordered):
Skill: {"skill":"improve","args":"do the thing"}
Read: {"file_path":"src/foo.ts"}
Read: {"file_path":"src/bar.ts"}

USER MESSAGES (first 5, for familiarity inference):
make the code better

TASKS:
1. Extract the key actions the skill instructs.
2. For each, check if the tool call sequence shows it happened.
3. Return ONLY a valid JSON object with exactly these keys:
{
  "userFamiliarity": <number 1-10>,
  "userFamiliarityReason": "<one sentence>",
  "closure": "<1-shot|multi-turn|incomplete>",
  "userTurnsAfterSkill": <number>,
  "verdict": "<PASS|FAIL>",
  "verdictReason": "<one sentence>",
  "checklist": [
    { "instruction": "<what skill said>", "pass": <true|false>, "detail": "<optional>" }
  ]
}`;

console.log("→ Testing judge API call");
console.log("  baseURL :", baseURL);
console.log("  model   :", model);
console.log("  key len :", apiKey.length);

const body: any = {
  model,
  messages: [
    {
      role: "system",
      content: "You are a strict evaluator. Return ONLY a single valid JSON object. No markdown, no prose before or after the JSON. First character must be '{' .",
    },
    { role: "user", content: evalPrompt },
  ],
  temperature: 0,
};

// GLM-4 and many OpenAI-compatible endpoints like response_format
if (!model.startsWith("claude")) {
  body.response_format = { type: "json_object" };
}

const start = Date.now();
const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify(body),
});

const elapsed = Date.now() - start;
console.log(`\n← Status: ${res.status}  (${elapsed}ms)`);

if (!res.ok) {
  const text = await res.text();
  console.error("Error body:", text.slice(0, 800));
  process.exit(1);
}

const data: any = await res.json();
const content: string = data?.choices?.[0]?.message?.content ?? "";

console.log("\nRaw content from model:");
console.log("---");
console.log(content);
console.log("---\n");

let parsed: any = null;
try {
  // Try direct
  parsed = JSON.parse(content);
} catch {
  // Try to extract first {...} blob
  const match = content.match(/\{[\s\S]*\}/);
  if (match) {
    try { parsed = JSON.parse(match[0]); } catch {}
  }
}

if (parsed) {
  console.log("Parsed JSON:");
  console.dir(parsed, { depth: 3 });
  const hasVerdict = "verdict" in parsed;
  const hasChecklist = Array.isArray(parsed.checklist);
  console.log(`\nHas verdict: ${hasVerdict}   Has checklist: ${hasChecklist}`);
  if (hasVerdict && hasChecklist) {
    console.log("✅ Looks like a valid judge response shape.");
  }
} else {
  console.log("❌ Could not parse JSON from response.");
  process.exit(2);
}
