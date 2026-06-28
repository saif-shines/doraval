export type ProviderDef = {
  name: string;
  displayName: string;
  baseUrl: string;
  /** Primary env var to hint in init and check for key detection. */
  envKey: string;
  /** Additional env vars that also work for this provider. */
  altEnvKeys: string[];
  /** Shown as placeholder/examples in init model prompt. */
  defaultModels: string[];
  requiresApiKey: boolean;
};

export const PROVIDERS: ProviderDef[] = [
  {
    name: "openai",
    displayName: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
    altEnvKeys: [],
    defaultModels: ["gpt-4o-mini", "gpt-4o"],
    requiresApiKey: true,
  },
  {
    name: "zai",
    displayName: "Z.ai / GLM",
    baseUrl: "https://api.z.ai/api/paas/v4",
    envKey: "ZAI_API_KEY",
    altEnvKeys: ["ZHIPU_API_KEY", "GLM_API_KEY"],
    defaultModels: ["glm-4-flash", "glm-4"],
    requiresApiKey: true,
  },
  {
    name: "groq",
    displayName: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
    altEnvKeys: [],
    defaultModels: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"],
    requiresApiKey: true,
  },
  {
    name: "openrouter",
    displayName: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    altEnvKeys: [],
    defaultModels: ["anthropic/claude-3-haiku", "google/gemini-flash-1.5"],
    requiresApiKey: true,
  },
  {
    name: "anthropic",
    displayName: "Anthropic (via compat)",
    baseUrl: "https://api.anthropic.com/v1",
    envKey: "ANTHROPIC_API_KEY",
    altEnvKeys: [],
    defaultModels: ["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"],
    requiresApiKey: true,
  },
  {
    name: "custom",
    displayName: "Custom (OpenAI-compatible)",
    baseUrl: "",
    envKey: "OPENAI_API_KEY",
    altEnvKeys: [],
    defaultModels: [],
    requiresApiKey: false,
  },
];

export function findProvider(name: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.name === name);
}

/**
 * Fetch available model IDs from a provider's /v1/models endpoint.
 * Returns empty array on any failure — callers should fall back to defaultModels.
 */
export async function fetchProviderModels(
  baseUrl: string,
  apiKey: string,
  timeoutMs = 8_000
): Promise<string[]> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const json = await res.json() as Record<string, unknown>;
    // Standard OpenAI: { data: [{id}] }  Some providers: [{ id }] or { models: [{id}] }
    const raw: unknown[] =
      Array.isArray(json.data) ? json.data as unknown[] :
      Array.isArray(json.models) ? json.models as unknown[] :
      Array.isArray(json) ? json as unknown[] :
      [];
    return raw
      .map((m) => {
        const model = m as Record<string, unknown>;
        return (typeof model.id === "string" ? model.id : typeof model.name === "string" ? model.name : "") as string;
      })
      .filter(Boolean);
  } catch {
    return [];
  } finally {
    clearTimeout(id);
  }
}

/** All env vars that could hold an API key across all providers. */
export const ALL_PROVIDER_ENV_KEYS: string[] = [
  ...new Set(PROVIDERS.flatMap((p) => [p.envKey, ...p.altEnvKeys])),
];

/**
 * Detect which provider env key is set (returns first match).
 * Checks primary envKey of each provider in PROVIDERS order.
 */
export function detectEnvProvider(): { provider: ProviderDef; key: string } | undefined {
  for (const p of PROVIDERS) {
    if (p.name === "custom") continue;
    for (const envVar of [p.envKey, ...p.altEnvKeys]) {
      const val = process.env[envVar];
      if (val) return { provider: p, key: envVar };
    }
  }
  return undefined;
}
