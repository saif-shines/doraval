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

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'ok';

const statusIcon = (s: CheckStatus) =>
  s === 'pass' || s === 'ok' ? pc.green('✓') :
  s === 'warn' ? pc.yellow('⚠') : pc.red('✗');

/** Render one check row (lightweight columnar style, matches drift/eval-history pad patterns). */
export function renderCheck(status: CheckStatus, text: string): string {
  return `  ${statusIcon(status)}  ${text}`;
}

/** Render validation checks as a simple aligned table (Status + message).
 *  Use for --format table human output to avoid "pretty basic" flat lists.
 *  No extra deps (per nodejs-cli-best-practices §2.1).
 */
export function renderChecksTable(
  checks: Array<{ status: CheckStatus; text: string }>,
  opts: { header?: boolean } = {}
): void {
  if (opts.header && checks.length > 0) {
    write(`  ${pc.dim('Status')}  ${pc.dim('Check')}`);
  }
  for (const c of checks) {
    write(renderCheck(c.status, c.text));
  }
}

/** Explicit "Next:" action line. Use for developer guidance (see skill + plan 019). */
export function nextAction(s: string): void {
  write(`\n  ${pc.white('Next:')} ${pc.dim(s)}`);
}

/** One-line summary (counts, totals, etc.). */
export function summaryLine(s: string): void {
  write(`  ${pc.dim(s)}`);
}
