import { defineCommand } from "citty";
import { existsSync, statSync } from "fs";
import { resolve, basename } from "path";
import pc from "picocolors";
import { spinner } from "@clack/prompts";
import { reviewSkill, reviewAll, type ReviewResult, type ReviewFinding } from "../../core/review.js";
import { reviewMemoryFile, MEMORY_FILE_NAMES } from "../../core/memory-file-review.js";

import { ui, renderCheck, resolveOutputMode, outJson, emitError, nextAction, summaryLine } from "../out.js";
import { preflight, reviewPreflightMessage } from "../preflight.js";
import { exit } from "../render/exit.js";
import { getFindingDocUrl } from "../../core/doc-registry.js";

/** Dim Docs: line under non-pass findings when a real page exists. */
function renderFindingDocs(f: ReviewFinding, indent = 6): void {
  if (f.severity === "pass") return;
  const url = f.docUrl ?? getFindingDocUrl({ code: f.code ?? f.id, tier: f.tier });
  if (url) ui.dim(`${" ".repeat(indent)}Docs: ${url}`);
}

// ── Rendering ──────────────────────────────────────────────────────────────────

function countParts(p: number, w: number, e: number): string {
  const parts: string[] = [];
  if (p > 0) parts.push(pc.green(`✓ ${p} passed`));
  if (w > 0) parts.push(pc.yellow(`⚠ ${w} warning${w === 1 ? "" : "s"}`));
  if (e > 0) parts.push(pc.red(`✗ ${e} error${e === 1 ? "" : "s"}`));
  return parts.join(" · ");
}

function renderTierLine(name: string, passed: number, warnings: number, errors: number): void {
  ui.write(`  ${name.padEnd(18)} ${countParts(passed, warnings, errors)}`);
}

export function severityLabel(severity: ReviewFinding["severity"]): string {
  return severity === "info" ? "FYI" : severity;
}

function renderFindings(findings: ReviewFinding[]): void {
  for (const f of findings) {
    if (f.severity === "pass") continue;
    if (f.severity === "info") ui.dim(`    ${severityLabel(f.severity)}  ${f.message}`);
    else renderCheck(f.severity === "error" ? "fail" : "warn", f.message, 4);
    renderFindingDocs(f, 6);
  }
}

function renderOptionalTier(
  name: string,
  tier?: { available: boolean; method?: string; count?: number; findings?: ReviewFinding[] },
): void {
  if (!tier || !tier.available) {
    const reason = name === "LLM review" ? "no judge found" : "no session files";
    ui.write(`  ${name.padEnd(18)} ${pc.dim(`unavailable (${reason})`)}`);
    return;
  }
  const label =
    name === "LLM review" && tier.method
      ? `via ${tier.method}`
      : `${tier.count ?? tier.findings?.length ?? 0} sessions found`;
  ui.write(`  ${name.padEnd(18)} ${label}`);
  for (const f of tier.findings ?? []) {
    if (f.severity === "info") ui.dim(`    ${severityLabel(f.severity)}  ${f.message}`);
    else {
      const status = f.severity === "error" ? "fail" as const : f.severity === "warning" ? "warn" as const : "pass" as const;
      renderCheck(status, f.message, 4);
    }
    renderFindingDocs(f, 6);
  }
}

function renderSingle(r: ReviewResult): void {
  ui.blank();
  ui.heading(`Reviewing ${r.path}`);
  ui.blank();

  const s = r.tiers.structure;
  renderTierLine("Structure", s.passed, s.warnings, s.errors);
  renderFindings(s.findings);

  const h = r.tiers.heuristics;
  renderTierLine("Heuristics", h.passed, h.warnings, h.errors);
  renderFindings(h.findings);

  renderOptionalTier("LLM review", r.tiers.llm);
  if (r.tiers.llm?.method === "delegated" && r.tiers.llm.prompt) {
    ui.blank();
    ui.write("  JUDGE THIS (delegated — evaluate against the rubric, then fix findings):");
    ui.write("  " + "─".repeat(60));
    ui.write(r.tiers.llm.prompt);
    ui.write("  " + "─".repeat(60));
  }
  renderOptionalTier("Sessions", r.tiers.sessions);

  ui.blank();
  summaryLine(`${r.summary.passed} passed · ${r.summary.warnings} warnings · ${r.summary.errors} errors`);

  const allFindings = [
    ...s.findings,
    ...h.findings,
    ...(r.tiers.llm?.findings ?? []),
    ...(r.tiers.sessions?.findings ?? []),
  ];
  const fixable = allFindings.filter((f) => f.fixable).length;
  if (fixable > 0) {
    nextAction(`dora fix ${r.path}      apply ${fixable} auto-fixable issue${fixable === 1 ? "" : "s"} (asks first)`);
  }
  ui.blank();
}

/** Human aggregate list cap — B34 large-N (JSON still returns full array). */
const REVIEW_AGGREGATE_CAP = 50;

function renderAggregate(results: ReviewResult[]): void {
  ui.blank();
  ui.heading("dora review --all");
  ui.blank();

  const shown =
    results.length > REVIEW_AGGREGATE_CAP
      ? results.slice(0, REVIEW_AGGREGATE_CAP)
      : results;
  if (results.length > REVIEW_AGGREGATE_CAP) {
    ui.dim(
      `  Showing ${REVIEW_AGGREGATE_CAP} of ${results.length} — pass a path or glob to narrow.`,
    );
    ui.blank();
  }

  for (const r of shown) {
    const status = r.summary.errors > 0 ? "fail" as const : r.summary.warnings > 0 ? "warn" as const : "pass" as const;
    renderCheck(status, `${r.path.padEnd(24)} ${countParts(r.summary.passed, r.summary.warnings, r.summary.errors)}`);
  }

  const totals = results.reduce(
    (acc, r) => ({ p: acc.p + r.summary.passed, w: acc.w + r.summary.warnings, e: acc.e + r.summary.errors }),
    { p: 0, w: 0, e: 0 },
  );
  ui.blank();
  summaryLine(
    `${results.length} skill${results.length === 1 ? "" : "s"} · ${totals.p} passed · ${totals.w} warnings · ${totals.e} errors`,
  );
  ui.blank();
}

// ── Command ────────────────────────────────────────────────────────────────────

export default defineCommand({
  meta: { name: "review", description: "Multi-tier skill review (structure → heuristics → LLM → sessions)" },
  args: {
    path: { type: "positional", description: "Skill dir or project root", required: false, default: "." },
    quick: { type: "boolean", description: "Tiers 1–2 only (structure + heuristics, no LLM)", default: false },
    deep: { type: "boolean", description: "Require LLM tier; exit 2 if no judge", default: false },
    sessions: { type: "boolean", description: "Require the session-evidence tier (exit 2 if no recent sessions)", default: false },
    all: { type: "boolean", description: "Review every artifact under the path", default: false },
    for: { type: "string", description: "Filter by agent name (planned)" },
    agent: { type: "string", description: "Session filter (planned)" },
    "fail-on": { type: "string", description: "Exit 1 trigger: error (default) | warning", default: "error" },
    format: { type: "string", description: "Output format: table | json", default: "table" },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: args.ci as boolean });
    preflight(
      mode,
      reviewPreflightMessage({
        quick: args.quick as boolean,
        deep: args.deep as boolean,
      }),
    );
    // Resolve --cwd to an absolute path: it's hashed into the memory
    // project slug (getProjectSlug), so a relative string here would give
    // the same physical project two different slugs depending on how the
    // caller happened to spell --cwd.
    const root = args.cwd ? resolve(args.cwd as string) : process.cwd();
    const target = resolve(root, (args.path as string) || ".");
    const useSpinner =
      mode.format !== "json" && !args.quick && process.stderr.isTTY === true;
    const spin = useSpinner ? spinner({ output: process.stderr }) : null;
    const opts = {
      quick: args.quick as boolean,
      deep: args.deep as boolean,
      sessions: args.sessions as boolean,
      agent: args.agent as string | undefined,
      cwd: root,
      ci: args.ci as boolean,
      onProgress: spin ? (msg: string) => spin.message(msg) : undefined,
    };

    try {
      spin?.start("Reviewing");
      const isMemoryFile =
        existsSync(target) && statSync(target).isFile() && MEMORY_FILE_NAMES.has(basename(target));
      const isSkillDir = !isMemoryFile && existsSync(resolve(target, "SKILL.md"));
      const useAll = !isMemoryFile && ((args.all as boolean) || !isSkillDir);

      const results: ReviewResult[] = isMemoryFile
        ? [await reviewMemoryFile(target, opts)]
        : useAll
        ? await reviewAll(target, opts)
        : [await reviewSkill(target, opts)];
      spin?.stop("Review complete");

      if (mode.format !== "json") {
        const warnings = [...new Set(results.flatMap((result) => result.ruleWarnings ?? []))];
        for (const warning of warnings) ui.dim(`  FYI  ${warning}`);
      }

      if (mode.format === "json") {
        // Machine contract: top-level shape is ALWAYS an array — never flips
        // to a bare object when exactly one skill is discovered.
        outJson(results);
      } else if (results.length === 1 && !args.all) {
        renderSingle(results[0]!);
      } else {
        renderAggregate(results);
      }

      const failOn = (args["fail-on"] as string) || "error";
      const hasErrors = results.some((r) => r.summary.errors > 0);
      const hasWarnings = results.some((r) => r.summary.warnings > 0);
      const shouldFail = hasErrors || (failOn === "warning" && hasWarnings);
      await exit(shouldFail ? 1 : 0);
    } catch (e) {
      spin?.stop("Review failed");
      emitError(e, mode);
      await exit(2); // could-not-run (internal error or unmet prerequisite)
    }
  },
});
