import { asSession, safeJsonParse, type Event, type Session, type ToolCall } from "../session-parse.js";

function blockText(content: unknown, type: string): string[] {
  if (!Array.isArray(content)) return [];
  const out: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const record = block as { type?: string; text?: string };
    if (record.type === type && typeof record.text === "string" && record.text.trim()) out.push(record.text);
  }
  return out;
}

/** Tool output is a string or `{ type, text }[]`. Skip encrypted blocks. */
function outputText(output: unknown): string {
  if (typeof output === "string") return output.trim();
  if (Array.isArray(output)) {
    return output.map((item) => {
      if (!item || typeof item !== "object") return "";
      const record = item as { type?: string; text?: string };
      if (record.type === "encrypted_content" || typeof record.text !== "string") return "";
      return record.text.trim();
    }).filter(Boolean).join("\n");
  }
  if (!output || typeof output !== "object") return "";
  const record = output as Record<string, unknown>;
  for (const key of ["text", "content", "body", "output"]) {
    if (key in record) {
      const inner = outputText(record[key]);
      if (inner) return inner;
    }
  }
  return "";
}

function toolInput(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    const parsed = safeJsonParse<unknown>(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return raw.trim() ? { command: raw } : {};
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

/** Codex rollout JSONL. No sqlite. The model is `turn_context.model`, not `model_provider`. */
export function parseCodexRollout(text: string): Session {
  const toolCalls: ToolCall[] = [];
  const userMessages: string[] = [];
  const assistantText: string[] = [];
  const events: Event[] = [];
  let sessionId = "";
  let cwd = "";
  let model = "unknown";
  let idx = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const row = safeJsonParse<{ timestamp?: string; type?: string; payload?: Record<string, unknown> }>(line);
    if (!row?.payload) continue;
    const payload = row.payload;
    const ts = row.timestamp;
    if (row.type === "session_meta") {
      sessionId = typeof payload.session_id === "string" ? payload.session_id : typeof payload.id === "string" ? payload.id : "";
      cwd = typeof payload.cwd === "string" ? payload.cwd : "";
    } else if (row.type === "turn_context" && typeof payload.model === "string" && payload.model.trim()) {
      model = payload.model.trim();
    } else if (row.type === "response_item" && (payload.type === "function_call" || payload.type === "custom_tool_call") && typeof payload.name === "string") {
      const input = toolInput(payload.type === "custom_tool_call" ? payload.input : payload.arguments);
      toolCalls.push({ name: payload.name, input, timestamp: row.timestamp ?? "", index: idx++ });
      const toolCallId = typeof payload.call_id === "string" ? payload.call_id : typeof payload.id === "string" ? payload.id : undefined;
      events.push({
        sessionId, seq: events.length, type: "tool_call",
        ...(ts ? { timestamp: ts } : {}),
        toolName: payload.name,
        ...(toolCallId ? { toolCallId, id: toolCallId } : {}),
        input,
      });
    } else if (row.type === "response_item" && (payload.type === "function_call_output" || payload.type === "custom_tool_call_output")) {
      const toolCallId = typeof payload.call_id === "string" ? payload.call_id : typeof payload.id === "string" ? payload.id : undefined;
      const output = outputText(payload.output);
      if (!toolCallId && !output) continue;
      events.push({
        sessionId, seq: events.length, type: "tool_result",
        ...(ts ? { timestamp: ts } : {}),
        ...(toolCallId ? { toolCallId } : {}),
        ...(output ? { output } : {}),
      });
    } else if (row.type === "response_item" && payload.type === "message" && payload.role === "user") {
      for (const text of blockText(payload.content, "input_text")) {
        userMessages.push(text);
        events.push({ sessionId, seq: events.length, type: "user", ...(ts ? { timestamp: ts } : {}), text });
      }
    } else if (row.type === "response_item" && payload.type === "message" && payload.role === "assistant") {
      for (const text of blockText(payload.content, "output_text")) {
        assistantText.push(text);
        events.push({ sessionId, seq: events.length, type: "assistant", ...(ts ? { timestamp: ts } : {}), text, model });
      }
    } else if (payload.type === "agent_message" && typeof payload.message === "string" && payload.message.trim()) {
      assistantText.push(payload.message);
      events.push({ sessionId, seq: events.length, type: "assistant", ...(ts ? { timestamp: ts } : {}), text: payload.message, model });
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
    sessionId, model, agent: "codex", cwd,
    toolCalls, toolCallCounts: counts, skillsInvoked: [],
    userMessages, userTurnCount: userMessages.length, assistantText,
  }, events);
}
