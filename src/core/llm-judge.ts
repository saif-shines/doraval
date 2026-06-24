import OpenAI from "openai";
import type { EvalConfig } from "./journal-config.js";

// Shared JSON extraction (also used by CLI agent path for compatibility)
export function extractCandidates(text: string): Record<string, unknown>[] {
  let cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();

  const candidates: Record<string, unknown>[] = [];
  const allMatches = cleaned.match(/\{[\s\S]*?\}(?=\s*(?:\{|$))/g) ?? [];
  const fullMatch = cleaned.match(/\{[\s\S]*\}/);
  if (fullMatch) {
    try { candidates.push(JSON.parse(fullMatch[0]) as Record<string, unknown>); } catch {}
  }
  for (const m of allMatches) {
    try { candidates.push(JSON.parse(m) as Record<string, unknown>); } catch {}
  }

  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    try {
      const direct = JSON.parse(cleaned);
      if (direct && typeof direct === 'object') candidates.push(direct as Record<string, unknown>);
    } catch {}
  }

  const unwrapped: Record<string, unknown>[] = [];
  for (const c of candidates) {
    if (c.result) {
      let inner = c.result;
      if (typeof inner === "string") { try { inner = JSON.parse(inner); } catch {} }
      if (inner && typeof inner === "object") unwrapped.push(inner as Record<string, unknown>);
    }
    unwrapped.push(c);
  }

  function collectObjects(obj: any, out: any[] = []): any[] {
    if (!obj || typeof obj !== 'object') return out;
    if (Array.isArray(obj)) {
      for (const item of obj) collectObjects(item, out);
    } else {
      out.push(obj);
      for (const v of Object.values(obj)) collectObjects(v, out);
    }
    return out;
  }

  const nested: Record<string, unknown>[] = [];
  for (const c of [...candidates, ...unwrapped]) {
    collectObjects(c, nested);
  }

  return [...unwrapped, ...nested];
}

export type JudgeResult =
  | { success: true; data: Record<string, unknown> }
  | { success: false; error: string };

// Declarative provider configuration for maintainability.
// We only need to know the base for glm* models; users on special plans
// (e.g. GLM Coding Plan) can override with OPENAI_BASE_URL or eval.base_url.
interface LLMProvider {
  name: string;
  prefixes: string[];
  baseURL: string;
  keyEnvVars: string[];
}

const PROVIDERS: LLMProvider[] = [
  {
    name: 'zai',
    prefixes: ['glm', 'z.ai', 'zhipu'],
    baseURL: 'https://api.z.ai/api/paas/v4',
    keyEnvVars: ['ZAI_API_KEY', 'ZHIPU_API_KEY', 'GLM_API_KEY'],
  },
  // Future providers (OpenAI, Groq, etc.) can be added here declaratively.
];

function resolveProvider(model: string): LLMProvider | undefined {
  const m = (model || '').toLowerCase();
  return PROVIDERS.find((p) =>
    p.prefixes.some((prefix) => m.includes(prefix))
  );
}

function resolveApiKey(cfg: EvalConfig): string | undefined {
  if (cfg.api_key) return cfg.api_key;

  // Check in priority order from providers + common fallbacks
  const allKeys = [
    ...PROVIDERS.flatMap((p) => p.keyEnvVars),
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
  ];

  for (const key of allKeys) {
    const val = (process.env as Record<string, string | undefined>)[key];
    if (val) return val;
  }
  return undefined;
}

function resolveBaseURL(cfg: EvalConfig, model: string): string {
  if (cfg.base_url) return cfg.base_url;

  // Support common ways users set custom base URLs (works from .env, shell, etc.).
  // OPENAI_BASE_URL is the standard convention (OpenAI SDK, LiteLLM, etc.).
  // ZAI_BASE_URL is also supported for users who prefer ZAI_* naming.
  if (process.env.ZAI_BASE_URL) return process.env.ZAI_BASE_URL;
  if (process.env.OPENAI_BASE_URL) return process.env.OPENAI_BASE_URL;

  const provider = resolveProvider(model);
  if (provider) {
    // Default to the general endpoint for glm models.
    // Users on special plans (e.g. GLM Coding Plan) or with proxies
    // can override with OPENAI_BASE_URL / ZAI_BASE_URL or eval.base_url.
    return provider.baseURL;
  }

  return 'https://api.openai.com/v1';
}

export function canUseApiJudge(evalCfg: EvalConfig): boolean {
  if (evalCfg.base_url) return true;
  if (evalCfg.api_key) return true;

  // Also enable API path if user has set a custom base URL via env
  // (they likely intend to use direct API)
  if (process.env.ZAI_BASE_URL || process.env.OPENAI_BASE_URL) return true;

  const provider = resolveProvider(evalCfg.model || '');
  const envKeys = provider
    ? provider.keyEnvVars
    : ['ZAI_API_KEY', 'ZHIPU_API_KEY', 'GLM_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];

  return envKeys.some((k) => !!(process.env as any)[k]);
}

/**
 * Calls an LLM directly via OpenAI-compatible API for eval judging.
 * Uses the official OpenAI SDK for broad compatibility (GLM, OpenAI, etc.).
 * We default glm models to Z.AI's general endpoint. Users don't need to
 * tell us their plan — they can override base_url if needed.
 * Returns a structured result instead of mutating global state.
 */
export async function invokeJudge(
  promptText: string,
  evalCfg: EvalConfig
): Promise<JudgeResult> {
  const model = (evalCfg.model || '').trim() || 'gpt-4o-mini';
  const apiKey = resolveApiKey(evalCfg);
  const baseURL = resolveBaseURL(evalCfg, model);

  if (!apiKey) {
    return {
      success: false,
      error: 'No API key for eval judge (set ZAI_API_KEY / OPENAI_API_KEY, or eval.api_key).',
    };
  }

  const client = new OpenAI({
    apiKey,
    baseURL: baseURL.replace(/\/+$/, ''),
  });

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a strict evaluator. Return ONLY a single valid JSON object. No markdown, no prose, no fences.',
        },
        { role: 'user', content: promptText },
      ],
      temperature: 0,
      ...(model.startsWith('claude') ? {} : { response_format: { type: 'json_object' } }),
    });

    const content: string = completion.choices?.[0]?.message?.content ?? '';

    if (typeof content !== 'string' || !content.trim()) {
      return { success: false, error: 'Judge API returned empty content' };
    }

    const candidates = extractCandidates(content);
    for (const c of candidates) {
      if ('verdict' in c || 'checklist' in c) {
        return { success: true, data: c };
      }
    }
    if (candidates[0]) {
      return { success: true, data: candidates[0] };
    }
    return { success: false, error: 'No usable JSON found in judge response' };
  } catch (e: any) {
    const msg = e?.message || 'Judge API request failed';
    const status = e?.status ? ` (status ${e.status})` : '';
    let error = `Judge API error${status}: ${msg}`;
    if (e?.response?.data) {
      try {
        error += ` — ${JSON.stringify(e.response.data).slice(0, 300)}`;
      } catch {}
    }
    return { success: false, error };
  }
}
