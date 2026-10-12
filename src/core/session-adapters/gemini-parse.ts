import { asSession, safeJsonParse, type Event, type Session, type ToolCall } from "../session-parse.js";

type Part = {
  text?: unknown;
  thought?: unknown;
  functionCall?: { name?: unknown; args?: unknown; id?: unknown };
};

type HeldTool = { id: string; name: string; args: Record<string, unknown>; output: string; failed: boolean };

type Held = {
  id: string;
  type: string;
  timestamp?: string;
  text: string;
  thinking: string[];
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  tools: HeldTool[];
};

function parts(content: unknown): Part[] {
  if (typeof content === "string") return [{ text: content }];
  if (Array.isArray(content)) return content.flatMap((item) => parts(item));
  if (content && typeof content === "object") return [content as Part];
  return [];
}

function visibleText(content: unknown): string {
  return parts(content)
    .filter((part) => part.thought !== true && typeof part.text === "string" && part.text.trim())
    .map((part) => (part.text as string).trim())
    .join("\n\n");
}

function responseText(value: unknown): string {
  const text = visibleText(value);
  if (text) return text;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  for (const key of ["output", "result", "content", "stdout"]) {
    const inner = record[key];
    if (typeof inner === "string" && inner.trim()) return inner.trim();
    if (inner && typeof inner === "object") {
      const nested = responseText(inner);
      if (nested) return nested;
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function argsOf(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    const parsed = safeJsonParse<Record<string, unknown>>(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  }
  return {};
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toolsOf(row: Record<string, unknown>): HeldTool[] {
  if (Array.isArray(row.toolCalls)) {
    const tools: HeldTool[] = [];
    for (const call of row.toolCalls) {
      if (!call || typeof call !== "object") continue;
      const record = call as Record<string, unknown>;
      if (typeof record.name !== "string" || !record.name) continue;
      tools.push({
        id: typeof record.id === "string" ? record.id : record.name,
        name: record.name,
        args: argsOf(record.args),
        output: responseText(record.result),
        failed: record.status === "error" || record.status === "failed",
      });
    }
    if (tools.length > 0) return tools;
  }
  const fromParts: HeldTool[] = [];
  for (const part of parts(row.content)) {
    const call = part.functionCall;
    if (!call || typeof call.name !== "string" || !call.name) continue;
    fromParts.push({
      id: typeof call.id === "string" ? call.id : call.name,
      name: call.name,
      args: argsOf(call.args),
      output: "",
      failed: false,
    });
  }
  return fromParts;
}

function thoughtLines(row: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const push = (value: string) => {
    const text = value.trim();
    if (text && !lines.includes(text)) lines.push(text);
  };
  if (Array.isArray(row.thoughts)) {
    for (const thought of row.thoughts) {
      if (!thought || typeof thought !== "object") continue;
      const record = thought as Record<string, unknown>;
      const subject = typeof record.subject === "string" ? record.subject.trim() : "";
      const description = typeof record.description === "string" ? record.description.trim() : "";
      if (subject && description) push(`${subject}: ${description}`);
      else push(subject || description);
    }
  }
  for (const part of parts(row.content)) {
    if (part.thought === true && typeof part.text === "string") push(part.text);
  }
  return lines;
}

function heldFrom(row: Record<string, unknown>): Held | null {
  if (row.type !== "user" && row.type !== "gemini") return null;
  if (typeof row.id !== "string" || !row.id) return null;
  const tokens = row.tokens && typeof row.tokens === "object" ? row.tokens as Record<string, unknown> : undefined;
  const inputTokens = num(tokens?.input);
  const outputTokens = num(tokens?.output);
  const cacheReadTokens = num(tokens?.cached);
  return {
    id: row.id,
    type: row.type,
    ...(typeof row.timestamp === "string" ? { timestamp: row.timestamp } : {}),
    text: visibleText(row.displayContent) || visibleText(row.content),
    thinking: thoughtLines(row),
    ...(typeof row.model === "string" && row.model ? { model: row.model } : {}),
    ...(inputTokens != null ? { inputTokens } : {}),
    ...(outputTokens != null ? { outputTokens } : {}),
    ...(cacheReadTokens != null ? { cacheReadTokens } : {}),
    tools: row.type === "gemini" ? toolsOf(row) : [],
  };
}

/** Gemini CLI chats: `~/.gemini/tmp/<hash>/chats/session-*.jsonl`, or one legacy JSON object. */
export function parseGeminiChat(text: string, cwdHint = ""): Session {
  const trimmed = text.trim();
  const whole = safeJsonParse<Record<string, unknown>>(trimmed);
  const rows = whole && Array.isArray(whole.messages)
    ? [whole]
    : trimmed.split("\n").map((line) => safeJsonParse<Record<string, unknown>>(line)).filter((row): row is Record<string, unknown> => row != null);

  const messages = new Map<string, Held>();
  let sessionId = "";
  let title = "";
  let cwd = cwdHint;
  let model = "unknown";

  const takeMeta = (row: Record<string, unknown>) => {
    if (typeof row.sessionId === "string" && row.sessionId) sessionId = row.sessionId;
    if (typeof row.summary === "string" && row.summary.trim()) title = row.summary.trim();
    if (Array.isArray(row.directories)) {
      const first = row.directories.find((item) => typeof item === "string" && item.trim());
      if (typeof first === "string") cwd = first;
    }
  };

  for (const row of rows) {
    if (Array.isArray(row.messages)) {
      takeMeta(row);
      for (const message of row.messages) {
        if (!message || typeof message !== "object") continue;
        const held = heldFrom(message as Record<string, unknown>);
        if (held) messages.set(held.id, held);
      }
      continue;
    }
    if (typeof row.$rewindTo === "string") {
      const kept = [...messages.values()];
      const at = kept.findIndex((message) => message.id === row.$rewindTo);
      if (at >= 0) {
        messages.clear();
        for (const message of kept.slice(0, at + 1)) messages.set(message.id, message);
      }
      continue;
    }
    if (row.$set && typeof row.$set === "object") {
      takeMeta(row.$set as Record<string, unknown>);
      continue;
    }
    if (row.type === "session_metadata" || (typeof row.sessionId === "string" && row.type == null)) {
      takeMeta(row);
      continue;
    }
    if (row.type === "message_update" && typeof row.id === "string") {
      const current = messages.get(row.id);
      const next = heldFrom({ ...current, ...row, type: current?.type ?? "gemini", id: row.id });
      if (current && next) messages.set(row.id, {
        ...current, ...next,
        tools: next.tools.length > 0 ? next.tools : current.tools,
        thinking: next.thinking.length > 0 ? next.thinking : current.thinking,
      });
      continue;
    }
    const held = heldFrom(row);
    if (held) messages.set(held.id, held);
  }

  const events: Event[] = [];
  const toolCalls: ToolCall[] = [];
  const userMessages: string[] = [];
  const assistantText: string[] = [];
  let toolIndex = 0;
  for (const message of messages.values()) {
    if (message.model) model = message.model;
    if (message.type === "user") {
      if (!message.text) continue;
      userMessages.push(message.text);
      events.push({ sessionId, seq: events.length, type: "user", ...(message.timestamp ? { timestamp: message.timestamp } : {}), text: message.text });
      continue;
    }
    for (const thought of message.thinking) {
      events.push({ sessionId, seq: events.length, type: "thinking", ...(message.timestamp ? { timestamp: message.timestamp } : {}), text: thought });
    }
    if (message.text) {
      assistantText.push(message.text);
      events.push({
        sessionId, seq: events.length, type: "assistant",
        ...(message.timestamp ? { timestamp: message.timestamp } : {}),
        ...(message.model ? { model: message.model } : {}),
        ...(message.inputTokens != null ? { inputTokens: message.inputTokens } : {}),
        ...(message.outputTokens != null ? { outputTokens: message.outputTokens } : {}),
        ...(message.cacheReadTokens != null ? { cacheReadTokens: message.cacheReadTokens } : {}),
        text: message.text,
      });
    }
    for (const tool of message.tools) {
      toolCalls.push({ name: tool.name, input: tool.args, timestamp: message.timestamp ?? "", index: toolIndex++ });
      events.push({
        sessionId, seq: events.length, type: "tool_call",
        ...(message.timestamp ? { timestamp: message.timestamp } : {}),
        toolName: tool.name, toolCallId: tool.id, id: tool.id, input: tool.args,
      });
      if (tool.output || tool.failed) {
        events.push({
          sessionId, seq: events.length, type: "tool_result",
          toolCallId: tool.id, ...(tool.output ? { output: tool.output } : {}), ...(tool.failed ? { isError: true } : {}),
        });
      }
    }
  }

  const counts: Record<string, number> = {};
  for (const tool of toolCalls) counts[tool.name] = (counts[tool.name] ?? 0) + 1;
  return asSession({
    sessionId, ...(title ? { sessionTitle: title } : {}), model, agent: "gemini", cwd,
    toolCalls, toolCallCounts: counts, skillsInvoked: [],
    userMessages, userTurnCount: userMessages.length, assistantText,
  }, events);
}
