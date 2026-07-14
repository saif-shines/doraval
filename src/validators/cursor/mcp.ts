import { createMcpValidator } from "../shared/mcp.js";

export const cursorMcpValidator = createMcpValidator({
  id: "cursor:mcp",
  provider: "cursor",
  name: "Cursor MCP Config",
  description:
    "Validates mcp.json (Cursor uses no leading dot; supports mcpServers wrapper or direct server map)",
  fileName: "mcp.json",
});
