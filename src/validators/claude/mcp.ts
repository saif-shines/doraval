import { createMcpValidator } from "../shared/mcp.js";

export const claudeMcpValidator = createMcpValidator({
  id: "claude:mcp",
  provider: "claude",
  name: "Claude MCP Config",
  description:
    "Validates .mcp.json (or inline via plugin.json mcpServers): server entries (stdio: command+args, or url), env, cwd, ${CLAUDE_PLUGIN_ROOT} etc. substitutions per Plugins reference",
  fileName: ".mcp.json",
});
