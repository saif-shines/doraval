import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { basename, join } from "path";
import { safeJsonParse, type SessionPrimitives, type ToolCall } from "../session-parse.js";
import type { SessionAdapter, SessionListItem } from "./types.js";

/** Cursor encodes cwd with NO leading dash: /Users/x/p -> Users-x-p */
function cwdToCursorDir(cwd: string): string {
  return cwd.replace(/\//g, "-").replace(/^-/, "");
}

/** Reverse of cwdToCursorDir is lossy; keep the original cwd from the caller instead. */

interface CursorLine {
  role?: string;
  message?: { content?: Array<{ type?: string; text?: string; name?: string; input?: Record<string, unknown> }> };
}

function stripUserQuery(text: string): string {
  const m = text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/);
  return (m ? m[1]! : text).trim();
}

function parseCursorTranscript(text: string, sessionId: string, cwd: string): SessionPrimitives {
  const toolCalls: ToolCall[] = [];
  const userMessages: string[] = [];
  const assistantText: string[] = [];
  let idx = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const j = safeJsonParse<CursorLine>(line);
    if (!j?.message?.content) continue;
    for (const block of j.message.content) {
      if (j.role === "user" && block.type === "text" && block.text) {
        userMessages.push(stripUserQuery(block.text));
      } else if (j.role === "assistant" && block.type === "text" && block.text) {
        assistantText.push(block.text);
      } else if (j.role === "assistant" && block.type === "tool_use" && block.name) {
        toolCalls.push({ name: block.name, input: block.input ?? {}, timestamp: "", index: idx++ });
      }
    }
  }
  const counts: Record<string, number> = {};
  for (const t of toolCalls) counts[t.name] = (counts[t.name] ?? 0) + 1;
  return {
    sessionId, model: "unknown", agent: "cursor", cwd,
    toolCalls, toolCallCounts: counts, skillsInvoked: [],
    userMessages, userTurnCount: userMessages.length, assistantText,
  };
}

export function createCursorAdapter(homeDir: string = homedir()): SessionAdapter {
  const transcriptsDir = (cwd: string) =>
    join(homeDir, ".cursor", "projects", cwdToCursorDir(cwd), "agent-transcripts");

  function list(cwd: string, limit: number): SessionListItem[] {
    const base = transcriptsDir(cwd);
    if (!existsSync(base)) return [];
    const items: SessionListItem[] = [];
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;                 // /subagents lives INSIDE uuid dirs; top level is uuid dirs
      const file = join(base, entry.name, `${entry.name}.jsonl`);
      if (!existsSync(file)) continue;
      items.push({ path: file, mtime: statSync(file).mtimeMs, skillCount: 0 });
    }
    return items.sort((a, b) => b.mtime - a.mtime).slice(0, limit);
  }

  return {
    agent: "cursor",
    detect(): boolean {
      return existsSync(join(homeDir, ".cursor", "projects"));
    },
    findLatestSession(cwd: string): string | null {
      return list(cwd, 1)[0]?.path ?? null;
    },
    listRecentSessions(cwd: string, limit = 10): SessionListItem[] {
      return list(cwd, limit);
    },
    parse(path: string): SessionPrimitives {
      const sessionId = basename(path, ".jsonl");
      // cwd is recoverable from the dir name only lossily; derive display cwd from path segments
      const projDir = basename(join(path, "..", "..", ".."));
      const cwd = "/" + projDir.replace(/-/g, "/");
      return parseCursorTranscript(readFileSync(path, "utf8"), sessionId, cwd);
    },
  };
}

export const cursorAdapter: SessionAdapter = createCursorAdapter();
