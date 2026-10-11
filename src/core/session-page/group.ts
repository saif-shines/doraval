/** One Grok turn: chunks up to `turn_completed`, not one row per chunk. */

import { extractSkillsFromUpdate } from "../session-adapters/grok.ts";

export type ToolRow = {
  name: string;
  path?: string;
  failed: boolean;
  /** Shell command, or a one-line input summary when that is not already the path. */
  command?: string;
  /** Tool result text, trimmed to 2000 characters. */
  output?: string;
  /** Set when `output` was longer than 2000 characters. */
  outputTruncated?: boolean;
  durationMs?: number;
};

export type FileChange = {
  path: string;
  added: number;
  removed: number;
  /** Short before/after, trimmed to 4000 characters. */
  diff: string;
};

export type Turn = {
  n: number;
  prompt: string;
  reply: string;
  tools: ToolRow[];
  hooks: number;
  outputTokens?: number;
  /** False when the log has not reached `turn_completed` yet. */
  closed: boolean;
  durationMs?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  /** Set only when a chunk has explicit thinking text. */
  thinking?: string;
  skills?: string[];
  files?: FileChange[];
  /** Finite `turn_completed.usage.cost`, when the log has one. */
  costUsd?: number;
};

export type SubagentFact = {
  id: string;
  description?: string;
  model?: string;
  status?: string;
  durationMs?: number;
  toolCalls?: number;
};

export type PermissionFact = {
  tool: string;
  decision: string;
};

export type SessionFacts = {
  subagents: SubagentFact[];
  recaps: string[];
  permissions: PermissionFact[];
  skills: string[];
  /** Sum of turn `costUsd` values. Omitted when no turn has one. */
  costUsd?: number;
};

type OpenTurn = {
  prompts: string[];
  replies: string[];
  tools: ToolRow[];
  byId: Map<string, ToolRow>;
  hooks: number;
  outputTokens?: number;
  durationMs?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  thinking: string[];
  skills: string[];
  files: FileChange[];
  fileByTool: Map<string, FileChange>;
  costUsd?: number;
};

const DIFF_LIMIT = 4000;
const OUTPUT_LIMIT = 2000;

function emptyOpenTurn(): OpenTurn {
  return {
    prompts: [],
    replies: [],
    tools: [],
    byId: new Map(),
    hooks: 0,
    thinking: [],
    skills: [],
    files: [],
    fileByTool: new Map(),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringish(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function linesOf(value: string): string[] {
  if (!value) return [];
  const parts = value.split("\n");
  if (value.endsWith("\n")) parts.pop();
  return parts;
}

function lineCount(value: string): number {
  return linesOf(value).length;
}

/** Lines present on both sides are context, not additions or removals. */
function changedLineCounts(oldText: string, newText: string): { added: number; removed: number } {
  const pending = new Map<string, number>();
  for (const line of linesOf(oldText)) pending.set(line, (pending.get(line) ?? 0) + 1);
  let added = 0;
  for (const line of linesOf(newText)) {
    const left = pending.get(line) ?? 0;
    if (left > 0) pending.set(line, left - 1);
    else added += 1;
  }
  let removed = 0;
  for (const left of pending.values()) removed += left;
  return { added, removed };
}

function chunkText(content: unknown): string {
  const record = asRecord(content);
  if (!record) return "";
  const type = typeof record.type === "string" ? record.type.toLowerCase() : "";
  if (type === "thinking" || type === "reasoning" || type === "thought") return "";
  return typeof record.text === "string" ? record.text.trim() : "";
}

function rawInput(update: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(update.rawInput ?? update.input ?? update.args);
}

function toolName(update: Record<string, unknown>): string {
  const meta = asRecord(update._meta);
  const named = asRecord(meta?.["x.ai/tool"]);
  if (typeof named?.name === "string" && named.name) return named.name;
  if (typeof update.kind === "string" && update.kind && update.kind.length < 64) return update.kind;
  if (typeof update.title === "string" && update.title && !update.title.includes("`") && update.title.length < 64) {
    return update.title;
  }
  return "tool";
}

function toolPath(update: Record<string, unknown>): string | undefined {
  if (Array.isArray(update.locations)) {
    for (const loc of update.locations) {
      const path = stringish(asRecord(loc)?.path);
      if (path) return path;
    }
  }
  const raw = rawInput(update);
  if (!raw) return undefined;
  for (const key of ["target_file", "file_path", "path"]) {
    const value = raw[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

function toolCommand(update: Record<string, unknown>): string | undefined {
  const raw = rawInput(update);
  if (!raw) return undefined;
  if (typeof raw.command === "string" && raw.command.trim()) return oneLine(raw.command);
  const skip = new Set([
    "target_file",
    "file_path",
    "path",
    "old_string",
    "new_string",
    "content",
    "contents",
    "text",
    "file_text",
    "new_content",
    "file_content",
    "prompt",
  ]);
  const bits: string[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (skip.has(key) || value == null) continue;
    if (typeof value === "string" && value.trim()) bits.push(oneLine(value));
    else if (typeof value === "number" || typeof value === "boolean") bits.push(`${key}=${value}`);
  }
  if (!bits.length) return undefined;
  return oneLine(bits.join(" "));
}

function collectText(value: unknown, parts: string[]): void {
  if (typeof value === "string") {
    if (value.trim()) parts.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, parts);
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  const type = typeof record.type === "string" ? record.type.toLowerCase() : "";
  if (type === "diff" || type === "thinking" || type === "reasoning" || type === "thought") return;
  if (typeof record.text === "string" && record.text.trim()) {
    parts.push(record.text);
    return;
  }
  if ("content" in record) collectText(record.content, parts);
}

function toolOutput(update: Record<string, unknown>): { text: string; truncated: boolean } | undefined {
  const parts: string[] = [];
  collectText(update.content, parts);
  let text = parts.join("\n").trim();
  if (!text) {
    const raw = asRecord(update.rawOutput);
    const result = asRecord(raw?.Result);
    const file = asRecord(raw?.FileContent);
    text = (
      stringish(raw?.output_for_prompt) ||
      stringish(raw?.output) ||
      stringish(result?.output) ||
      stringish(file?.raw_output) ||
      stringish(file?.content)
    ).trim();
  }
  if (!text) return undefined;
  return { text: clip(text, OUTPUT_LIMIT), truncated: text.length > OUTPUT_LIMIT };
}

function toolDuration(update: Record<string, unknown>): number | undefined {
  const direct = num(update.duration_ms) ?? num(update.elapsed_ms) ?? num(update.durationMs);
  if (direct != null) return direct;
  const raw = asRecord(update.rawOutput);
  if (!raw) return undefined;
  const top = num(raw.duration_ms) ?? num(raw.elapsed_ms);
  if (top != null) return top;
  const result = asRecord(raw.Result);
  if (!result) return undefined;
  const nested = num(result.duration_ms) ?? num(result.elapsed_ms);
  if (nested != null) return nested;
  const secs = num(result.duration_secs);
  return secs == null ? undefined : Math.round(secs * 1000);
}

function shortDiff(oldText: string | null, newText: string | null): string {
  if (oldText == null) return clip(`after:\n${newText ?? ""}`, DIFF_LIMIT);
  if (newText == null) return clip(`before:\n${oldText}`, DIFF_LIMIT);
  const before = `before:\n${oldText}`;
  const after = `after:\n${newText}`;
  if (before.length + 1 + after.length <= DIFF_LIMIT) return `${before}\n${after}`;
  const half = Math.floor((DIFF_LIMIT - 1) / 2);
  return `${clip(before, half)}\n${clip(after, DIFF_LIMIT - half - 1)}`;
}

function makeChange(path: string, oldText: string | null, newText: string | null): FileChange | null {
  if (!path || (oldText == null && newText == null)) return null;
  let added = 0;
  let removed = 0;
  if (oldText == null) added = lineCount(newText ?? "");
  else if (newText == null) removed = lineCount(oldText);
  else ({ added, removed } = changedLineCounts(oldText, newText));
  return { path, added, removed, diff: shortDiff(oldText, newText) };
}

function stringField(raw: Record<string, unknown> | null, keys: string[]): string | null {
  if (!raw) return null;
  for (const key of keys) {
    if (typeof raw[key] === "string") return raw[key];
  }
  return null;
}

function changeOf(update: Record<string, unknown>): FileChange | null {
  const raw = rawInput(update);
  const path = toolPath(update) || stringish(raw?.file_path) || stringish(raw?.path);
  if (raw && (typeof raw.old_string === "string" || typeof raw.new_string === "string")) {
    return makeChange(
      path,
      typeof raw.old_string === "string" ? raw.old_string : null,
      typeof raw.new_string === "string" ? raw.new_string : null,
    );
  }
  if (Array.isArray(update.content)) {
    for (const item of update.content) {
      const record = asRecord(item);
      if (!record || record.type !== "diff") continue;
      const oldText = typeof record.oldText === "string" ? record.oldText : typeof record.old_string === "string" ? record.old_string : null;
      const newText = typeof record.newText === "string" ? record.newText : typeof record.new_string === "string" ? record.new_string : null;
      const diffPath = stringish(record.path) || path;
      const change = makeChange(diffPath, oldText, newText);
      if (change) return change;
    }
  }
  const name = toolName(update).toLowerCase();
  const write = name.includes("write") || name === "create" || name === "create_file";
  if (!write) return null;
  const body = stringField(raw, ["content", "contents", "text", "file_text", "new_content", "file_content"]);
  if (body == null) return null;
  return makeChange(path, null, body);
}

function noteFile(buf: OpenTurn, id: string, change: FileChange | null) {
  if (!change) return;
  if (id) {
    const prev = buf.fileByTool.get(id);
    if (prev) {
      if (change.diff.length > prev.diff.length || (change.path && !prev.path)) {
        prev.path = change.path || prev.path;
        prev.added = change.added;
        prev.removed = change.removed;
        prev.diff = change.diff;
      }
      return;
    }
    buf.fileByTool.set(id, change);
  }
  buf.files.push(change);
}

function slashCommand(value: string): string {
  const token = value.trim().split(/\s+/)[0] ?? "";
  if (!token.startsWith("/") || token.slice(1).includes("/")) return "";
  return token.slice(1);
}

function pushSkill(out: string[], value: unknown) {
  if (typeof value !== "string") return;
  const token = value.trim().replace(/^\//, "").split(/\s+/)[0] ?? "";
  if (!token || token === "skill" || token.includes("/")) return;
  if (!out.includes(token)) out.push(token);
}

function skillsFrom(update: Record<string, unknown>): string[] {
  const name = toolName(update).toLowerCase();
  const named = name === "skill" || name === "slash_command" || name === "slashcommand";
  const raw = rawInput(update);
  const out: string[] = [];
  for (const skill of extractSkillsFromUpdate(update)) pushSkill(out, skill);
  if (!raw) return out;
  if (typeof raw.skill === "string") pushSkill(out, raw.skill);
  if (typeof raw.command === "string") {
    if (named) pushSkill(out, raw.command);
    else pushSkill(out, slashCommand(raw.command));
  }
  if (named) pushSkill(out, raw.name);
  return out;
}

function addSkills(list: string[], update: Record<string, unknown>) {
  for (const skill of skillsFrom(update)) {
    if (!list.includes(skill)) list.push(skill);
  }
}

function thinkingParts(value: unknown, out: string[]) {
  if (Array.isArray(value)) {
    for (const item of value) thinkingParts(item, out);
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  const type = typeof record.type === "string" ? record.type.toLowerCase() : "";
  if (typeof record.thinking === "string" && record.thinking.trim()) out.push(record.thinking.trim());
  else if ((type === "thinking" || type === "reasoning" || type === "thought") && typeof record.text === "string" && record.text.trim()) {
    out.push(record.text.trim());
  }
  if ("content" in record) thinkingParts(record.content, out);
}

function explicitThinking(update: Record<string, unknown>): string {
  const parts: string[] = [];
  thinkingParts(update.content, parts);
  const kind = typeof update.sessionUpdate === "string" ? update.sessionUpdate : "";
  if (parts.length === 0 && /thought|thinking/i.test(kind)) {
    const text = chunkText(update.content);
    if (text) parts.push(text);
  }
  return parts.join("\n\n").trim();
}

function decisionWord(value: unknown): string {
  if (typeof value !== "string") return "";
  const word = value.trim().toLowerCase();
  if (word === "allow" || word === "allowed" || word === "approve" || word === "approved" || word === "accept" || word === "accepted") {
    return "allow";
  }
  if (word === "deny" || word === "denied" || word === "reject" || word === "rejected" || word === "block" || word === "blocked") {
    return "deny";
  }
  return "";
}

function permissionOf(update: Record<string, unknown>): PermissionFact | null {
  const kind = typeof update.sessionUpdate === "string" ? update.sessionUpdate : "";
  if (kind === "hook_execution" || kind === "hook_annotation") return null;
  const structured = /permission|sandbox|approval/i.test(kind);
  const nested = asRecord(update.permission) || asRecord(update.sandbox) || asRecord(update.sandbox_decision);
  const rawDecision = nested?.decision ?? update.decision ?? (structured ? update.outcome : undefined);
  const decision = decisionWord(rawDecision) || (structured ? stringish(rawDecision).trim().toLowerCase() : "");
  if (!decision) return null;
  const tool = stringish(nested?.tool) || stringish(nested?.tool_name) || stringish(update.tool) || stringish(update.tool_name) || stringish(update.toolName);
  if (!tool) return null;
  return { tool, decision };
}

function applyTool(row: ToolRow, update: Record<string, unknown>) {
  const path = toolPath(update);
  if (path) row.path = path;
  const command = toolCommand(update);
  const explicit = typeof rawInput(update)?.command === "string";
  if (command && (explicit || !row.command)) row.command = command;
  const output = toolOutput(update);
  if (output) {
    row.output = output.text;
    if (output.truncated) row.outputTruncated = true;
    else delete row.outputTruncated;
  }
  const duration = toolDuration(update);
  if (duration != null) row.durationMs = duration;
  if (update.status === "failed") row.failed = true;
}

function updateOf(line: string): Record<string, unknown> | null {
  if (!line.includes("sessionUpdate")) return null;
  let parsed: { params?: { update?: Record<string, unknown> } };
  try {
    parsed = JSON.parse(line) as { params?: { update?: Record<string, unknown> } };
  } catch {
    return null;
  }
  const update = parsed.params?.update;
  return update && typeof update === "object" ? update : null;
}

function finishTurn(turns: Turn[], buf: OpenTurn, closed: boolean) {
  const prompt = buf.prompts.join("\n\n");
  const reply = buf.replies.join("\n\n");
  if (!prompt && !reply && buf.tools.length === 0) return;
  const thinking = buf.thinking.join("\n\n").trim();
  const turn: Turn = {
    n: turns.length + 1,
    prompt,
    reply,
    tools: buf.tools,
    hooks: buf.hooks,
    closed,
  };
  if (buf.outputTokens != null) turn.outputTokens = buf.outputTokens;
  if (buf.durationMs != null) turn.durationMs = buf.durationMs;
  if (buf.cacheReadTokens != null) turn.cacheReadTokens = buf.cacheReadTokens;
  if (buf.cacheWriteTokens != null) turn.cacheWriteTokens = buf.cacheWriteTokens;
  if (buf.reasoningTokens != null) turn.reasoningTokens = buf.reasoningTokens;
  if (thinking) turn.thinking = thinking;
  if (buf.skills.length) turn.skills = buf.skills;
  if (buf.files.length) turn.files = buf.files;
  if (buf.costUsd != null) turn.costUsd = buf.costUsd;
  turns.push(turn);
}

type Walked = {
  turns: Turn[];
  subagents: SubagentFact[];
  recaps: string[];
  permissions: PermissionFact[];
};

function compactionNote(update: Record<string, unknown>): string {
  for (const key of ["summary", "message", "text"]) {
    const value = stringish(update[key]).trim();
    if (value) return value;
  }
  return "";
}

/** One pass over the log. Turns close only on `turn_completed`. */
function walkUpdates(text: string): Walked {
  const turns: Turn[] = [];
  const state: { buf: OpenTurn | null } = { buf: null };
  const subagents: SubagentFact[] = [];
  const index = new Map<string, SubagentFact>();
  const recaps: string[] = [];
  const permissions: PermissionFact[] = [];

  const close = (closed: boolean) => {
    const current = state.buf;
    if (!current) return;
    finishTurn(turns, current, closed);
    state.buf = null;
  };

  const ensure = () => {
    if (!state.buf) state.buf = emptyOpenTurn();
    return state.buf;
  };

  const rowFor = (update: Record<string, unknown>): SubagentFact | null => {
    const subagentId = stringish(update.subagent_id);
    const childId = stringish(update.child_session_id);
    const keys = [...new Set([subagentId, childId].filter(Boolean))];
    if (!keys.length) return null;
    let row: SubagentFact | undefined;
    for (const id of keys) row = row ?? index.get(id);
    if (!row) {
      row = { id: subagentId || childId };
      subagents.push(row);
    } else if (subagentId) {
      row.id = subagentId;
    }
    for (const id of keys) index.set(id, row);
    return row;
  };

  for (const line of text.split("\n")) {
    const update = updateOf(line);
    if (!update) continue;
    const kind = update.sessionUpdate;

    if (kind === "auto_compact_started" || kind === "auto_compact_completed" || kind === "compaction_checkpoint") {
      const note = compactionNote(update);
      if (note) recaps.push(note);
    }

    if (kind === "subagent_spawned" || kind === "subagent_finished") {
      const row = rowFor(update);
      if (row && kind === "subagent_spawned") {
        const description = stringish(update.description).trim();
        const model = stringish(update.model).trim();
        if (description) row.description = description;
        if (model) row.model = model;
      } else if (row) {
        const status = stringish(update.status).trim();
        if (status) row.status = status;
        const duration = num(update.duration_ms) ?? num(update.durationMs);
        if (duration != null) row.durationMs = duration;
        const calls = num(update.tool_calls) ?? num(update.toolCalls);
        if (calls != null) row.toolCalls = calls;
      }
    } else if (kind === "session_recap") {
      const summary = stringish(update.summary).trim();
      if (summary) recaps.push(summary);
    } else if (kind !== "tool_call" && kind !== "tool_call_update") {
      const permission = permissionOf(update);
      if (permission) permissions.push(permission);
    }

    if (kind === "user_message_chunk") {
      const prompt = chunkText(update.content);
      if (!prompt) continue;
      ensure().prompts.push(prompt);
    } else if (kind === "agent_message_chunk" || kind === "agent_thought_chunk") {
      const current = ensure();
      const thought = explicitThinking(update);
      if (thought) current.thinking.push(thought);
      if (kind === "agent_message_chunk") {
        const reply = chunkText(update.content);
        if (reply) current.replies.push(reply);
      }
    } else if (kind === "tool_call" || kind === "tool_call_update") {
      const current = ensure();
      const id = typeof update.toolCallId === "string" ? update.toolCallId : "";
      let row = id ? current.byId.get(id) : undefined;
      if (!row) {
        row = { name: toolName(update), failed: false };
        if (id) current.byId.set(id, row);
        current.tools.push(row);
      }
      applyTool(row, update);
      addSkills(current.skills, update);
      noteFile(current, id, changeOf(update));
    } else if (kind === "hook_execution") {
      ensure().hooks += 1;
    } else if (kind === "turn_completed") {
      const current = state.buf;
      if (!current) continue;
      const usage = asRecord(update.usage);
      const outputTokens = num(usage?.outputTokens);
      if (outputTokens != null) current.outputTokens = outputTokens;
      const cacheRead = num(usage?.cachedReadTokens);
      if (cacheRead != null) current.cacheReadTokens = cacheRead;
      const cacheWrite = num(usage?.cacheCreationTokens);
      if (cacheWrite != null) current.cacheWriteTokens = cacheWrite;
      const reasoning = num(usage?.reasoningTokens);
      if (reasoning != null) current.reasoningTokens = reasoning;
      const cost = num(usage?.cost);
      if (cost != null) current.costUsd = cost;
      const elapsed = num(update.elapsed_ms);
      if (elapsed != null) current.durationMs = elapsed;
      close(true);
    } else {
      const thought = explicitThinking(update);
      if (thought) ensure().thinking.push(thought);
    }
  }

  close(false);
  return { turns, subagents, recaps, permissions };
}

/**
 * Group a Grok `updates.jsonl` body into turns.
 * A turn closes only on `turn_completed`. An open turn at the end is `closed: false`.
 * Leading hooks stay on the first turn.
 */
/** One walk. Turns close only on `turn_completed`. `costUsd` is omitted when no turn has a cost. */
export function readSessionLog(text: string): { turns: Turn[]; facts: SessionFacts } {
  const walked = walkUpdates(text);
  const skills: string[] = [];
  let costUsd: number | undefined;
  for (const turn of walked.turns) {
    for (const skill of turn.skills ?? []) {
      if (!skills.includes(skill)) skills.push(skill);
    }
    if (turn.costUsd != null) costUsd = (costUsd ?? 0) + turn.costUsd;
  }
  const facts: SessionFacts = {
    subagents: walked.subagents,
    recaps: walked.recaps,
    permissions: walked.permissions,
    skills,
  };
  if (costUsd != null) facts.costUsd = costUsd;
  return { turns: walked.turns, facts };
}

export function groupUpdates(text: string): Turn[] {
  return readSessionLog(text).turns;
}

export function extractSessionFacts(text: string): SessionFacts {
  return readSessionLog(text).facts;
}
