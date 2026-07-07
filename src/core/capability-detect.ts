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
// Probe order: most capable judge CLIs first.
const CLI_CANDIDATES = ["claude", "grok", "codex", "copilot", "cursor"];

export function detectCliCommand(): string | null {
  for (const cmd of CLI_CANDIDATES) {
    try {
      const result = spawnSync(["which", cmd], { stdout: "pipe", stderr: "pipe" });
      if (result.exitCode === 0) return cmd;
    } catch {
      // not installed
    }
  }
  return null;
}

export function detectCapabilities(evalCfg?: Partial<EvalConfig>): Capabilities {
  const api = canUseApiJudge(evalCfg ?? {});
  const cliCommand = detectCliCommand();
  const cli = cliCommand !== null;
  // B9: agent CLI first, API key second — use the subscription they already pay for.
  const preferred: Capabilities["preferred"] = cli ? "cli" : api ? "api" : "none";
  return { api, cli, cliCommand, preferred };
}

export function describeCapabilities(caps: Capabilities): string {
  if (caps.preferred === "api") return "API judge (direct)";
  if (caps.preferred === "cli") return `CLI judge (${caps.cliCommand})`;
  return "no judge available — set an API key or install claude CLI";
}
