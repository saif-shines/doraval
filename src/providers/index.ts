import type { ProviderAdapter } from "./types.js";

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
};

const codexAdapter: ProviderAdapter = {
  id: "codex",
  name: "Codex",
  validators: [
    codexPluginValidator,
    codexMarketplaceValidator,
    codexMcpValidator,
    codexSkillValidator,
  ],
};

const cursorAdapter: ProviderAdapter = {
  id: "cursor",
  name: "Cursor",
  validators: [
    cursorPluginValidator,
    cursorMarketplaceValidator,
    cursorMcpValidator,
    cursorSkillValidator,
  ],
};

const copilotAdapter: ProviderAdapter = {
  id: "copilot",
  name: "Copilot CLI",
  validators: [
    copilotPluginValidator,
    copilotMarketplaceValidator,
    copilotMcpValidator,
    copilotSkillValidator,
  ],
};

const grokAdapter: ProviderAdapter = {
  id: "grok",
  name: "Grok",
  validators: [], // Grok provider support is focused on agent driving for test sessions; packaging validators added later
};

export const adapters: ProviderAdapter[] = [claudeAdapter, codexAdapter, cursorAdapter, copilotAdapter, grokAdapter];

// Re-export types for convenience
export type { ProviderAdapter } from "./types.js";
export { supportedProviders } from "./spec.js";
