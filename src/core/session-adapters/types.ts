import type { SessionPrimitives } from "../session-parse.js";

export interface SessionListItem {
  path: string;
  mtime: number;
  title?: string;
  skillCount: number;
  tokens?: number;          // Codex fills this (Task 5); others leave undefined
}

export interface SessionAdapter {
  agent: string;
  detect(): boolean;
  findLatestSession(cwd: string): string | null;
  listRecentSessions(cwd: string, limit?: number): SessionListItem[];
  parse(path: string): SessionPrimitives;
}

export const SESSION_WINDOW = 10;
export const SESSION_MAX_AGE_DAYS = 30;
export const SESSION_MAX_FILE_BYTES = 50 * 1024 * 1024;

/** True if mtime falls within the 30-day evidence window. */
export function withinWindow(mtimeMs: number, nowMs: number = Date.now()): boolean {
  return nowMs - mtimeMs <= SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}
