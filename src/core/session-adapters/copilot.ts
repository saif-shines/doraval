import { existsSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { Database } from "bun:sqlite";
import type { Session } from "../session-parse.js";
import { parseCopilotEvents } from "./copilot-parse.js";
import type { SessionAdapter, SessionListItem } from "./types.js";

interface SessionRow { id: string; summary: string | null; updated_at: string }

export function createCopilotAdapter(homeDir: string = homedir()): SessionAdapter {
  const eventsPath = (id: string) => join(homeDir, ".copilot", "session-state", id, "events.jsonl");

  function list(cwd: string | null, limit: number): SessionListItem[] {
    const dbPath = join(homeDir, ".copilot", "session-store.db");
    if (!existsSync(dbPath)) return [];
    let rows: SessionRow[];
    try {
      const db = new Database(dbPath, { readonly: true });
      try {
        rows = cwd == null
          ? db.query<SessionRow, [number]>(
              `SELECT id, summary, updated_at FROM sessions ORDER BY updated_at DESC LIMIT ?`
            ).all(limit)
          : db.query<SessionRow, [string, number]>(
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
    listAllRecentSessions(limit = 10): SessionListItem[] {
      return list(null, limit);
    },
    parse(path: string): Session {
      return parseCopilotEvents(readFileSync(path, "utf8"));
    },
  };
}

export const copilotAdapter: SessionAdapter = createCopilotAdapter();
