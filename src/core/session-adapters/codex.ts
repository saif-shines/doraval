import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { Database } from "bun:sqlite";
import { safeJsonParse, type Session } from "../session-parse.js";
import { parseCodexRollout } from "./codex-parse.js";
import type { SessionAdapter, SessionListItem } from "./types.js";

interface ThreadRow {
  id: string; rollout_path: string; title: string;
  model: string | null; git_branch: string | null; tokens_used: number; updated_at: number;
}

function listViaSqlite(homeDir: string, cwd: string | null, limit: number): SessionListItem[] | null {
  const dbPath = join(homeDir, ".codex", "state_5.sqlite");
  if (!existsSync(dbPath)) return null;
  try {
    const db = new Database(dbPath, { readonly: true });
    try {
      const rows = cwd == null
        ? db.query<ThreadRow, [number]>(
            `SELECT id, rollout_path, title, model, git_branch, tokens_used, updated_at
             FROM threads WHERE archived = 0 ORDER BY updated_at DESC LIMIT ?`
          ).all(limit)
        : db.query<ThreadRow, [string, number]>(
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
function listViaWalk(homeDir: string, cwd: string | null, limit: number): SessionListItem[] {
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
      if (meta?.type === "session_meta" && (cwd == null || meta.payload?.cwd === cwd)) {
        out.push({ path: f.path, mtime: f.mtime, skillCount: 0 });
        if (out.length >= limit) break;
      }
    } catch { /* skip unreadable */ }
  }
  return out;
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
    listAllRecentSessions(limit = 10): SessionListItem[] {
      return listViaSqlite(homeDir, null, limit) ?? listViaWalk(homeDir, null, limit);
    },
    parse(path: string): Session {
      return parseCodexRollout(readFileSync(path, "utf8"));
    },
  };
}

export const codexAdapter: SessionAdapter = createCodexAdapter();
