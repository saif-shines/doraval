import { existsSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { Database } from "bun:sqlite";
import { asSession, safeJsonParse, type Event, type Session, type ToolCall } from "../session-parse.js";
import type { SessionAdapter, SessionListItem } from "./types.js";

interface SessionRow { id: string; summary: string | null; updated_at: string }

interface CopilotEvent {
  type?: string;
  timestamp?: string;
  data?: {
    sessionId?: string; copilotVersion?: string;
    context?: { cwd?: string; branch?: string };
    content?: string; toolName?: string; toolCallId?: string; arguments?: Record<string, unknown>;
  };
}

function parseEvents(text: string): Session {
  const toolCalls: ToolCall[] = [];
  const userMessages: string[] = [];
  const assistantText: string[] = [];
  const events: Event[] = [];
  let sessionId = "", cwd = "", gitBranch: string | undefined;
  let idx = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const e = safeJsonParse<CopilotEvent>(line);
    if (!e?.type || !e.data) continue;
    const ts = e.timestamp;
    if (e.type === "session.start") {
      sessionId = e.data.sessionId ?? "";
      cwd = e.data.context?.cwd ?? "";
      gitBranch = e.data.context?.branch;
    } else if (e.type === "tool.execution_start" && e.data.toolName) {
      toolCalls.push({ name: e.data.toolName, input: e.data.arguments ?? {}, timestamp: e.timestamp ?? "", index: idx++ });
      const toolCallId = e.data.toolCallId;
      events.push({
        sessionId, seq: events.length, type: "tool_call",
        ...(ts ? { timestamp: ts } : {}),
        toolName: e.data.toolName,
        ...(toolCallId ? { toolCallId, id: toolCallId } : {}),
        input: e.data.arguments ?? {},
      });
    } else if (e.type === "user.message" && typeof e.data.content === "string") {
      // NOT transformedContent — that field embeds <system_reminder> / <current_datetime> noise
      const text = e.data.content.trim();
      if (text) {
        userMessages.push(text);
        events.push({ sessionId, seq: events.length, type: "user", ...(ts ? { timestamp: ts } : {}), text });
      }
    } else if (e.type === "assistant.message" && typeof e.data.content === "string") {
      // Real events.jsonl (sampled ~/.copilot/session-state/*/events.jsonl) shows most
      // assistant.message events on tool-call-only turns carry content: "" — filter empties
      // so assistantText doesn't fill up with blank entries (matches the trim+filter
      // convention already used for Claude Code's own text blocks in session-parse.ts).
      const text = e.data.content.trim();
      if (text) {
        assistantText.push(text);
        events.push({ sessionId, seq: events.length, type: "assistant", ...(ts ? { timestamp: ts } : {}), text });
      }
    }
  }
  const counts: Record<string, number> = {};
  for (const t of toolCalls) counts[t.name] = (counts[t.name] ?? 0) + 1;
  if (sessionId) {
    for (const ev of events) {
      if (!ev.sessionId) ev.sessionId = sessionId;
    }
  }
  return asSession({
    sessionId, model: "unknown", agent: "copilot", cwd, gitBranch,
    toolCalls, toolCallCounts: counts, skillsInvoked: [],
    userMessages, userTurnCount: userMessages.length, assistantText,
  }, events);
}

export function createCopilotAdapter(homeDir: string = homedir()): SessionAdapter {
  const eventsPath = (id: string) => join(homeDir, ".copilot", "session-state", id, "events.jsonl");

  function list(cwd: string, limit: number): SessionListItem[] {
    const dbPath = join(homeDir, ".copilot", "session-store.db");
    if (!existsSync(dbPath)) return [];
    let rows: SessionRow[];
    try {
      const db = new Database(dbPath, { readonly: true });
      try {
        rows = db.query<SessionRow, [string, number]>(
          `SELECT id, summary, updated_at FROM sessions WHERE cwd = ? ORDER BY updated_at DESC LIMIT ?`
        ).all(cwd, limit);
      } finally {
        db.close();
      }
    } catch {
      return []; // locked/corrupt db — no fallback source exists for Copilot
    }
    const items: SessionListItem[] = [];
    for (const r of rows) {
      const p = eventsPath(r.id);
      if (!existsSync(p)) continue;      // db row without events.jsonl → skip
      items.push({ path: p, mtime: statSync(p).mtimeMs, title: r.summary || undefined, skillCount: 0 });
    }
    return items;
  }

  return {
    agent: "copilot",
    detect(): boolean {
      return existsSync(join(homeDir, ".copilot"));
    },
    findLatestSession(cwd: string): string | null {
      return list(cwd, 1)[0]?.path ?? null;
    },
    listRecentSessions(cwd: string, limit = 10): SessionListItem[] {
      return list(cwd, limit);
    },
    parse(path: string): Session {
      return parseEvents(readFileSync(path, "utf8"));
    },
  };
}

export const copilotAdapter: SessionAdapter = createCopilotAdapter();
