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
    return { config: (rawConfig as Record<string, unknown>).mcpServers as Record<string, unknown>, errors, passes };
  }

  if (rawConfig && typeof rawConfig === "object" && !Array.isArray(rawConfig)) {
    return { config: rawConfig as Record<string, unknown>, errors, passes };
  }

  errors.push(`${fileLabel} must be an object (or contain mcpServers object)`);
  return { config: null, errors, passes };
}
