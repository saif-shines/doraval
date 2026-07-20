import { canUseApiJudge } from "./llm-judge.js";
import type { EvalConfig } from "./journal-config.js";

export interface Capabilities {
  api: boolean;
  preferred: "api" | "none";
}

/** Pure probe: is a direct-API judge reachable (env or config credentials)? */
export function detectCapabilities(evalCfg?: Partial<EvalConfig>): Capabilities {
  const api = canUseApiJudge(evalCfg ?? {});
  return { api, preferred: api ? "api" : "none" };
}

export type JudgeMode = "api" | "delegate" | "fail";

/**
 * Routing decision. `delegate` is NOT a detected capability (dora can always
 * emit a prompt) — it is the no-key fallback, and the choice needs the `--ci`
 * flag the probe never sees.
 *
 * auto:     key -> api; no key & !ci -> delegate; no key & ci -> fail
 * api:      key -> api;  no key -> fail (never silently degrades)
 * delegate: always delegate (escape hatch for a harness that runs the prompt)
 */
export function resolveJudgeMode(input: {
  apiAvailable: boolean;
  ci: boolean;
  judgePref?: "auto" | "api" | "delegate";
}): JudgeMode {
  const pref = input.judgePref ?? "auto";
  if (pref === "delegate") return "delegate";
  if (pref === "api") return input.apiAvailable ? "api" : "fail";
  // auto
  if (input.apiAvailable) return "api";
  return input.ci ? "fail" : "delegate";
}

export function describeCapabilities(caps: Capabilities): string {
  if (caps.preferred === "api") return "API judge (direct)";
  return "no judge available — set an API key, or run in-agent to delegate judging to the caller";
}
