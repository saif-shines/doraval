import type { Validator } from "../validators/types.js";

export type ProviderId = "claude" | "codex" | "cursor" | "copilot" | "grok";

export interface ProviderAdapter {
  id: ProviderId;
  name: string;                          // "Claude Code"
  validators: Validator[];               // reuses existing Validator interface
}

export type Intent = "self" | "self-later" | "distribute";
