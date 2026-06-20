import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { parseSession, type SessionPrimitives } from "./session-parse.js";

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

const ADAPTERS: SessionAdapter[] = [claudeCodeAdapter];

export function getAdapter(): SessionAdapter | null {
  return ADAPTERS.find((a) => a.detect()) ?? null;
}

export function getAllAdapters(): SessionAdapter[] {
  return ADAPTERS.filter((a) => a.detect());
}
