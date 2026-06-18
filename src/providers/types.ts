import type { Validator } from "../validators/types.js";

export type ProviderId = "claude" | "codex" | "cursor" | "copilot";

export interface ProviderContext {
  cwd: string;
  hasPluginManifest?: boolean;
  hasMarketplace?: boolean;
  looseSkillFiles?: string[];
  isEmpty?: boolean;
  // Provider-specific fields can be added by adapters
}

export interface Decision {
  path: "standalone" | "plugin";
  targetDir: string;
  shouldCreateDir: boolean;
  migrateExisting: boolean;
}

export interface ScaffoldResult {
  success: boolean;
  targetDir: string;
  createdFiles: string[];
  message?: string;
}

export interface ProviderAdapter {
  id: ProviderId;
  name: string;                          // "Claude Code"
  manifestPath: string;                  // ".claude-plugin/plugin.json"
  marketplacePath: string;               // ".claude-plugin/marketplace.json"
  mcpFilename: string;                   // ".mcp.json" | "mcp.json"
  validators: Validator[];               // reuses existing Validator interface
  detectContext(dir: string): ProviderContext;
  scaffold(decision: Decision, ctx: ProviderContext): Promise<ScaffoldResult>;
}

export type Intent = "self" | "self-later" | "distribute";
