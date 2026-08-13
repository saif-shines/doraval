/**
 * Shared review control plane: config/rules load, judge context, finding tallies.
 * Skill vs memory still own their tier *producers*; this module owns the control path.
 */
import { readConfig, getEvalConfig, type JournalConfig, type EvalConfig } from "./journal-config.js";
import { resolveEffectiveRules, type EffectiveRule } from "./rules/resolve.js";
import { detectCapabilities, resolveJudgeMode, type Capabilities, type JudgeMode } from "./capability-detect.js";
import type { AgentConfig } from "./agent-invoke.js";

export type FindingSeverity = "error" | "warning" | "info" | "pass";

export function padIdx(n: number): string {
  return String(n).padStart(3, "0");
}

export function tallyFindings<T extends { severity: FindingSeverity }>(
  findings: T[],
): { passed: number; warnings: number; errors: number; findings: T[] } {
  return {
    passed: findings.filter((f) => f.severity === "pass").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    errors: findings.filter((f) => f.severity === "error").length,
    findings,
  };
}

export async function loadReviewContext(cwd: string): Promise<{
  config: JournalConfig | null;
  effective: Map<string, EffectiveRule>;
  ruleWarnings: string[];
}> {
  const config = await readConfig();
  const { map: effective, warnings: ruleWarnings } = resolveEffectiveRules(config, cwd);
  return { config, effective, ruleWarnings };
}

export function resolveJudgeContext(
  config: JournalConfig | null,
  opts?: { ci?: boolean },
): {
  evalCfg: EvalConfig;
  agentCfg: AgentConfig;
  caps: Capabilities;
  mode: JudgeMode;
} {
  const evalCfg = getEvalConfig(config);
  const agentCfg: AgentConfig = config?.agent ?? { command: "" };
  const caps = detectCapabilities(evalCfg);
  const mode = resolveJudgeMode({
    apiAvailable: caps.api,
    ci: opts?.ci ?? false,
    judgePref: evalCfg.judge,
  });
  return { evalCfg, agentCfg, caps, mode };
}
