import type { z } from "zod";
import type { EvalConfig } from "./journal-config.js";
import { resolveJudgeMode, type JudgeMode } from "./capability-detect.js";
import { canUseApiJudge, callJudgeApi } from "./llm-judge.js";

export type { JudgeMode };

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

export type JudgeRequest<T> = {
  prompt: string;
  schema: z.ZodType<T>;
  ci?: boolean;
  evalCfg: Partial<EvalConfig>;
  system?: string;
  apiAvailable?: boolean;
};

export type JudgeOutcome<T> =
  | { mode: "api"; ok: true; data: T }
  | { mode: "api"; ok: false; error: string }
  | { mode: "delegate"; prompt: string }
  | { mode: "fail" };

/** One Judge: owns mode and transport. Review passes prompt, schema, ci. */
export async function judge<T>(req: JudgeRequest<T>): Promise<JudgeOutcome<T>> {
  const mode = decideJudgeMode(req.evalCfg, { ci: req.ci ?? false, apiAvailable: req.apiAvailable });
  if (mode === "fail") return { mode: "fail" };
  if (mode === "delegate") return { mode: "delegate", prompt: req.prompt };
  const result = await callJudgeApi(req.prompt, req.schema, req.evalCfg, { system: req.system });
  return result.ok
    ? { mode: "api", ok: true, data: result.data }
    : { mode: "api", ok: false, error: result.error };
}
