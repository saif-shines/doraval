import { existsSync } from "fs";
import { resolve } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

export const claudeMonitorsValidator: Validator = {
  id: "claude:monitors",
  provider: "claude",
  name: "Claude Monitors (experimental)",
  description: "Validates monitors/monitors.json (or experimental.monitors): array of {name, command, description, when?}; commands support ${CLAUDE_PLUGIN_*} subs. Monitors run only in interactive CLI sessions.",

  detect(dir: string): boolean {
    return (
      existsSync(resolve(dir, "monitors", "monitors.json")) ||
      existsSync(resolve(dir, "monitors.json")) ||
      // optimistic for plugin manifests declaring experimental.monitors
      existsSync(resolve(dir, ".claude-plugin", "plugin.json"))
    );
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    let arr: any[] | null = null;
    const candidates = [
      resolve(dir, "monitors", "monitors.json"),
      resolve(dir, "monitors.json"),
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        try {
          const parsed = JSON.parse(await Bun.file(p).text());
          if (Array.isArray(parsed)) {
            arr = parsed;
            passes.push("monitors config is valid JSON array");
          }
          break;
        } catch {
          errors.push("monitors config is invalid JSON");
          return { errors, warnings, passes };
        }
      }
    }

    // Also check inline experimental.monitors from plugin manifest
    if (!arr) {
      const mp = resolve(dir, ".claude-plugin", "plugin.json");
      if (existsSync(mp)) {
        try {
          const m = JSON.parse(await Bun.file(mp).text());
          const exp = m?.experimental;
          const inline = typeof exp === "string" ? null : exp?.monitors;
          if (Array.isArray(inline)) arr = inline;
          else if (typeof inline === "string") {
            // path inside manifest; would be resolved at runtime
            passes.push("experimental.monitors declared as path in manifest (content not validated here)");
          }
        } catch {
          // intentional: optional inline monitors parse
        }
      }
    }

    if (!arr) {
      return { errors, warnings, passes };
    }

    if (!Array.isArray(arr)) {
      errors.push("monitors config must be a JSON array");
      return { errors, warnings, passes };
    }

    const seen = new Set<string>();
    arr.forEach((mon: any, i: number) => {
      if (!mon || typeof mon !== "object") {
        errors.push(`monitors[${i}]: entry must be an object`);
        return;
      }
      if (!mon.name || typeof mon.name !== "string") {
        errors.push(`monitors[${i}]: "name" (unique id) is required`);
      } else {
        if (seen.has(mon.name)) errors.push(`monitors: duplicate name "${mon.name}"`);
        seen.add(mon.name);
      }
      if (!mon.command || typeof mon.command !== "string") {
        errors.push(`monitors[${i}]: "command" (shell command) is required`);
      } else if (/\$\{CLAUDE_/.test(mon.command)) {
        passes.push(`monitors[${i}] "${mon.name || i}": uses CLAUDE_PLUGIN_* substitution`);
      }
      if (!mon.description) {
        warnings.push(`monitors[${i}]: "description" recommended (shown in task panel)`);
      }
      if (mon.when && !/^always$|^on-skill-invoke:/.test(String(mon.when))) {
        warnings.push(`monitors[${i}]: "when" should be "always" (default) or "on-skill-invoke:<skill>"`);
      }
    });

    passes.push(`${arr.length} monitor(s) declared`);

    warnings.push("Note: monitors are experimental, run only for interactive CLI sessions, and are skipped on some hosts. They do not stop automatically if the plugin is disabled mid-session.");

    return { errors, warnings, passes };
  },
};
