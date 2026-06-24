import pc from "picocolors";
import type { ValidateResult } from "../validators/types.js";

/** Write human UI to stderr without Bun's console.error red default. */
function write(s: string) {
  process.stderr.write(s.endsWith("\n") ? s : s + "\n");
}

/**
 * Semantic CLI output helpers.
 * Use these instead of console.error for human-facing messages on Bun.
 *
 * Conventions (per nodejs-cli-best-practices + cli-developer):
 * - "table" format = human readable columnar text (pipe/grep friendly, no heavy deps)
 * - Always surface "Next:" action for developer guidance
 * - Prefer small footprint; use padEnd + icons for tables (see drift, eval-history)
 * - Decision: staying text-first for reports. Rich TUI (e.g. ink) only for interactive flows.
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
  checks: Array<{ status: CheckStatus; text: string | { text: string } }>,
  opts: { header?: boolean } = {}
): void {
  if (opts.header && checks.length > 0) {
    write(`  ${pc.dim('Status')}  ${pc.dim('Check')}`);
  }
  for (const c of checks) {
    const t = typeof c.text === "string" ? c.text : c.text.text;
    write(renderCheck(c.status, t));
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

/**
 * Canonical renderer for validation results.
 * Single place to evolve table presentation, next actions, hints, etc.
 * Keeps "table" mode friendly for pipes/grep while being more structured.
 */
export function renderValidationReport(
  allResults: Array<{ id: string; name: string; result: ValidateResult }>,
  opts: { path: string; verbose?: boolean }
): void {
  const totalErrors = allResults.reduce((n, r) => n + r.result.errors.length, 0);
  const totalWarnings = allResults.reduce((n, r) => n + r.result.warnings.length, 0);
  const totalPasses = allResults.reduce((n, r) => n + r.result.passes.length, 0);

  ui.heading(`dora validate — ${allResults.length} validator(s)`);
  ui.info(`  Path:  ${opts.path}`);
  summaryLine(`${allResults.length} validators • ${totalErrors} errors • ${totalWarnings} warnings\n`);

  for (const { id, name, result } of allResults) {
    ui.write(`  ${pc.bold(name)} ${pc.dim(`(${id})`)}`);

    const checks: Array<{ status: CheckStatus; text: string }> = [];

    // errors first (high priority)
    for (const e of result.errors) {
      const item = typeof e === "string" ? { text: e } : e;
      const txt = item.code ? `${item.text} (${item.code})` : item.text;
      const full = item.hint ? `${txt} — ${item.hint}` : txt;
      checks.push({ status: "fail", text: full });
    }
    for (const w of result.warnings) {
      const item = typeof w === "string" ? { text: w } : w;
      const full = item.hint ? `${item.text} — ${item.hint}` : item.text;
      checks.push({ status: "warn", text: full });
    }
    for (const p of result.passes) {
      const item = typeof p === "string" ? { text: p } : p;
      checks.push({ status: "pass", text: item.text });
    }

    const useHeader = checks.length > 2 || !!opts.verbose;
    renderChecksTable(checks, { header: useHeader });

    if (result.errors.length === 0 && result.warnings.length === 0) {
      ui.write(`  ${pc.green("✓")} ${pc.white("All checks passed.")}\n`);
    } else {
      ui.info(`  Result: ${result.errors.length} error(s), ${result.warnings.length} warning(s)\n`);
    }
  }

  // Single overall next action (per nodejs-cli-best-practices + cli-developer guidance)
  if (totalErrors === 0 && totalWarnings === 0) {
    nextAction(`dora skill drift ${opts.path}   or   dora journal add "..."`);
  } else if (totalErrors > 0) {
    nextAction(`dora validate ${opts.path} --verbose`);
  } else {
    nextAction(`dora validate ${opts.path} --for claude`);
  }
}
