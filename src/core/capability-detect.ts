import { spawnSync } from "bun";
import { canUseApiJudge } from "./llm-judge.js";
import type { EvalConfig } from "./journal-config.js";

export interface Capabilities {
  api: boolean;
  cli: boolean;
  cliCommand: string | null;
  preferred: "api" | "cli" | "none";
}

// Agent CLI first (B9): user already pays for their coding agent subscription.
// ONLY list CLIs that agent-invoke.ts has a working judge template for
// (getDefaultPromptTemplate + JSON unwrapping). codex/copilot/cursor are NOT
// judge-capable yet — selecting them produces unparseable output and a silent
// LLM-tier failure. Extend this list together with agent-invoke templates (B14).
export const CLI_CANDIDATES = ["claude", "grok"];

let cachedCliCommand: string | null | undefined;

export function detectCliCommand(): string | null {
  // Memoized per process: `dora review --all` calls this once per skill and
  // the PATH does not change mid-run. resetCapabilityCache() for tests.
  if (cachedCliCommand !== undefined) return cachedCliCommand;
  for (const cmd of CLI_CANDIDATES) {
    try {
      const result = spawnSync(["which", cmd], { stdout: "pipe", stderr: "pipe" });
      if (result.exitCode === 0) {
        cachedCliCommand = cmd;
        return cmd;
      }
    } catch {
      // not installed
    }
  }
  cachedCliCommand = null;
  return null;
}

export function resetCapabilityCache(): void {
  cachedCliCommand = undefined;
}

export function detectCapabilities(evalCfg?: Partial<EvalConfig>): Capabilities {
  const api = canUseApiJudge(evalCfg ?? {});
  const cliCommand = detectCliCommand();
  const cli = cliCommand !== null;

  // Explicit user preference (dora config set eval.judge api|cli) governs —
  // fall through to auto order only when it can't be honored.
  const judgePref = evalCfg?.judge;
  let preferred: Capabilities["preferred"];
  if (judgePref === "api" && api) {
    preferred = "api";
  } else if (judgePref === "cli" && cli) {
    preferred = "cli";
  } else {
    // B9 auto order: agent CLI first, API key second — use the subscription they already pay for.
    preferred = cli ? "cli" : api ? "api" : "none";
  }
  return { api, cli, cliCommand, preferred };
}

export function describeCapabilities(caps: Capabilities): string {
  if (caps.preferred === "api") return "API judge (direct)";
  if (caps.preferred === "cli") return `CLI judge (${caps.cliCommand})`;
  return "no judge available — set an API key or install claude CLI";
}
