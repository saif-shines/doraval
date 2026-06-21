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

export function parseSession(jsonlText: string): SessionPrimitives {
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

  const toolCalls: ToolCall[] = [];
  const userMessages: string[] = [];
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
      skillsFromTranscript.add(msg.attributionSkill.trim());
    }

    // <command-name>/foo</command-name> wrappers in message content
    const raw = JSON.stringify(msg);
    const cmdMatch = raw.match(/<command-name>([^<]+)<\/command-name>/i);
    if (cmdMatch) {
      let name = cmdMatch[1].trim();
      if (name.startsWith("/")) name = name.slice(1);
      if (name) skillsFromTranscript.add(name);
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

  return {
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
  };
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
