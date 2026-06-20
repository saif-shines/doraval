import type { ProviderId } from "./types.js";

/**
 * Canonical cross-tool packaging spec.
 * Single source of truth for manifest paths, marketplace paths, MCP filenames, etc.
 * Derived from plans/006-multi-provider-master.md (authstack reference).
 *
 * Adapters and future validators should read from here to prevent drift.
 */
export const PROVIDER_SPECS = {
  claude: {
    id: "claude" as const,
    name: "Claude Code",
    manifestPath: ".claude-plugin/plugin.json",
    marketplacePath: ".claude-plugin/marketplace.json",
    mcpFilename: ".mcp.json",
    skillsField: "array-or-dir-string",
    sourceShape: "string",
    requiresInterface: false,
  },
  codex: {
    id: "codex" as const,
    name: "Codex",
    manifestPath: ".codex-plugin/plugin.json",
    marketplacePath: ".agents/plugins/marketplace.json",
    mcpFilename: ".mcp.json",
    skillsField: "directory-string",
    sourceShape: "object",
    requiresInterface: true,
  },
  cursor: {
    id: "cursor" as const,
    name: "Cursor",
    manifestPath: ".cursor-plugin/plugin.json",
    marketplacePath: ".cursor-plugin/marketplace.json",
    mcpFilename: "mcp.json",
    skillsField: "directory-string",
    sourceShape: "string",
    requiresInterface: false,
  },
  copilot: {
    id: "copilot" as const,
    name: "Copilot CLI",
    manifestPath: ".github/plugin/plugin.json",
    marketplacePath: ".github/plugin/marketplace.json",
    mcpFilename: ".mcp.json",
    skillsField: "array-of-paths",
    sourceShape: "string",
    requiresInterface: false,
  },
  grok: {
    id: "grok" as const,
    name: "Grok",
    manifestPath: ".grok-plugin/plugin.json",
    marketplacePath: ".grok-plugin/marketplace.json",
    mcpFilename: ".mcp.json",
    skillsField: "directory-string",
    sourceShape: "string",
    requiresInterface: false,
  },
} as const;

export type ProviderSpec = (typeof PROVIDER_SPECS)[ProviderId];

export function getProviderSpec(id: ProviderId): ProviderSpec {
  return PROVIDER_SPECS[id];
}

export const supportedProviders = Object.keys(PROVIDER_SPECS) as ProviderId[];
