import type { Session } from "../session-parse.js";
import { REVIEW_WINDOW_MAX_AGE_DAYS } from "../review-window.js";

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
  parse(path: string): Session;
}

export const SESSION_MAX_AGE_DAYS = REVIEW_WINDOW_MAX_AGE_DAYS;
export const SESSION_MAX_FILE_BYTES = 50 * 1024 * 1024;

/** True if mtime falls within maxAgeDays (default: Review window). */
export function withinWindow(
  mtimeMs: number,
  nowMs: number = Date.now(),
  maxAgeDays: number = SESSION_MAX_AGE_DAYS,
): boolean {
  return nowMs - mtimeMs <= maxAgeDays * 24 * 60 * 60 * 1000;
}
