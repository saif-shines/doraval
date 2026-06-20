import type { Validator } from "./types.js";
import { adapters } from "../providers/index.js";
import { supportedProviders } from "../providers/spec.js";

// Validators are sourced from ProviderAdapter[] (see src/providers/index.ts + spec.ts).
export const validators: Validator[] = adapters.flatMap((a) => a.validators);

/**
 * Resolve --for flag to matching validators.
 *
 * Supports three forms:
 *   --for claude:plugin  → exact match on id
 *   --for claude         → all validators where provider === "claude"
 *   (omitted)            → all validators (caller runs detect)
 */
export function resolveFor(
  forFlag: string | undefined,
  allValidators: Validator[] = validators
): { matched: Validator[]; error?: string } {
  if (!forFlag) {
    return { matched: allValidators };
  }

  // Exact id match: "claude:plugin"
  if (forFlag.includes(":")) {
    const exact = allValidators.filter((v) => v.id === forFlag);
    if (exact.length === 0) {
      const available = allValidators.map((v) => v.id).join(", ");
      return { matched: [], error: `Unknown validator: "${forFlag}"\n\nAvailable: ${available}` };
    }
    return { matched: exact };
  }

  // Provider match: "claude"
  const byProvider = allValidators.filter((v) => v.provider === forFlag);
  if (byProvider.length === 0) {
    // Also allow providers that have adapters even if they have no validators yet (foundation phase)
    const knownProviders = [...new Set([
      ...allValidators.map((v) => v.provider),
      ...supportedProviders,
    ])];
    if (!knownProviders.includes(forFlag as (typeof knownProviders)[number])) {
      return { matched: [], error: `Unknown provider: "${forFlag}"\n\nAvailable providers: ${knownProviders.join(", ")}` };
    }
    // Provider is known (e.g. codex) but has no validators yet
    return { matched: [] };
  }
  return { matched: byProvider };
}

export type { Validator, ValidateResult, ValidateOptions } from "./types.js";