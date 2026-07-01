/**
 * Generic work-event bus for long-running commands.
 *
 * WorkSink is emitted by commands (skill lint, eval session-judge, journal sync, …).
 * The text backend uses noopWorkSink. The TUI backend drives a split-footer progress
 * panel from the same events.
 *
 * EvalProgress (eval-progress.ts) stays as-is for backward compat; it adapts to a
 * WorkSink via evalProgressFromSink() so runSkillSessions still works unchanged.
 */
import type { EvalResult } from "./session-eval.js";
import type { EvalProgress } from "./eval-progress.js";

export type WorkEvent =
  | { kind: "plan";  total: number; label: string }
  | { kind: "start"; index: number; label: string }
  | { kind: "log";   level: "info" | "warn" | "fail"; text: string }
  | { kind: "done";  label?: string };

export interface WorkSink {
  emit(e: WorkEvent): void;
}

export const noopWorkSink: WorkSink = { emit: () => {} };

/**
 * Build an EvalProgress that forwards events to a WorkSink.
 * Lets runSkillSessions drive the work footer without any core changes.
 */
export function evalProgressFromSink(
  sink: WorkSink,
  skillLabel: string
): EvalProgress {
  return {
    onPlan(total, skillName) {
      sink.emit({ kind: "plan", total, label: skillName || skillLabel });
    },
    onRunStart(index, prompt) {
      const preview = prompt.length > 55 ? prompt.slice(0, 52) + "…" : prompt;
      sink.emit({ kind: "start", index, label: preview });
    },
    onRunDone(index, result: EvalResult) {
      const symbol = result.verdict === "PASS" ? "✓" : result.verdict === "FAIL" ? "✗" : "?";
      const label  = result.verdict === "PASS" ? "ADHERES" : result.verdict === "FAIL" ? "DRIFTS" : "UNKNOWN";
      const reason = result.verdictReason ? `  ${result.verdictReason.slice(0, 60)}` : "";
      const level  = result.verdict === "PASS" ? "info" : result.verdict === "FAIL" ? "fail" : "warn";
      sink.emit({ kind: "log", level, text: `${symbol} run ${index + 1}  ${label}${reason}` });
    },
    onDone(summary) {
      sink.emit({
        kind: "done",
        label: `✓ ${summary.adheres} adheres / ${summary.drifts} drifts`,
      });
    },
  };
}
