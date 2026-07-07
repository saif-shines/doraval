/**
 * Single source of truth for agent detection (plan item B2).
 * Replaces the scattered probing in capability-detect.ts (judge candidates),
 * session-adapters.ts (home dirs), and the deleted init.ts (command -v).
 * Detection is pure filesystem + `which` — no network, no LLM, no config.
 */
import { existsSync } from "fs";
import { join } from "path";
import { spawnSync } from "bun";

export type AgentName = "claude" | "cursor" | "copilot" | "codex" | "grok";

export interface AgentSurface {
  /** Repo-relative config files/dirs that exist (CLAUDE.md, .cursor/rules, …) */
  configFiles: string[];
  /** Repo-relative directories that contain skills */
  skillRoots: string[];
}

export interface AgentDetection {
  name: AgentName;
  installed: boolean;
  configuredInRepo: boolean;
  surfaces: AgentSurface;
}

export interface CrossAgentSurface {
  agentsMd: boolean;
  mcpJson: boolean;
}

export interface DetectDeps {
  which(cmd: string): boolean;
}

/** What binary marks "installed" and which repo paths mark "configured", per agent. */
const AGENT_PROBES: Record<
  AgentName,
  { binaries: string[]; configFiles: string[]; skillRoots: string[] }
> = {
  claude: {
    binaries: ["claude"],
    configFiles: ["CLAUDE.md", ".claude-plugin/plugin.json", ".claude"],
    skillRoots: [".claude/skills"],
  },
  cursor: {
    binaries: ["cursor-agent", "cursor"],
    configFiles: [".cursorrules", ".cursor/rules", ".cursor-plugin/plugin.json"],
    skillRoots: [".cursor/rules"],
  },
  copilot: {
    binaries: ["copilot"],
    configFiles: [".github/copilot-instructions.md", ".github/plugin/plugin.json"],
    skillRoots: [],
  },
  codex: {
    binaries: ["codex"],
    configFiles: [".codex-plugin/plugin.json", ".codex-plugin"],
    skillRoots: ["skills"],
  },
  grok: {
    binaries: ["grok"],
    configFiles: [".grok-plugin/plugin.json"],
    skillRoots: [],
  },
};

function defaultWhich(cmd: string): boolean {
  try {
    const r = spawnSync(["which", cmd], { stdout: "pipe", stderr: "pipe" });
    return r.exitCode === 0;
  } catch {
    return false; // intentional: `which` itself missing means not installed
  }
}

export const defaultDeps: DetectDeps = { which: defaultWhich };

export function detectAllAgents(cwd: string, deps: DetectDeps = defaultDeps): AgentDetection[] {
  return (Object.keys(AGENT_PROBES) as AgentName[]).map((name) => {
    const probe = AGENT_PROBES[name];
    const configFiles = probe.configFiles.filter((p) => existsSync(join(cwd, p)));
    const skillRoots = probe.skillRoots.filter((p) => existsSync(join(cwd, p)));
    return {
      name,
      installed: probe.binaries.some((b) => deps.which(b)),
      configuredInRepo: configFiles.length > 0 || skillRoots.length > 0,
      surfaces: { configFiles, skillRoots },
    };
  });
}

export function scanCrossAgent(cwd: string): CrossAgentSurface {
  return {
    agentsMd: existsSync(join(cwd, "AGENTS.md")),
    mcpJson: existsSync(join(cwd, ".mcp.json")),
  };
}
