import { existsSync } from "fs";
import { resolve } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

export const claudeMcpValidator: Validator = {
  id: "claude:mcp",
  provider: "claude",
  name: "Claude MCP Config",
  description: "Validates .mcp.json: server definitions, required fields, path portability",

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

    // Check top-level structure
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

    // TODO: Validate each server entry (type-specific required fields)
    // Rules will be added incrementally from official docs

    return { errors, warnings, passes };
  },
};