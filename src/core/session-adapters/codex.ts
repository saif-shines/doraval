import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { Database } from "bun:sqlite";
import { safeJsonParse, type SessionPrimitives, type ToolCall } from "../session-parse.js";
import type { SessionAdapter, SessionListItem } from "./types.js";

interface ThreadRow {
  id: string; rollout_path: string; title: string;
  model: string | null; git_branch: string | null; tokens_used: number; updated_at: number;
}

function listViaSqlite(homeDir: string, cwd: string, limit: number): SessionListItem[] | null {
  const dbPath = join(homeDir, ".codex", "state_5.sqlite");
  if (!existsSync(dbPath)) return null;
  try {
    const db = new Database(dbPath, { readonly: true });
    try {
      const rows = db.query<ThreadRow, [string, number]>(
        `SELECT id, rollout_path, title, model, git_branch, tokens_used, updated_at
         FROM threads WHERE cwd = ? AND archived = 0 ORDER BY updated_at DESC LIMIT ?`
      ).all(cwd, limit);
      return rows
        .filter((r) => existsSync(r.rollout_path))
        .map((r) => ({
          path: r.rollout_path,
          mtime: statSync(r.rollout_path).mtimeMs,
          title: r.title || undefined,
          skillCount: 0,
          tokens: r.tokens_used,
        }));
    } finally {
      db.close();
    }
  } catch {
    return null; // locked/corrupt → caller falls back to rollout walk
  }
}

/** Fallback: walk ~/.codex/sessions/YYYY/MM/DD/*.jsonl and match session_meta.payload.cwd. */
function listViaWalk(homeDir: string, cwd: string, limit: number): SessionListItem[] {
  const root = join(homeDir, ".codex", "sessions");
  if (!existsSync(root)) return [];
  const files: { path: string; mtime: number }[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".jsonl")) files.push({ path: full, mtime: statSync(full).mtimeMs });
    }
  };
  try { walk(root); } catch { return []; }
  files.sort((a, b) => b.mtime - a.mtime);
  const out: SessionListItem[] = [];
  for (const f of files) {
    try {
      const firstLine = readFileSync(f.path, "utf8").split("\n", 1)[0] ?? "";
      const meta = safeJsonParse<{ type?: string; payload?: { cwd?: string } }>(firstLine);
      if (meta?.type === "session_meta" && meta.payload?.cwd === cwd) {
        out.push({ path: f.path, mtime: f.mtime, skillCount: 0 });
        if (out.length >= limit) break;
      }
    } catch { /* skip unreadable */ }
  }
  return out;
}

function parseRollout(text: string): SessionPrimitives {
  const toolCalls: ToolCall[] = [];
  const userMessages: string[] = [];
  const assistantText: string[] = [];
  let sessionId = "", cwd = "", model = "unknown";
  let idx = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const j = safeJsonParse<{ timestamp?: string; type?: string; payload?: any }>(line);
    if (!j?.payload) continue;
    const p = j.payload;
    if (j.type === "session_meta") {
      sessionId = p.session_id ?? p.id ?? "";
      cwd = p.cwd ?? "";
      model = p.model_provider ?? "unknown";
    } else if (j.type === "response_item" && p.type === "function_call" && typeof p.name === "string") {
      // arguments is a JSON *string*; on parse failure keep {} — raw name still counts
      const input = typeof p.arguments === "string" ? (safeJsonParse<Record<string, unknown>>(p.arguments) ?? {}) : (p.arguments ?? {});
      toolCalls.push({ name: p.name, input, timestamp: j.timestamp ?? "", index: idx++ });
    } else if (j.type === "response_item" && p.type === "message" && p.role === "user" && Array.isArray(p.content)) {
      for (const b of p.content) {
        if (b?.type === "input_text" && typeof b.text === "string") userMessages.push(b.text);
      }
    } else if (p.type === "agent_message" && typeof p.message === "string") {
      // Real Codex rollouts wrap this as top-level type "event_msg" (not "response_item" as
      // the plan's synthetic fixture assumed) — match on payload.type regardless of wrapper
      // so both the fixture and real dogfood data parse correctly.
      assistantText.push(p.message);
    }
  }
  const counts: Record<string, number> = {};
  for (const t of toolCalls) counts[t.name] = (counts[t.name] ?? 0) + 1;
  return {
    sessionId, model, agent: "codex", cwd,
    toolCalls, toolCallCounts: counts, skillsInvoked: [],
    userMessages, userTurnCount: userMessages.length, assistantText,
  };
}

export function createCodexAdapter(homeDir: string = homedir()): SessionAdapter {
  return {
    agent: "codex",
    detect(): boolean {
      return existsSync(join(homeDir, ".codex"));
    },
    findLatestSession(cwd: string): string | null {
      return this.listRecentSessions(cwd, 1)[0]?.path ?? null;
    },
    listRecentSessions(cwd: string, limit = 10): SessionListItem[] {
      return listViaSqlite(homeDir, cwd, limit) ?? listViaWalk(homeDir, cwd, limit);
    },
    parse(path: string): SessionPrimitives {
      return parseRollout(readFileSync(path, "utf8"));
    },
  };
}

export const codexAdapter: SessionAdapter = createCodexAdapter();
