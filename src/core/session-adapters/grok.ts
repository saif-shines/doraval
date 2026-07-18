import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { basename, dirname, join } from "path";
import { safeJsonParse, type SessionPrimitives, type ToolCall } from "../session-parse.js";
import type { SessionAdapter, SessionListItem } from "./types.js";

export interface GrokAdapterOptions {
  /** Absolute path to Grok home (replaces ~/.grok). Defaults to GROK_HOME env or `<homeDir>/.grok`. */
  grokHome?: string;
}

interface GrokSummary {
  info?: { id?: string; cwd?: string };
  session_summary?: string;
  current_model_id?: string;
  head_branch?: string;
  primaryModelId?: string;
}

interface GrokSignals {
  primaryModelId?: string;
  contextTokensUsed?: number;
  toolsUsed?: string[];
}

function resolveGrokHome(homeDir: string, opts?: GrokAdapterOptions): string {
  if (opts?.grokHome) return opts.grokHome;
  if (process.env.GROK_HOME) return process.env.GROK_HOME;
  return join(homeDir, ".grok");
}

function encodeCwd(cwd: string): string {
  return cwd.replace(/\//g, "%2F");
}

/** Find the sessions/<group> directory for a cwd (encoded name or .cwd pointer). */
function findSessionGroup(sessionsRoot: string, cwd: string): string | null {
  if (!existsSync(sessionsRoot)) return null;
  const encoded = encodeCwd(cwd);
  const direct = join(sessionsRoot, encoded);
  if (existsSync(direct)) return direct;

  // Long-path groups: slug+hash dir with a `.cwd` file holding the real path
  try {
    for (const name of readdirSync(sessionsRoot)) {
      if (name.startsWith(".")) continue;
      const group = join(sessionsRoot, name);
      let st;
      try {
        st = statSync(group);
      } catch {
        continue;
      }
      if (!st.isDirectory()) continue;
      const cwdFile = join(group, ".cwd");
      if (!existsSync(cwdFile)) continue;
      const text = readFileSync(cwdFile, "utf8").trim();
      if (text === cwd) return group;
    }
  } catch {
    // intentional: best-effort walk of session groups
  }
  return null;
}

function readJsonFile<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    return safeJsonParse<T>(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** Session identity = parent dir of updates.jsonl (UUID), not the file basename. */
export function sessionIdFromPath(path: string): string {
  const norm = path.replace(/\\/g, "/");
  if (norm.endsWith("/updates.jsonl")) {
    return basename(dirname(norm));
  }
  // …/<sessionId>/terminal/run.log or other files under the session dir
  const parts = norm.split("/").filter(Boolean);
  const sessIdx = parts.lastIndexOf("sessions");
  if (sessIdx >= 0 && parts.length > sessIdx + 2) {
    // sessions/<group>/<sessionId>/…
    return parts[sessIdx + 2]!;
  }
  // last non-file segment
  if (parts.length >= 2) return parts[parts.length - 2]!;
  return basename(norm).replace(/\.jsonl$/, "") || "grok";
}

const SKILL_TITLE_RE = /^Skill\s+(\S+)/i;
const SKILL_PATH_RE = /[/\\]skills[/\\]([^/\\]+)[/\\]SKILL\.md/i;

/** Extract skill names from ACP tool titles, paths, and raw inputs. */
export function extractSkillsFromUpdate(u: Record<string, unknown>): string[] {
  const out: string[] = [];
  const title = typeof u.title === "string" ? u.title : "";
  const m = title.match(SKILL_TITLE_RE);
  if (m?.[1]) out.push(m[1]);

  const blobs: string[] = [title];
  for (const key of ["rawInput", "input", "args"] as const) {
    const v = u[key];
    if (v && typeof v === "object") blobs.push(JSON.stringify(v));
    else if (typeof v === "string") blobs.push(v);
  }
  if (Array.isArray(u.locations)) blobs.push(JSON.stringify(u.locations));

  for (const blob of blobs) {
    let match: RegExpExecArray | null;
    const re = new RegExp(SKILL_PATH_RE.source, "gi");
    while ((match = re.exec(blob)) !== null) {
      if (match[1]) out.push(match[1]);
    }
  }
  return out;
}

function toolNameFromUpdate(u: Record<string, unknown>): string | null {
  if (typeof u.title === "string" && u.title && !SKILL_TITLE_RE.test(u.title)) {
    // Prefer short snake_case tool names over human "Read `path`" titles when both exist —
    // tool_call usually has short name; tool_call_update often has long title.
    if (!u.title.includes("`") && u.title.length < 64) return u.title;
  }
  if (typeof u.kind === "string" && u.kind) return u.kind;
  if (typeof u.title === "string" && u.title) return u.title;
  return null;
}

function parseUpdatesJsonl(
  text: string,
  meta: {
    sessionId: string;
    cwd: string;
    model: string;
    sessionTitle?: string;
    gitBranch?: string;
  },
): SessionPrimitives {
  const lines = text.split("\n").filter((l) => l.trim());
  const toolCalls: ToolCall[] = [];
  const userMessages: string[] = [];
  const assistantText: string[] = [];
  const skills = new Set<string>();
  let idx = 0;

  for (const line of lines) {
    const j = safeJsonParse<Record<string, unknown>>(line);
    if (!j) continue;
    const params = (j.params ?? {}) as Record<string, unknown>;
    const u = (params.update ?? {}) as Record<string, unknown>;
    const su = u.sessionUpdate;

    if (su === "user_message_chunk") {
      const content = u.content as { text?: string } | undefined;
      if (content?.text) userMessages.push(content.text);
    }
    if (su === "agent_message_chunk") {
      const content = u.content as { text?: string } | undefined;
      if (content?.text?.trim()) assistantText.push(content.text.trim());
    }
    if (su === "tool_call" || su === "tool_call_update") {
      for (const s of extractSkillsFromUpdate(u)) skills.add(s);
      if (su === "tool_call") {
        const name = toolNameFromUpdate(u) || "tool";
        const input =
          (u.rawInput as Record<string, unknown>) ||
          (u.input as Record<string, unknown>) ||
          (u.args as Record<string, unknown>) ||
          {};
        const ts = typeof j.timestamp === "number" ? new Date(j.timestamp * 1000).toISOString() : "";
        toolCalls.push({ name, input, timestamp: ts, index: idx++ });
      }
    }
  }

  const counts: Record<string, number> = {};
  for (const t of toolCalls) counts[t.name] = (counts[t.name] || 0) + 1;

  return {
    sessionId: meta.sessionId,
    sessionTitle: meta.sessionTitle,
    model: meta.model,
    agent: "grok",
    cwd: meta.cwd,
    gitBranch: meta.gitBranch,
    toolCalls,
    toolCallCounts: counts,
    skillsInvoked: [...skills],
    userMessages: userMessages.slice(0, 5),
    userTurnCount: userMessages.length,
    assistantText,
  };
}

function listSessionDirs(group: string): string[] {
  try {
    return readdirSync(group).filter((d) => {
      if (d.startsWith(".")) return false;
      try {
        return statSync(join(group, d)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

function sessionMtime(sessDir: string): number {
  const updates = join(sessDir, "updates.jsonl");
  try {
    if (existsSync(updates)) return statSync(updates).mtimeMs;
    return statSync(sessDir).mtimeMs;
  } catch {
    return 0;
  }
}

export function createGrokAdapter(
  homeDir: string = homedir(),
  opts?: GrokAdapterOptions,
): SessionAdapter {
  const grokHome = () => resolveGrokHome(homeDir, opts);
  const sessionsRoot = () => join(grokHome(), "sessions");

  return {
    agent: "grok",

    detect(): boolean {
      try {
        return existsSync(sessionsRoot());
      } catch {
        return false;
      }
    },

    findLatestSession(cwd: string): string | null {
      try {
        const group = findSessionGroup(sessionsRoot(), cwd);
        if (!group) return null;
        const subs = listSessionDirs(group);
        if (subs.length === 0) return null;
        subs.sort((a, b) => sessionMtime(join(group, b)) - sessionMtime(join(group, a)));
        const latest = join(group, subs[0]!);
        const updates = join(latest, "updates.jsonl");
        if (existsSync(updates)) return updates;
        const termDir = join(latest, "terminal");
        if (existsSync(termDir)) {
          const logs = readdirSync(termDir).filter((f) => f.endsWith(".log"));
          if (logs.length) return join(termDir, logs[0]!);
        }
        return null;
      } catch {
        return null;
      }
    },

    listRecentSessions(cwd: string, limit = 10): SessionListItem[] {
      const res: SessionListItem[] = [];
      try {
        const group = findSessionGroup(sessionsRoot(), cwd);
        if (!group) return [];
        const subs = listSessionDirs(group);
        subs.sort((a, b) => sessionMtime(join(group, b)) - sessionMtime(join(group, a)));
        for (const sub of subs.slice(0, limit)) {
          const sessDir = join(group, sub);
          const updates = join(sessDir, "updates.jsonl");
          if (!existsSync(updates)) continue;
          const summary = readJsonFile<GrokSummary>(join(sessDir, "summary.json"));
          let skillCount = 0;
          try {
            // Light pass for list badges — full parse is for parse()
            const text = readFileSync(updates, "utf8");
            const skills = new Set<string>();
            for (const line of text.split("\n")) {
              if (!line.includes("skill") && !line.includes("Skill") && !line.includes("SKILL.md")) continue;
              const j = safeJsonParse<Record<string, unknown>>(line);
              if (!j) continue;
              const u = ((j.params as Record<string, unknown>)?.update ?? {}) as Record<string, unknown>;
              for (const s of extractSkillsFromUpdate(u)) skills.add(s);
            }
            skillCount = skills.size;
          } catch {
            // intentional: list stays usable if updates unreadable
          }
          const signals = readJsonFile<GrokSignals>(join(sessDir, "signals.json"));
          res.push({
            path: updates,
            mtime: sessionMtime(sessDir),
            title: summary?.session_summary || summary?.info?.id || sub,
            skillCount,
            tokens: signals?.contextTokensUsed,
          });
        }
      } catch {
        // intentional: degrade to empty list for this home-dir walk
      }
      return res;
    },

    parse(path: string): SessionPrimitives {
      const sessionId = sessionIdFromPath(path);
      const sessDir = path.endsWith("updates.jsonl") || path.endsWith("updates.jsonl".replace(/\//g, "\\"))
        ? dirname(path)
        : // terminal/log → climb to session dir
          (() => {
            const norm = path.replace(/\\/g, "/");
            if (norm.includes("/terminal/")) return dirname(dirname(path));
            return dirname(path);
          })();

      const summary = readJsonFile<GrokSummary>(join(sessDir, "summary.json"));
      const signals = readJsonFile<GrokSignals>(join(sessDir, "signals.json"));
      const model =
        summary?.current_model_id ||
        signals?.primaryModelId ||
        summary?.primaryModelId ||
        "grok";
      const cwd = summary?.info?.cwd || process.cwd();
      const sessionTitle = summary?.session_summary || undefined;
      const gitBranch = summary?.head_branch || undefined;

      if (!existsSync(path)) {
        return {
          sessionId,
          sessionTitle,
          model,
          agent: "grok",
          cwd,
          gitBranch,
          toolCalls: [],
          toolCallCounts: {},
          skillsInvoked: [],
          userMessages: [],
          userTurnCount: 0,
          assistantText: [],
        };
      }

      const text = readFileSync(path, "utf8");
      if (path.endsWith("updates.jsonl")) {
        return parseUpdatesJsonl(text, { sessionId, cwd, model, sessionTitle, gitBranch });
      }

      // fallback for terminal logs under the session directory
      return {
        sessionId,
        sessionTitle,
        model,
        agent: "grok",
        cwd,
        gitBranch,
        toolCalls: [
          {
            name: "GrokResponse",
            input: { content: text.slice(0, 3000) },
            timestamp: "",
            index: 0,
          },
        ],
        toolCallCounts: { GrokResponse: 1 },
        skillsInvoked: [],
        userMessages: [text.slice(0, 200)],
        userTurnCount: 1,
        assistantText: [],
      };
    },
  };
}

export const grokAdapter: SessionAdapter = createGrokAdapter();
