import { asSession, safeJsonParse, type Event, type Session, type ToolCall } from "../session-parse.js";

interface CopilotEvent {
  type?: string;
  timestamp?: string;
  data?: {
    sessionId?: string;
    context?: { cwd?: string; branch?: string };
    content?: unknown;
    toolName?: string;
    toolCallId?: string;
    arguments?: Record<string, unknown>;
    model?: string;
    newModel?: string;
    success?: boolean;
    result?: { content?: unknown; detailedContent?: unknown };
  };
}

function resultText(result: { content?: unknown; detailedContent?: unknown } | undefined): string {
  const content = typeof result?.content === "string" ? result.content.trim() : "";
  const detailed = typeof result?.detailedContent === "string" ? result.detailedContent.trim() : "";
  return detailed.length >= content.length ? detailed : content;
}

/** Copilot events.jsonl. Titles come from the first user message when the sqlite store is absent. */
export function parseCopilotEvents(text: string): Session {
  const toolCalls: ToolCall[] = [];
  const userMessages: string[] = [];
  const assistantText: string[] = [];
  const events: Event[] = [];
  let sessionId = "";
  let cwd = "";
  let gitBranch: string | undefined;
  let model = "unknown";
  let idx = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const row = safeJsonParse<CopilotEvent>(line);
    if (!row?.type || !row.data) continue;
    const ts = row.timestamp;
    const named = typeof row.data.newModel === "string" && row.data.newModel.trim()
      ? row.data.newModel.trim()
      : typeof row.data.model === "string" && row.data.model.trim()
        ? row.data.model.trim()
        : "";
    if (named) model = named;
    if (row.type === "session.start") {
      sessionId = row.data.sessionId ?? "";
      cwd = row.data.context?.cwd ?? "";
      gitBranch = row.data.context?.branch;
    } else if (row.type === "tool.execution_start" && row.data.toolName) {
      toolCalls.push({ name: row.data.toolName, input: row.data.arguments ?? {}, timestamp: row.timestamp ?? "", index: idx++ });
      const toolCallId = row.data.toolCallId;
      events.push({
        sessionId, seq: events.length, type: "tool_call",
        ...(ts ? { timestamp: ts } : {}),
        toolName: row.data.toolName,
        ...(toolCallId ? { toolCallId, id: toolCallId } : {}),
        input: row.data.arguments ?? {},
      });
    } else if (row.type === "tool.execution_complete") {
      const output = resultText(row.data.result);
      const toolCallId = row.data.toolCallId;
      if (toolCallId || output || row.data.success === false) {
        events.push({
          sessionId, seq: events.length, type: "tool_result",
          ...(ts ? { timestamp: ts } : {}),
          ...(toolCallId ? { toolCallId } : {}),
          ...(output ? { output } : {}),
          ...(row.data.success === false ? { isError: true } : {}),
        });
      }
    } else if (row.type === "user.message" && typeof row.data.content === "string") {
      const prompt = row.data.content.trim();
      if (prompt) {
        userMessages.push(prompt);
        events.push({ sessionId, seq: events.length, type: "user", ...(ts ? { timestamp: ts } : {}), text: prompt });
      }
    } else if (row.type === "assistant.message" && typeof row.data.content === "string") {
      const reply = row.data.content.trim();
      if (reply) {
        assistantText.push(reply);
        events.push({ sessionId, seq: events.length, type: "assistant", ...(ts ? { timestamp: ts } : {}), text: reply });
      }
    }
  }
  const counts: Record<string, number> = {};
  for (const tool of toolCalls) counts[tool.name] = (counts[tool.name] ?? 0) + 1;
  if (sessionId) {
    for (const event of events) {
      if (!event.sessionId) event.sessionId = sessionId;
    }
  }
  return asSession({
    sessionId, model, agent: "copilot", cwd, gitBranch,
    toolCalls, toolCallCounts: counts, skillsInvoked: [],
    userMessages, userTurnCount: userMessages.length, assistantText,
  }, events);
}
