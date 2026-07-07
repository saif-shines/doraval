import { defineCommand } from "citty";
import { existsSync } from "fs";
import { resolve } from "path";
import pc from "picocolors";
import { reviewSkill, reviewAll, type ReviewResult, type ReviewFinding } from "../../core/review.js";

import { ui, renderCheck, resolveOutputMode, outJson, emitError, nextAction, summaryLine } from "../out.js";
import { exit } from "../render/exit.js";

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

function renderFindings(findings: ReviewFinding[]): void {
  for (const f of findings) {
    if (f.severity === "pass" || f.severity === "info") continue;
    renderCheck(f.severity === "error" ? "fail" : "warn", f.message, 4);
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
    const status = f.severity === "error" ? "fail" as const : f.severity === "warning" ? "warn" as const : "pass" as const;
    renderCheck(status, f.message, 4);
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

function renderAggregate(results: ReviewResult[]): void {
  ui.blank();
  ui.heading("dora review --all");
  ui.blank();

  for (const r of results) {
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
  meta: { name: "review", description: "Deep multi-tier review of skills: structure, heuristics, LLM, sessions" },
  args: {
    path: { type: "positional", description: "Skill dir or project root", required: false, default: "." },
    quick: { type: "boolean", description: "Tiers 1–2 only (structure + heuristics, no LLM)", default: false },
    deep: { type: "boolean", description: "Require LLM tier; exit 2 if no judge", default: false },
    sessions: { type: "boolean", description: "Require session tier", default: false },
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
    const root = (args.cwd as string) || process.cwd();
    const target = resolve(root, (args.path as string) || ".");
    const opts = {
      quick: args.quick as boolean,
      deep: args.deep as boolean,
      sessions: args.sessions as boolean,
      agent: args.agent as string | undefined,
      cwd: root,
    };

    try {
      const isSkillDir = existsSync(resolve(target, "SKILL.md"));
      const useAll = (args.all as boolean) || !isSkillDir;

      const results: ReviewResult[] = useAll
        ? await reviewAll(target, opts)
        : [await reviewSkill(target, opts)];

      if (mode.format === "json") {
        outJson(results.length === 1 && !args.all ? results[0]! : results);
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
      emitError(e, mode);
      await exit(2); // could-not-run (internal error or unmet prerequisite)
    }
  },
});
