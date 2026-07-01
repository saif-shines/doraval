/**
 * Eval progress events — emitted by skill-runner.ts and eval.ts during long-running work.
 * The text backend ignores these (undefined = no-op). The TUI backend uses them to
 * drive a live split-footer dashboard.
 *
 * Kept as a plain callback bag (not EventEmitter) to match the SkillRunOptions style
 * and keep the core decoupled from any UI layer.
 */
import type { EvalResult } from "./session-eval.js";

export interface EvalProgress {
  /** Called once after the prompt list is finalized. total = number of runs. */
  onPlan(total: number, skillName: string): void;

  /** Called at the start of each run, before the agent is spawned. */
  onRunStart(index: number, prompt: string): void;

  /** Called after the eval judge returns for each run. */
  onRunDone(index: number, result: EvalResult): void;

  /** Called when all runs are complete (batch or session path). */
  onDone(summary: { total: number; adheres: number; drifts: number; unknown: number }): void;
}
