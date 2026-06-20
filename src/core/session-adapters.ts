import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { parseSession, safeJsonParse, type SessionPrimitives } from "./session-parse.js";

export interface SessionAdapter {
  agent: string;
  detect(): boolean;
  findLatestSession(cwd: string): string | null;
  listRecentSessions(cwd: string, limit?: number): Array<{
    path: string;
    mtime: number;
    title?: string;
    skillCount: number;
  }>;
  parse(path: string): SessionPrimitives;
}

function cwdToProjectHash(cwd: string): string {
  return cwd.replace(/\//g, "-");
}

export const claudeCodeAdapter: SessionAdapter = {
  agent: "claude-code",

  detect(): boolean {
    return existsSync(join(homedir(), ".claude"));
  },

  findLatestSession(cwd: string): string | null {
    const hash = cwdToProjectHash(cwd);
    const dir = join(homedir(), ".claude", "projects", hash);
    if (!existsSync(dir)) return null;

    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => ({ name: f, path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    // Skip queue-only files (non-interactive sessions)
    for (const file of files) {
      const content = readFileSync(file.path, "utf8");
      if (content.includes('"type":"assistant"') || content.includes('"type": "assistant"')) {
        return file.path;
      }
    }
    return files[0]?.path ?? null;
  },

  listRecentSessions(cwd: string, limit = 10): Array<{
    path: string;
    mtime: number;
    title?: string;
    skillCount: number;
  }> {
    const hash = cwdToProjectHash(cwd);
    const dir = join(homedir(), ".claude", "projects", hash);
    if (!existsSync(dir)) return [];

    const allFiles = readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => ({ name: f, path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    const results: Array<{ path: string; mtime: number; title?: string; skillCount: number }> = [];
    for (const file of allFiles) {
      try {
        const text = readFileSync(file.path, "utf8");
        if (!text.includes('"type":"assistant"') && !text.includes('"type": "assistant"')) {
          continue; // skip queue-only
        }
        const prim = parseSession(text);
        results.push({
          path: file.path,
          mtime: file.mtime,
          title: prim.sessionTitle,
          skillCount: prim.skillsInvoked.length,
        });
        if (results.length >= limit) break;
      } catch {
        // ignore bad files
      }
    }
    return results;
  },

  parse(path: string): SessionPrimitives {
    const text = readFileSync(path, "utf8");
    return parseSession(text);
  },
};

// Basic Grok adapter (sessions stored under ~/.grok/sessions).
// For test-run generated traces we primarily capture stdout; this allows
// post-hoc eval of grok sessions when they exist.
const grokAdapter: SessionAdapter = {
  agent: "grok",

  detect(): boolean {
    try {
      const { homedir } = require("os");
      const { existsSync } = require("fs");
      const { join } = require("path");
      return existsSync(join(homedir(), ".grok", "sessions"));
    } catch {
      return false;
    }
  },

  findLatestSession(cwd: string): string | null {
    try {
      const { homedir } = require("os");
      const { existsSync, readdirSync, statSync } = require("fs");
      const { join } = require("path");
      const encoded = cwd.replace(/\//g, "%2F");  // Grok uses encoded cwd
      const base = join(homedir(), ".grok", "sessions", encoded);
      if (!existsSync(base)) return null;
      const subs = readdirSync(base).filter((d: string) => !d.startsWith("."));
      if (subs.length === 0) return null;
      // pick most recent subdir by mtime
      subs.sort((a: string, b: string) => {
        const ma = statSync(join(base, a)).mtimeMs;
        const mb = statSync(join(base, b)).mtimeMs;
        return mb - ma;
      });
      const latest = subs[0];
      const updates = join(base, latest, "updates.jsonl");
      if (existsSync(updates)) return updates;
      // fallback to a terminal log if present
      const termDir = join(base, latest, "terminal");
      if (existsSync(termDir)) {
        const logs = readdirSync(termDir).filter((f: string) => f.endsWith(".log"));
        if (logs.length) return join(termDir, logs[0]);
      }
      return null;
    } catch {
      return null;
    }
  },

  listRecentSessions(cwd: string, limit = 10) {
    const res: any[] = [];
    try {
      const { homedir } = require("os");
      const { existsSync, readdirSync, statSync } = require("fs");
      const { join } = require("path");
      const encoded = cwd.replace(/\//g, "%2F");
      const base = join(homedir(), ".grok", "sessions", encoded);
      if (!existsSync(base)) return [];
      const subs = readdirSync(base).filter((d: string) => !d.startsWith("."));
      subs.sort((a: string, b: string) => {
        const ma = statSync(join(base, a)).mtimeMs;
        const mb = statSync(join(base, b)).mtimeMs;
        return mb - ma;
      });
      for (const sub of subs.slice(0, limit)) {
        const updates = join(base, sub, "updates.jsonl");
        if (existsSync(updates)) {
          res.push({ path: updates, mtime: statSync(updates).mtimeMs, title: sub, skillCount: 0 });
        }
      }
    } catch {}
    return res;
  },

  parse(path: string): SessionPrimitives {
    const text = readFileSync(path, "utf8");
    // If it's updates.jsonl, parse events; else treat as log
    if (path.endsWith("updates.jsonl")) {
      const lines = text.split("\n").filter((l: string) => l.trim());
      const toolCalls: any[] = [];
      const userMessages: string[] = [];
      let idx = 0;
      for (const line of lines) {
        const j = safeJsonParse<any>(line);
        if (!j) continue;
        const u = j.params?.update || {};
        if (u.sessionUpdate === "user_message_chunk" && u.content?.text) {
          userMessages.push(u.content.text);
        }
        if (u.sessionUpdate === "tool_call" && u.title) {
          toolCalls.push({
            name: u.title,
            input: u.input || u.args || {},
            timestamp: new Date((j.timestamp || 0) * 1000).toISOString(),
            index: idx++,
          });
        }
      }
      const counts: Record<string, number> = {};
      for (const t of toolCalls) counts[t.name] = (counts[t.name] || 0) + 1;
      return {
        sessionId: path.split("/").pop()?.replace(".jsonl", "") || "grok",
        model: "grok",
        agent: "grok",
        cwd: process.cwd(),
        toolCalls,
        toolCallCounts: counts,
        skillsInvoked: [],
        userMessages: userMessages.slice(0, 5),
        userTurnCount: userMessages.length,
      } as any;
    }
    // fallback for log
    return {
      sessionId: "grok-" + Date.now(),
      model: "grok",
      agent: "grok",
      cwd: process.cwd(),
      toolCalls: [{ name: "GrokResponse", input: { content: text.slice(0, 3000) }, timestamp: "", index: 0 }],
      toolCallCounts: { GrokResponse: 1 },
      skillsInvoked: [],
      userMessages: [text.slice(0, 200)],
      userTurnCount: 1,
    } as any;
  },
};

const ADAPTERS: SessionAdapter[] = [claudeCodeAdapter, grokAdapter];

export function getAdapter(): SessionAdapter | null {
  return ADAPTERS.find((a) => a.detect()) ?? null;
}

export function getAllAdapters(): SessionAdapter[] {
  return ADAPTERS.filter((a) => a.detect());
}
