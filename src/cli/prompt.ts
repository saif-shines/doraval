import pc from "picocolors";

/**
 * Simple interactive prompt (used by journal init and top-level init).
 * Writes the label + dim fallback to stderr, reads one line from stdin.
 * Returns the input or the fallback if empty.
 */
export function prompt(label: string, fallback: string): string {
  // label should include leading spacing if desired, e.g. "  >"
  process.stderr.write(`${label} ${pc.dim(`(${fallback})`)} `);
  const buf = new Uint8Array(1024);
  const n = require("fs").readSync(0, buf);
  const input = new TextDecoder().decode(buf.subarray(0, n)).trim();
  return input || fallback;
}
