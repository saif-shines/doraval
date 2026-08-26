import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { parseSession } from "../session-parse.js";
import type { SessionAdapter, SessionListItem } from "./types.js";

/** Claude encodes cwd with a LEADING dash: /Users/x/p -> -Users-x-p */
function cwdToProjectHash(cwd: string): string {
  return cwd.replace(/\//g, "-");
}

function takeClaudeFiles(files: { path: string; mtime: number }[], limit: number): SessionListItem[] {
  const results: SessionListItem[] = [];
  for (const file of files) {
    try {
      const text = readFileSync(file.path, "utf8");
      if (!text.includes('"type":"assistant"') && !text.includes('"type": "assistant"')) continue;
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
}

function listClaudeFiles(dir: string, limit: number): SessionListItem[] {
  if (!existsSync(dir)) return [];
  const allFiles = readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => ({ path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return takeClaudeFiles(allFiles, limit);
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
      return listClaudeFiles(join(homeDir, ".claude", "projects", cwdToProjectHash(cwd)), limit);
    },

    listAllRecentSessions(limit = 10): SessionListItem[] {
      const root = join(homeDir, ".claude", "projects");
      if (!existsSync(root)) return [];
      const files: { path: string; mtime: number }[] = [];
      for (const name of readdirSync(root, { withFileTypes: true })) {
        if (!name.isDirectory()) continue;
        const dir = join(root, name.name);
        for (const f of readdirSync(dir).filter((n) => n.endsWith(".jsonl"))) {
          const path = join(dir, f);
          files.push({ path, mtime: statSync(path).mtimeMs });
        }
      }
      files.sort((a, b) => b.mtime - a.mtime);
      return takeClaudeFiles(files, limit);
    },

    parse(path: string) {
      return parseSession(readFileSync(path, "utf8"));
    },
  };
}

export const claudeCodeAdapter: SessionAdapter = createClaudeAdapter();
