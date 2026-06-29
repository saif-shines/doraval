import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import type { SkillModel } from "./skill-validate.js";
import type { EvalConfig } from "./journal-config.js";
import type { AgentConfig } from "./agent-invoke.js";
import { invokeAgent } from "./agent-invoke.js";
import { resolveDirectCredentials, DEFAULT_JUDGE_TIMEOUT_MS } from "./llm-judge.js";
import type { Capabilities } from "./capability-detect.js";

// ── Schemas ────────────────────────────────────────────────────────────────────

export const LintFindingSchema = z.object({
  severity: z.enum(["error", "warning", "info"]),
  category: z.enum(["clarity", "actionability", "contradiction", "trigger", "scope"]),
  finding: z.string(),
  suggestion: z.string(),
});

export const LintSchema = z.object({
  overall: z.enum(["pass", "warn", "fail"]),
  summary: z.string(),
  findings: z.array(LintFindingSchema),
});

export type LintOutput = z.infer<typeof LintSchema>;
export type LintFinding = z.infer<typeof LintFindingSchema>;

export type LintResult =
  | { ok: true; output: LintOutput; method: "api" | "cli" }
  | { ok: false; error: string };

// ── Prompt ─────────────────────────────────────────────────────────────────────

export function buildLintPrompt(model: SkillModel): string {
  const frontmatter = Object.entries(model.data)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  return `You are a skill linter for AI coding agents. Analyze this skill and identify quality issues.

FRONTMATTER:
${frontmatter}

BODY:
${model.content}

Evaluate across five dimensions:
1. CLARITY: Are instructions unambiguous? Would two engineers interpret them identically?
2. ACTIONABILITY: Can an AI agent actually execute each instruction with the tools it has?
3. CONTRADICTION: Do any instructions conflict with each other or with the frontmatter?
4. TRIGGER: Is the when_to_use / trigger condition specific enough to avoid false positives?
5. SCOPE: Is the skill focused, or does it combine unrelated responsibilities?

Rules:
- "error" = the skill will likely malfunction or be ignored
- "warning" = the skill may work inconsistently across sessions
- "info" = improvement opportunity; skill works but could be better
- If no issues found in a category, omit it from findings (do not invent problems)
- overall = "fail" if any errors, "warn" if any warnings, "pass" otherwise

CRITICAL: Return ONLY a JSON object. No markdown, no prose. First char '{', last char '}'.

{
  "overall": "pass" | "warn" | "fail",
  "summary": "<one sentence>",
  "findings": [
    {
      "severity": "error" | "warning" | "info",
      "category": "clarity" | "actionability" | "contradiction" | "trigger" | "scope",
      "finding": "<what the issue is>",
      "suggestion": "<concrete fix>"
    }
  ]
}`;
}

// ── Provider factory (mirrors llm-judge.ts, kept local to avoid coupling) ─────

function makeProvider(baseUrl: string, apiKey: string, providerName: string) {
  if (providerName === "openai" || baseUrl === "https://api.openai.com/v1") {
    return createOpenAI({ apiKey, baseURL: baseUrl });
  }
  return createOpenAICompatible({
    name: providerName,
    apiKey,
    baseURL: baseUrl.replace(/\/+$/, ""),
  });
}

// ── API path ───────────────────────────────────────────────────────────────────

async function lintViaApi(prompt: string, evalCfg: Partial<EvalConfig>): Promise<LintResult> {
  const { apiKey, baseUrl, model, providerName } = resolveDirectCredentials(evalCfg);
  if (!apiKey) {
    return { ok: false, error: "No API key configured for lint judge" };
  }
  const provider = makeProvider(baseUrl, apiKey, providerName);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_JUDGE_TIMEOUT_MS);
  try {
    const { object } = await generateObject({
      model: provider(model),
      schema: LintSchema,
      system: "You are a strict linter. Return ONLY a valid JSON object matching the schema. No markdown, no prose.",
      prompt,
      temperature: 0,
      abortSignal: controller.signal,
    });
    return { ok: true, output: object, method: "api" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "API lint request failed";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── CLI path ───────────────────────────────────────────────────────────────────

function mapCliRaw(raw: Record<string, unknown>): LintOutput | null {
  if (typeof raw.overall !== "string" || !["pass", "warn", "fail"].includes(raw.overall)) return null;
  if (typeof raw.summary !== "string") return null;
  if (!Array.isArray(raw.findings)) return null;

  const findings: LintFinding[] = [];
  for (const item of raw.findings as unknown[]) {
    if (
      item !== null &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>).severity === "string" &&
      typeof (item as Record<string, unknown>).category === "string" &&
      typeof (item as Record<string, unknown>).finding === "string" &&
      typeof (item as Record<string, unknown>).suggestion === "string"
    ) {
      const f = item as Record<string, unknown>;
      findings.push({
        severity: f.severity as LintFinding["severity"],
        category: f.category as LintFinding["category"],
        finding: f.finding as string,
        suggestion: f.suggestion as string,
      });
    }
  }
  return { overall: raw.overall as LintOutput["overall"], summary: raw.summary, findings };
}

async function lintViaCli(prompt: string, agentCfg: AgentConfig): Promise<LintResult> {
  const raw = await invokeAgent(prompt, agentCfg, ["overall", "findings"]);
  if (!raw) return { ok: false, error: "CLI agent returned no response" };
  const output = mapCliRaw(raw);
  if (!output) return { ok: false, error: "CLI agent response did not match lint schema" };
  return { ok: true, output, method: "cli" };
}

// ── Public entry point ─────────────────────────────────────────────────────────

export async function lintSkill(
  model: SkillModel,
  caps: Capabilities,
  agentCfg: AgentConfig,
  evalCfg: Partial<EvalConfig>
): Promise<LintResult> {
  const prompt = buildLintPrompt(model);

  if (caps.preferred === "api") {
    const result = await lintViaApi(prompt, evalCfg);
    if (result.ok) return result;
    // API failed — fall back to CLI if available
    if (caps.cli && caps.cliCommand) {
      return lintViaCli(prompt, { ...agentCfg, command: caps.cliCommand });
    }
    return result;
  }

  if (caps.preferred === "cli") {
    return lintViaCli(prompt, { ...agentCfg, command: agentCfg.command || caps.cliCommand! });
  }

  return {
    ok: false,
    error: "No judge available. Set an API key (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.) or install claude CLI.",
  };
}
