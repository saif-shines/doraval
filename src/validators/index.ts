import { claudeSkillValidator } from "./claude/skill.js";
import { claudePluginValidator } from "./claude/plugin.js";
import { claudeMarketplaceValidator } from "./claude/marketplace.js";
import { claudeHooksValidator } from "./claude/hooks.js";
import { claudeMcpValidator } from "./claude/mcp.js";
import { claudeSubagentValidator } from "./claude/subagent.js";
import { claudeCommandValidator } from "./claude/command.js";
import { claudeMemoryValidator } from "./claude/memory.js";
import { claudeLspValidator } from "./claude/lsp.js";
import { claudeMonitorsValidator } from "./claude/monitors.js";
import type { Validator } from "./types.js";

export const validators: Validator[] = [
  // Claude Code
  claudeSkillValidator,
  claudePluginValidator,
  claudeMarketplaceValidator,
  claudeHooksValidator,
  claudeMcpValidator,
  claudeSubagentValidator,
  claudeCommandValidator,
  claudeMemoryValidator,
  claudeLspValidator,
  claudeMonitorsValidator,
  // Future: cursor, codex, windsurf validators go here
];

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
    const providers = [...new Set(allValidators.map((v) => v.provider))];
    return { matched: [], error: `Unknown provider: "${forFlag}"\n\nAvailable providers: ${providers.join(", ")}` };
  }
  return { matched: byProvider };
}

export type { Validator, ValidateResult, ValidateOptions } from "./types.js";