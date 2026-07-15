import type { SessionAdapter } from "./types.js";
import { claudeCodeAdapter } from "./claude.js";
import { grokAdapter } from "./grok.js";
import { cursorAdapter } from "./cursor.js";
import { codexAdapter } from "./codex.js";
import { copilotAdapter } from "./copilot.js";

export const ALL_ADAPTERS: SessionAdapter[] = [claudeCodeAdapter, grokAdapter, cursorAdapter, codexAdapter, copilotAdapter];

export function getAdapter(): SessionAdapter | null {
  return ALL_ADAPTERS.find((a) => a.detect()) ?? null;
}

export function getAllAdapters(): SessionAdapter[] {
  return ALL_ADAPTERS.filter((a) => a.detect());
}

export type { SessionAdapter, SessionListItem } from "./types.js";
export { claudeCodeAdapter, createClaudeAdapter } from "./claude.js";
export { grokAdapter, createGrokAdapter } from "./grok.js";
export { cursorAdapter, createCursorAdapter } from "./cursor.js";
export { codexAdapter, createCodexAdapter } from "./codex.js";
export { copilotAdapter, createCopilotAdapter } from "./copilot.js";
