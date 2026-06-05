import { existsSync } from "fs";
import { resolve } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

const KNOWN_EVENTS = [
  "PreToolUse",
  "PostToolUse",
  "Stop",
  "SubagentStop",
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
  "PreCompact",
  "Notification",
  "PermissionRequest",
] as const;

export const claudeHooksValidator: Validator = {
  id: "claude:hooks",
  provider: "claude",
  name: "Claude Hooks",
  description: "Validates hooks/hooks.json: event names, matcher structure, hook types",

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
      config = JSON.parse(raw);
      passes.push("hooks.json is valid JSON");
    } catch {
      errors.push("hooks.json is missing or invalid JSON");
      return { errors, warnings, passes };
    }

    // Check event names
    const eventNames = Object.keys(config);
    for (const name of eventNames) {
      if ((KNOWN_EVENTS as readonly string[]).includes(name)) {
        passes.push(`Event "${name}" is a known lifecycle event`);
      } else {
        warnings.push(`Unknown event name: "${name}" — expected one of: ${KNOWN_EVENTS.join(", ")}`);
      }
    }

    // TODO: Validate matcher and hook structure per event
    // Rules will be added incrementally from official docs

    return { errors, warnings, passes };
  },
};