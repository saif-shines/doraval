import { createMcpValidator } from "../shared/mcp.js";

export const copilotMcpValidator = createMcpValidator({
  id: "copilot:mcp",
  provider: "copilot",
  name: "Copilot MCP Config",
  description:
    "Validates .mcp.json (referenced via mcpServers in manifest). Supports stdio and http servers.",
  fileName: ".mcp.json",
});
