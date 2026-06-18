import { existsSync } from "fs";
import { resolve } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

export const codexMcpValidator: Validator = {
  id: "codex:mcp",
  provider: "codex",
  name: "Codex MCP Config",
  description: "Validates .mcp.json (or inline via plugin.json mcpServers): server entries (stdio: command+args, or url), env, cwd, substitutions per Codex MCP support",

  detect(dir: string): boolean {
    return existsSync(resolve(dir, ".mcp.json"));
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    const mcpPath = resolve(dir, ".mcp.json");

    let config: Record<string, unknown>;
    try {
      const raw = await Bun.file(mcpPath).text();
      config = JSON.parse(raw);
      passes.push(".mcp.json is valid JSON");
    } catch {
      errors.push(".mcp.json is missing or invalid JSON");
      return { errors, warnings, passes };
    }

    if (typeof config !== "object" || Array.isArray(config)) {
      errors.push(".mcp.json must be a JSON object with server name keys");
      return { errors, warnings, passes };
    }

    const serverNames = Object.keys(config);
    if (serverNames.length === 0) {
      warnings.push(".mcp.json is empty — no servers defined");
      return { errors, warnings, passes };
    }

    passes.push(`${serverNames.length} server(s) defined`);

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

      // Codex supports similar substitutions; check for common ones
      const hasSubs = JSON.stringify(e).match(/\$\{CODEX_|CLAUDE_PLUGIN_|user_config\.|ENV_VAR\}/);
      if (hasSubs) {
        passes.push(`mcp server "${name}": uses substitutions (e.g. \${CODEX_*} or env)`);
      }
    }

    return { errors, warnings, passes };
  },
};
