import { existsSync } from "fs";
import { resolve } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

export const cursorMcpValidator: Validator = {
  id: "cursor:mcp",
  provider: "cursor",
  name: "Cursor MCP Config",
  description: "Validates mcp.json (Cursor uses no leading dot; supports mcpServers wrapper or direct server map)",

  detect(dir: string): boolean {
    // Cursor uses mcp.json (no dot prefix) — distinct from .mcp.json used by others
    return existsSync(resolve(dir, "mcp.json"));
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    const mcpPath = resolve(dir, "mcp.json");

    let rawConfig: any;
    try {
      const raw = await Bun.file(mcpPath).text();
      rawConfig = JSON.parse(raw);
      passes.push("mcp.json is valid JSON");
    } catch {
      errors.push("mcp.json is missing or invalid JSON");
      return { errors, warnings, passes };
    }

    // Cursor's observed format in real projects often wraps under "mcpServers"
    let config: Record<string, unknown>;
    if (rawConfig && typeof rawConfig === "object" && !Array.isArray(rawConfig) && rawConfig.mcpServers && typeof rawConfig.mcpServers === "object") {
      config = rawConfig.mcpServers as Record<string, unknown>;
      passes.push("mcp.json uses mcpServers wrapper (normalized)");
    } else if (typeof rawConfig === "object" && !Array.isArray(rawConfig)) {
      config = rawConfig;
    } else {
      errors.push("mcp.json must be an object (or contain mcpServers object)");
      return { errors, warnings, passes };
    }

    const serverNames = Object.keys(config);
    if (serverNames.length === 0) {
      warnings.push("mcp.json is empty — no servers defined");
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

      // Common substitutions across tools
      const hasSubs = JSON.stringify(e).match(/\$\{CODEX_|CLAUDE_PLUGIN_|CURSOR_|user_config\.|ENV_VAR\}/);
      if (hasSubs) {
        passes.push(`mcp server "${name}": uses substitutions`);
      }
    }

    return { errors, warnings, passes };
  },
};
