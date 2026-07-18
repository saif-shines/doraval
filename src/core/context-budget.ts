/**
 * Always-on context budget for scan (Anthropic context-engineering notes).
 * Counts tokens that typically load every turn — not on-demand skills.
 * Pure filesystem; no network/LLM.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { collectConfigSurfaces } from "./cross-agent.js";
import { parseFrontmatter } from "./frontmatter.js";
import { findDisclosureCandidates } from "./progressive-disclosure.js";
import type { DisclosureCandidate } from "./progressive-disclosure.js";
import { estimateTokens } from "./skill-validate.js";
import type { AgentName } from "./agent-detect.js";

/** Soft line budget for a *single agent's* always-on window (matches CLAUDE.md guidance). */
export const ALWAYS_ON_LINES_WARN = 200;
/** Soft MCP count — bloated tool sets create ambiguous selection. */
export const MCP_SERVERS_WARN = 8;

export interface AlwaysOnFileBudget {
  path: string;
  lines: number;
  tokens: number;
}

/** Per-agent always-on window: that agent's own files plus shared (AGENTS.md) files. */
export interface AgentWindow {
  agent: string;
  lines: number;
  tokens: number;
  fileCount: number;
}

export interface ContextBudget {
  alwaysOn: AlwaysOnFileBudget[];
  alwaysOnLines: number;
  alwaysOnTokens: number;
  /** Per-agent always-on budgets, heaviest first. */
  windows: AgentWindow[];
  /** Max lines over all windows (0 if none). */
  heaviestWindowLines: number;
  /** Single largest always-on file (avoids recomputing in callers). */
  largestAlwaysOn?: AlwaysOnFileBudget;
  skillCount: number;
  mcpServerCount: number;
  /** Sum of statically-declared MCP tools from .mcp.json, when any server declares them. */
  declaredMcpTools?: number;
  /** Top reference-shaped sections in the heaviest always-on file — extraction candidates. */
  candidates?: DisclosureCandidate[];
  /** empty = nothing measured; ok = within soft budgets; warn = heavy always-on or tool set */
  status: "empty" | "ok" | "warn";
  /** One-line human summary for Intelligence */
  summary: string;
  /** Optional next-step hint when status is warn */
  hint?: string;
}

/** Concrete agents whose always-on window we bucket (excludes "shared", codex has no rule dirs here). */
const CONCRETE_AGENTS: AgentName[] = ["claude", "cursor", "copilot", "grok"];

/**
 * Whether a rule file's frontmatter marks it always-on (loaded every turn) vs
 * just-in-time (path-scoped). JIT when `alwaysApply: false` or a non-empty
 * `globs`/`appliesTo`/`apply` path-glob is set; otherwise always-on (includes
 * `alwaysApply: true` and plain rules with no frontmatter). Malformed
 * frontmatter is treated as always-on (fail safe toward counting it).
 */
export function isAlwaysOnRule(content: string): boolean {
  let data: Record<string, unknown> = {};
  try {
    data = parseFrontmatter(content).data;
  } catch {
    return true;
  }
  if (data["alwaysApply"] === false) return false;
  const glob = data["globs"] ?? data["appliesTo"] ?? data["apply"];
  if (typeof glob === "string" && glob.trim()) return false;
  if (Array.isArray(glob) && glob.length > 0) return false;
  return true;
}

/** Whether a config-surface path lives in a per-agent rules directory (subject to JIT filtering). */
function isRuleFile(file: string): boolean {
  return (
    file.startsWith(".cursor/rules/") || file.startsWith(".claude/rules/") || file.startsWith(".grok/rules/")
  );
}

function relPosix(cwd: string, abs: string): string {
  return relative(cwd, abs).split(/[/\\]/).join("/");
}

function lineCount(text: string): number {
  if (!text) return 0;
  return text.split("\n").length;
}

function listGrokRuleFiles(cwd: string): string[] {
  const dir = join(cwd, ".grok", "rules");
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md") || f.endsWith(".mdc"))
      .map((f) => join(dir, f))
      .filter((p) => {
        try {
          return statSync(p).isFile();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

/** Server names from repo-root `.mcp.json` (empty if missing/invalid). */
export function listMcpServerNames(cwd: string): string[] {
  const p = join(cwd, ".mcp.json");
  if (!existsSync(p)) return [];
  try {
    const raw = JSON.parse(readFileSync(p, "utf-8")) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const obj = raw as Record<string, unknown>;
    const servers =
      obj.mcpServers && typeof obj.mcpServers === "object" && !Array.isArray(obj.mcpServers)
        ? (obj.mcpServers as Record<string, unknown>)
        : obj;
    const names: string[] = [];
    for (const [name, v] of Object.entries(servers)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const e = v as Record<string, unknown>;
        if ("command" in e || "url" in e || "type" in e) names.push(name);
      }
    }
    return names.sort();
  } catch {
    return [];
  }
}

/** Count MCP servers in repo-root `.mcp.json` (0 if missing/invalid). */
export function countMcpServers(cwd: string): number {
  return listMcpServerNames(cwd).length;
}

/** Sum of statically-declared tools in .mcp.json, or undefined if none declare any. */
export function countDeclaredMcpTools(cwd: string): number | undefined {
  const p = join(cwd, ".mcp.json");
  if (!existsSync(p)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(p, "utf-8")) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const obj = raw as Record<string, unknown>;
    const servers =
      obj.mcpServers && typeof obj.mcpServers === "object" && !Array.isArray(obj.mcpServers)
        ? (obj.mcpServers as Record<string, unknown>)
        : obj;
    let total = 0;
    let declared = false;
    for (const v of Object.values(servers)) {
      if (!v || typeof v !== "object" || Array.isArray(v)) continue;
      const e = v as Record<string, unknown>;
      if (Array.isArray(e["tools"])) {
        total += e["tools"].length;
        declared = true;
      } else if (typeof e["toolCount"] === "number" && Number.isFinite(e["toolCount"])) {
        total += e["toolCount"];
        declared = true;
      }
    }
    return declared ? total : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Measure always-on agent context under cwd.
 * @param skillCount — on-demand skills discovered by scan (not always-on; inventory only).
 */
export function measureContextBudget(cwd: string, skillCount = 0): ContextBudget {
  interface TaggedFile extends AlwaysOnFileBudget {
    agent: AgentName | "shared";
  }
  const byPath = new Map<string, TaggedFile>();

  for (const s of collectConfigSurfaces(cwd)) {
    if (isRuleFile(s.file) && !isAlwaysOnRule(s.content)) continue; // JIT rule — not always-on
    byPath.set(s.file, {
      path: s.file,
      lines: lineCount(s.content),
      tokens: estimateTokens(s.content),
      agent: s.agent,
    });
  }

  for (const abs of listGrokRuleFiles(cwd)) {
    const path = relPosix(cwd, abs);
    if (byPath.has(path)) continue;
    try {
      const content = readFileSync(abs, "utf-8");
      if (!isAlwaysOnRule(content)) continue; // JIT rule — not always-on
      byPath.set(path, {
        path,
        lines: lineCount(content),
        tokens: estimateTokens(content),
        agent: "grok",
      });
    } catch {
      // intentional: unreadable rule file — skip
    }
  }

  const tagged = [...byPath.values()];
  const alwaysOn: AlwaysOnFileBudget[] = tagged
    .map((f) => ({ path: f.path, lines: f.lines, tokens: f.tokens }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const alwaysOnLines = alwaysOn.reduce((n, f) => n + f.lines, 0);
  const alwaysOnTokens = alwaysOn.reduce((n, f) => n + f.tokens, 0);
  const mcpServerCount = countMcpServers(cwd);
  const declaredMcpTools = countDeclaredMcpTools(cwd);
  const largestAlwaysOn =
    alwaysOn.length > 0 ? [...alwaysOn].sort((a, b) => b.lines - a.lines)[0] : undefined;

  // Per-agent window: that agent's own files plus shared (AGENTS.md) files.
  // Only agents with at least one of their own files get a window — an
  // AGENTS.md-only repo has no agent actually loading it yet.
  const sharedFiles = tagged.filter((f) => f.agent === "shared");
  const windows: AgentWindow[] = [];
  for (const agent of CONCRETE_AGENTS) {
    const own = tagged.filter((f) => f.agent === agent);
    if (own.length === 0) continue;
    const files = [...own, ...sharedFiles];
    windows.push({
      agent,
      lines: files.reduce((n, f) => n + f.lines, 0),
      tokens: files.reduce((n, f) => n + f.tokens, 0),
      fileCount: files.length,
    });
  }
  windows.sort((a, b) => b.lines - a.lines);
  const heaviestWindowLines = windows.length > 0 ? windows[0]!.lines : 0;

  if (alwaysOn.length === 0 && skillCount === 0 && mcpServerCount === 0) {
    return {
      alwaysOn,
      alwaysOnLines: 0,
      alwaysOnTokens: 0,
      windows: [],
      heaviestWindowLines: 0,
      skillCount,
      mcpServerCount,
      status: "empty",
      summary: "No always-on context measured",
    };
  }

  const heavyWindow = heaviestWindowLines > ALWAYS_ON_LINES_WARN;
  const heavyMcp = mcpServerCount >= MCP_SERVERS_WARN;
  const status: ContextBudget["status"] = heavyWindow || heavyMcp ? "warn" : "ok";

  const fileBit =
    alwaysOn.length === 0
      ? "0 always-on files"
      : `${alwaysOn.length} always-on file${alwaysOn.length === 1 ? "" : "s"}`;
  const heaviest = windows[0];
  const heaviestBit = heaviest ? ` · heaviest agent: ${heaviest.agent} ${heaviest.lines} lines` : "";
  const mcpBit =
    declaredMcpTools !== undefined ? `${mcpServerCount} MCP (${declaredMcpTools} tools)` : `${mcpServerCount} MCP`;
  const summary = `Always-on ~${alwaysOnTokens.toLocaleString()} tokens (${alwaysOnLines} lines, ${fileBit})${heaviestBit} · ${skillCount} skill${skillCount === 1 ? "" : "s"} · ${mcpBit}`;

  let hint: string | undefined;
  let candidates: DisclosureCandidate[] | undefined;
  if (heavyWindow && heaviest) {
    if (largestAlwaysOn) {
      try {
        const content = readFileSync(join(cwd, largestAlwaysOn.path), "utf-8");
        candidates = findDisclosureCandidates(largestAlwaysOn.path, content).slice(0, 3);
      } catch {
        // intentional: heaviest always-on file unreadable — fall back to generic hint below
      }
    }
    const top = candidates && candidates.length > 0 ? candidates[0] : undefined;
    hint = top
      ? `${heaviest.agent} always-on ~${heaviest.lines} lines — move "${top.heading}" (${top.lines} lines, reference) to a skill`
      : `${heaviest.agent} always-on ~${heaviest.lines} lines (over ~${ALWAYS_ON_LINES_WARN}) — move reference content to skills (largest: ${largestAlwaysOn?.path ?? "unknown"})`;
  } else if (heavyMcp) {
    hint =
      declaredMcpTools !== undefined
        ? `${declaredMcpTools} MCP tools across ${mcpServerCount} servers — bloated tool sets force coin-flip selection; prune or split by job`
        : `${mcpServerCount} MCP servers load their tool definitions every turn — prune or defer so the agent can choose unambiguously`;
  }

  return {
    alwaysOn,
    alwaysOnLines,
    alwaysOnTokens,
    windows,
    heaviestWindowLines,
    largestAlwaysOn,
    skillCount,
    mcpServerCount,
    declaredMcpTools,
    candidates,
    status,
    summary,
    hint,
  };
}
