import { existsSync } from "fs";
import { resolve } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

// Complete list of lifecycle events from the official Plugins reference (and user hooks).
// Plugins and user hooks respond to the exact same set.
const KNOWN_EVENTS = [
  "SessionStart",
  "Setup",
  "UserPromptSubmit",
  "UserPromptExpansion",
  "PreToolUse",
  "PermissionRequest",
  "PermissionDenied",
  "PostToolUse",
  "PostToolUseFailure",
  "PostToolBatch",
  "Notification",
  "MessageDisplay",
  "SubagentStart",
  "SubagentStop",
  "TaskCreated",
  "TaskCompleted",
  "Stop",
  "StopFailure",
  "TeammateIdle",
  "InstructionsLoaded",
  "ConfigChange",
  "CwdChanged",
  "FileChanged",
  "WorktreeCreate",
  "WorktreeRemove",
  "PreCompact",
  "PostCompact",
  "Elicitation",
  "ElicitationResult",
  "SessionEnd",
] as const;

type HookType = "command" | "http" | "mcp_tool" | "prompt" | "agent";

/** Plugin and settings files often nest events under a top-level `"hooks"` key. */
function normalizeHooksConfig(config: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(config);
  if (
    keys.length === 1 &&
    keys[0] === "hooks" &&
    config.hooks &&
    typeof config.hooks === "object" &&
    !Array.isArray(config.hooks)
  ) {
    return config.hooks as Record<string, unknown>;
  }
  return config;
}

export const claudeHooksValidator: Validator = {
  id: "claude:hooks",
  provider: "claude",
  name: "Claude Hooks",
  description: "Validates hooks/hooks.json (or root hooks.json): all lifecycle events per Plugins reference, hook group structure (matcher + hooks[]), supported hook types (command, http, mcp_tool, prompt, agent)",

  detect(dir: string): boolean {
    return (
      existsSync(resolve(dir, "hooks", "hooks.json")) ||
      existsSync(resolve(dir, "hooks.json"))
    );
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    const hooksPath = existsSync(resolve(dir, "hooks", "hooks.json"))
      ? resolve(dir, "hooks", "hooks.json")
      : resolve(dir, "hooks.json");

    let config: Record<string, unknown>;
    try {
      const raw = await Bun.file(hooksPath).text();
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      config = normalizeHooksConfig(parsed);
      passes.push("hooks.json is valid JSON");
      if (parsed !== config && Object.keys(parsed).length === 1 && "hooks" in parsed) {
        passes.push('Uses nested "hooks" object (plugin/settings layout)');
      }
    } catch {
      errors.push("hooks.json is missing or invalid JSON");
      return { errors, warnings, passes };
    }

    // Check event names against the full official list
    const eventNames = Object.keys(config);
    for (const name of eventNames) {
      if ((KNOWN_EVENTS as readonly string[]).includes(name)) {
        passes.push(`Event "${name}" is a known lifecycle event`);
      } else {
        warnings.push(`Unknown event name: "${name}" — see full list in Plugins reference (SessionStart, PreToolUse, PostToolUse, Stop, ...)`);
      }
    }

    // Basic structural validation for hook definitions (per "Hook configuration" examples and Hook types)
    // Each event value: array of groups. Each group: { matcher?: string, hooks: HookEntry[] }
    // HookEntry: { type: "command"|"http"|"mcp_tool"|"prompt"|"agent", command?: string, url?: string, ... }
    for (const [event, groups] of Object.entries(config)) {
      if (!Array.isArray(groups)) {
        errors.push(`Event "${event}": value must be an array of hook groups`);
        continue;
      }
      groups.forEach((group: any, gi: number) => {
        if (!group || typeof group !== "object") {
          errors.push(`${event}[${gi}]: hook group must be an object`);
          return;
        }
        if (group.matcher !== undefined && typeof group.matcher !== "string") {
          warnings.push(`${event}[${gi}]: "matcher" should be a string (e.g. "Write|Edit" or glob)`);
        }
        const hooksArr = group.hooks;
        if (!Array.isArray(hooksArr)) {
          errors.push(`${event}[${gi}]: missing or invalid "hooks" array`);
          return;
        }
        hooksArr.forEach((h: any, hi: number) => {
          if (!h || typeof h !== "object" || !h.type) {
            errors.push(`${event}[${gi}].hooks[${hi}]: must have "type"`);
            return;
          }
          const t = String(h.type) as HookType;
          if (!["command", "http", "mcp_tool", "prompt", "agent"].includes(t)) {
            warnings.push(`${event}[${gi}].hooks[${hi}]: unknown type "${t}" (valid: command, http, mcp_tool, prompt, agent)`);
          }
          if (t === "command" && !h.command) {
            errors.push(`${event}[${gi}].hooks[${hi}]: type=command requires "command"`);
          }
          if (t === "http" && !h.url) {
            errors.push(`${event}[${gi}].hooks[${hi}]: type=http requires "url"`);
          }
          // command strings commonly use "${CLAUDE_PLUGIN_ROOT}" etc. (substitution is runtime)
          if (h.command && typeof h.command === "string" && /\$\{CLAUDE_/.test(h.command)) {
            passes.push(`${event}[${gi}].hooks[${hi}]: uses plugin env substitution`);
          }
        });
        if (hooksArr.length > 0) {
          passes.push(`Event "${event}" has ${hooksArr.length} hook action(s)`);
        }
      });
    }

    return { errors, warnings, passes };
  },
};