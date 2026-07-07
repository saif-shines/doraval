/**
 * `dora --capabilities` — agent self-description (plan item B7, contract A5).
 * Hand-maintained registry for now; commands added here as they ship.
 * Exit-code meanings are the global contract: 0 clean, 1 issues, 2 could-not-run.
 */
import pkg from "../../package.json" with { type: "json" };
import { detectCapabilities } from "../core/capability-detect.js";

export interface CommandCapability {
  name: string;
  description: string;
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
    llm: { available: boolean; via: "api" | "cli" | "none" };
  };
}

const EXIT_CODES = {
  "0": "clean — no issues found",
  "1": "issues found",
  "2": "could not run (internal error or unmet prerequisite)",
};

const COMMON_FLAGS = {
  "--format": { description: "Output format", values: ["table", "json"], default: "table" },
  "--ci": { description: "Machine mode: implies --format json, strict exit codes" },
};

export function buildCapabilities(): CapabilitiesManifest {
  const caps = detectCapabilities();
  return {
    version: pkg.version,
    commands: [
      {
        name: "scan",
        description:
          "Scan the repo: agent surfaces, skill health, suggestions. Also runs as bare `dora`.",
        args: [],
        flags: {
          ...COMMON_FLAGS,
          "--cwd": { description: "Directory to scan (CI / coding agents)" },
        },
        exit_codes: EXIT_CODES,
        examples: ["dora --format json", "dora scan --cwd /path/to/repo --format json"],
      },
      {
        name: "review",
        description:
          "4-tier quality gate: structure → heuristics → LLM → sessions. Replaces validate/drift/judge.",
        args: [{ name: "path", required: false, type: "string" }],
        flags: {
          ...COMMON_FLAGS,
          "--quick": { description: "Tiers 1–2 only (no LLM)" },
          "--deep": { description: "All tiers including LLM judge" },
          "--all": { description: "Review every discovered skill" },
          "--fail-on": { description: "Minimum severity to exit 1", values: ["error", "warning"], default: "error" },
        },
        exit_codes: EXIT_CODES,
        examples: ["dora review .", "dora review --all --quick --ci"],
      },
      {
        name: "fix",
        description:
          "Apply mechanical fixes from review findings or emit agent-ready briefs for judgment fixes.",
        args: [{ name: "path", required: false, type: "string" }],
        flags: {
          ...COMMON_FLAGS,
          "--yes": { description: "Apply fixes without prompting" },
          "--dry-run": { description: "Show what would change, don't write" },
          "--brief": { description: "Emit agent-ready prompt for judgment fixes" },
        },
        exit_codes: EXIT_CODES,
        examples: ["dora fix . --dry-run", "dora fix --brief"],
      },
    ],
    intelligence: {
      mechanical: true,
      heuristic: true,
      llm: {
        available: caps.preferred !== "none",
        via: caps.preferred === "none" ? "none" : caps.preferred,
      },
    },
  };
}
