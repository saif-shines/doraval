import pc from "picocolors";
import { currentBackend } from "./render/index.js";
import type { ValidateResult } from "../validators/types.js";
import { errorToJson, isDoravalError } from "../core/errors.js";
import { posthog, anonymousId } from "../analytics.js";

/**
 * Semantic CLI output helpers.
 * Use these instead of console.error for human-facing messages on Bun.
 *
 * All methods delegate to the active RenderBackend (text today).
 * Conventions: surface "Next:" for guidance; JSON/CI stay quiet via mode.
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
export function renderCheck(status: CheckStatus, text: string, indent = 2): void {
  ui.write(`${" ".repeat(indent)}${statusIcon(status)}  ${text}`);
}

/** Render validation checks as a simple aligned list, indented to sit under a tree node.
 *  Use for --format table human output to avoid "pretty basic" flat lists.
 *  No extra deps (per nodejs-cli-best-practices §2.1).
 */
export function renderChecksTable(
  checks: Array<{ status: CheckStatus; text: string | { text: string } }>,
  opts: { indent?: number } = {}
): void {
  for (const c of checks) {
    const t = typeof c.text === "string" ? c.text : c.text.text;
    renderCheck(c.status, t, opts.indent);
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
  docUrl?: string;
}): void {
  ui.fail(`Error: ${opts.problem}`);
  ui.info(`  Context: ${opts.context}`);
  ui.info(`  Solutions:`);
  for (const s of opts.solutions) {
    ui.info(`    • ${s}`);
  }
  if (opts.docUrl) {
    ui.info(`  Docs: ${opts.docUrl}`);
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
    const errCount = result.errors.length;
    const warnCount = result.warnings.length;
    const passCount = result.passes.length;
    const hasIssues = errCount > 0 || warnCount > 0;
    const expand = hasIssues || !!opts.verbose;

    const countLabel = errCount > 0
      ? pc.red(`${errCount} error${errCount === 1 ? "" : "s"}`)
      : warnCount > 0
      ? pc.yellow(`${warnCount} warning${warnCount === 1 ? "" : "s"}`)
      : pc.green(`${passCount} passed`);

    ui.write(`  ${pc.dim(expand ? "▾" : "▸")} ${pc.bold(name)} ${pc.dim(`(${id})`)}  ${countLabel}`);

    if (!expand) continue;

    const checks: Array<{ status: CheckStatus; text: string }> = [];

    for (const e of result.errors) {
      const item = typeof e === "string" ? { text: e } : e;
      const txt = item.code ? `${item.text} (${item.code})` : item.text;
      checks.push({ status: "fail", text: item.hint ? `${txt} — ${item.hint}` : txt });
    }
    for (const w of result.warnings) {
      const item = typeof w === "string" ? { text: w } : w;
      checks.push({ status: "warn", text: item.hint ? `${item.text} — ${item.hint}` : item.text });
    }
    if (opts.verbose) {
      for (const p of result.passes) {
        const item = typeof p === "string" ? { text: p } : p;
        checks.push({ status: "pass", text: item.text });
      }
    }

    renderChecksTable(checks, { indent: 4 });
    ui.blank();
  }

  if (totalErrors === 0 && totalWarnings === 0) {
    nextAction(`dora review ${opts.path}   or   dora memory add "..."`);
  } else if (totalErrors > 0) {
    nextAction(`dora review ${opts.path} --deep`);
  } else {
    nextAction(`dora review ${opts.path} --quick`);
  }
}

// ── Output mode + machine contract (plan items B6, A5) ─────────────────────

export interface OutputMode {
  format: "table" | "json";
  ci: boolean;
}

/** Single place that decides table vs json. `--ci` implies json. */
export function resolveOutputMode(args?: { format?: string; ci?: boolean }): OutputMode {
  const ci = args?.ci === true;
  const format: OutputMode["format"] =
    ci || args?.format === "json" ? "json" : "table";
  return { format, ci };
}

/** Data channel: pretty JSON to stdout (never colored, never decorated). */
export function outJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

/**
 * Diagnostics channel: render any thrown error to stderr.
 * DoravalError → guided text (table mode) or JSON error object (json mode).
 * Unknown errors → wrapped as E-INT-000 (internal).
 */
export function emitError(e: unknown, mode: OutputMode): void {
  const derr = isDoravalError(e)
    ? e
    : {
        code: "E-INT-000",
        message: e instanceof Error ? e.message : String(e),
        suggestion: "Re-run with --verbose; report with `dora report` if it persists",
        context: undefined as string | undefined,
        docUrl: undefined as string | undefined,
      };

  posthog.captureException(e instanceof Error ? e : new Error(derr.message), anonymousId, {
    error_code: derr.code,
  });

  if (mode.format === "json") {
    process.stderr.write(
      JSON.stringify(
        isDoravalError(e) ? errorToJson(e) : { error: { code: derr.code, message: derr.message, suggestion: derr.suggestion } }
      ) + "\n"
    );
    return;
  }

  guidedError({
    context: derr.context ?? "running doraval",
    problem: `${derr.message} (${derr.code})`,
    solutions: derr.suggestion ? [derr.suggestion] : ["Re-run with --verbose for details"],
    docUrl: derr.docUrl,
  });
}
