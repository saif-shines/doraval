import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import type { EvalConfig } from "./journal-config.js";
import {
  PROVIDERS,
  ALL_PROVIDER_ENV_KEYS,
  detectEnvProvider,
  findProvider,
  type ProviderDef,
} from "./providers.js";

export const DEFAULT_JUDGE_TIMEOUT_MS = 60_000;

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
      error: `Request timed out after ${Math.round(timeoutMs / 1000)}s. Try again, use a faster model, or set eval.judge=cli.`,
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

// ── invokeJudge ────────────────────────────────────────────────────────────────

/**
 * Calls an LLM directly via Vercel AI SDK for eval judging.
 * Uses generateObject + Zod schema for typed, validated output.
 * Supports any OpenAI-compatible provider via the PROVIDERS registry.
 */
export async function invokeJudge(
  promptText: string,
  evalCfg: EvalConfig,
  opts?: { timeoutMs?: number }
): Promise<JudgeResult> {
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

  try {
    const { object } = await generateObject({
      model: provider(model),
      schema: JudgeSchema,
      system:
        "You are a strict evaluator. Return ONLY a valid JSON object matching the schema exactly. No markdown, no prose.",
      prompt: promptText,
      temperature: 0,
      abortSignal: abortController.signal,
    });
    return { success: true, data: object };
  } catch (e: unknown) {
    const mapped = mapJudgeError(e, timeoutMs);
    return { success: false, error: mapped.error, code: mapped.code };
  } finally {
    clearTimeout(timeoutId);
  }
}
