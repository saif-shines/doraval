/**
 * Live command map for `dora agent-help`.
 * Exit-code meanings are the global contract: 0 clean, 1 issues, 2 could-not-run.
 */
import pkg from "../../package.json" with { type: "json" };
import { detectCapabilities } from "../core/capability-detect.js";

export type CommandLabel = "read-only" | "writes";

export interface CommandCapability {
  name: string;
  description: string;
  label: CommandLabel;
  args: { name: string; required: boolean; type: string }[];
  flags: Record<string, { description: string; values?: string[]; default?: string }>;
  exit_codes: Record<string, string>;
  examples: string[];
}

export interface CapabilitiesManifest {
  version: string;
  commands: CommandCapability[];
  intelligence: {
    mechanical: boolean;
    heuristic: boolean;
    llm: { available: boolean; via: "api" | "delegate" };
  };
}

const EXIT_CODES = {
  "0": "clean — no issues found",
  "1": "issues found",
  "2": "could not run (internal error or unmet prerequisite)",
};

const COMMON_FLAGS = {
  "--format": { description: "Output format", values: ["table", "json"], default: "table" },
  "--json": { description: "Alias for --format json" },
  "--ci": { description: "Machine mode: implies --format json, strict exit codes" },
};

function cmd(
  name: string,
  label: CommandLabel,
  description: string,
  examples: string[],
  flags: CommandCapability["flags"] = {},
  args: CommandCapability["args"] = [],
): CommandCapability {
  return { name, label, description, args, flags, exit_codes: EXIT_CODES, examples };
}

export function buildCapabilities(): CapabilitiesManifest {
  const caps = detectCapabilities();
  return {
    version: pkg.version,
    commands: [
      cmd("scan", "read-only", "Scan the repo: agent surfaces, skill health, suggestions. Also bare `dora`.", [
        "dora",
        "dora --json",
        "dora --yes",
      ], { ...COMMON_FLAGS, "--cwd": { description: "Directory to scan" }, "--yes": { description: "Skip the proceed prompt" } }),
      cmd("review", "read-only", "Multi-tier skill review (structure → heuristics → LLM → sessions). Includes Session health (token pressure).", [
        "dora review --quick",
        "dora review --quick --json",
        "dora review --deep .",
      ], {
        ...COMMON_FLAGS,
        "--quick": { description: "Tiers 1–2 only (no LLM)" },
        "--deep": { description: "Require LLM tier; exit 2 if no judge" },
        "--all": { description: "Review every artifact" },
        "--fail-on": { description: "Exit 1 trigger: error | warning", values: ["error", "warning"], default: "error" },
      }, [{ name: "path", required: false, type: "string" }]),
      cmd("fix", "writes", "Apply mechanical review fixes; surface judgment items.", [
        "dora fix . --dry-run",
        "dora fix . --yes",
      ], {
        ...COMMON_FLAGS,
        "--yes": { description: "Apply without prompting" },
        "--dry-run": { description: "Show diffs, write nothing" },
        "--brief": { description: "Agent-ready prompt for judgment fixes" },
      }, [{ name: "path", required: false, type: "string" }]),
      cmd("new", "writes", "Scaffold a skill, rule, agent, or plugin.", [
        "dora new skill --for claude --name review-pr --yes",
      ], COMMON_FLAGS),
      cmd("skill unused", "read-only", "List Authored Skills that are Remove candidates.", [
        "dora skill unused",
        "dora skill unused --json",
      ], {
        ...COMMON_FLAGS,
        "--cwd": { description: "Working directory override" },
      }),
      cmd("skill", "writes", "Remove or Restore a Skill.", [
        "dora skill remove ghost --dry-run",
        "dora skill restore ghost --yes",
      ], {
        ...COMMON_FLAGS,
        "--yes": { description: "Delete without prompting" },
        "--dry-run": { description: "Show the plan, write nothing" },
        "--for": { description: "Target agent", values: ["claude", "cursor", "codex", "copilot", "grok"] },
        "--global": { description: "Select a Global Skill when the name clashes" },
      }, [{ name: "name", required: false, type: "string" }]),
      cmd("memory", "writes", "Capture principles; promote to AGENTS.md.", [
        "dora memory add \"Never use default exports\" --weight 8",
        "dora memory promote --dry-run",
      ], COMMON_FLAGS),
      cmd("reconcile", "writes", "Settle cross-agent contradictions.", [
        "dora reconcile --dry-run",
      ], { ...COMMON_FLAGS, "--dry-run": { description: "Plan only" }, "--apply": { description: "Write recommended resolutions" }, "--yes": { description: "Skip confirm when applying" } }),
      cmd("config", "read-only", "Get or set config. Mutating subcommands write.", [
        "dora config get",
      ], COMMON_FLAGS),
      cmd("rules", "read-only", "View review rules. Mutating subcommands write.", [
        "dora rules",
      ], COMMON_FLAGS),
      cmd("sessions", "read-only", "List coding-agent sessions for this project.", [
        "dora sessions",
      ], COMMON_FLAGS),
      cmd("bump", "writes", "Bump plugin/marketplace semver.", ["dora bump"]),
      cmd("update", "writes", "Update doraval to the latest version.", ["dora update"]),
      cmd("providers", "read-only", "Packaging/spec reference for supported agents.", ["dora providers"]),
      cmd("agent-help", "read-only", "Live command map for agents.", [
        "dora agent-help",
        "dora agent-help --json",
        "dora agent-help review",
      ], COMMON_FLAGS),
    ],
    intelligence: {
      mechanical: true,
      heuristic: true,
      llm: {
        available: true,
        via: caps.preferred === "api" ? "api" : "delegate",
      },
    },
  };
}
