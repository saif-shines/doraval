import { parseCodexRollout } from "../session-adapters/codex-parse.ts";
import { parseCopilotEvents } from "../session-adapters/copilot-parse.ts";
import { parseCursorTranscript } from "../session-adapters/cursor-parse.ts";
import { parseGeminiChat } from "../session-adapters/gemini-parse.ts";
import type { Event, Session } from "../session-parse.ts";
import { parseSession } from "../session-parse.ts";
import type { AgentName } from "./agents.ts";
import { agentLabel } from "./agents.ts";
import { rollupFiles, type FileChange, type PermissionFact, type SubagentFact, type ToolRow, type Turn } from "./group.ts";

const OUTPUT_LIMIT = 2000;
const DIFF_LIMIT = 4000;

export type ViewFacts = {
  subagents: SubagentFact[];
  recaps: string[];
  permissions: PermissionFact[];
  skills: string[];
  files: FileChange[];
  costUsd?: number;
  parentSessionId: string | null;
  logPath: string;
  headCommit: string | null;
  reasoningEffort: string | null;
  sandbox: string | null;
  compactionCount: number | null;
};

export type LogView = {
  title: string;
  model: string;
  folder: string;
  branch: string;
  turns: Turn[];
  facts: ViewFacts;
};

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function linesOf(value: string): string[] {
  if (!value) return [];
  const parts = value.split("\n");
  if (value.endsWith("\n")) parts.pop();
  return parts;
}

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

function textOf(input: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function fileChange(name: string, input: Record<string, unknown>): FileChange | null {
  const path = textOf(input, ["file_path", "filePath", "path"]).trim();
  if (!path) return null;
  if (name === "Write" || name === "write") {
    const body = textOf(input, ["contents", "content"]);
    return { path, added: linesOf(body).length, removed: 0, diff: clip(body, DIFF_LIMIT) };
  }
  if (name === "Edit" || name === "StrReplace" || name === "search_replace" || name === "apply_patch") {
    const oldText = textOf(input, ["old_string", "old_str"]);
    const newText = textOf(input, ["new_string", "new_str"]);
    if (!oldText && !newText) return null;
    const counts = changedLineCounts(oldText, newText);
    return { path, added: counts.added, removed: counts.removed, diff: clip(`before:\n${oldText}\nafter:\n${newText}`, DIFF_LIMIT) };
  }
  return null;
}

function toolRow(event: Event): ToolRow {
  const input = event.input ?? {};
  const command = textOf(input, ["command", "cmd", "message", "prompt"]).trim();
  const path = textOf(input, ["file_path", "filePath", "path"]).trim();
  return {
    name: event.toolName || "tool",
    failed: false,
    ...(command ? { command } : {}),
    ...(path && path !== command ? { path } : {}),
  };
}

/** One turn per user message. Tool results attach by id. */
export function sessionToView(session: Session, logPath: string): LogView {
  const turns: Turn[] = [];
  let prompts: string[] = [];
  let replies: string[] = [];
  let thoughts: string[] = [];
  let tools: ToolRow[] = [];
  let files: FileChange[] = [];
  const byId = new Map<string, ToolRow>();
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let open = false;

  const close = () => {
    if (!open) return;
    const thinking = thoughts.join("\n\n").trim();
    turns.push({
      n: turns.length + 1,
      prompt: prompts.join("\n\n"),
      reply: replies.join("\n\n"),
      tools,
      hooks: 0,
      closed: true,
      ...(thinking ? { thinking } : {}),
      ...(outputTokens > 0 ? { outputTokens } : {}),
      ...(cacheReadTokens > 0 ? { cacheReadTokens } : {}),
      ...(files.length > 0 ? { files } : {}),
    });
    prompts = [];
    replies = [];
    thoughts = [];
    tools = [];
    files = [];
    byId.clear();
    outputTokens = 0;
    cacheReadTokens = 0;
    open = false;
  };

  for (const event of session.events) {
    if (event.type === "user") {
      close();
      open = true;
      if (event.text) prompts.push(event.text);
      continue;
    }
    if (!open) open = true;
    if (event.outputTokens) outputTokens += event.outputTokens;
    if (event.cacheReadTokens) cacheReadTokens += event.cacheReadTokens;
    if (event.type === "assistant" && event.text) replies.push(event.text);
    if (event.type === "thinking" && event.text) thoughts.push(event.text);
    if (event.type === "tool_call") {
      const row = toolRow(event);
      tools.push(row);
      if (event.toolCallId) byId.set(event.toolCallId, row);
      const change = fileChange(row.name, event.input ?? {});
      if (change) files.push(change);
    }
    if (event.type === "tool_result") {
      const row = (event.toolCallId && byId.get(event.toolCallId)) || tools[tools.length - 1];
      if (!row) continue;
      if (event.isError) row.failed = true;
      if (event.output) {
        const text = event.output.trim();
        if (text) {
          row.output = clip(text, OUTPUT_LIMIT);
          if (text.length > OUTPUT_LIMIT) row.outputTruncated = true;
        }
      }
    }
  }
  close();

  const title = session.sessionTitle?.trim()
    || session.userMessages.find((line) => line.trim())?.trim().slice(0, 120)
    || session.sessionId
    || "Session";
  const model = session.model && session.model !== "unknown" ? session.model : agentLabel(session.agent);
  return {
    title,
    model,
    folder: session.cwd,
    branch: session.gitBranch ?? "",
    turns,
    facts: {
      subagents: [],
      recaps: [],
      permissions: session.permissions ?? [],
      skills: [...new Set(session.skillsInvoked)],
      files: rollupFiles(turns),
      ...(typeof session.costUsd === "number" ? { costUsd: session.costUsd } : {}),
      parentSessionId: null,
      logPath,
      headCommit: null,
      reasoningEffort: null,
      sandbox: null,
      compactionCount: null,
    },
  };
}

function parseAgent(agent: Exclude<AgentName, "grok">, text: string, sessionId: string, cwdHint: string): Session {
  switch (agent) {
    case "claude-code": return parseSession(text);
    case "cursor": return parseCursorTranscript(text, sessionId, cwdHint);
    case "codex": return parseCodexRollout(text);
    case "copilot": return parseCopilotEvents(text);
    case "gemini": return parseGeminiChat(text, cwdHint);
    default: {
      const unreachable: never = agent;
      return unreachable;
    }
  }
}

export function viewFromLog(agent: Exclude<AgentName, "grok">, text: string, sessionId: string, cwdHint: string, logPath: string): LogView {
  return sessionToView(parseAgent(agent, text, sessionId, cwdHint), logPath);
}
