import { SESSION_MAX_AGE_DAYS, SESSION_WINDOW } from "./session-adapters/types.js";
import type { LoadResult } from "./session-evidence.js";

export const CACHE_READ_THRESHOLD = 0.8;
export const CALL_COUNT_THRESHOLD = 20;
export const TURN_COUNT_THRESHOLD = 10;

export type SessionHealthCode = "cache-read" | "call-count" | "turn-count";

export interface SessionHealthSignal {
  code: SessionHealthCode;
  sessionId: string;
  agent: string;
  detail: string;
}

export interface SessionHealth {
  window: { last: number; maxAgeDays: number };
  sessionCount: number;
  signals: SessionHealthSignal[];
}

/** Token-pressure signals from loaded Sessions. Not a Finding. */
export function collectSessionHealth(loaded: LoadResult): SessionHealth {
  const signals: SessionHealthSignal[] = [];
  for (const s of loaded.sessions) {
    const p = s.primitives;
    const cache = p.cacheReadTokens;
    const input = p.inputTokens ?? 0;
    const output = p.outputTokens ?? 0;
    const denom = input + output + (cache ?? 0);
    if (cache != null && denom > 0 && cache / denom >= CACHE_READ_THRESHOLD) {
      const pct = Math.round((cache / denom) * 100);
      signals.push({
        code: "cache-read",
        sessionId: p.sessionId,
        agent: s.agent,
        detail: `${pct}% cache-read`,
      });
    }
    const calls = (p.events ?? []).filter((e) => e.type === "assistant" || e.type === "tool_call").length;
    if (calls >= CALL_COUNT_THRESHOLD) {
      signals.push({
        code: "call-count",
        sessionId: p.sessionId,
        agent: s.agent,
        detail: `${calls} calls`,
      });
    }
    if (p.userTurnCount >= TURN_COUNT_THRESHOLD) {
      signals.push({
        code: "turn-count",
        sessionId: p.sessionId,
        agent: s.agent,
        detail: `${p.userTurnCount} turns`,
      });
    }
  }
  return {
    window: { last: SESSION_WINDOW, maxAgeDays: SESSION_MAX_AGE_DAYS },
    sessionCount: loaded.sessions.length,
    signals,
  };
}
