import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { parseSession, safeJsonParse, type SessionPrimitives } from "../session-parse.js";
import type { SessionAdapter, SessionListItem } from "./types.js";

export function createGrokAdapter(homeDir: string = homedir()): SessionAdapter {
  return {
    agent: "grok",

    detect(): boolean {
      try {
        return existsSync(join(homeDir, ".grok", "sessions"));
      } catch {
        return false;
      }
    },

    findLatestSession(cwd: string): string | null {
      try {
        const encoded = cwd.replace(/\//g, "%2F");  // Grok uses encoded cwd
        const base = join(homeDir, ".grok", "sessions", encoded);
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

    listRecentSessions(cwd: string, limit = 10): SessionListItem[] {
      const res: SessionListItem[] = [];
      try {
        const encoded = cwd.replace(/\//g, "%2F");
        const base = join(homeDir, ".grok", "sessions", encoded);
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
          assistantText: [],
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
        assistantText: [],
      } as any;
    },
  };
}

export const grokAdapter: SessionAdapter = createGrokAdapter();
