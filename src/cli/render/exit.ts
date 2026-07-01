/**
 * Safe exit helper and process-level lifecycle handlers.
 *
 * IMPORTANT: Use exit() instead of process.exit() in command bodies whenever
 * the TUI backend may be active. The text backend's destroy() is a no-op, so
 * this is safe to use everywhere.
 *
 * The process.on("exit") handler is a belt-and-suspenders backstop that fires
 * even on direct process.exit() calls that bypass this helper.
 */
import { currentBackend, resetToText } from "./index.js";

/**
 * Destroy the active render backend (restores terminal) then exit.
 * In text mode, destroy() is a no-op — this is always safe to call.
 */
export async function exit(code: number): Promise<never> {
  try {
    await currentBackend().destroy();
    resetToText();
  } catch {}
  process.exit(code);
}

/**
 * Register process-level lifecycle handlers. Call once at startup (index.ts).
 *
 * These guarantee the terminal is restored even when:
 *   - A command calls process.exit() directly
 *   - An uncaught error crashes the process
 *
 * SIGINT / SIGTERM are handled by OpenTUI itself when exitOnCtrlC: true
 * (the renderer registers its own handlers). The handlers here cover
 * uncaught errors and the process.exit() backstop.
 */
export function registerLifecycleHandlers(): void {
  // Sync backstop: fires on any process.exit() call.
  // destroy() must be synchronous here — OpenTUI's restore is.
  process.on("exit", () => {
    try {
      void currentBackend().destroy();
    } catch {}
  });

  // Restore terminal before crashing on unhandled errors.
  process.on("uncaughtException", async (err: Error) => {
    try { await currentBackend().destroy(); } catch {}
    resetToText();
    process.stderr.write(`\nFatal: ${err.message}\n${err.stack ?? ""}\n`);
    process.exit(1);
  });

  process.on("unhandledRejection", async (reason: unknown) => {
    try { await currentBackend().destroy(); } catch {}
    resetToText();
    process.stderr.write(`\nUnhandled rejection: ${String(reason)}\n`);
    process.exit(1);
  });
}
