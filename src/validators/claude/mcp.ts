import { existsSync } from "fs";
import { resolve } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";
import { normalizeMcpConfig } from "../shared/mcp.js";

export const claudeMcpValidator: Validator = {
  id: "claude:mcp",
  provider: "claude",
  name: "Claude MCP Config",
  description: "Validates .mcp.json (or inline via plugin.json mcpServers): server entries (stdio: command+args, or url), env, cwd, ${CLAUDE_PLUGIN_ROOT} etc. substitutions per Plugins reference",

  detect(dir: string): boolean {
    return existsSync(resolve(dir, ".mcp.json"));
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    const mcpPath = resolve(dir, ".mcp.json");

    let rawConfig: unknown;
    try {
      const raw = await Bun.file(mcpPath).text();
      rawConfig = JSON.parse(raw);
      passes.push(".mcp.json is valid JSON");
    } catch {
      errors.push(".mcp.json is missing or invalid JSON");
      return { errors, warnings, passes };
    }

    const normalized = normalizeMcpConfig(rawConfig, ".mcp.json");
    errors.push(...normalized.errors);
    passes.push(...normalized.passes);
    if (!normalized.config) {
      return { errors, warnings, passes };
    }
    const config = normalized.config;

    const serverNames = Object.keys(config);
    if (serverNames.length === 0) {
      warnings.push(".mcp.json is empty — no servers defined");
      return { errors, warnings, passes };
    }

    passes.push(`${serverNames.length} server(s) defined`);

    // Per-server validation (from MCP server configuration examples + env var section)
    for (const [name, entry] of Object.entries(config)) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        errors.push(`mcp server "${name}": definition must be an object`);
        continue;
      }
      const e = entry as Record<string, unknown>;

      const hasCommand = typeof e.command === "string";
      const hasUrl = typeof e.url === "string";

      if (!hasCommand && !hasUrl) {
        errors.push(`mcp server "${name}": must have either "command" (for stdio) or "url" (for SSE/HTTP)`);
      }
      if (hasCommand && !Array.isArray(e.args)) {
        // args optional but conventionally present; only warn if command without args for common case
        warnings.push(`mcp server "${name}": "command" present but no "args" array (ok for some servers)`);
      }
      if (hasUrl && hasCommand) {
        warnings.push(`mcp server "${name}": both "command" and "url" present — usually one or the other`);
      }

      if (e.env && typeof e.env === "object") {
        passes.push(`mcp server "${name}": has env`);
      }
      if (typeof e.cwd === "string") {
        passes.push(`mcp server "${name}": has cwd`);
      }

      // Variable substitutions supported in command/args/env/cwd values (documented)
      const hasSubs = JSON.stringify(e).match(/\$\{CLAUDE_PLUGIN_(ROOT|DATA)|CLAUDE_PROJECT_DIR|user_config\.|ENV_VAR\}/);
      if (hasSubs) {
        passes.push(`mcp server "${name}": uses \${CLAUDE_PLUGIN_*} / user_config / env substitution`);
      }
    }

    return { errors, warnings, passes };
  },
};