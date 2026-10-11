import { access, open, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { readSessionLog, rollupFiles, type FileChange, type Turn } from "./group.ts";
import { isHiddenCwd, isHiddenSession } from "./hide.ts";

export { isHiddenCwd, isHiddenSession };

const updatesById = new Map<string, string>();

function cacheKey(root: string, id: string): string {
  return `${root}\0${id}`;
}

export type SessionRow = {
  id: string;
  title: string;
  model: string;
  folder: string;
  branch: string;
  contextPct: number | null;
  errors: number | null;
  turns: number | null;
  live: boolean;
  lastActive: string;
  hidden: boolean;
};

const TURN_NEEDLE = Buffer.from('"turn_completed"');
/** Turn counts touch `updates.jsonl`. Only the newest visible rows, not the whole 4.7GB tree. */
const TURN_COUNT_LIMIT = 30;

export function defaultGrokHome(): string {
  return join(homedir(), ".grok");
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Count `turn_completed` without parsing the log into objects. */
export async function countTurnCompleted(path: string): Promise<number> {
  const fh = await open(path, "r");
  const buf = Buffer.alloc(1024 * 1024);
  let count = 0;
  let carry = Buffer.alloc(0);
  try {
    while (true) {
      const { bytesRead } = await fh.read(buf, 0, buf.length, null);
      if (bytesRead <= 0) break;
      const chunk = Buffer.concat([carry, buf.subarray(0, bytesRead)]);
      let from = 0;
      while (from < chunk.length) {
        const at = chunk.indexOf(TURN_NEEDLE, from);
        if (at < 0) break;
        count += 1;
        from = at + TURN_NEEDLE.length;
      }
      carry = chunk.subarray(Math.max(0, chunk.length - TURN_NEEDLE.length + 1));
    }
  } finally {
    await fh.close();
  }
  return count;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

type ExtractedFacts = ReturnType<typeof readSessionLog>["facts"];

export type SessionFacts = Pick<ExtractedFacts, "subagents" | "recaps" | "skills" | "permissions"> & {
  files: FileChange[];
  costUsd?: number;
  parentSessionId: string | null;
  logPath: string;
  headCommit: string | null;
  reasoningEffort: string | null;
  sandbox: string | null;
  compactionCount: number | null;
};

export async function listSessions(root: string): Promise<SessionRow[]> {
  const sessionsRoot = join(root, "sessions");
  const activeFile = await readJson(join(root, "active_sessions.json"));
  const live = new Set<string>();
  if (Array.isArray(activeFile)) {
    for (const row of activeFile) {
      const id = (row as { session_id?: unknown }).session_id;
      if (typeof id === "string") live.add(id);
    }
  }

  let groups: string[] = [];
  try {
    groups = await readdir(sessionsRoot);
  } catch {
    return [];
  }

  const rows: SessionRow[] = [];
  await mapPool(groups, 32, async (group) => {
    let children: string[] = [];
    try {
      children = await readdir(join(sessionsRoot, group));
    } catch {
      return;
    }
    await mapPool(children, 8, async (id) => {
      if (id.startsWith(".")) return;
      const dir = join(sessionsRoot, group, id);
      const summary = await readJson(join(dir, "summary.json"));
      if (!summary) return;
      const updatesPath = join(dir, "updates.jsonl");
      const info = (summary.info ?? {}) as { id?: unknown; cwd?: unknown };
      const sessionId = asString(info.id) || id;
      updatesById.set(cacheKey(root, sessionId), updatesPath);
      const folder = asString(info.cwd);
      const signals = await readJson(join(dir, "signals.json"));
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
        hidden: isHiddenCwd(folder) || isHiddenSession(summary),
      });
    });
  });

  rows.sort((a, b) => {
    if (a.live !== b.live) return a.live ? -1 : 1;
    return b.lastActive.localeCompare(a.lastActive);
  });

  const counted = rows.filter((row) => !row.hidden).slice(0, TURN_COUNT_LIMIT);
  await mapPool(counted, 6, async (row) => {
    const updates = await findUpdates(root, row.id);
    if (!updates) return;
    try {
      row.turns = await countTurnCompleted(updates);
    } catch {
      row.turns = null;
    }
  });

  return rows;
}

export async function loadTurns(
  root: string,
  id: string,
): Promise<{ row: SessionRow; turns: Turn[]; facts: SessionFacts } | null> {
  if (!/^[0-9a-f-]{20,}$/i.test(id)) return null;
  const updates = await findUpdates(root, id);
  if (!updates) return null;
  const dir = updates.slice(0, -"/updates.jsonl".length);
  const summary = await readJson(join(dir, "summary.json"));
  const signals = await readJson(join(dir, "signals.json"));
  const info = (summary?.info ?? {}) as { cwd?: unknown };
  const text = await readFile(updates, "utf8");
  const { turns, facts: extracted } = readSessionLog(text);
  const active = await readJson(join(root, "active_sessions.json"));
  let live = false;
  if (Array.isArray(active)) {
    live = active.some((row) => (row as { session_id?: unknown }).session_id === id);
  }
  return {
    row: {
      id,
      title: asString(summary?.session_summary) || asString(summary?.generated_title) || id,
      model: asString(summary?.current_model_id) || "grok",
      folder: asString(info.cwd),
      branch: asString(summary?.head_branch),
      contextPct: asNumber(signals?.contextWindowUsage),
      errors: asNumber(signals?.errorCount),
      turns: turns.filter((turn) => turn.closed).length,
      live,
      lastActive: asString(summary?.last_active_at),
      hidden: isHiddenCwd(asString(info.cwd)) || isHiddenSession(summary),
    },
    turns,
    facts: {
      subagents: extracted.subagents,
      recaps: extracted.recaps,
      skills: extracted.skills,
      permissions: extracted.permissions,
      files: rollupFiles(turns),
      ...(typeof extracted.costUsd === "number" ? { costUsd: extracted.costUsd } : {}),
      parentSessionId: asStringOrNull(summary?.parent_session_id),
      logPath: updates,
      headCommit: asStringOrNull(summary?.head_commit),
      reasoningEffort: asStringOrNull(summary?.reasoning_effort),
      sandbox: asStringOrNull(summary?.sandbox_profile),
      compactionCount: asNumber(signals?.compactionCount),
    },
  };
}

async function findUpdates(root: string, id: string): Promise<string | null> {
  const known = updatesById.get(cacheKey(root, id));
  if (known) return known;
  const sessionsRoot = join(root, "sessions");
  let groups: string[] = [];
  try {
    groups = await readdir(sessionsRoot);
  } catch {
    return null;
  }
  for (const group of groups) {
    const updates = join(sessionsRoot, group, id, "updates.jsonl");
    try {
      await access(updates);
      updatesById.set(cacheKey(root, id), updates);
      return updates;
    } catch {
      // not this group
    }
  }
  return null;
}

async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      if (current !== undefined) await fn(current);
    }
  });
  await Promise.all(workers);
}
