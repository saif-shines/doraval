/**
 * Active render backend. Text-only since the OpenTUI stack was removed —
 * the indirection stays so exit.ts and out.ts keep a single seam.
 */
import type { RenderBackend } from "./backend.js";
import { textBackend } from "./text-backend.js";

let _active: RenderBackend = textBackend;

/** The currently active render backend. Never null. */
export function currentBackend(): RenderBackend {
  return _active;
}

/** Reset to the text backend. */
export function resetToText(): void {
  _active = textBackend;
}
