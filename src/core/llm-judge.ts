import { generateObject, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";

/** Suppress noisy AI SDK warnings (e.g. Z.ai lacks structuredOutputs / responseFormat). */
function silenceAiSdkWarnings(): void {
  const g = globalThis as typeof globalThis & { AI_SDK_LOG_WARNINGS?: boolean };
  g.AI_SDK_LOG_WARNINGS = false;
}
import type { EvalConfig } from "./journal-config.js";
import {
  PROVIDERS,
  ALL_PROVIDER_ENV_KEYS,
  detectEnvProvider,
  findProvider,
  type ProviderDef,
} from "./providers.js";

export const DEFAULT_JUDGE_TIMEOUT_MS = 180_000; // 3 min — reasoning models on Z.ai/Groq etc. can be slow

// ── Output schema ──────────────────────────────────────────────────────────────

export const JudgeSchema = z.object({
  verdict: z.enum(["PASS", "FAIL"]),        // keep top-level binary (PASS = no DRIFTED items)
  verdictReason: z.string(),
  checklist: z.array(
    z.object({
      instruction: z.string(),
      bindingness: z.enum(["MANDATORY", "CONDITIONAL", "DISCRETIONARY"]),
      itemVerdict: z.enum(["ALIGNED", "DRIFTED", "JUSTIFIED", "UNCLEAR"]),
      evidence: z.string(),                  // tool-call index or agent quote; empty string if none
      detail: z.string().optional(),
    })
  ),
  ambiguityFlags: z.array(z.string()),       // instructions that came back UNCLEAR (skill-quality feedback)
  userFamiliarity: z.number().int().min(1).max(10),
  userFamiliarityReason: z.string(),
  closure: z.enum(["1-shot", "multi-turn", "incomplete"]),
  userTurnsAfterSkill: z.number().int().min(0),
});

export type JudgeOutput = z.infer<typeof JudgeSchema>;

export type JudgeErrorCode =
  | "timeout"
  | "network"
  | "rate_limit"
  | "auth"
  | "model"
  | "parse"
  | "empty"
  | "config";

export type JudgeResult =
  | { success: true; data: JudgeOutput }
  | { success: false; error: string; code?: JudgeErrorCode };

// ── JSON extraction for CLI agent path (stdout parsing) ────────────────────────

/** Remove reasoning-model think blocks before JSON extraction. */
export function stripReasoningArtifacts(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/** Extract JSON candidates from CLI agent stdout (not used for API path). */
export function extractCandidates(text: string): Record<string, unknown>[] {
  const cleaned = stripReasoningArtifacts(text)
    .replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, "$1")
    .trim();

  const candidates: Record<string, unknown>[] = [];
  const fullMatch = cleaned.match(/\{[\s\S]*\}/);
  if (fullMatch) {
    try {
      candidates.push(JSON.parse(fullMatch[0]) as Record<string, unknown>);
    } catch {}
  }
  const allMatches = cleaned.match(/\{[\s\S]*?\}(?=\s*(?:\{|$))/g) ?? [];
  for (const m of allMatches) {
    try {
      candidates.push(JSON.parse(m) as Record<string, unknown>);
    } catch {}
  }
  if (cleaned.startsWith("{") || cleaned.startsWith("[")) {
    try {
      const direct = JSON.parse(cleaned);
      if (direct && typeof direct === "object")
        candidates.push(direct as Record<string, unknown>);
    } catch {}
  }

  const unwrapped: Record<string, unknown>[] = [];
  for (const c of candidates) {
    if (c.result) {
      let inner = c.result;
      if (typeof inner === "string") {
        try {
          inner = JSON.parse(inner);
        } catch {}
      }
      if (inner && typeof inner === "object")
        unwrapped.push(inner as Record<string, unknown>);
    }
    unwrapped.push(c);
  }

  function collectObjects(obj: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
    if (!obj || typeof obj !== "object") return out;
    if (Array.isArray(obj)) {
      for (const item of obj) collectObjects(item, out);
    } else {
      out.push(obj as Record<string, unknown>);
      for (const v of Object.values(obj)) collectObjects(v, out);
    }
    return out;
  }

  const nested: Record<string, unknown>[] = [];
  for (const c of [...candidates, ...unwrapped]) collectObjects(c, nested);

  return [...unwrapped, ...nested];
}

// ── Credential resolution ──────────────────────────────────────────────────────

export type DirectCredentials = {
  apiKey?: string;
  baseUrl: string;
  model: string;
  providerName: string;
};

function resolveApiKey(evalCfg: Partial<EvalConfig>, providerDef: ProviderDef): string | undefined {
  if (evalCfg.api_key) return evalCfg.api_key;
  const keysToCheck = [providerDef.envKey, ...providerDef.altEnvKeys, ...ALL_PROVIDER_ENV_KEYS];
  for (const k of keysToCheck) {
    const val = process.env[k];
    if (val) return val;
  }
  return undefined;
}

function resolveProviderDef(evalCfg: Partial<EvalConfig>): ProviderDef {
  if (evalCfg.provider) {
    const p = findProvider(evalCfg.provider);
    if (p) return p;
  }
  // Detect from env
  const detected = detectEnvProvider();
  if (detected) return detected.provider;
  // Fall back to custom (base_url may be set)
  return findProvider("custom")!;
}

/** Shared credential resolution used by judge, init, and canUseApiJudge. */
export function resolveDirectCredentials(evalCfg: Partial<EvalConfig>): DirectCredentials {
  const model = (evalCfg.model ?? "").trim() || "gpt-4o-mini";
  const providerDef = resolveProviderDef(evalCfg);
  const baseUrl = evalCfg.base_url?.trim() || providerDef.baseUrl || "https://api.openai.com/v1";
  return {
    apiKey: resolveApiKey(evalCfg, providerDef),
    baseUrl,
    model,
    providerName: providerDef.name,
  };
}

/** True when direct API calls are plausible (key, base URL, or matching env var). */
export function canUseApiJudge(evalCfg: Partial<EvalConfig>): boolean {
  if (evalCfg.base_url) return true;
  if (evalCfg.api_key) return true;
  if (process.env.ZAI_BASE_URL || process.env.OPENAI_BASE_URL) return true;
  const creds = resolveDirectCredentials(evalCfg);
  return !!creds.apiKey;
}

/** Alias for init UX: any env or config that enables the direct path. */
export function hasDirectApiCredentials(evalCfg?: Partial<EvalConfig> | null): boolean {
  return canUseApiJudge(evalCfg ?? {});
}

// ── Provider factory ───────────────────────────────────────────────────────────

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

// ── Error mapping ──────────────────────────────────────────────────────────────

function mapJudgeError(e: unknown, timeoutMs: number): { error: string; code: JudgeErrorCode } {
  const err = e as {
    name?: string;
    message?: string;
    code?: string;
    status?: number;
    hostname?: string;
    response?: { data?: unknown };
  };
  const msg = typeof err?.message === "string" ? err.message : "Judge API request failed";
  const lower = msg.toLowerCase();

  if (
    err?.name === "AbortError" ||
    lower.includes("aborted") ||
    lower.includes("this operation was aborted") ||
    lower.includes("timeout")
  ) {
    return {
      code: "timeout",
      error:
        `Request timed out after ${Math.round(timeoutMs / 1000)}s. ` +
        `Try a faster model (glm-4.7 / glm-4-flash), increase with "dora config set eval.timeout_ms 300000", or set eval.judge=cli.`,
    };
  }
  if (err?.code === "ENOTFOUND" || err?.code === "ECONNREFUSED" || err?.code === "ETIMEDOUT") {
    const host = err.hostname ? ` (${err.hostname})` : "";
    return {
      code: "network",
      error: `Cannot connect to judge API${host}. Check internet / eval.base_url / OPENAI_BASE_URL.`,
    };
  }
  if (err?.status === 429) {
    // Z.ai uses HTTP 429 + code 1113 for "wrong product endpoint / no package",
    // not only rate limits — Coding Plan keys must use /api/coding/paas/v4.
    if (
      lower.includes("insufficient balance") ||
      lower.includes("no resource package") ||
      lower.includes("1113")
    ) {
      return {
        code: "auth",
        error:
          "Z.ai rejected the call (1113: no balance/package on this endpoint). " +
          "Coding Plan keys need: dora config set eval.base_url https://api.z.ai/api/coding/paas/v4 " +
          "(pay-as-you-go uses https://api.z.ai/api/paas/v4). Or set eval.judge=cli.",
      };
    }
    return {
      code: "rate_limit",
      error: "Rate limit exceeded. Wait and retry, or set eval.judge=cli.",
    };
  }
  if (err?.status === 401 || err?.status === 403) {
    return {
      code: "auth",
      error: "API rejected credentials (401/403). Check your API key matches the provider.",
    };
  }
  if (
    err?.status === 404 ||
    (lower.includes("model") &&
      (lower.includes("not found") || lower.includes("does not exist") || lower.includes("deprecated")))
  ) {
    return {
      code: "model",
      error: `Model not available or deprecated. Set eval.model to a supported id, or use eval.judge=cli.`,
    };
  }
  let error = `Judge API error${err?.status ? ` (${err.status})` : ""}: ${msg}`;
  if (err?.response?.data) {
    try { error += ` — ${JSON.stringify(err.response.data).slice(0, 200)}`; } catch {}
  }
  return { code: "network", error };
}

// ── Response parsing (prompt-JSON path) ────────────────────────────────────────

const JUDGE_SYSTEM_JSON = `You are a strict evaluator. Return ONLY a single valid JSON object (no markdown fences, no prose) with exactly these fields:
{
  "verdict": "PASS" | "FAIL",
  "verdictReason": string,
  "checklist": [
    {
      "instruction": string,
      "bindingness": "MANDATORY" | "CONDITIONAL" | "DISCRETIONARY",
      "itemVerdict": "ALIGNED" | "DRIFTED" | "JUSTIFIED" | "UNCLEAR",
      "evidence": string,
      "detail": string (optional)
    }
  ],
  "ambiguityFlags": string[],
  "userFamiliarity": integer 1-10,
  "userFamiliarityReason": string,
  "closure": "1-shot" | "multi-turn" | "incomplete",
  "userTurnsAfterSkill": integer >= 0
}
For rubric/artifact judging (no session), use userFamiliarity=5, userFamiliarityReason="not applicable (rubric mode)", closure="1-shot", userTurnsAfterSkill=0.
PASS only if no MANDATORY/CONDITIONAL checklist item has itemVerdict DRIFTED.`;

/** Parse model text into JudgeOutput via extractCandidates + Zod. */
export function parseJudgeText(text: string): JudgeResult {
  const candidates = extractCandidates(text);
  let lastIssue = "no JSON object found";
  for (const c of candidates) {
    const parsed = JudgeSchema.safeParse(c);
    if (parsed.success) return { success: true, data: parsed.data };
    lastIssue = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }
  return {
    success: false,
    code: "parse",
    error: `Judge returned unparseable JSON (${lastIssue}). Try another model or eval.judge=cli.`,
  };
}

/**
 * True when the provider is known to support OpenAI-style json_schema structured outputs.
 * Z.ai Coding Plan (and most OpenAI-compat gateways) reject response_format json_schema —
 * generateObject then fails with "No object generated: response did not match schema".
 */
function supportsStructuredOutputs(providerName: string, baseUrl: string): boolean {
  if (providerName === "openai" && baseUrl.includes("api.openai.com")) return true;
  return false;
}

// ── invokeJudge ────────────────────────────────────────────────────────────────

/**
 * Calls an LLM directly via Vercel AI SDK for eval judging.
 * Uses generateObject only on OpenAI; otherwise generateText + JSON parse
 * (Z.ai / Groq / OpenRouter / custom often lack structuredOutputs).
 */
export async function invokeJudge(
  promptText: string,
  evalCfg: EvalConfig,
  opts?: { timeoutMs?: number }
): Promise<JudgeResult> {
  silenceAiSdkWarnings();
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_JUDGE_TIMEOUT_MS;
  const { apiKey, baseUrl, model, providerName } = resolveDirectCredentials(evalCfg);

  if (!apiKey) {
    const detected = detectEnvProvider();
    const hint = detected
      ? `Set ${detected.provider.envKey} in your environment.`
      : `Set one of: ${PROVIDERS.filter((p) => p.requiresApiKey).map((p) => p.envKey).join(", ")}.`;
    return {
      success: false,
      code: "config",
      error: `No API key for eval judge. ${hint} Or set eval.judge=cli to use your coding agent.`,
    };
  }

  const provider = makeProvider(baseUrl, apiKey, providerName);
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
  const modelRef = provider(model);

  try {
    if (supportsStructuredOutputs(providerName, baseUrl)) {
      try {
        const { object } = await generateObject({
          model: modelRef,
          schema: JudgeSchema,
          system: JUDGE_SYSTEM_JSON,
          prompt: promptText,
          temperature: 0,
          abortSignal: abortController.signal,
        });
        return { success: true, data: object };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // Fall through to text+parse for transient schema failures
        if (!/object generated|schema|JSON|parse/i.test(msg)) {
          const mapped = mapJudgeError(e, timeoutMs);
          return { success: false, error: mapped.error, code: mapped.code };
        }
      }
    }

    const { text } = await generateText({
      model: modelRef,
      system: JUDGE_SYSTEM_JSON,
      prompt: promptText,
      temperature: 0,
      abortSignal: abortController.signal,
    });

    if (!text?.trim()) {
      return {
        success: false,
        code: "empty",
        error:
          "Judge API returned empty text (common with reasoning models if only reasoning tokens were used). Try glm-4.7 / a non-reasoning model, or eval.judge=cli.",
      };
    }

    return parseJudgeText(text);
  } catch (e: unknown) {
    const mapped = mapJudgeError(e, timeoutMs);
    return { success: false, error: mapped.error, code: mapped.code };
  } finally {
    clearTimeout(timeoutId);
  }
}
