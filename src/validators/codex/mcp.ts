import { createMcpValidator } from "../shared/mcp.js";

export const codexMcpValidator = createMcpValidator({
  id: "codex:mcp",
  provider: "codex",
  name: "Codex MCP Config",
  description:
    "Validates .mcp.json (or inline via plugin.json mcpServers): server entries (stdio: command+args, or url), env, cwd, substitutions per Codex MCP support",
  fileName: ".mcp.json",
});
