import { basename, extname } from "path";
import { getAllAdapters, ALL_ADAPTERS, type SessionAdapter } from "./session-adapters/index.js";
import type { Session, SessionPrimitives } from "./session-parse.js";
import { resolveReviewWindow, type ReviewWindow } from "./review-window.js";
import { readConfigSync } from "./journal-config.js";
import { withinWindow } from "./session-adapters/types.js";

/** Human token line. Unset stays "unavailable" — never invent 0. */
export function formatTokenLabel(primitives: SessionPrimitives, listTokens?: number | null): string {
  const s = primitives as Session;
  const parts: string[] = [];
  if (s.inputTokens != null) parts.push(`${s.inputTokens} in`);
  if (s.outputTokens != null) parts.push(`${s.outputTokens} out`);
  if (s.cacheReadTokens != null) parts.push(`${s.cacheReadTokens} cache`);
  if (parts.length) return parts.join(" · ");
  if (listTokens != null) return String(listTokens);
  return "unavailable";
}

export interface SessionListEntry {
  agent: string;
  sessionId: string;
  when: string;
  title: string;
  turns: number;
  toolCalls: number;
  tokens: number | null;
  path: string;
}

const AGENT_ALIASES: Record<string, string> = {
  claude: "claude-code",
};

/** User-facing agent names ("claude") to the adapter's own name ("claude-code"). */
export function resolveAgentAlias(name: string): string {
  return AGENT_ALIASES[name] ?? name;
}

const KNOWN_ADAPTER_AGENTS = new Set(ALL_ADAPTERS.map((a) => a.agent));

/** True if an adapter exists for this agent name (regardless of whether it's installed). */
export function isKnownAgent(name: string): boolean {
  return KNOWN_ADAPTER_AGENTS.has(resolveAgentAlias(name));
}

function formatWhen(mtime: number): string {
  return new Date(mtime).toISOString().slice(0, 16).replace("T", " ");
}

function toEntry(adapter: SessionAdapter, s: { path: string; mtime: number; tokens?: number }, primitives: SessionPrimitives): SessionListEntry {
  return {
    agent: adapter.agent,
    sessionId: primitives.sessionId,
    when: formatWhen(s.mtime),
    title: primitives.sessionTitle ?? "(untitled)",
    turns: primitives.userTurnCount,
    toolCalls: primitives.toolCalls.length,
    tokens: s.tokens ?? null,
    path: s.path,
  };
}

export function listSessions(
  cwd: string,
  opts: { agent?: string; limit?: number; adapters?: SessionAdapter[]; window?: ReviewWindow } = {}
): SessionListEntry[] {
  const window = opts.window ?? resolveReviewWindow({ config: readConfigSync() });
  const pool = opts.adapters ?? getAllAdapters();
  const targetAgent = opts.agent ? resolveAgentAlias(opts.agent) : undefined;
  const adapters = targetAgent ? pool.filter((a) => a.agent === targetAgent) : pool;

  const withMtime: { entry: SessionListEntry; mtime: number }[] = [];
  for (const adapter of adapters) {
    const sessions = adapter.listRecentSessions(cwd, opts.limit ?? window.last);
    for (const s of sessions) {
      if (!withinWindow(s.mtime, Date.now(), window.maxAgeDays)) continue;
      try {
        const primitives = adapter.parse(s.path);
        withMtime.push({ entry: toEntry(adapter, s, primitives), mtime: s.mtime });
      } catch {
        // Skip unparseable sessions rather than failing the whole list.
      }
    }
  }

  // Sort by the raw mtime, not the minute-truncated "when" string — two
  // sessions seconds apart within the same minute would otherwise tie.
  const limit = opts.limit ?? window.last;
  return withMtime.sort((a, b) => b.mtime - a.mtime).slice(0, limit).map((x) => x.entry);
}

function needle(id: string): string {
  return id.replace(/…$/, "").replace(/\.\.\.$/, "");
}

function idHits(want: string, sessionId: string, fileId: string): "exact" | "prefix" | null {
  if (sessionId === want || fileId === want) return "exact";
  if (want.length > 0 && (sessionId.startsWith(want) || fileId.startsWith(want))) return "prefix";
  return null;
}

export function findSession(
  cwd: string,
  id: string,
  opts: { agent?: string; adapters?: SessionAdapter[] } = {}
): { entry: SessionListEntry; primitives: SessionPrimitives } | null {
  const pool = opts.adapters ?? getAllAdapters();
  const targetAgent = opts.agent ? resolveAgentAlias(opts.agent) : undefined;
  const adapters = targetAgent ? pool.filter((a) => a.agent === targetAgent) : pool;
  const want = needle(id);

  const hits: { entry: SessionListEntry; primitives: SessionPrimitives; kind: "exact" | "prefix" }[] = [];
  for (const adapter of adapters) {
    const sessions = adapter.listRecentSessions(cwd, 50);
    for (const s of sessions) {
      try {
        const primitives = adapter.parse(s.path);
        const fileId = basename(s.path).replace(extname(s.path), "");
        const kind = idHits(want, primitives.sessionId, fileId);
        if (kind) hits.push({ entry: toEntry(adapter, s, primitives), primitives, kind });
      } catch {
        // Skip unparseable sessions.
      }
    }
  }

  const exact = hits.filter((h) => h.kind === "exact");
  if (exact.length === 1) return exact[0]!;
  if (hits.length === 1) return hits[0]!;
  return null;
}
