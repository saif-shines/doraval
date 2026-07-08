import { basename, extname } from "path";
import { claudeCodeAdapter, grokAdapter, getAllAdapters, type SessionAdapter } from "./session-adapters.js";
import type { SessionPrimitives } from "./session-parse.js";

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

const KNOWN_ADAPTER_AGENTS = new Set([claudeCodeAdapter.agent, grokAdapter.agent]);

/** True if an adapter exists for this agent name (regardless of whether it's installed). */
export function isKnownAgent(name: string): boolean {
  return KNOWN_ADAPTER_AGENTS.has(resolveAgentAlias(name));
}

function formatWhen(mtime: number): string {
  return new Date(mtime).toISOString().slice(0, 16).replace("T", " ");
}

function toEntry(adapter: SessionAdapter, path: string, mtime: number, primitives: SessionPrimitives): SessionListEntry {
  return {
    agent: adapter.agent,
    sessionId: primitives.sessionId,
    when: formatWhen(mtime),
    title: primitives.sessionTitle ?? "(untitled)",
    turns: primitives.userTurnCount,
    toolCalls: primitives.toolCalls.length,
    tokens: null,
    path,
  };
}

export function listSessions(
  cwd: string,
  opts: { agent?: string; limit?: number; adapters?: SessionAdapter[] } = {}
): SessionListEntry[] {
  const pool = opts.adapters ?? getAllAdapters();
  const targetAgent = opts.agent ? resolveAgentAlias(opts.agent) : undefined;
  const adapters = targetAgent ? pool.filter((a) => a.agent === targetAgent) : pool;

  const withMtime: { entry: SessionListEntry; mtime: number }[] = [];
  for (const adapter of adapters) {
    const sessions = adapter.listRecentSessions(cwd, opts.limit ?? 10);
    for (const s of sessions) {
      try {
        const primitives = adapter.parse(s.path);
        withMtime.push({ entry: toEntry(adapter, s.path, s.mtime, primitives), mtime: s.mtime });
      } catch {
        // Skip unparseable sessions rather than failing the whole list.
      }
    }
  }

  // Sort by the raw mtime, not the minute-truncated "when" string — two
  // sessions seconds apart within the same minute would otherwise tie.
  return withMtime.sort((a, b) => b.mtime - a.mtime).map((x) => x.entry);
}

export function findSession(
  cwd: string,
  id: string,
  opts: { agent?: string; adapters?: SessionAdapter[] } = {}
): { entry: SessionListEntry; primitives: SessionPrimitives } | null {
  const pool = opts.adapters ?? getAllAdapters();
  const targetAgent = opts.agent ? resolveAgentAlias(opts.agent) : undefined;
  const adapters = targetAgent ? pool.filter((a) => a.agent === targetAgent) : pool;

  for (const adapter of adapters) {
    const sessions = adapter.listRecentSessions(cwd, 50);
    for (const s of sessions) {
      try {
        const primitives = adapter.parse(s.path);
        const fileId = basename(s.path).replace(extname(s.path), "");
        if (primitives.sessionId === id || fileId === id) {
          return { entry: toEntry(adapter, s.path, s.mtime, primitives), primitives };
        }
      } catch {
        // Skip unparseable sessions.
      }
    }
  }

  return null;
}
