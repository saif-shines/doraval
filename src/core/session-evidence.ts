import { statSync } from "fs";
import { getAllAdapters } from "./session-adapters/index.js";
import { SESSION_WINDOW, SESSION_MAX_FILE_BYTES, withinWindow, type SessionAdapter } from "./session-adapters/types.js";
import type { SessionPrimitives } from "./session-parse.js";
import type { ReviewFinding } from "./review.js";

export interface LoadedSession {
  agent: string;
  path: string;
  mtime: number;
  primitives: SessionPrimitives;
}

export interface LoadResult {
  sessions: LoadedSession[];
  adaptersDetected: string[];
  skipped: Record<string, number>;
}

/** Load once per review run; reviewAll threads the result to every skill. */
export function loadRecentSessions(cwd: string, adapters: SessionAdapter[] = getAllAdapters()): LoadResult {
  const sessions: LoadedSession[] = [];
  const skipped: Record<string, number> = {};
  for (const adapter of adapters) {
    let listed;
    try {
      listed = adapter.listRecentSessions(cwd, SESSION_WINDOW);
    } catch {
      skipped[adapter.agent] = (skipped[adapter.agent] ?? 0) + 1;
      continue;
    }
    for (const item of listed) {
      if (!withinWindow(item.mtime)) continue;
      try {
        if (statSync(item.path).size > SESSION_MAX_FILE_BYTES) {
          skipped[adapter.agent] = (skipped[adapter.agent] ?? 0) + 1;
          continue;
        }
        sessions.push({ agent: adapter.agent, path: item.path, mtime: item.mtime, primitives: adapter.parse(item.path) });
      } catch {
        skipped[adapter.agent] = (skipped[adapter.agent] ?? 0) + 1;
      }
    }
  }
  return { sessions, adaptersDetected: adapters.map((a) => a.agent), skipped };
}

type EvidenceKind = "native" | "path" | "mention";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchSession(skillName: string, skillDir: string, s: LoadedSession): EvidenceKind | null {
  if (s.primitives.skillsInvoked.includes(skillName)) return "native";
  const needleDir = skillDir;
  const needleFile = `${skillName}/SKILL.md`;
  for (const tc of s.primitives.toolCalls) {
    const blob = JSON.stringify(tc.input ?? {});
    if (blob.includes(needleDir) || blob.includes(needleFile)) return "path";
  }
  // "/name" preceded by start-of-string or whitespace (a real slash-command
  // invocation), and not followed by a word char or hyphen — so /review ≠
  // /review-pr, and a path fragment like "src/review.ts" doesn't count either.
  const mention = new RegExp(`(?:^|\\s)/${escapeRegExp(skillName)}(?![\\w-])`);
  if (s.primitives.userMessages.some((m) => mention.test(m))) return "mention";
  return null;
}

export function collectSessionEvidence(
  skillName: string,
  skillDir: string,
  loaded: LoadResult,
  opts: { required: boolean }
): ReviewFinding[] {
  const total = loaded.sessions.length;

  if (total === 0) {
    return [{
      id: "sess-003", tier: "sessions", severity: "info",
      message: "No sessions found for this project. Use your agent, then re-run.",
      fixable: false,
    }];
  }

  // agent -> kind -> count
  const hits = new Map<string, Map<EvidenceKind, number>>();
  let invoked = 0;
  for (const s of loaded.sessions) {
    const kind = matchSession(skillName, skillDir, s);
    if (!kind) continue;
    invoked++;
    const byKind = hits.get(s.agent) ?? new Map<EvidenceKind, number>();
    byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
    hits.set(s.agent, byKind);
  }

  if (invoked > 0) {
    const breakdown = [...hits.entries()]
      .map(([agent, kinds]) => [...kinds.entries()].map(([k, n]) => `${agent}: ${n} ${k}`).join(", "))
      .join(", ");
    return [{
      id: "sess-001", tier: "sessions", severity: "pass",
      message: `Invoked in ${invoked} of ${total} recent sessions (${breakdown})`,
      fixable: false,
    }];
  }

  const agents = [...new Set(loaded.sessions.map((s) => s.agent))].join(", ");
  return [{
    id: "sess-002", tier: "sessions",
    severity: opts.required ? "warning" : "info",
    message: `Never invoked in ${total} recent sessions (${agents})`,
    fixable: false,
  }];
}
