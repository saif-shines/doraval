/**
 * Doc registry (plan item B19 + per-finding docUrls).
 * Maps error-code families, finding codes, review tiers, and providers to real,
 * already-published doc pages — never a fabricated URL. Unmapped → undefined.
 */
import type { ProviderId } from "../providers/types.js";

const BASE = "https://doraval.dev";

const REVIEW = `${BASE}/commands/review/`;
const SCAN = `${BASE}/commands/scan/`;
const TIERS = `${BASE}/concepts/review-tiers/`;
const MEMORY = `${BASE}/concepts/memory/`;
const GET_STARTED = `${BASE}/get-started/`;
const INSTALL = `${BASE}/get-started/installation/`;

/** Error-code prefix (e.g. "E-JRN-001" → "E-JRN") to the doc page that explains it. */
const CODE_DOCS: Record<string, string> = {
  "E-JRN": MEMORY,
  "E-PRE": TIERS, // 001 tool, 002 auth, 003 sessions, 004 judge
  "E-NET": TIERS,
  "E-CFG": `${BASE}/commands/config/`,
  "E-SCF": `${BASE}/commands/new/`,
  "E-VAL": REVIEW,
  "E-SCAN": SCAN,
  "E-INSTALL": INSTALL,
};

/**
 * Exact finding / health codes (sess-*, E-SCAN-SHADOW, …).
 * Only pages that exist under apps/website/content.
 */
const FINDING_CODE_DOCS: Record<string, string> = {
  "E-VAL-001": REVIEW,
  "E-SCAN-SHADOW": SCAN,
  "E-SCAN-OVERLAP": SCAN,
  "E-SCAN-MCP": SCAN,
  "E-INSTALL-MISSING": INSTALL,
  "E-INSTALL-BINARY": INSTALL,
  "E-INSTALL-SKEW": INSTALL,
  "E-INSTALL-UNSUPPORTED": INSTALL,
  "E-INSTALL-SOURCE": GET_STARTED,
  "E-INSTALL-OK": INSTALL,
};

/** Review tier → overview page (when no more specific code). */
const TIER_DOCS: Record<string, string> = {
  structure: TIERS,
  heuristics: TIERS,
  llm: TIERS,
  sessions: TIERS,
};

/** Look up a doc URL for a DoravalError code (e.g. "E-PRE-002" → review-tiers page). */
export function getDocUrl(code: string): string | undefined {
  if (FINDING_CODE_DOCS[code]) return FINDING_CODE_DOCS[code];
  const prefix = code.split("-").slice(0, 2).join("-"); // "E-PRE-002" -> "E-PRE"
  return CODE_DOCS[prefix];
}

export interface FindingDocLookup {
  code?: string;
  tier?: string;
  provider?: string;
}

/**
 * Resolve a doc URL for a review/scan finding.
 * Order: exact code → E-* prefix → tier → provider → undefined.
 */
export function getFindingDocUrl(opts: FindingDocLookup): string | undefined {
  if (opts.code) {
    const fromCode = getDocUrl(opts.code);
    if (fromCode) return fromCode;
  }
  if (opts.tier && TIER_DOCS[opts.tier]) return TIER_DOCS[opts.tier];
  if (opts.provider) return getProviderDocUrl(opts.provider as ProviderId);
  return undefined;
}

/** Attach docUrl when missing and a real page exists. Pure; does not invent URLs. */
export function withDocUrl<T extends { code?: string; tier?: string; docUrl?: string; provider?: string }>(
  finding: T,
): T {
  if (finding.docUrl) return finding;
  const docUrl = getFindingDocUrl({
    code: finding.code,
    tier: finding.tier,
    provider: finding.provider,
  });
  return docUrl ? { ...finding, docUrl } : finding;
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
