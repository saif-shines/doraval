import { asSession, safeJsonParse, type Event, type Session, type ToolCall } from "../session-parse.js";

interface CursorLine {
  role?: string;
  message?: { content?: Array<{ type?: string; text?: string; name?: string; input?: Record<string, unknown> }> };
}

function stripUserQuery(text: string): string {
  const match = text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/);
  return (match ? match[1]! : text).trim();
}

/** Cursor agent transcript JSONL. `cwd` is the project folder name when the log has no path. */
export function parseCursorTranscript(text: string, sessionId: string, cwd: string): Session {
  const toolCalls: ToolCall[] = [];
  const userMessages: string[] = [];
  const assistantText: string[] = [];
  const events: Event[] = [];
  let idx = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const row = safeJsonParse<CursorLine>(line);
    if (!row?.message?.content) continue;
    for (const block of row.message.content) {
      if (row.role === "user" && block.type === "text" && block.text) {
        const prompt = stripUserQuery(block.text);
        userMessages.push(prompt);
        events.push({ sessionId, seq: events.length, type: "user", text: prompt });
      } else if (row.role === "assistant" && block.type === "text" && block.text) {
        assistantText.push(block.text);
        events.push({ sessionId, seq: events.length, type: "assistant", text: block.text });
      } else if (row.role === "assistant" && block.type === "tool_use" && block.name) {
        toolCalls.push({ name: block.name, input: block.input ?? {}, timestamp: "", index: idx++ });
        events.push({ sessionId, seq: events.length, type: "tool_call", toolName: block.name, input: block.input ?? {} });
      }
    }
  }
  const counts: Record<string, number> = {};
  for (const tool of toolCalls) counts[tool.name] = (counts[tool.name] ?? 0) + 1;
  return asSession({
    sessionId, model: "unknown", agent: "cursor", cwd,
    toolCalls, toolCallCounts: counts, skillsInvoked: [],
    userMessages, userTurnCount: userMessages.length, assistantText,
  }, events);
}
