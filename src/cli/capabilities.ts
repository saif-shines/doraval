/**
 * Live command map for `dora --help --json`.
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
  "--cwd": { description: "Working directory override" },
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
      cmd("scan", "read-only", "Scan the repo: agent surfaces, skill health, suggestions.", [
        "dora scan",
        "dora scan --json",
        "dora scan --yes",
      ], { ...COMMON_FLAGS, "--cwd": { description: "Directory to scan" }, "--yes": { description: "Skip the proceed prompt" } }),
      cmd("fix", "writes", "Apply mechanical review fixes; surface judgment items.", [
        "dora fix . --dry-run",
        "dora fix . --yes",
      ], {
        ...COMMON_FLAGS,
        "--yes": { description: "Apply without prompting" },
        "--dry-run": { description: "Show diffs, write nothing" },
        "--brief": { description: "Agent-ready Judgment items (code, docUrl, severity, hint)" },
      }, [{ name: "path", required: false, type: "string" }]),
      cmd("skill unused", "read-only", "List unused Skills. Remove candidates are never invoked and not a Recent install.", [
        "dora skill unused",
        "dora skill unused --json",
      ], {
        ...COMMON_FLAGS,
        "--cwd": { description: "Working directory override" },
        "--last": { description: "How many recent Sessions to read" },
        "--since": { description: "Drop Sessions older than this many days" },
        "--global": { description: "Home Skills; Sessions from every project" },
      }),
      cmd("skill", "writes", "List, new, remove, or restore a Skill.", [
        "dora skill",
        "dora skill new --for claude --name review-pr --yes",
        "dora skill remove ghost --dry-run",
      ], {
        ...COMMON_FLAGS,
        "--yes": { description: "Delete without prompting" },
        "--dry-run": { description: "Show the plan, write nothing" },
        "--for": { description: "Target agent", values: ["claude", "cursor", "codex", "copilot", "grok"] },
        "--global": { description: "Select a Global Skill when the name clashes" },
      }, [{ name: "name", required: false, type: "string" }]),
      cmd("rule", "read-only", "List review rules. Mutating subcommands write.", [
        "dora rule",
        "dora rule new --for cursor --yes",
      ], COMMON_FLAGS),
      cmd("session", "read-only", "List coding-agent sessions for this project.", [
        "dora session",
        "dora session show <id>",
      ], COMMON_FLAGS),
      cmd("memory", "writes", "Capture principles; promote to AGENTS.md.", [
        "dora memory add \"Never use default exports\" --weight 8",
        "dora memory promote --dry-run",
      ], COMMON_FLAGS),
      cmd("conflicts", "writes", "Settle cross-agent contradictions.", [
        "dora conflicts --dry-run",
        "dora conflicts --yes",
      ], { ...COMMON_FLAGS, "--dry-run": { description: "Plan only" }, "--yes": { description: "Apply recommended resolutions" } }),
      cmd("config", "read-only", "List, get, or set config. Mutating subcommands write.", [
        "dora config",
        "dora config setup",
        "dora config set identity.api_key <token> --yes",
      ], { ...COMMON_FLAGS, "--dry-run": { description: "Plan only" }, "--yes": { description: "Write a secret without prompting" } }),
      cmd("agent", "writes", "List Subagents; new.", [
        "dora agent",
        "dora agent new --for claude --yes",
      ], COMMON_FLAGS),
      cmd("plugin", "writes", "List Plugins; new; bump semver (also marketplaces).", [
        "dora plugin",
        "dora plugin new --for claude --yes",
        "dora plugin bump",
      ], COMMON_FLAGS),
      cmd("harness", "writes", "List routines; new, boot, pause, resume, open.", [
        "dora harness",
        "dora harness list",
        "dora harness new",
        "dora harness boot <slug>",
        "dora harness pause <slug>",
        "dora harness resume <slug>",
        "dora harness open <slug>",
      ], {
        ...COMMON_FLAGS,
        "--accept": { description: "Write the routine folder after the printed one-pass command" },
        "--yes": { description: "Write without prompting" },
        "--dry-run": { description: "Print the one-pass command, write nothing" },
      }),
      cmd("update", "writes", "Update doraval to the latest version.", ["dora update"]),
      cmd("probe", "writes", "Send hello to doraval.dev and wait for ack.", [
        "dora probe --dry-run",
        "dora probe --yes",
      ], {
        ...COMMON_FLAGS,
        "--yes": { description: "Run without prompting" },
        "--dry-run": { description: "Show the plan, send nothing" },
      }),
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
