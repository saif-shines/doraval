/**
 * Resolve the render mode once at command start.
 * TUI backend (OpenTUI) is only used when ALL conditions hold:
 *   - stdout and stdin are real TTYs (not piped / redirected)
 *   - not --format json
 *   - not --ci flag
 *   - no CI env variable
 *   - no DORAVAL_NO_TUI override
 *   - not a dumb terminal
 *
 * In all other cases the text backend is used — identical output to today.
 * This is the hard rule: OpenTUI must NEVER initialize when output could be
 * consumed by a pipe, script, or CI runner.
 */
export type RenderMode = "tui" | "text";

export function resolveRenderMode(args?: {
  format?: string;
  ci?: boolean;
}): RenderMode {
  if (!process.stdout.isTTY) return "text";
  if (!process.stdin.isTTY) return "text";
  if (args?.format === "json") return "text";
  if (args?.ci) return "text";
  if (process.env.CI) return "text";
  if (process.env.DORAVAL_NO_TUI === "1") return "text";
  if (process.env.TERM === "dumb") return "text";
  return "tui";
}
