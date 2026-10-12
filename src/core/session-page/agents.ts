/** Page agents. `dora session` stays the five adapters in `ALL_ADAPTERS`. Gemini is page-only. */

export const AGENT_DIRS = {
  grok: ".grok",
  "claude-code": ".claude",
  cursor: ".cursor",
  codex: ".codex",
  copilot: ".copilot",
  gemini: ".gemini",
} as const;

export const HOME_FOLDERS = ".claude, .grok, .cursor, .codex, .copilot, or .gemini";
export const CHOOSE_HOME = `Choose your home folder, or ${HOME_FOLDERS}.`;

export type AgentName = keyof typeof AGENT_DIRS;

const LABELS: Record<AgentName, string> = {
  grok: "Grok",
  "claude-code": "Claude",
  cursor: "Cursor",
  codex: "Codex",
  copilot: "Copilot",
  gemini: "Gemini",
};

export function agentLabel(agent: string): string {
  return agent in LABELS ? LABELS[agent as AgentName] : agent;
}

/** Agents present in the rows, in page order. Unknown agents follow. */
export function agentsIn(rows: { agent?: string }[]): string[] {
  const present = new Set<string>();
  for (const row of rows) if (row.agent) present.add(row.agent);
  const ordered = (Object.keys(AGENT_DIRS) as string[]).filter((agent) => present.has(agent));
  for (const agent of present) if (!ordered.includes(agent)) ordered.push(agent);
  return ordered;
}

/** List line: agent, model when the log has one, branch. */
export function rowWho(row: { agent?: string; model: string; branch: string }): string {
  const label = row.agent ? agentLabel(row.agent) : "";
  const model = row.model && row.model !== "unknown" && row.model !== row.agent && row.model !== label ? row.model : "";
  return [label, model, row.branch].filter(Boolean).join(" · ");
}

/** Grok ids stay bare so existing links keep working. Other agents are prefixed. */
export function traceId(agent: AgentName, id: string): string {
  return agent === "grok" ? id : `${agent}:${id}`;
}

function safeId(id: string): boolean {
  return id.length > 0 && id.length < 240 && !id.includes("/") && !id.includes("\\") && !id.includes("..");
}

export function parseTraceId(raw: string): { agent: AgentName; id: string } | null {
  const colon = raw.indexOf(":");
  if (colon > 0) {
    const agent = raw.slice(0, colon);
    const id = raw.slice(colon + 1);
    if (!safeId(id)) return null;
    if (agent in AGENT_DIRS && agent !== "grok") return { agent: agent as AgentName, id };
    return null;
  }
  if (/^[0-9a-f-]{20,}$/i.test(raw)) return { agent: "grok", id: raw };
  return null;
}
