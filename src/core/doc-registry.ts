/**
 * Doc registry (plan item B19). Maps error-code families and providers to real,
 * already-published doc pages — never a fabricated URL. Every E-* code should
 * link somewhere real; unmapped codes/providers get undefined (no link shown).
 */
import type { ProviderId } from "../providers/types.js";

const BASE = "https://doraval.thehacksmith.dev";

/** Error-code prefix (e.g. "E-JRN-001" → "E-JRN") to the doc page that explains it. */
const CODE_DOCS: Record<string, string> = {
  "E-JRN": `${BASE}/concepts/memory/`, // memory sync/init/promote — gh/git prerequisites, backup model
  "E-PRE": `${BASE}/concepts/review-tiers/`, // missing judge / gh / git for a required tier
  "E-NET": `${BASE}/concepts/review-tiers/`, // judge invocation failed
  "E-CFG": `${BASE}/commands/config/`,
  "E-SCF": `${BASE}/commands/new/`,
  "E-VAL": `${BASE}/commands/review/`,
};

/** Look up a doc URL for a DoravalError code (e.g. "E-PRE-002" → review-tiers page). */
export function getDocUrl(code: string): string | undefined {
  const prefix = code.split("-").slice(0, 2).join("-"); // "E-PRE-002" -> "E-PRE"
  return CODE_DOCS[prefix];
}

/** Each agent's own docs (verified real, cross-checked against AGENTS.md). */
const PROVIDER_DOCS: Partial<Record<ProviderId, string>> = {
  claude: "https://code.claude.com/llms.txt",
  codex: "https://developers.openai.com/llms.txt",
  cursor: "https://cursor.com/docs/plugins",
  copilot: "https://docs.github.com/llms.txt",
};

/** Look up a provider's own docs for validator findings tied to that agent. */
export function getProviderDocUrl(provider: ProviderId): string | undefined {
  return PROVIDER_DOCS[provider];
}
