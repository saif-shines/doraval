/** One walk of the six local session layouts. A directory is an opaque token. */

import { AGENT_DIRS, agentLabel, parseTraceId, traceId, type AgentName } from "./agents.ts";
import { viewFromLog, type ViewFacts } from "./from-events.ts";
import { readSessionLog, rollupFiles, type Turn } from "./group.ts";
import { isHiddenCwd, isHiddenSession } from "./hide.ts";

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
  agent: string;
};

export type FolderEntry = { name: string; kind: "file" | "directory" };

export type OpenedFile = {
  size: number;
  mtimeMs: number;
  label: string;
  stream(): AsyncIterable<Uint8Array>;
};

export type FolderStorage<D> = {
  list(dir: D): Promise<FolderEntry[]>;
  openDir(dir: D, name: string): Promise<D | null>;
  openFile(dir: D, name: string): Promise<OpenedFile | null>;
};

export type LogPathFor = (hit: { agent: AgentName; id: string; label: string }) => string;

export type ListedSessions = { rows: SessionRow[] } | { unrecognized: true };

export type OpenedSession = { row: SessionRow; turns: Turn[]; facts: ViewFacts };

/** Turn counts touch `updates.jsonl`. Only the newest visible rows, not the whole 4.7GB tree. */
const FILL_LIMIT = 30;
const READ_CAP = 20 * 1024 * 1024;
const GROUP_POOL = 32;
const SESSION_POOL = 8;
const FILL_POOL = 6;
const WALK_DEPTH = 6;
const WALK_CAP = 5000;
const SNIFF_LIMIT = 24;
const TURN_NEEDLE = '"turn_completed"';

type Held = { file: OpenedFile };

export async function countNeedle(chunks: AsyncIterable<Uint8Array>, needle = TURN_NEEDLE): Promise<number> {
  const target = new TextEncoder().encode(needle);
  let count = 0;
  let carry = new Uint8Array(0);
  for await (const raw of chunks) {
    const chunk = concatBytes(carry, raw);
    let from = 0;
    while (from < chunk.length) {
      const at = findBytes(chunk, target, from);
      if (at < 0) break;
      count += 1;
      from = at + target.length;
    }
    carry = chunk.slice(Math.max(0, chunk.length - target.length + 1));
  }
  return count;
}

export async function listFolder<D>(
  root: D,
  storage: FolderStorage<D>,
  logPathFor: LogPathFor,
): Promise<ListedSessions> {
  const top = await storage.list(root);
  const dirNames = new Set(top.filter((entry) => entry.kind === "directory").map((entry) => entry.name));
  const rows: SessionRow[] = [];
  const grokDirs = new Map<string, D>();
  const files = new Map<string, Held>();
  const home = (Object.values(AGENT_DIRS) as string[]).some((name) => dirNames.has(name));
  if (home) {
    for (const [agent, name] of Object.entries(AGENT_DIRS) as [AgentName, string][]) {
      if (!dirNames.has(name)) continue;
      const child = await storage.openDir(root, name);
      if (!child) continue;
      rows.push(...(await collectAgent(storage, agent, child, grokDirs, files)));
    }
  } else {
    const kind = await detect(storage, root, dirNames);
    if (!kind) return { unrecognized: true };
    rows.push(...(await collectAgent(storage, kind, root, grokDirs, files)));
  }
  rows.sort((a, b) => {
    if (a.live !== b.live) return a.live ? -1 : 1;
    return b.lastActive.localeCompare(a.lastActive);
  });
  await fillRows(storage, rows, grokDirs, files, logPathFor);
  return { rows };
}

export async function openFolder<D>(
  root: D,
  id: string,
  storage: FolderStorage<D>,
  logPathFor: LogPathFor,
): Promise<OpenedSession | null> {
  const parsed = parseTraceId(id);
  if (!parsed) return null;
  if (parsed.agent === "grok") return openGrok(storage, root, parsed.id, logPathFor);
  const found = await findAgentFile(storage, root, parsed.agent, parsed.id);
  if (!found || found.file.size > READ_CAP) return null;
  const view = viewFromLog(
    parsed.agent,
    await textOf(found.file),
    parsed.id,
    found.hint,
    logPathFor({ agent: parsed.agent, id: parsed.id, label: found.file.label }),
  );
  return {
    row: {
      id,
      title: view.title,
      model: view.model,
      folder: view.folder,
      branch: view.branch,
      contextPct: null,
      errors: null,
      turns: view.turns.length,
      live: false,
      lastActive: new Date(found.file.mtimeMs).toISOString(),
      hidden: isHiddenCwd(view.folder),
      agent: parsed.agent,
    },
    turns: view.turns,
    facts: view.facts,
  };
}

async function detect<D>(storage: FolderStorage<D>, root: D, dirNames: Set<string>): Promise<AgentName | null> {
  if (dirNames.has("session-state")) return "copilot";
  if (dirNames.has("tmp")) {
    const tmp = await storage.openDir(root, "tmp");
    if (tmp && (await childHasChats(storage, tmp))) return "gemini";
  }
  if (dirNames.has("sessions")) return sessionsKind(storage, root);
  if (dirNames.has("projects")) return projectsKind(storage, root);
  return null;
}

async function sessionsKind<D>(storage: FolderStorage<D>, root: D): Promise<"grok" | "codex"> {
  const sessions = await storage.openDir(root, "sessions");
  if (!sessions) return "grok";
  const names = await storage.list(sessions);
  for (const group of names) {
    if (group.name.startsWith(".") || group.kind !== "directory") continue;
    const groupDir = await storage.openDir(sessions, group.name);
    if (!groupDir) continue;
    for (const child of await storage.list(groupDir)) {
      if (child.kind !== "directory") continue;
      const dir = await storage.openDir(groupDir, child.name);
      if (dir && (await storage.openFile(dir, "summary.json"))) return "grok";
    }
  }
  if (names.some((entry) => /^\d{4}$/.test(entry.name))) return "codex";
  const rootEntries = await storage.list(root);
  if (rootEntries.some((entry) => entry.name === "state_5.sqlite")) return "codex";
  return "grok";
}

async function projectsKind<D>(storage: FolderStorage<D>, root: D): Promise<"cursor" | "claude-code"> {
  const projects = await storage.openDir(root, "projects");
  if (!projects) return "claude-code";
  const names = await storage.list(projects);
  for (const entry of names.slice(0, SNIFF_LIMIT)) {
    if (entry.name.startsWith(".") || entry.kind !== "directory") continue;
    const dir = await storage.openDir(projects, entry.name);
    if (!dir) continue;
    const kids = await storage.list(dir);
    if (kids.some((kid) => kid.kind === "directory" && kid.name === "agent-transcripts")) return "cursor";
    if (kids.some((kid) => kid.kind === "file" && kid.name.endsWith(".jsonl"))) return "claude-code";
  }
  const files = await storage.list(root);
  if (files.some((entry) => entry.name === "argv.json" || entry.name === "ide_state.json")) return "cursor";
  return "claude-code";
}

async function childHasChats<D>(storage: FolderStorage<D>, dir: D): Promise<boolean> {
  const names = await storage.list(dir);
  for (const entry of names.slice(0, SNIFF_LIMIT)) {
    if (entry.name.startsWith(".") || entry.kind !== "directory") continue;
    const child = await storage.openDir(dir, entry.name);
    if (child && (await storage.openDir(child, "chats"))) return true;
  }
  return false;
}

async function collectAgent<D>(
  storage: FolderStorage<D>,
  agent: AgentName,
  agentRoot: D,
  grokDirs: Map<string, D>,
  files: Map<string, Held>,
): Promise<SessionRow[]> {
  if (agent === "grok") return collectGrok(storage, agentRoot, grokDirs);
  if (agent === "claude-code") return collectClaude(storage, agentRoot, files);
  if (agent === "cursor") return collectCursor(storage, agentRoot, files);
  if (agent === "codex") return collectCodex(storage, agentRoot, files);
  if (agent === "copilot") return collectCopilot(storage, agentRoot, files);
  return collectGemini(storage, agentRoot, files);
}

async function collectGrok<D>(storage: FolderStorage<D>, grokRoot: D, grokDirs: Map<string, D>): Promise<SessionRow[]> {
  const sessionsRoot = await storage.openDir(grokRoot, "sessions");
  if (!sessionsRoot) return [];
  const activeFile = await readJson(storage, grokRoot, "active_sessions.json");
  const live = new Set<string>();
  if (Array.isArray(activeFile)) {
    for (const row of activeFile) {
      const id = (row as { session_id?: unknown }).session_id;
      if (typeof id === "string") live.add(id);
    }
  }
  const groups = (await storage.list(sessionsRoot)).filter((entry) => entry.kind === "directory");
  const rows: SessionRow[] = [];
  await mapPool(groups, GROUP_POOL, async (group) => {
    const groupDir = await storage.openDir(sessionsRoot, group.name);
    if (!groupDir) return;
    const children = (await storage.list(groupDir)).filter((entry) => entry.kind === "directory" && !entry.name.startsWith("."));
    await mapPool(children, SESSION_POOL, async (child) => {
      const dir = await storage.openDir(groupDir, child.name);
      if (!dir) return;
      const summary = asRecord(await readJson(storage, dir, "summary.json"));
      if (!summary) return;
      const info = asRecord(summary.info);
      const sessionId = asString(info?.id) || child.name;
      grokDirs.set(sessionId, dir);
      const folder = asString(info?.cwd);
      const signals = asRecord(await readJson(storage, dir, "signals.json"));
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
        agent: "grok",
      });
    });
  });
  return rows;
}

async function collectClaude<D>(storage: FolderStorage<D>, agentRoot: D, files: Map<string, Held>): Promise<SessionRow[]> {
  const projects = await storage.openDir(agentRoot, "projects");
  if (!projects) return [];
  const rows: SessionRow[] = [];
  for (const proj of await storage.list(projects)) {
    if (proj.kind !== "directory" || proj.name.startsWith(".")) continue;
    const dir = await storage.openDir(projects, proj.name);
    if (!dir) continue;
    for (const entry of await storage.list(dir)) {
      if (entry.kind !== "file" || !entry.name.endsWith(".jsonl")) continue;
      const file = await storage.openFile(dir, entry.name);
      if (!file) continue;
      const id = traceId("claude-code", entry.name.slice(0, -".jsonl".length));
      files.set(id, { file });
      rows.push(stub("claude-code", id, file.mtimeMs));
    }
  }
  return rows;
}

async function collectCursor<D>(storage: FolderStorage<D>, agentRoot: D, files: Map<string, Held>): Promise<SessionRow[]> {
  const projects = await storage.openDir(agentRoot, "projects");
  if (!projects) return [];
  const rows: SessionRow[] = [];
  for (const proj of await storage.list(projects)) {
    if (proj.kind !== "directory" || proj.name.startsWith(".")) continue;
    const projDir = await storage.openDir(projects, proj.name);
    const transcripts = projDir ? await storage.openDir(projDir, "agent-transcripts") : null;
    if (!transcripts) continue;
    for (const entry of await storage.list(transcripts)) {
      if (entry.kind !== "directory" || entry.name.startsWith(".")) continue;
      const session = await storage.openDir(transcripts, entry.name);
      if (!session) continue;
      const file = await storage.openFile(session, `${entry.name}.jsonl`);
      if (!file) continue;
      const id = traceId("cursor", entry.name);
      files.set(id, { file });
      rows.push(stub("cursor", id, file.mtimeMs, proj.name));
    }
  }
  return rows;
}

async function collectCodex<D>(storage: FolderStorage<D>, agentRoot: D, files: Map<string, Held>): Promise<SessionRow[]> {
  const sessions = await storage.openDir(agentRoot, "sessions");
  if (!sessions) return [];
  const found: { name: string; file: OpenedFile }[] = [];
  await walkJsonl(storage, sessions, 0, found);
  return found.map((entry) => {
    const id = traceId("codex", entry.name.slice(0, -".jsonl".length));
    files.set(id, { file: entry.file });
    return stub("codex", id, entry.file.mtimeMs);
  });
}

async function collectCopilot<D>(storage: FolderStorage<D>, agentRoot: D, files: Map<string, Held>): Promise<SessionRow[]> {
  const state = await storage.openDir(agentRoot, "session-state");
  if (!state) return [];
  const rows: SessionRow[] = [];
  for (const entry of await storage.list(state)) {
    if (entry.kind !== "directory" || entry.name.startsWith(".")) continue;
    const dir = await storage.openDir(state, entry.name);
    if (!dir) continue;
    const file = await storage.openFile(dir, "events.jsonl");
    if (!file) continue;
    const id = traceId("copilot", entry.name);
    files.set(id, { file });
    rows.push(stub("copilot", id, file.mtimeMs));
  }
  return rows;
}

async function collectGemini<D>(storage: FolderStorage<D>, agentRoot: D, files: Map<string, Held>): Promise<SessionRow[]> {
  const parent = await storage.openDir(agentRoot, "tmp");
  if (!parent) return [];
  const rows: SessionRow[] = [];
  for (const hash of await storage.list(parent)) {
    if (hash.kind !== "directory" || hash.name.startsWith(".")) continue;
    const hashDir = await storage.openDir(parent, hash.name);
    const chats = hashDir ? await storage.openDir(hashDir, "chats") : null;
    if (!chats) continue;
    const names = await storage.list(chats);
    const jsonlStems = new Set(
      names.filter((entry) => entry.name.endsWith(".jsonl")).map((entry) => entry.name.slice(0, -".jsonl".length)),
    );
    for (const entry of names) {
      if (!entry.name.startsWith("session-")) continue;
      const jsonl = entry.name.endsWith(".jsonl");
      const json = entry.name.endsWith(".json");
      if (!jsonl && !json) continue;
      const stem = entry.name.slice(0, entry.name.lastIndexOf("."));
      if (json && jsonlStems.has(stem)) continue;
      if (entry.kind !== "file") continue;
      const file = await storage.openFile(chats, entry.name);
      if (!file) continue;
      const id = traceId("gemini", stem);
      files.set(id, { file });
      rows.push(stub("gemini", id, file.mtimeMs, hash.name));
    }
  }
  return rows;
}

async function findNamed<D>(
  storage: FolderStorage<D>,
  dir: D,
  fileName: string,
  depth: number,
  dirName: string,
  hint: string,
): Promise<{ file: OpenedFile; hint: string } | null> {
  if (depth > WALK_DEPTH) return null;
  for (const entry of await storage.list(dir)) {
    if (entry.name.startsWith(".")) continue;
    if (entry.kind === "file" && entry.name === fileName) {
      const file = await storage.openFile(dir, entry.name);
      if (file) return { file, hint };
    }
    if (entry.kind !== "directory") continue;
    const child = await storage.openDir(dir, entry.name);
    if (!child) continue;
    const nextHint = entry.name === "chats" ? dirName : hint;
    const found = await findNamed(storage, child, fileName, depth + 1, entry.name, nextHint);
    if (found) return found;
  }
  return null;
}

async function walkJsonl<D>(
  storage: FolderStorage<D>,
  dir: D,
  depth: number,
  out: { name: string; file: OpenedFile }[],
): Promise<void> {
  if (depth > WALK_DEPTH || out.length >= WALK_CAP) return;
  for (const entry of await storage.list(dir)) {
    if (entry.name.startsWith(".")) continue;
    if (entry.kind === "directory") {
      const child = await storage.openDir(dir, entry.name);
      if (child) await walkJsonl(storage, child, depth + 1, out);
    } else if (entry.name.endsWith(".jsonl")) {
      const file = await storage.openFile(dir, entry.name);
      if (file) out.push({ name: entry.name, file });
    }
  }
}

async function fillRows<D>(
  storage: FolderStorage<D>,
  rows: SessionRow[],
  grokDirs: Map<string, D>,
  files: Map<string, Held>,
  logPathFor: LogPathFor,
): Promise<void> {
  const counted = rows.filter((row) => !row.hidden).slice(0, FILL_LIMIT);
  await mapPool(counted, FILL_POOL, async (row) => {
    if (row.agent === "grok") {
      const dir = grokDirs.get(row.id);
      if (!dir) return;
      const updates = await storage.openFile(dir, "updates.jsonl");
      if (!updates) return;
      try {
        row.turns = await countNeedle(updates.stream());
      } catch {
        row.turns = null;
      }
      return;
    }
    const parsed = parseTraceId(row.id);
    const held = files.get(row.id);
    if (!parsed || parsed.agent === "grok" || !held || held.file.size > READ_CAP) return;
    try {
      const view = viewFromLog(
        parsed.agent,
        await textOf(held.file),
        parsed.id,
        row.folder,
        logPathFor({ agent: parsed.agent, id: parsed.id, label: held.file.label }),
      );
      row.title = view.title || row.title;
      row.model = view.model;
      row.folder = view.folder || row.folder;
      row.branch = view.branch;
      row.turns = view.turns.length;
      row.hidden = isHiddenCwd(row.folder);
    } catch {
      row.turns = null;
    }
  });
}

async function openGrok<D>(
  storage: FolderStorage<D>,
  root: D,
  id: string,
  logPathFor: LogPathFor,
): Promise<OpenedSession | null> {
  const found = await findGrokSession(storage, root, id);
  if (!found) return null;
  const summary = asRecord(await readJson(storage, found.dir, "summary.json"));
  const signals = asRecord(await readJson(storage, found.dir, "signals.json"));
  const info = asRecord(summary?.info);
  const text = await textOf(found.file);
  const { turns, facts: extracted } = readSessionLog(text);
  const active = await readJson(storage, found.grokRoot, "active_sessions.json");
  const live = Array.isArray(active) && active.some((row) => (row as { session_id?: unknown }).session_id === id);
  const folder = asString(info?.cwd);
  return {
    row: {
      id,
      title: asString(summary?.session_summary) || asString(summary?.generated_title) || id,
      model: asString(summary?.current_model_id) || "grok",
      folder,
      branch: asString(summary?.head_branch),
      contextPct: asNumber(signals?.contextWindowUsage),
      errors: asNumber(signals?.errorCount),
      turns: turns.filter((turn) => turn.closed).length,
      live,
      lastActive: asString(summary?.last_active_at),
      hidden: isHiddenCwd(folder) || isHiddenSession(summary),
      agent: "grok",
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
      logPath: logPathFor({ agent: "grok", id, label: found.file.label }),
      headCommit: asStringOrNull(summary?.head_commit),
      reasoningEffort: asStringOrNull(summary?.reasoning_effort),
      sandbox: asStringOrNull(summary?.sandbox_profile),
      compactionCount: asNumber(signals?.compactionCount),
    },
  };
}

async function findGrokSession<D>(
  storage: FolderStorage<D>,
  root: D,
  id: string,
): Promise<{ dir: D; grokRoot: D; file: OpenedFile } | null> {
  const bases: { sessions: D; grokRoot: D }[] = [];
  const direct = await storage.openDir(root, "sessions");
  if (direct) bases.push({ sessions: direct, grokRoot: root });
  const dot = await storage.openDir(root, ".grok");
  const nested = dot ? await storage.openDir(dot, "sessions") : null;
  if (dot && nested) bases.push({ sessions: nested, grokRoot: dot });
  for (const base of bases) {
    for (const group of await storage.list(base.sessions)) {
      if (group.kind !== "directory") continue;
      const groupDir = await storage.openDir(base.sessions, group.name);
      if (!groupDir) continue;
      const dir = await storage.openDir(groupDir, id);
      if (!dir) continue;
      const file = await storage.openFile(dir, "updates.jsonl");
      if (file) return { dir, grokRoot: base.grokRoot, file };
    }
  }
  return null;
}

async function findAgentFile<D>(
  storage: FolderStorage<D>,
  root: D,
  agent: Exclude<AgentName, "grok">,
  id: string,
): Promise<{ file: OpenedFile; hint: string } | null> {
  const bases: D[] = [root];
  const dot = await storage.openDir(root, AGENT_DIRS[agent]);
  if (dot) bases.push(dot);
  for (const base of bases) {
    const found = await findInAgent(storage, base, agent, id);
    if (found) return found;
  }
  return null;
}

async function findInAgent<D>(
  storage: FolderStorage<D>,
  base: D,
  agent: Exclude<AgentName, "grok">,
  id: string,
): Promise<{ file: OpenedFile; hint: string } | null> {
  if (agent === "claude-code") {
    const projects = await storage.openDir(base, "projects");
    if (!projects) return null;
    for (const proj of await storage.list(projects)) {
      if (proj.kind !== "directory") continue;
      const dir = await storage.openDir(projects, proj.name);
      const file = dir ? await storage.openFile(dir, `${id}.jsonl`) : null;
      if (file) return { file, hint: "" };
    }
    return null;
  }
  if (agent === "cursor") {
    const projects = await storage.openDir(base, "projects");
    if (!projects) return null;
    for (const proj of await storage.list(projects)) {
      if (proj.kind !== "directory") continue;
      const dir = await storage.openDir(projects, proj.name);
      const transcripts = dir ? await storage.openDir(dir, "agent-transcripts") : null;
      const session = transcripts ? await storage.openDir(transcripts, id) : null;
      const file = session ? await storage.openFile(session, `${id}.jsonl`) : null;
      if (file) return { file, hint: proj.name };
    }
    return null;
  }
  if (agent === "copilot") {
    const state = await storage.openDir(base, "session-state");
    const dir = state ? await storage.openDir(state, id) : null;
    const file = dir ? await storage.openFile(dir, "events.jsonl") : null;
    return file ? { file, hint: "" } : null;
  }
  if (agent === "gemini") {
    const parent = await storage.openDir(base, "tmp");
    if (!parent) return null;
    const jsonl = await findNamed(storage, parent, `${id}.jsonl`, 0, "", "");
    if (jsonl) return jsonl;
    return findNamed(storage, parent, `${id}.json`, 0, "", "");
  }
  const sessions = await storage.openDir(base, "sessions");
  if (!sessions) return null;
  const file = await findNamed(storage, sessions, `${id}.jsonl`, 0, "", "");
  return file ? { file: file.file, hint: "" } : null;
}

function stub(agent: AgentName, id: string, mtime: number, folder = ""): SessionRow {
  const bare = id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
  return {
    id,
    title: bare,
    model: agentLabel(agent),
    folder,
    branch: "",
    contextPct: null,
    errors: null,
    turns: null,
    live: false,
    lastActive: new Date(mtime).toISOString(),
    hidden: false,
    agent,
  };
}

async function readJson<D>(storage: FolderStorage<D>, dir: D, name: string): Promise<unknown> {
  const file = await storage.openFile(dir, name);
  if (!file) return null;
  try {
    return JSON.parse(await textOf(file));
  } catch {
    return null;
  }
}

async function textOf(file: OpenedFile): Promise<string> {
  const decoder = new TextDecoder();
  let out = "";
  for await (const chunk of file.stream()) out += decoder.decode(chunk, { stream: true });
  out += decoder.decode();
  return out;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
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

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const out = new Uint8Array(left.length + right.length);
  out.set(left, 0);
  out.set(right, left.length);
  return out;
}

function findBytes(hay: Uint8Array, needle: Uint8Array, from: number): number {
  const last = hay.length - needle.length;
  for (let i = from; i <= last; i += 1) {
    let match = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (hay[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
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
