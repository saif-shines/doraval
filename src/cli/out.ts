import pc from "picocolors";
import { currentBackend } from "./render/index.js";
import { errorToJson, isDoravalError } from "../core/errors.js";

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

// ── Output mode + machine contract (plan items B6, A5) ─────────────────────

export interface OutputMode {
  format: "table" | "json";
  ci: boolean;
}

/** Single place that decides table vs json. `--ci` and `--json` imply json. */
export function resolveOutputMode(args?: { format?: string; ci?: boolean; json?: boolean }): OutputMode {
  const ci = args?.ci === true;
  const format: OutputMode["format"] =
    ci || args?.json === true || args?.format === "json" ? "json" : "table";
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
