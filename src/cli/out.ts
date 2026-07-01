import pc from "picocolors";
import { currentBackend } from "./render/index.js";
import type { ValidateResult } from "../validators/types.js";

/**
 * Semantic CLI output helpers.
 * Use these instead of console.error for human-facing messages on Bun.
 *
 * All methods delegate to the active RenderBackend (text or TUI).
 * The active backend is set by render/index.ts and resolved once per command
 * based on TTY / --format json / --ci / CI env (see render/mode.ts).
 *
 * Conventions (per nodejs-cli-best-practices + cli-developer):
 * - Always surface "Next:" action for developer guidance
 * - Non-TTY / --format json / --ci → text backend (byte-identical to before)
 * - Interactive TTY → TUI backend (OpenTUI split-footer)
 */
export const ui = {
  /** Escape hatch: pre-styled or multiline strings. */
  write: (s: string) => currentBackend().write(s),

  /** Neutral body text (prose, paths, labels). */
  info: (s: string) => currentBackend().info(s),

  /** Secondary / metadata. */
  dim: (s: string) => currentBackend().dim(s),

  blank: () => currentBackend().blank(),

  /** Section headers. */
  heading: (s: string) => currentBackend().heading(s),

  /** ✓ pass / completion lines (indented). */
  success: (s: string) => currentBackend().success(s),

  /** ⚠ non-fatal issues (indented). */
  warn: (s: string) => currentBackend().warn(s),

  /** ✗ fatal / validation errors. */
  fail: (s: string) => currentBackend().fail(s),

  /** Indented validation / list row helpers. */
  pass: (s: string) => currentBackend().pass(s),
  failItem: (s: string) => currentBackend().failItem(s),
  warnItem: (s: string) => currentBackend().warnItem(s),
};

export type CheckStatus = "pass" | "warn" | "fail" | "ok";

const statusIcon = (s: CheckStatus) =>
  s === "pass" || s === "ok" ? pc.green("✓") :
  s === "warn" ? pc.yellow("⚠") : pc.red("✗");

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
    ui.write(`  ${pc.dim("Status")}  ${pc.dim("Check")}`);
  }
  for (const c of checks) {
    const t = typeof c.text === "string" ? c.text : c.text.text;
    ui.write(renderCheck(c.status, t));
  }
}

/** Explicit "Next:" action line. Use for developer guidance (see skill + plan 019). */
export function nextAction(s: string): void {
  ui.write(`\n  ${pc.white("Next:")} ${pc.dim(s)}`);
}

/**
 * Guided error following devrel-tooling + cli-developer conventions:
 * context → problem → solutions (with remediation) + optional Next.
 * Keeps text-first, no new deps, TTY-aware via picocolors + ui.
 */
export function guidedError(opts: {
  context: string;
  problem: string;
  solutions: string[];
  next?: string;
}): void {
  ui.fail(`Error: ${opts.problem}`);
  ui.info(`  Context: ${opts.context}`);
  ui.info(`  Solutions:`);
  for (const s of opts.solutions) {
    ui.info(`    • ${s}`);
  }
  if (opts.next) {
    nextAction(opts.next);
  } else {
    ui.blank();
  }
}

/** One-line summary (counts, totals, etc.). */
export function summaryLine(s: string): void {
  ui.write(`  ${pc.dim(s)}`);
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

  ui.heading(`dora validate — ${allResults.length} validator(s)`);
  ui.info(`  Path:  ${opts.path}`);
  summaryLine(`${allResults.length} validators • ${totalErrors} errors • ${totalWarnings} warnings\n`);

  for (const { id, name, result } of allResults) {
    ui.write(`  ${pc.bold(name)} ${pc.dim(`(${id})`)}`);

    const checks: Array<{ status: CheckStatus; text: string }> = [];

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

  if (totalErrors === 0 && totalWarnings === 0) {
    nextAction(`dora skill drift ${opts.path}   or   dora journal add "..."`);
  } else if (totalErrors > 0) {
    nextAction(`dora validate ${opts.path} --verbose`);
  } else {
    nextAction(`dora validate ${opts.path} --for claude`);
  }
}
