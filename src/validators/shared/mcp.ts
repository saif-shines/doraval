import { existsSync } from "fs";
import { resolve } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

/** Normalizes an MCP config's top level: unwraps a "mcpServers" wrapper if present, else uses the root as the server map. */
export interface McpNormalizeResult {
  config: Record<string, unknown> | null;
  errors: string[];
  passes: string[];
}

export function normalizeMcpConfig(rawConfig: unknown, fileLabel: string): McpNormalizeResult {
  const errors: string[] = [];
  const passes: string[] = [];

  if (
    rawConfig &&
    typeof rawConfig === "object" &&
    !Array.isArray(rawConfig) &&
    (rawConfig as Record<string, unknown>).mcpServers &&
    typeof (rawConfig as Record<string, unknown>).mcpServers === "object"
  ) {
    passes.push(`${fileLabel} uses mcpServers wrapper (normalized)`);
    return {
      config: (rawConfig as Record<string, unknown>).mcpServers as Record<string, unknown>,
      errors,
      passes,
    };
  }

  if (rawConfig && typeof rawConfig === "object" && !Array.isArray(rawConfig)) {
    return { config: rawConfig as Record<string, unknown>, errors, passes };
  }

  errors.push(`${fileLabel} must be an object (or contain mcpServers object)`);
  return { config: null, errors, passes };
}

/** Any ${…} / user_config / ENV_VAR style substitution in server entries. */
const SUBS_RE = /\$\{|user_config\.|ENV_VAR/;

export interface McpValidatorOptions {
  id: string;
  provider: string;
  name: string;
  description: string;
  /** Filename under dir, e.g. ".mcp.json" or "mcp.json" */
  fileName: string;
}

export function createMcpValidator(opts: McpValidatorOptions): Validator {
  const { id, provider, name, description, fileName } = opts;
  return {
    id,
    provider,
    name,
    description,
    detect(dir: string): boolean {
      return existsSync(resolve(dir, fileName));
    },
    async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
      const errors: string[] = [];
      const warnings: string[] = [];
      const passes: string[] = [];
      const mcpPath = resolve(dir, fileName);

      let rawConfig: unknown;
      try {
        rawConfig = JSON.parse(await Bun.file(mcpPath).text());
        passes.push(`${fileName} is valid JSON`);
      } catch {
        errors.push(`${fileName} is missing or invalid JSON`);
        return { errors, warnings, passes };
      }

      const normalized = normalizeMcpConfig(rawConfig, fileName);
      errors.push(...normalized.errors);
      passes.push(...normalized.passes);
      if (!normalized.config) return { errors, warnings, passes };
      const config = normalized.config;

      const serverNames = Object.keys(config);
      if (serverNames.length === 0) {
        warnings.push(`${fileName} is empty — no servers defined`);
        return { errors, warnings, passes };
      }
      passes.push(`${serverNames.length} server(s) defined`);

      for (const [serverName, entry] of Object.entries(config)) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          errors.push(`mcp server "${serverName}": definition must be an object`);
          continue;
        }
        const e = entry as Record<string, unknown>;
        const hasCommand = typeof e.command === "string";
        const hasUrl = typeof e.url === "string";

        if (!hasCommand && !hasUrl) {
          errors.push(
            `mcp server "${serverName}": must have either "command" (for stdio) or "url" (for SSE/HTTP)`,
          );
        }
        if (hasCommand && !Array.isArray(e.args)) {
          warnings.push(
            `mcp server "${serverName}": "command" present but no "args" array (ok for some servers)`,
          );
        }
        if (hasUrl && hasCommand) {
          warnings.push(
            `mcp server "${serverName}": both "command" and "url" present — usually one or the other`,
          );
        }
        if (e.env && typeof e.env === "object") {
          passes.push(`mcp server "${serverName}": has env`);
        }
        if (typeof e.cwd === "string") {
          passes.push(`mcp server "${serverName}": has cwd`);
        }
        if (SUBS_RE.test(JSON.stringify(e))) {
          passes.push(`mcp server "${serverName}": uses substitutions`);
        }
      }

      return { errors, warnings, passes };
    },
  };
}
