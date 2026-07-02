import { defineCommand } from "citty";
import { resolve, basename } from "path";
import pc from "picocolors";
import { ui } from "../out.js";
import { loadSkill } from "../../core/skill-validate.js";
import { discoverSkills } from "../../core/views/skills-view.js";
import { getAdapter } from "../../core/session-adapters.js";
import { runEval, type EvalResult, type ChecklistItem } from "../../core/session-eval.js";
import { readConfig, getEvalConfig } from "../../core/journal-config.js";
import { exit } from "../render/exit.js";

// ─── Verdict symbols and colors ───────────────────────────────────────────────

function verdictSymbol(v: ChecklistItem["itemVerdict"]): string {
  if (v === "ALIGNED") return pc.green("✓");
  if (v === "DRIFTED") return pc.red("↗");
  if (v === "JUSTIFIED") return pc.yellow("~");
  return pc.dim("?");
}

function verdictLabel(v: ChecklistItem["itemVerdict"]): string {
  const pad = v.padEnd(9);
  if (v === "ALIGNED") return pc.green(pad);
  if (v === "DRIFTED") return pc.red(pad);
  if (v === "JUSTIFIED") return pc.yellow(pad);
  return pc.dim(pad);
}

// ─── Render helpers ───────────────────────────────────────────────────────────

function renderSessionResult(
  result: EvalResult,
  verbose: boolean
): void {
  const shortId = result.sessionId.slice(0, 7);
  const title = result.sessionTitle ? ` "${result.sessionTitle}"` : "";
  ui.write(`\n  Session ${pc.bold(shortId)}${pc.dim(title)}`);

  for (const item of result.checklist) {
    // In non-verbose mode, skip ALIGNED/JUSTIFIED non-DRIFTED items unless UNCLEAR
    if (!verbose && item.itemVerdict !== "DRIFTED" && item.itemVerdict !== "UNCLEAR") {
      continue;
    }
    const sym = verdictSymbol(item.itemVerdict);
    const label = verdictLabel(item.itemVerdict);
    const evidence = item.evidence ? pc.dim(`  (${item.evidence})`) : "";
    ui.write(`    ${sym} ${label} ${item.instruction}${evidence}`);
    if (item.detail && verbose) {
      ui.write(`        ${pc.dim(item.detail)}`);
    }
  }

  const drifted = result.checklist.filter((c) => c.itemVerdict === "DRIFTED");
  const alignedCount = result.checklist.filter((c) => c.itemVerdict === "ALIGNED").length;
  const justifiedCount = result.checklist.filter((c) => c.itemVerdict === "JUSTIFIED").length;
  const unclear = result.checklist.filter((c) => c.itemVerdict === "UNCLEAR");

  if (!verbose && drifted.length === 0 && unclear.length === 0) {
    ui.write(`    ${pc.green("✓")} ${pc.dim("All instructions aligned")}`);
  }

  const total = result.checklist.length;
  if (total > 0) {
    const summary = `${alignedCount} ALIGNED, ${drifted.length} DRIFTED, ${justifiedCount} JUSTIFIED, ${unclear.length} UNCLEAR`;
    ui.write(`    ${pc.dim(summary)}`);
  }
}

// ─── Aggregate helpers ────────────────────────────────────────────────────────

interface SkillDriftSummary {
  skillName: string;
  sessionsChecked: number;
  sessionsMatched: number;
  totalBinding: number;
  totalDrifted: number;
  driftRate: number; // 0..1
  results: EvalResult[];
}

function computeAggregate(results: EvalResult[]): {
  totalBinding: number;
  totalDrifted: number;
  ambiguityFlags: string[];
} {
  let totalBinding = 0;
  let totalDrifted = 0;
  const flags = new Set<string>();

  for (const r of results) {
    for (const item of r.checklist) {
      if (
        item.bindingness === "MANDATORY" ||
        item.bindingness === "CONDITIONAL"
      ) {
        totalBinding++;
        if (item.itemVerdict === "DRIFTED") totalDrifted++;
      }
      if (item.itemVerdict === "UNCLEAR") {
        flags.add(item.instruction);
      }
    }
    for (const f of r.ambiguityFlags) {
      flags.add(f);
    }
  }
  return { totalBinding, totalDrifted, ambiguityFlags: [...flags] };
}

// ─── Mode 1: run eval for a single skill across sessions ──────────────────────

async function runMode1(opts: {
  skillPath: string;
  sessionFilter?: string;
  limit: number;
  verbose: boolean;
  format: string;
}): Promise<{ driftedCount: number; totalBinding: number }> {
  const fullPath = resolve(opts.skillPath);
  const loaded = await loadSkill(fullPath);
  if (!loaded.ok) {
    ui.fail(`Cannot load skill at "${opts.skillPath}": ${loaded.error}`);
    return await exit(1);
  }
  const { model } = loaded;
  const skillName = (model.data.name as string | undefined) ?? basename(fullPath);
  const skillContent = model.content;

  const cfg = await readConfig().catch(() => null);
  const evalCfg = getEvalConfig(cfg);
  const agentCfg = {
    command:
      cfg?.agent && typeof cfg.agent === "object" && "command" in cfg.agent
        ? String(cfg.agent.command)
        : "claude",
  };

  const adapter = getAdapter();
  const allSessions = adapter ? adapter.listRecentSessions(process.cwd(), opts.limit) : [];
  const totalChecked = allSessions.length;

  // Parse each session and filter by skill name
  const results: EvalResult[] = [];
  let matched = 0;

  for (const session of allSessions) {
    // Mode 2 filter: session id prefix
    if (opts.sessionFilter) {
      const base = basename(session.path);
      if (!session.path.includes(opts.sessionFilter) && !base.includes(opts.sessionFilter)) {
        continue;
      }
    }

    let primitives;
    try {
      primitives = adapter.parse(session.path);
    } catch {
      continue;
    }

    if (!primitives.skillsInvoked.some((s) => s === skillName || s.includes(skillName))) {
      continue;
    }
    matched++;

    const result = await runEval(primitives, skillName, skillContent, agentCfg, evalCfg);
    results.push(result);
  }

  if (opts.sessionFilter && matched === 0) {
    ui.fail(`Session ${opts.sessionFilter} not found for skill ${skillName}`);
    return await exit(1);
  }

  if (opts.format === "json") {
    process.stdout.write(
      JSON.stringify({ skill: skillName, sessionsChecked: totalChecked, sessionsMatched: matched, results }, null, 2) + "\n"
    );
    const { totalBinding, totalDrifted } = computeAggregate(results);
    return { driftedCount: totalDrifted, totalBinding };
  }

  ui.heading("dora drift — session-grounded behavioral analysis");
  ui.write(
    `\n  Skill: ${pc.bold(skillName)}   Sessions checked: ${totalChecked}   Sessions matched: ${pc.bold(String(matched))}`
  );

  if (matched === 0) {
    const msg = adapter
      ? "No sessions found that invoked this skill. Run a session with this skill first."
      : "No supported coding agent detected. Install Claude Code (or Grok) to capture sessions.";
    ui.write(`\n  ${pc.dim(msg)}`);
    return { driftedCount: 0, totalBinding: 0 };
  }

  for (const result of results) {
    renderSessionResult(result, opts.verbose);
  }

  const { totalBinding, totalDrifted, ambiguityFlags } = computeAggregate(results);

  ui.write("");
  if (totalBinding === 0) {
    ui.write(`  ${pc.dim("No binding instructions found across sessions.")}`);
  } else {
    const pct = Math.round((totalDrifted / totalBinding) * 100);
    const driftLine =
      totalDrifted === 0
        ? pc.green(`0/${totalBinding} binding instructions drifted (0%)`)
        : pc.red(`${totalDrifted}/${totalBinding} binding instructions drifted (${pct}%)`);
    ui.write(`  Aggregate drift rate: ${driftLine}`);
  }

  if (ambiguityFlags.length > 0) {
    ui.write(`\n  ${pc.yellow("Skill ambiguity flags")} ${pc.dim("(UNCLEAR → treated as ALIGNED):")} `);
    for (const flag of ambiguityFlags) {
      ui.write(`    ${pc.dim("•")} "${flag}" ${pc.dim("— instruction too vague, tighten it")}`);
    }
  }

  ui.write("");

  return { driftedCount: totalDrifted, totalBinding };
}

// ─── Mode 3: repo sweep across all discovered skills ─────────────────────────

async function runMode3(opts: {
  limit: number;
  verbose: boolean;
  format: string;
}): Promise<{ totalDrifted: number }> {
  const skills = discoverSkills(process.cwd());

  if (skills.length === 0) {
    ui.warn("No skills found in this directory. Run from a directory with SKILL.md files.");
    return { totalDrifted: 0 };
  }

  const cfg = await readConfig().catch(() => null);
  const evalCfg = getEvalConfig(cfg);
  const agentCfg = {
    command:
      cfg?.agent && typeof cfg.agent === "object" && "command" in cfg.agent
        ? String(cfg.agent.command)
        : "claude",
  };

  const adapter = getAdapter();
  const allSessions = adapter ? adapter.listRecentSessions(process.cwd(), opts.limit) : [];

  const summaries: SkillDriftSummary[] = [];

  for (const skillEntry of skills) {
    const loaded = await loadSkill(skillEntry.dir);
    if (!loaded.ok) continue;

    const { model } = loaded;
    const skillName =
      (model.data.name as string | undefined) ?? skillEntry.name;
    const skillContent = model.content;

    const results: EvalResult[] = [];
    let matched = 0;

    for (const session of allSessions) {
      let primitives;
      try {
        primitives = adapter.parse(session.path);
      } catch {
        continue;
      }
      if (!primitives.skillsInvoked.some((s) => s === skillName || s.includes(skillName))) {
        continue;
      }
      matched++;

      const result = await runEval(primitives, skillName, skillContent, agentCfg, evalCfg);
      results.push(result);
    }

    const { totalBinding, totalDrifted } = computeAggregate(results);
    summaries.push({
      skillName,
      sessionsChecked: allSessions.length,
      sessionsMatched: matched,
      totalBinding,
      totalDrifted,
      driftRate: totalBinding > 0 ? totalDrifted / totalBinding : 0,
      results,
    });
  }

  // Rank by drift rate (highest first)
  summaries.sort((a, b) => b.driftRate - a.driftRate);

  if (opts.format === "json") {
    const out = summaries.map(({ results: _r, ...rest }) => ({
      ...rest,
      driftRatePct: Math.round(rest.driftRate * 100),
    }));
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    const total = summaries.reduce((n, s) => n + s.totalDrifted, 0);
    return { totalDrifted: total };
  }

  ui.heading("dora drift — repo sweep");
  ui.write(`\n  ${pc.dim(`Skills found: ${skills.length}   Sessions checked per skill: up to ${opts.limit}`)}`);
  ui.write("");

  if (summaries.length === 0) {
    ui.write(`  ${pc.dim("No skills could be analyzed.")}`);
    return { totalDrifted: 0 };
  }

  for (const s of summaries) {
    const pct = Math.round(s.driftRate * 100);
    const rateStr =
      s.totalBinding === 0
        ? pc.dim("no binding instructions")
        : s.totalDrifted === 0
        ? pc.green(`0% drift`)
        : pc.red(`${pct}% drift`);

    ui.write(
      `  ${pc.bold(s.skillName.padEnd(20))}  matched: ${String(s.sessionsMatched).padStart(2)}   ${rateStr}   ${pc.dim(`(${s.totalDrifted}/${s.totalBinding} binding)`)}`
    );

    if (opts.verbose) {
      for (const result of s.results) {
        renderSessionResult(result, opts.verbose);
      }
    }
  }
  ui.write("");

  const grandDrifted = summaries.reduce((n, s) => n + s.totalDrifted, 0);
  return { totalDrifted: grandDrifted };
}

// ─── Command definition ───────────────────────────────────────────────────────

export default defineCommand({
  meta: {
    name: "drift",
    description:
      "Session-grounded behavioral analysis: measure skill adherence across real agent sessions (3 modes: single skill, single session, repo sweep)",
  },
  args: {
    path: {
      type: "positional",
      description:
        "Path to skill directory (default: repo sweep of all discovered skills)",
      required: false,
    },
    session: {
      type: "string",
      description: "Filter to the single session whose path contains this id prefix (Mode 2)",
    },
    format: {
      type: "string",
      alias: "f",
      description: 'Output format: "table" (default) | "json"',
      default: "table",
    },
    limit: {
      type: "string",
      description: "Max sessions to check per skill (default: 20)",
      default: "20",
    },
    ci: {
      type: "boolean",
      description: "Exit 1 if any DRIFTED items found",
      default: false,
    },
    verbose: {
      type: "boolean",
      alias: "v",
      description: "Show all checklist items, not just DRIFTED",
      default: false,
    },
  },

  async run({ args }) {
    const skillPath = args.path as string | undefined;
    const sessionFilter = args.session as string | undefined;
    const format = args.format as string;
    const parsedLimit = parseInt(String(args.limit ?? "20"), 10);
    const limit = Number.isNaN(parsedLimit) ? 20 : parsedLimit;
    const verbose = Boolean(args.verbose);
    const ci = Boolean(args.ci);

    if (skillPath) {
      // Mode 1 (default) or Mode 2 (with --session)
      const { driftedCount } = await runMode1({
        skillPath,
        sessionFilter,
        limit,
        verbose,
        format,
      });
      if (ci && driftedCount > 0) return await exit(1);
    } else {
      // Mode 3 — repo sweep
      const { totalDrifted } = await runMode3({ limit, verbose, format });
      if (ci && totalDrifted > 0) return await exit(1);
    }
    await exit(0);
  },
});
