import type { ProviderAdapter, ProviderContext, Decision, ScaffoldResult } from "./types.js";

import { claudeSkillValidator } from "../validators/claude/skill.js";
import { claudePluginValidator } from "../validators/claude/plugin.js";
import { claudeMarketplaceValidator } from "../validators/claude/marketplace.js";
import { claudeHooksValidator } from "../validators/claude/hooks.js";
import { claudeMcpValidator } from "../validators/claude/mcp.js";
import { claudeSubagentValidator } from "../validators/claude/subagent.js";
import { claudeCommandValidator } from "../validators/claude/command.js";
import { claudeMemoryValidator } from "../validators/claude/memory.js";
import { claudeLspValidator } from "../validators/claude/lsp.js";
import { claudeMonitorsValidator } from "../validators/claude/monitors.js";

import { codexPluginValidator } from "../validators/codex/plugin.js";
import { codexMarketplaceValidator } from "../validators/codex/marketplace.js";
import { codexMcpValidator } from "../validators/codex/mcp.js";
import { codexSkillValidator } from "../validators/codex/skill.js";

import { cursorPluginValidator } from "../validators/cursor/plugin.js";
import { cursorMarketplaceValidator } from "../validators/cursor/marketplace.js";
import { cursorMcpValidator } from "../validators/cursor/mcp.js";
import { cursorSkillValidator } from "../validators/cursor/skill.js";

import { copilotPluginValidator } from "../validators/copilot/plugin.js";
import { copilotMarketplaceValidator } from "../validators/copilot/marketplace.js";
import { copilotMcpValidator } from "../validators/copilot/mcp.js";
import { copilotSkillValidator } from "../validators/copilot/skill.js";

const claudeAdapter: ProviderAdapter = {
  id: "claude",
  name: "Claude Code",
  manifestPath: ".claude-plugin/plugin.json",
  marketplacePath: ".claude-plugin/marketplace.json",
  mcpFilename: ".mcp.json",
  validators: [
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
  ],
  detectContext(dir: string): ProviderContext {
    // Minimal implementation for foundation phase.
    // Full per-provider context detection will be added as adapters mature.
    return { cwd: dir };
  },
  async scaffold(
    decision: Decision,
    ctx: ProviderContext
  ): Promise<ScaffoldResult> {
    // Scaffold wiring is future work (see plans 006/010).
    throw new Error("Scaffold via adapter not yet implemented");
  },
};

const codexAdapter: ProviderAdapter = {
  id: "codex",
  name: "Codex",
  manifestPath: ".codex-plugin/plugin.json",
  marketplacePath: ".agents/plugins/marketplace.json",
  mcpFilename: ".mcp.json",
  validators: [
    codexPluginValidator,
    codexMarketplaceValidator,
    codexMcpValidator,
    codexSkillValidator,
  ],
  detectContext(dir: string): ProviderContext {
    return { cwd: dir };
  },
  async scaffold(
    decision: Decision,
    ctx: ProviderContext
  ): Promise<ScaffoldResult> {
    throw new Error("Scaffold via adapter not yet implemented");
  },
};

const cursorAdapter: ProviderAdapter = {
  id: "cursor",
  name: "Cursor",
  manifestPath: ".cursor-plugin/plugin.json",
  marketplacePath: ".cursor-plugin/marketplace.json",
  mcpFilename: "mcp.json",
  validators: [
    cursorPluginValidator,
    cursorMarketplaceValidator,
    cursorMcpValidator,
    cursorSkillValidator,
  ],
  detectContext(dir: string): ProviderContext {
    return { cwd: dir };
  },
  async scaffold(
    decision: Decision,
    ctx: ProviderContext
  ): Promise<ScaffoldResult> {
    // Scaffold for cursor via adapter is future work (cursor/copilot new.ts use thin working impl for first landing).
    // TODO(010): consolidate decidePath + scaffold into shared + forward from provider new commands + adapters.
    // See plans/010-complete-cursor-copilot-cli-symmetry.md
    throw new Error("Scaffold via adapter not yet implemented");
  },
};

const copilotAdapter: ProviderAdapter = {
  id: "copilot",
  name: "Copilot CLI",
  manifestPath: ".github/plugin/plugin.json",
  marketplacePath: ".github/plugin/marketplace.json",
  mcpFilename: ".mcp.json",
  validators: [
    copilotPluginValidator,
    copilotMarketplaceValidator,
    copilotMcpValidator,
    copilotSkillValidator,
  ],
  detectContext(dir: string): ProviderContext {
    return { cwd: dir };
  },
  async scaffold(
    decision: Decision,
    ctx: ProviderContext
  ): Promise<ScaffoldResult> {
    // Scaffold for copilot via adapter is future work (cursor/copilot new.ts use thin working impl for first landing).
    // TODO(010): consolidate decidePath + scaffold into shared + forward from provider new commands + adapters.
    // See plans/010-complete-cursor-copilot-cli-symmetry.md
    throw new Error("Scaffold via adapter not yet implemented");
  },
};

const grokAdapter: ProviderAdapter = {
  id: "grok",
  name: "Grok",
  manifestPath: ".grok-plugin/plugin.json",
  marketplacePath: ".grok-plugin/marketplace.json",
  mcpFilename: ".mcp.json",
  validators: [], // Grok provider support is focused on agent driving for test sessions; packaging validators added later
  detectContext(dir: string): ProviderContext {
    return { cwd: dir };
  },
  async scaffold(
    decision: Decision,
    ctx: ProviderContext
  ): Promise<ScaffoldResult> {
    throw new Error("Scaffold via adapter not yet implemented for grok");
  },
};

export const adapters: ProviderAdapter[] = [claudeAdapter, codexAdapter, cursorAdapter, copilotAdapter, grokAdapter];

export function resolveAdapter(id: string): ProviderAdapter | undefined {
  return adapters.find((a) => a.id === id);
}

// Re-export types for convenience
export type { ProviderAdapter, ProviderContext, Decision, ScaffoldResult } from "./types.js";
export { supportedProviders } from "./spec.js";
