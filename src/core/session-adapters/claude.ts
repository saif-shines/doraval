import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { parseSession } from "../session-parse.js";
import type { SessionAdapter, SessionListItem } from "./types.js";

/** Claude encodes cwd with a LEADING dash: /Users/x/p -> -Users-x-p */
function cwdToProjectHash(cwd: string): string {
  return cwd.replace(/\//g, "-");
}

export function createClaudeAdapter(homeDir: string = homedir()): SessionAdapter {
  return {
    agent: "claude-code",

    detect(): boolean {
      return existsSync(join(homeDir, ".claude"));
    },

    findLatestSession(cwd: string): string | null {
      const dir = join(homeDir, ".claude", "projects", cwdToProjectHash(cwd));
      if (!existsSync(dir)) return null;
      const files = readdirSync(dir)
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => ({ path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      for (const file of files) {
        const content = readFileSync(file.path, "utf8");
        if (content.includes('"type":"assistant"') || content.includes('"type": "assistant"')) {
          return file.path;
        }
      }
      return files[0]?.path ?? null;
    },

    listRecentSessions(cwd: string, limit = 10): SessionListItem[] {
      const dir = join(homeDir, ".claude", "projects", cwdToProjectHash(cwd));
      if (!existsSync(dir)) return [];
      const allFiles = readdirSync(dir)
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => ({ path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      const results: SessionListItem[] = [];
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

    parse(path: string) {
      return parseSession(readFileSync(path, "utf8"));
    },
  };
}

export const claudeCodeAdapter: SessionAdapter = createClaudeAdapter();
