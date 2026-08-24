export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  timestamp: string;
  index: number;
}

export interface SessionPrimitives {
  sessionId: string;
  sessionTitle?: string;
  model: string;
  agent: string;
  cwd: string;
  gitBranch?: string;
  toolCalls: ToolCall[];
  toolCallCounts: Record<string, number>;
  skillsInvoked: string[];
  userMessages: string[];
  userTurnCount: number;
  durationMs?: number;
  assistantText: string[];
}

export type EventType = "user" | "assistant" | "tool_call" | "tool_result" | "system" | "error";

export interface Event {
  sessionId: string;
  seq: number;
  type: EventType;
  timestamp?: string;
  id?: string;
  parentId?: string;
  toolName?: string;
  toolCallId?: string;
  input?: Record<string, unknown>;
  output?: string;
  isError?: boolean;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  stopReason?: string;
  text?: string;
}

export type SkillSignal = "skill_tool_use" | "prompt_slash_command" | "grok_title";

export interface SkillInvokeRecord {
  name: string;
  signal: SkillSignal;
  eventIds: string[];
}

/** Session IR: Event list plus the derived blob (expand — callers can still read blob fields). */
export interface Session extends SessionPrimitives {
  events: Event[];
  skillInvokes: SkillInvokeRecord[];
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  costUsd?: number;
}

/** Build a Session from a blob + Events. Token totals sum Events, then optional fallback. Never writes 0 for a missing field. */
export function asSession(
  primitives: SessionPrimitives,
  events: Event[],
  fallback?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    costUsd?: number;
    skillInvokes?: SkillInvokeRecord[];
  },
): Session {
  let input: number | undefined;
  let output: number | undefined;
  let cache: number | undefined;
  for (const e of events) {
    if (e.inputTokens != null) input = (input ?? 0) + e.inputTokens;
    if (e.outputTokens != null) output = (output ?? 0) + e.outputTokens;
    if (e.cacheReadTokens != null) cache = (cache ?? 0) + e.cacheReadTokens;
  }
  return {
    ...primitives,
    events,
    skillInvokes: fallback?.skillInvokes ?? [],
    ...(input != null ? { inputTokens: input } : fallback?.inputTokens != null ? { inputTokens: fallback.inputTokens } : {}),
    ...(output != null ? { outputTokens: output } : fallback?.outputTokens != null ? { outputTokens: fallback.outputTokens } : {}),
    ...(cache != null ? { cacheReadTokens: cache } : fallback?.cacheReadTokens != null ? { cacheReadTokens: fallback.cacheReadTokens } : {}),
    ...(fallback?.costUsd != null ? { costUsd: fallback.costUsd } : {}),
  };
}

interface RawMessage {
  type: string;
  [key: string]: unknown;
}

function extractUserText(message: unknown): string | null {
  if (typeof message === "string") return message.trim() || null;
  if (Array.isArray(message)) {
    for (const block of message) {
      if (block && typeof block === "object" && (block as Record<string, unknown>).type === "text") {
        const text = (block as Record<string, unknown>).text;
        if (typeof text === "string" && text.trim()) return text.trim();
      }
    }
  }
  return null;
}

/**
 * Pragmatic safe parse for tolerant JSONL streams (session logs).
 * Returns null on any failure — callers decide to skip.
 * (Inspired by pragmatic-fp: wrap the throwing effect instead of scattering try/catch.)
 */
export function safeJsonParse<T = any>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function pushEvent(events: Event[], partial: Omit<Event, "seq">): void {
  const e: Event = { ...partial, seq: events.length };
  for (const key of Object.keys(e) as (keyof Event)[]) {
    if (e[key] === undefined) delete e[key];
  }
  events.push(e);
}

function toolResultText(content: unknown): string | undefined {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const bits = content
      .map((b) => (b && typeof b === "object" && typeof (b as { text?: unknown }).text === "string" ? (b as { text: string }).text : ""))
      .filter(Boolean);
    return bits.length ? bits.join("\n") : undefined;
  }
  return undefined;
}

export function parseSession(jsonlText: string): Session {
  const lines = jsonlText.split("\n").filter((l) => l.trim());
  const messages: RawMessage[] = [];

  for (const line of lines) {
    const parsed = safeJsonParse<RawMessage>(line);
    if (parsed) messages.push(parsed);
  }

  let sessionId = "";
  let sessionTitle: string | undefined;
  let model = "unknown";
  let agent = "claude-code";
  let cwd = "";
  let gitBranch: string | undefined;
  let durationMs: number | undefined;
  let costUsd: number | undefined;

  const events: Event[] = [];
  const skillInvokes: SkillInvokeRecord[] = [];
  const toolCalls: ToolCall[] = [];
  const userMessages: string[] = [];
  const assistantText: string[] = [];
  let toolIndex = 0;

  // Collect skill names from modern client-driven invocations
  const skillsFromTranscript = new Set<string>();

  for (const msg of messages) {
    // Extract session-level metadata from any message
    if (!sessionId && typeof msg.sessionId === "string") sessionId = msg.sessionId;
    if (!cwd && typeof msg.cwd === "string") cwd = msg.cwd;
    if (!gitBranch && typeof msg.gitBranch === "string") gitBranch = msg.gitBranch;

    // attributionSkill field (modern Claude Code client)
    if (typeof msg.attributionSkill === "string" && msg.attributionSkill.trim()) {
      const n = msg.attributionSkill.trim();
      skillsFromTranscript.add(n);
      const evId = typeof msg.uuid === "string" ? msg.uuid : "";
      skillInvokes.push({ name: n, signal: "skill_tool_use", eventIds: evId ? [evId] : [] });
    }

    // <command-name>/foo</command-name> wrappers in message content
    const raw = JSON.stringify(msg);
    const cmdMatch = raw.match(/<command-name>([^<]+)<\/command-name>/i);
    if (cmdMatch) {
      let name = cmdMatch[1].trim();
      if (name.startsWith("/")) name = name.slice(1);
      if (name) {
        skillsFromTranscript.add(name);
        const evId = typeof msg.uuid === "string" ? msg.uuid : "";
        skillInvokes.push({ name, signal: "prompt_slash_command", eventIds: evId ? [evId] : [] });
      }
    }

    // Hook-injected skills: hook_additional_context attachments
    // Pattern: "full content of your 'skill-name' skill"
    if (msg.type === "attachment") {
      const att = msg.attachment as Record<string, unknown> | undefined;
      if (att && att.type === "hook_additional_context") {
        const content = Array.isArray(att.content)
          ? (att.content as unknown[]).join("\n")
          : typeof att.content === "string" ? att.content : "";
        const hookSkillMatch = content.match(/full content of your '([^']+)' skill/i);
        if (hookSkillMatch) {
          skillsFromTranscript.add(hookSkillMatch[1].trim());
        }
      }
    }

    if (msg.type === "ai-title") {
      sessionTitle = typeof msg.aiTitle === "string" ? msg.aiTitle : undefined;
    }

    if (msg.type === "system") {
      if (typeof msg.durationMs === "number") durationMs = msg.durationMs;
      pushEvent(events, {
        sessionId: sessionId || (typeof msg.sessionId === "string" ? msg.sessionId : ""),
        type: "system",
        ...(typeof msg.uuid === "string" ? { id: msg.uuid } : {}),
        ...(typeof msg.parentUuid === "string" ? { parentId: msg.parentUuid } : {}),
        ...(typeof msg.timestamp === "string" ? { timestamp: msg.timestamp } : {}),
      });
    }

    if (msg.type === "result") {
      if (typeof msg.total_cost_usd === "number") costUsd = msg.total_cost_usd;
      if (typeof msg.duration_ms === "number" && durationMs === undefined) durationMs = msg.duration_ms;
    }

    if (msg.type === "assistant") {
      const message = msg.message as Record<string, unknown> | undefined;
      if (!message) continue;

      if (typeof message.model === "string" && message.model !== "<synthetic>") {
        model = message.model;
        agent =
          typeof msg.entrypoint === "string"
            ? msg.entrypoint === "cli"
              ? "claude-code"
              : msg.entrypoint
            : "claude-code";
      }

      const usage = message.usage as Record<string, unknown> | undefined;
      const usageFields = {
        ...(typeof usage?.input_tokens === "number" ? { inputTokens: usage.input_tokens as number } : {}),
        ...(typeof usage?.output_tokens === "number" ? { outputTokens: usage.output_tokens as number } : {}),
        ...(typeof usage?.cache_read_input_tokens === "number" ? { cacheReadTokens: usage.cache_read_input_tokens as number } : {}),
      };
      const stopReason = typeof message.stop_reason === "string" ? message.stop_reason : undefined;
      const parentId = typeof msg.parentUuid === "string" ? msg.parentUuid : undefined;
      const ts = typeof msg.timestamp === "string" ? msg.timestamp : undefined;
      const lineId = typeof msg.uuid === "string" ? msg.uuid : undefined;
      let usagePlaced = false;

      const content = Array.isArray(message.content) ? message.content : [];
      for (const block of content) {
        if (!block || typeof block !== "object") continue;
        const b = block as Record<string, unknown>;
        if (b.type === "tool_use" && typeof b.name === "string") {
          const input = (b.input ?? {}) as Record<string, unknown>;
          toolCalls.push({
            name: b.name,
            input,
            timestamp: typeof msg.timestamp === "string" ? msg.timestamp : "",
            index: toolIndex++,
          });
          const toolId = typeof b.id === "string" ? b.id : undefined;
          pushEvent(events, {
            sessionId,
            type: "tool_call",
            ...(lineId ? { id: toolId ?? lineId } : toolId ? { id: toolId } : {}),
            ...(parentId ? { parentId } : {}),
            ...(ts ? { timestamp: ts } : {}),
            toolName: b.name,
            ...(toolId ? { toolCallId: toolId } : {}),
            input,
            ...(typeof message.model === "string" ? { model: message.model } : {}),
            ...(stopReason ? { stopReason } : {}),
            ...(!usagePlaced ? usageFields : {}),
          });
          if (b.name === "Skill" && typeof input.skill === "string" && input.skill) {
            skillInvokes.push({
              name: input.skill,
              signal: "skill_tool_use",
              eventIds: toolId ? [toolId] : lineId ? [lineId] : [],
            });
          }
          usagePlaced = true;
        } else if (b.type === "text" && typeof b.text === "string") {
          const text = b.text.trim();
          if (text) {
            assistantText.push(text);
            pushEvent(events, {
              sessionId,
              type: "assistant",
              ...(lineId ? { id: lineId } : {}),
              ...(parentId ? { parentId } : {}),
              ...(ts ? { timestamp: ts } : {}),
              text,
              ...(typeof message.model === "string" ? { model: message.model } : {}),
              ...(stopReason ? { stopReason } : {}),
              ...(!usagePlaced ? usageFields : {}),
            });
            usagePlaced = true;
          }
        }
      }
    }

    if (msg.type === "user") {
      // Skip attachment-injected messages (hook content, skill content)
      const isAttachment = typeof msg.attachment !== "undefined";
      if (isAttachment) continue;

      const message = msg.message as Record<string, unknown> | undefined;
      if (!message) continue;
      const text = extractUserText(message.content);
      if (text) userMessages.push(text);
      const parentId = typeof msg.parentUuid === "string" ? msg.parentUuid : undefined;
      const ts = typeof msg.timestamp === "string" ? msg.timestamp : undefined;
      const lineId = typeof msg.uuid === "string" ? msg.uuid : undefined;

      const blocks = Array.isArray(message.content) ? message.content : [];
      let emittedResult = false;
      for (const block of blocks) {
        if (!block || typeof block !== "object") continue;
        const b = block as Record<string, unknown>;
        if (b.type !== "tool_result") continue;
        emittedResult = true;
        const toolCallId = typeof b.tool_use_id === "string" ? b.tool_use_id : undefined;
        const out = toolResultText(b.content);
        pushEvent(events, {
          sessionId,
          type: "tool_result",
          ...(lineId ? { id: lineId } : {}),
          ...(parentId ? { parentId } : {}),
          ...(ts ? { timestamp: ts } : {}),
          ...(toolCallId ? { toolCallId } : {}),
          ...(out != null ? { output: out } : {}),
          ...(b.is_error === true ? { isError: true } : {}),
        });
      }
      if (text) {
        pushEvent(events, {
          sessionId,
          type: "user",
          ...(lineId && !emittedResult ? { id: lineId } : {}),
          ...(parentId ? { parentId } : {}),
          ...(ts ? { timestamp: ts } : {}),
          text,
        });
      }
    }
  }

  // Derive skillsInvoked from BOTH legacy Skill tool calls and modern client paths
  const legacySkills = toolCalls
    .filter((t) => t.name === "Skill")
    .map((t) => (typeof t.input.skill === "string" ? t.input.skill : ""))
    .filter(Boolean);

  const modernSkills = Array.from(skillsFromTranscript);
  const skillsInvoked = [...new Set([...legacySkills, ...modernSkills])];

  // Count tool calls
  const toolCallCounts: Record<string, number> = {};
  for (const t of toolCalls) {
    toolCallCounts[t.name] = (toolCallCounts[t.name] ?? 0) + 1;
  }

  const primitives: SessionPrimitives = {
    sessionId,
    sessionTitle,
    model,
    agent,
    cwd,
    gitBranch,
    toolCalls,
    toolCallCounts,
    skillsInvoked,
    userMessages,
    userTurnCount: userMessages.length,
    durationMs,
    assistantText,
  };
  if (sessionId) {
    for (const e of events) {
      if (!e.sessionId) e.sessionId = sessionId;
    }
  }
  return asSession(primitives, events, {
    ...(costUsd != null ? { costUsd } : {}),
    skillInvokes,
  });
}

/**
 * Smart truncation for LLM context:
 * 1. Always keep all Skill calls
 * 2. Keep first ceil(budget/2) and last floor(budget/2) non-Skill calls
 */
export function truncateToolCalls(calls: ToolCall[], maxCalls: number): ToolCall[] {
  if (calls.length <= maxCalls) return calls;

  const skillCalls = calls.filter((c) => c.name === "Skill");
  const nonSkillCalls = calls.filter((c) => c.name !== "Skill");

  const budget = Math.max(0, maxCalls - skillCalls.length);
  if (budget === 0) return skillCalls;

  const head = nonSkillCalls.slice(0, Math.ceil(budget / 2));
  const tail = nonSkillCalls.slice(-Math.floor(budget / 2));

  const headSet = new Set(head.map((c) => c.index));
  const tailSet = new Set(tail.map((c) => c.index));
  const selected = new Set([...headSet, ...tailSet, ...skillCalls.map((c) => c.index)]);

  return calls.filter((c) => selected.has(c.index));
}

/**
 * Sanitize a sessionId (from untrusted JSONL) for safe use in filenames under ~/.doraval/evals/.
 * Allows only safe chars, collapses separators, caps length.
 * Returns a safe fallback if the result would be empty, traversal-like, or unsafe.
 */
export function sanitizeSessionId(raw: string | undefined | null): string {
  if (!raw || typeof raw !== "string") {
    return `unknown-${Date.now()}`;
  }
  let sanitized = raw
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 64);

  if (!sanitized || sanitized === "." || sanitized === ".." || sanitized.includes("..")) {
    return `unknown-${Date.now()}`;
  }
  return sanitized;
}
