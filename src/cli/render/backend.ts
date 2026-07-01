/**
 * The RenderBackend interface — implemented by both text and TUI backends.
 * Commands use ui.* from out.ts (which delegates here), never this directly.
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
