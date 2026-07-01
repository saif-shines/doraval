/**
 * Active backend state — one backend is live at a time.
 * Starts as the text backend (safe default). Commands that need TUI
 * call initBackend(args) at the top of run() to activate it.
 */
import type { RenderBackend } from "./backend.js";
import { textBackend } from "./text-backend.js";
import type { RenderMode } from "./mode.js";

let _active: RenderBackend = textBackend;
let _mode: RenderMode = "text";

/** The currently active render backend. Never null — falls back to text. */
export function currentBackend(): RenderBackend {
  return _active;
}

/** Active render mode. */
export function currentMode(): RenderMode {
  return _mode;
}

/** Activate a new backend. Only called once per command that opts into TUI. */
export function setBackend(b: RenderBackend, mode: RenderMode): void {
  _active = b;
  _mode = mode;
}

/** Reset to the text backend (e.g. after TUI backend is destroyed). */
export function resetToText(): void {
  _active = textBackend;
  _mode = "text";
}

/**
 * Initialize the backend for a command based on render mode.
 * In "tui" mode, lazily constructs the TUI backend.
 * Falls back to text on any construction error.
 *
 * Returns the active backend (always valid).
 */
export async function initBackend(mode: RenderMode): Promise<RenderBackend> {
  if (mode === "text") {
    setBackend(textBackend, "text");
    return textBackend;
  }

  try {
    const { createTuiBackend } = await import("./tui-backend.js");
    const tui = await createTuiBackend();
    setBackend(tui, "tui");
    return tui;
  } catch (err) {
    // Native renderer unavailable — fall back silently
    process.stderr.write(`[doraval] TUI unavailable, falling back to text: ${err}\n`);
    setBackend(textBackend, "text");
    return textBackend;
  }
}
