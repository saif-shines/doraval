import { readSessionLog, rollupFiles, type Turn } from "./group.ts";
import { isHiddenCwd, isHiddenSession } from "./hide.ts";
import type { SessionFacts, SessionRow } from "./read.ts";

type FileHandle = {
  kind: "file";
  getFile(): Promise<{ text(): Promise<string> }>;
};

type DirHandle = {
  kind: "directory";
  getDirectoryHandle(name: string): Promise<DirHandle>;
  getFileHandle(name: string): Promise<FileHandle>;
  entries(): AsyncIterable<[string, FileHandle | DirHandle]>;
};

export type GrokFolder = DirHandle;

const TURN_NEEDLE = '"turn_completed"';

function countTurns(text: string): number {
  let count = 0;
  let from = 0;
  while (from < text.length) {
    const at = text.indexOf(TURN_NEEDLE, from);
    if (at < 0) break;
    count += 1;
    from = at + TURN_NEEDLE.length;
  }
  return count;
}

async function readJson(dir: DirHandle, name: string): Promise<Record<string, unknown> | null> {
  try {
    const handle = await dir.getFileHandle(name);
    return JSON.parse(await (await handle.getFile()).text()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readText(dir: DirHandle, name: string): Promise<string | null> {
  try {
    const handle = await dir.getFileHandle(name);
    return (await handle.getFile()).text();
  } catch {
    return null;
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function findSessionDir(sessions: DirHandle, id: string): Promise<DirHandle | null> {
  for await (const [, group] of sessions.entries()) {
    if (group.kind !== "directory") continue;
    try {
      const dir = await group.getDirectoryHandle(id);
      await dir.getFileHandle("summary.json");
      return dir;
    } catch {
      // not this group
    }
  }
  return null;
}

export async function listGrokFolder(root: GrokFolder): Promise<SessionRow[]> {
  const sessions = await root.getDirectoryHandle("sessions");
  const active = await readJson(root, "active_sessions.json");
  const live = new Set<string>();
  if (Array.isArray(active)) {
    for (const row of active) {
      const id = (row as { session_id?: unknown }).session_id;
      if (typeof id === "string") live.add(id);
    }
  }

  const rows: (SessionRow & { dir?: DirHandle })[] = [];
  for await (const [, group] of sessions.entries()) {
    if (group.kind !== "directory") continue;
    for await (const [id, session] of group.entries()) {
      if (session.kind !== "directory" || id.startsWith(".")) continue;
      const summary = await readJson(session, "summary.json");
      if (!summary) continue;
      const info = (summary.info ?? {}) as { id?: unknown; cwd?: unknown };
      const sessionId = asString(info.id) || id;
      const folder = asString(info.cwd);
      const signals = await readJson(session, "signals.json");
      const hidden = isHiddenCwd(folder) || isHiddenSession(summary);
      rows.push({
        id: sessionId,
        title: asString(summary.session_summary) || asString(summary.generated_title) || sessionId,
        model: asString(summary.current_model_id) || "grok",
        folder,
        branch: asString(summary.head_branch),
        contextPct: asNumber(signals?.contextWindowUsage),
        errors: asNumber(signals?.errorCount),
        turns: null,
        live: live.has(sessionId),
        lastActive: asString(summary.last_active_at),
        hidden,
        dir: hidden ? undefined : session,
      });
    }
  }
  rows.sort((a, b) => {
    if (a.live !== b.live) return a.live ? -1 : 1;
    return b.lastActive.localeCompare(a.lastActive);
  });
  const counted = rows.filter((row) => !row.hidden).slice(0, 30);
  for (const row of counted) {
    const updates = row.dir ? await readText(row.dir, "updates.jsonl") : null;
    row.turns = updates == null ? null : countTurns(updates);
    delete row.dir;
  }
  for (const row of rows) delete row.dir;
  return rows;
}

export async function loadGrokSession(
  root: GrokFolder,
  id: string,
): Promise<{ row: SessionRow; turns: Turn[]; facts: SessionFacts } | null> {
  if (!/^[0-9a-f-]{20,}$/i.test(id)) return null;
  const sessions = await root.getDirectoryHandle("sessions");
  const dir = await findSessionDir(sessions, id);
  if (!dir) return null;
  const summary = await readJson(dir, "summary.json");
  const signals = await readJson(dir, "signals.json");
  const updates = await readText(dir, "updates.jsonl");
  if (!summary || updates == null) return null;
  const { turns, facts: extracted } = readSessionLog(updates);
  const info = (summary.info ?? {}) as { cwd?: unknown };
  const folder = asString(info.cwd);
  return {
    row: {
      id,
      title: asString(summary.session_summary) || asString(summary.generated_title) || id,
      model: asString(summary.current_model_id) || "grok",
      folder,
      branch: asString(summary.head_branch),
      contextPct: asNumber(signals?.contextWindowUsage),
      errors: asNumber(signals?.errorCount),
      turns: turns.filter((turn) => turn.closed).length,
      live: false,
      lastActive: asString(summary.last_active_at),
      hidden: isHiddenCwd(folder) || isHiddenSession(summary),
    },
    turns,
    facts: {
      subagents: extracted.subagents,
      recaps: extracted.recaps,
      skills: extracted.skills,
      permissions: extracted.permissions,
      files: rollupFiles(turns),
      ...(typeof extracted.costUsd === "number" ? { costUsd: extracted.costUsd } : {}),
      parentSessionId: asString(summary.parent_session_id) || null,
      logPath: `sessions/…/${id}/updates.jsonl`,
      headCommit: asString(summary.head_commit) || null,
      reasoningEffort: asString(summary.reasoning_effort) || null,
      sandbox: asString(summary.sandbox_profile) || null,
      compactionCount: asNumber(signals?.compactionCount),
    },
  };
}
