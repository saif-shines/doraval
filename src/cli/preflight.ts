import { ui } from "./out.js";

export type ProgressMode = { format: string };

/** Table mode only. JSON/CI must stay silent for progress lines. */
export function shouldEmitProgress(mode: ProgressMode): boolean {
  return mode.format !== "json";
}

export function preflight(mode: ProgressMode, message: string): void {
  if (!shouldEmitProgress(mode)) return;
  ui.dim(`  ${message}`);
}

/** Stage heartbeat for multi-second work. Same gate as preflight. */
export function stage(mode: ProgressMode, message: string): void {
  preflight(mode, message);
}

/** Single-line form for tests / callers that still use `preflight()`. */
export function scanPreflightMessage(dir?: string): string {
  const where = dir ? ` (${dir})` : "";
  return `Scanning agent context${where} — read-only, no writes, no LLM.`;
}

export function reviewPreflightMessage(opts: { quick?: boolean; deep?: boolean } = {}): string {
  if (opts.quick) {
    return "Reviewing artifacts — tiers: structure + heuristics; no LLM.";
  }
  if (opts.deep) {
    return "Reviewing artifacts — tiers: structure + heuristics + LLM (required); no writes.";
  }
  return "Reviewing artifacts — tiers: structure + heuristics; LLM if a judge is available; no writes.";
}

export function reconcilePreflightMessage(opts: { dryRun?: boolean; apply?: boolean } = {}): string {
  if (opts.dryRun) {
    return "Reconcile dry-run — plan only, no file writes.";
  }
  if (opts.apply) {
    return "Reconcile — will apply recommended resolutions (writes files when confirmed).";
  }
  return "Reconcile — detect contradictions, you pick, dora applies (writes only after confirm).";
}

export function memorySyncPreflightMessage(): string {
  return "Memory sync — may check gh auth, commit, pull, push (network).";
}
