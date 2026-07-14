/**
 * RenderBackend — text backend only today.
 * // ponytail: keep this seam; a second (TUI/dashboard) backend was removed and may return as dora ui
 * Commands use ui.* from out.ts, never this interface directly.
 */
export interface RenderBackend {
  // Primitives — mirrors the ui.* object in out.ts
  write(s: string): void;
  info(s: string): void;
  dim(s: string): void;
  blank(): void;
  heading(s: string): void;
  success(s: string): void;
  warn(s: string): void;
  fail(s: string): void;
  pass(s: string): void;
  failItem(s: string): void;
  warnItem(s: string): void;

  /** Restore terminal / release native resources. No-op for text backend. */
  destroy(): void | Promise<void>;
}
