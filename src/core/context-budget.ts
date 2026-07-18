/**
 * Always-on context budget for scan (Anthropic context-engineering notes).
 * Counts tokens that typically load every turn — not on-demand skills.
 * Pure filesystem; no network/LLM.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { collectConfigSurfaces } from "./cross-agent.js";
import { estimateTokens } from "./skill-validate.js";

/** Soft line budget for the *sum* of always-on instruction files (matches CLAUDE.md guidance). */
export const ALWAYS_ON_LINES_WARN = 200;
/** Soft MCP count — bloated tool sets create ambiguous selection. */
export const MCP_SERVERS_WARN = 8;

export interface AlwaysOnFileBudget {
  path: string;
  lines: number;
  tokens: number;
}

export interface ContextBudget {
  alwaysOn: AlwaysOnFileBudget[];
  alwaysOnLines: number;
  alwaysOnTokens: number;
  skillCount: number;
  mcpServerCount: number;
  /** empty = nothing measured; ok = within soft budgets; warn = heavy always-on or tool set */
  status: "empty" | "ok" | "warn";
  /** One-line human summary for Intelligence */
  summary: string;
  /** Optional next-step hint when status is warn */
  hint?: string;
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

/**
 * Measure always-on agent context under cwd.
 * @param skillCount — on-demand skills discovered by scan (not always-on; inventory only).
 */
export function measureContextBudget(cwd: string, skillCount = 0): ContextBudget {
  const byPath = new Map<string, AlwaysOnFileBudget>();

  for (const s of collectConfigSurfaces(cwd)) {
    const lines = lineCount(s.content);
    byPath.set(s.file, {
      path: s.file,
      lines,
      tokens: estimateTokens(s.content),
    });
  }

  for (const abs of listGrokRuleFiles(cwd)) {
    const path = relPosix(cwd, abs);
    if (byPath.has(path)) continue;
    try {
      const content = readFileSync(abs, "utf-8");
      byPath.set(path, {
        path,
        lines: lineCount(content),
        tokens: estimateTokens(content),
      });
    } catch {
      // intentional: unreadable rule file — skip
    }
  }

  const alwaysOn = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
  const alwaysOnLines = alwaysOn.reduce((n, f) => n + f.lines, 0);
  const alwaysOnTokens = alwaysOn.reduce((n, f) => n + f.tokens, 0);
  const mcpServerCount = countMcpServers(cwd);

  if (alwaysOn.length === 0 && skillCount === 0 && mcpServerCount === 0) {
    return {
      alwaysOn,
      alwaysOnLines: 0,
      alwaysOnTokens: 0,
      skillCount,
      mcpServerCount,
      status: "empty",
      summary: "No always-on context measured",
    };
  }

  const heavyLines = alwaysOnLines > ALWAYS_ON_LINES_WARN;
  const heavyMcp = mcpServerCount >= MCP_SERVERS_WARN;
  const status: ContextBudget["status"] = heavyLines || heavyMcp ? "warn" : "ok";

  const fileBit =
    alwaysOn.length === 0
      ? "0 always-on files"
      : `${alwaysOn.length} always-on file${alwaysOn.length === 1 ? "" : "s"}`;
  const summary = `Always-on ~${alwaysOnTokens.toLocaleString()} tokens (${alwaysOnLines} lines, ${fileBit}) · ${skillCount} skill${skillCount === 1 ? "" : "s"} · ${mcpServerCount} MCP`;

  let hint: string | undefined;
  if (heavyLines) {
    const top = [...alwaysOn].sort((a, b) => b.lines - a.lines)[0];
    hint = `Always-on over ~${ALWAYS_ON_LINES_WARN} lines — move reference content to skills (largest: ${top?.path ?? "unknown"})`;
  } else if (heavyMcp) {
    hint = `${mcpServerCount} MCP servers — prune or defer tools so the agent can choose unambiguously`;
  }

  return {
    alwaysOn,
    alwaysOnLines,
    alwaysOnTokens,
    skillCount,
    mcpServerCount,
    status,
    summary,
    hint,
  };
}
