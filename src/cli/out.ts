import pc from "picocolors";

/** Write human UI to stderr without Bun's console.error red default. */
function write(s: string) {
  process.stderr.write(s.endsWith("\n") ? s : s + "\n");
}

/**
 * Semantic CLI output helpers.
 * Use these instead of console.error for human-facing messages on Bun.
 */
export const ui = {
  /** Escape hatch: pre-styled or multiline strings. */
  write,

  /** Neutral body text (prose, paths, labels). */
  info: (s: string) => write(s),

  /** Secondary / metadata. */
  dim: (s: string) => write(pc.dim(pc.gray(s))),

  blank: () => write(""),

  /** Section headers. */
  heading: (s: string) => write(`\n  ${pc.bold(pc.white(s))}\n`),

  /** ✓ pass / completion lines (indented). */
  success: (s: string) => write(`  ${pc.green("✓")} ${pc.white(s)}`),

  /** ⚠ non-fatal issues (indented). */
  warn: (s: string) => write(`  ${pc.yellow("⚠")} ${pc.white(s)}`),

  /** ✗ fatal / validation errors. */
  fail: (s: string) => write(`${pc.red("✗")} ${pc.white(s)}`),

  /** Indented validation / list row helpers. */
  pass: (s: string) => write(`  ${pc.green("✓")} ${pc.white(s)}`),
  failItem: (s: string) => write(`  ${pc.red("✗")} ${pc.white(s)}`),
  warnItem: (s: string) => write(`  ${pc.yellow("⚠")} ${pc.white(s)}`),
};
