/**
 * TUI backend — OpenTUI split-footer renderer.
 *
 * ui.* methods write to process.stdout, which is captured by split-footer's
 * "capture-stdout" mode and rendered above the footer — ANSI codes preserved.
 *
 * Only instantiated when resolveRenderMode() returns "tui":
 *   - stdout + stdin are real TTYs
 *   - not --format json / --ci / CI env / DORAVAL_NO_TUI
 */
import { createCliRenderer, type CliRenderer } from "@opentui/core";
import type { RenderBackend } from "./backend.js";
import type { EvalProgress } from "../../core/eval-progress.js";
import { createEvalDashboard, type EvalDashboard } from "../tui/eval-dashboard.js";
import { createWorkFooter, type WorkFooter } from "../tui/work-footer.js";
import type { WorkSink } from "../../core/work-events.js";

export interface TuiBackend extends RenderBackend {
  /** Renderer instance — for commands that need direct access. */
  renderer: CliRenderer;
  /** Create an eval progress sink that drives the full eval split-footer dashboard. */
  createEvalProgress(): EvalProgress;
  /** Create a generic work-progress sink for any long-running command. */
  createWorkProgress(command: string): WorkSink;
}

export async function createTuiBackend(): Promise<TuiBackend> {
  const renderer = await createCliRenderer({
    screenMode: "split-footer",
    footerHeight: 5,
    exitOnCtrlC: true,
    clearOnShutdown: false,   // keep scrollback visible after destroy
    externalOutputMode: "capture-stdout",
  });

  let _dashboard: EvalDashboard | null = null;
  let _workFooter: WorkFooter | null = null;
  let _destroyed = false;

  /**
   * Write a styled line above the footer.
   * In split-footer + capture-stdout mode, process.stdout writes are queued
   * and flushed above the footer — ANSI styles preserved as-is.
   */
  function writeOut(content: string): void {
    if (_destroyed) {
      process.stderr.write(content.endsWith("\n") ? content : content + "\n");
      return;
    }
    process.stdout.write(content.endsWith("\n") ? content : content + "\n");
  }

  const backend: TuiBackend = {
    renderer,

    write(s)     { writeOut(s); },
    info(s)      { writeOut(s); },
    dim(s)       { writeOut(s); },
    blank()      { writeOut(""); },
    heading(s)   { writeOut(`\n  ${s}\n`); },
    success(s)   { writeOut(`  ✓ ${s}`); },
    warn(s)      { writeOut(`  ⚠ ${s}`); },
    fail(s)      { writeOut(`✗ ${s}`); },
    pass(s)      { writeOut(`  ✓ ${s}`); },
    failItem(s)  { writeOut(`  ✗ ${s}`); },
    warnItem(s)  { writeOut(`  ⚠ ${s}`); },

    createEvalProgress(): EvalProgress {
      _workFooter?.destroy();
      _workFooter = null;
      if (_dashboard) _dashboard.destroy();
      _dashboard = createEvalDashboard(renderer);
      return _dashboard.progress;
    },

    createWorkProgress(command: string): WorkSink {
      _dashboard?.destroy();
      _dashboard = null;
      if (_workFooter) _workFooter.destroy();
      _workFooter = createWorkFooter(renderer, command);
      return _workFooter.sink;
    },

    async destroy() {
      if (_destroyed) return;
      _destroyed = true;
      _dashboard?.destroy();
      _dashboard = null;
      _workFooter?.destroy();
      _workFooter = null;
      renderer.destroy();
    },
  };

  return backend;
}
