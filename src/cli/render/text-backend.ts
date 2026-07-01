/**
 * Text backend — the original out.ts implementation, now a proper RenderBackend.
 * Writes human UI to stderr without Bun's console.error red default.
 * This is the always-safe fallback for non-TTY / CI / --format json / --ci paths.
 */
import pc from "picocolors";
import type { RenderBackend } from "./backend.js";

function write(s: string): void {
  process.stderr.write(s.endsWith("\n") ? s : s + "\n");
}

export const textBackend: RenderBackend = {
  write,
  info:     (s) => write(s),
  dim:      (s) => write(pc.dim(pc.gray(s))),
  blank:    ()  => write(""),
  heading:  (s) => write(`\n  ${pc.bold(pc.white(s))}\n`),
  success:  (s) => write(`  ${pc.green("✓")} ${pc.white(s)}`),
  warn:     (s) => write(`  ${pc.yellow("⚠")} ${pc.white(s)}`),
  fail:     (s) => write(`${pc.red("✗")} ${pc.white(s)}`),
  pass:     (s) => write(`  ${pc.green("✓")} ${pc.white(s)}`),
  failItem: (s) => write(`  ${pc.red("✗")} ${pc.white(s)}`),
  warnItem: (s) => write(`  ${pc.yellow("⚠")} ${pc.white(s)}`),
  destroy:  ()  => {},
};
