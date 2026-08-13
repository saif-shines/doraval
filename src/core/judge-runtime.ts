/**
 * Single owner for judge *mode* decisions.
 * Transport stays in llm-judge / skill-lint; orchestration calls decideJudgeMode once.
 */
import type { EvalConfig } from "./journal-config.js";
import {
  resolveJudgeMode,
  detectCapabilities,
  type JudgeMode,
  type Capabilities,
} from "./capability-detect.js";
import { canUseApiJudge } from "./llm-judge.js";

export {
  resolveJudgeMode,
  detectCapabilities,
  type JudgeMode,
  type Capabilities,
};

/**
 * Resolve api | delegate | fail from eval config + CI.
 * Prefer this over re-calling resolveJudgeMode at every leaf.
 */
export function decideJudgeMode(
  evalCfg: Partial<EvalConfig>,
  opts?: { ci?: boolean; apiAvailable?: boolean },
): JudgeMode {
  const apiAvailable = opts?.apiAvailable ?? canUseApiJudge(evalCfg);
  return resolveJudgeMode({
    apiAvailable,
    ci: opts?.ci ?? false,
    judgePref: evalCfg.judge,
  });
}
