import { defineCommand } from "citty";
import { join, basename, resolve, dirname } from "path";
import { existsSync, readFileSync } from "fs";
import pc from "picocolors";
import { ui } from "../out.js";
import { getAdapter } from "../../core/session-adapters.js";
import { parseSession, sanitizeSessionId, type SessionPrimitives } from "../../core/session-parse.js";
import { runEval, type EvalResult } from "../../core/session-eval.js";
import { readConfig, getEvalConfig, ensureDoravalDirs, getEvalsDir } from "../../core/journal-config.js";
import { canUseApiJudge } from "../../core/llm-judge.js";
import { loadSkill } from "../../core/skill-validate.js";
import { prompt } from "../prompt.js";
import { runSkillSessions, renderBatchResults, displayVerdict } from "../../core/skill-runner.js";

function renderResult(result: EvalResult, verbose: boolean, useDriftTerms = false): void {
  const v = result.verdict;
  const isPass = v === "PASS";
  const isFail = v === "FAIL";
  const displayV = displayVerdict(v, useDriftTerms);
  const displaySymbol = isPass ? "✓" : isFail ? "✗" : "?";
  const verdictColor = isPass ? pc.green : isFail ? pc.red : pc.yellow;

  ui.write(`\n  ${verdictColor(`[${displayV}]`)} ${pc.bold(result.skill)}`);
  ui.write(`  agent:       ${result.agent}`);
  ui.write(`  model:       ${result.model}`);
  if (result.userFamiliarity > 0) {
    ui.write(`  familiarity: ${result.userFamiliarity}/10  (${result.userFamiliarityReason})`);
  }
  ui.write(`  closure:     ${result.closure}${result.userTurnsAfterSkill > 0 ? ` (${result.userTurnsAfterSkill} turns)` : ""}`);
  if (result.sessionTitle) {
    ui.write(`  session:     ${result.sessionId.slice(0, 8)}  "${result.sessionTitle}"`);
  }

  if (result.checklist.length > 0) {
    ui.write(`\n  Adherence:`);
    for (const item of result.checklist) {
      const sym = item.pass ? pc.green("✓") : pc.red("✗");
      const detail = item.detail ? `  ${pc.dim(item.detail)}` : "";
      ui.write(`  ${sym} ${item.instruction}${detail}`);
    }
    const passed = result.checklist.filter((c) => c.pass).length;
    ui.write(`\n  Result: ${passed}/${result.checklist.length}  [${verdictColor(displayV)}${result.verdictReason ? ` — ${result.verdictReason}` : ""}]`);
  } else if (result.verdictReason) {
    ui.write(`\n  ${verdictColor(displaySymbol)} ${result.verdictReason}`);
  }
}

function selectRecentSessions(
  recent: Array<{ path: string; mtime: number; title?: string; skillCount: number }>
): string[] {
  if (recent.length === 0) return [];
  if (recent.length === 1) return [recent[0]!.path];

  ui.write(`\n  Recent sessions for this directory:`);
  recent.forEach((s, i) => {
    const date = new Date(s.mtime).toISOString().slice(0, 10);
    const titleStr = s.title ? ` "${s.title.slice(0, 45)}"` : "";
    const skillStr = s.skillCount > 0 ? ` (${s.skillCount} skill${s.skillCount === 1 ? "" : "s"})` : "";
    const short = basename(s.path);
    ui.write(`    ${i + 1}. ${date}${titleStr}${skillStr}  ${pc.dim(short)}`);
  });

  const input = prompt(
    `\n  Select session(s) (e.g. 1,3 or 2-4 or all or latest): `,
    "1"
  ).trim().toLowerCase();

  if (input === "all") return recent.map((s) => s.path);
  if (input === "latest") return [recent[0]!.path];

  // direct path?
  if (input.includes("/") || input.endsWith(".jsonl")) return [input];

  const selected = new Set<string>();
  const parts = input.split(/[\s,]+/);
  for (const part of parts) {
    if (part.includes("-")) {
      const nums = part.split("-").map((n) => parseInt(n, 10)).filter((n) => !isNaN(n));
      const start = nums[0] ?? 0;
      const end = nums[1] ?? start;
      for (let n = start; n <= end; n++) {
        const item = recent[n - 1];
        if (item) selected.add(item.path);
      }
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n)) {
        const item = recent[n - 1];
        if (item) selected.add(item.path);
      }
    }
  }

  return selected.size > 0 ? Array.from(selected) : [recent[0]!.path];
}

export default defineCommand({
  meta: {
    name: "eval",
    description: "Evaluate sessions against skill instructions (or generate runs with --runs --skill)",
  },
  subCommands: {
    history: () => import("./eval-history.js").then((m) => m.default),
  },
  args: {
    session: {
      type: "string",
      description: "Path to .jsonl session file(s). Supports comma/space separated values, or omit to interactively select from recent sessions.",
    },
    skill: {
      type: "string",
      description: "Path to a skill directory to filter to (default: all skills in session)",
    },
    format: {
      type: "string",
      alias: "f",
      description: "Output format: table (default) or json",
      default: "table",
    },
    ci: {
      type: "boolean",
      description: "Exit with code 1 if any verdict is FAIL (DRIFTS for generated runs)",
      default: false,
    },
    verbose: {
      type: "boolean",
      alias: "v",
      description: "Show full checklist reasoning",
      default: false,
    },
    runs: {
      type: "string",
      description: "Generate and run N sessions for the skill (using prompts) then eval comparatively. Requires --skill. Use --workdir to control the base directory for the runs.",
      default: "0",
    },
    prompt: {
      type: "string",
      description: "Single prompt to use for generated sessions. For multiple distinct prompts use --prompts-file.",
    },
    "prompts-file": {
      type: "string",
      description: "File containing prompts (one per line) for generated sessions",
    },
    generate: {
      type: "boolean",
      description: "Auto-generate prompts from the skill (when using --runs)",
      default: false,
    },
    real: {
      type: "boolean",
      description: "Force real agent CLI for generated sessions (vs faster internal)",
      default: false,
    },
    workdir: {
      type: "string",
      description: "Base directory for generated test runs (--runs). Each run gets its own subdirectory. Use this to point the agent at a populated checkout/repo instead of an empty temp dir.",
    },
  },

  async run({ args }) {
    const config = await readConfig();
    const evalCfg = getEvalConfig(config);

    const agentCfg = config?.agent;
    if (!agentCfg) {
      ui.fail("No coding agent configured. Run: dora init");
      process.exit(2);
    }

    // The point of eval is to reuse whatever agent the user already has configured.
    // We only need eval.model for the "sending to ..." notice and the result record.
    if (!evalCfg.model) {
      ui.warn("No eval.model configured for the judge LLM.");
      ui.info("  doraval will use your configured agent (" + agentCfg.command + ").");
      ui.info("  If you want to record a specific model, run: dora config set eval.model claude-3-5-sonnet-20241022");
    }

    const numRuns = parseInt(String(args.runs || "0"), 10) || 0;
    if (numRuns > 0) {
      if (!args.skill) {
        ui.fail("--runs requires --skill <path-to-skill>");
        process.exit(1);
      }
      let skillInput = String(args.skill);
      // Normalize if user passed the SKILL.md file instead of the directory
      if (skillInput.endsWith("SKILL.md") || skillInput.endsWith("/SKILL.md")) {
        skillInput = dirname(skillInput);
      }
      const skillPath = resolve(skillInput);

      let prompts: string[] | undefined;
      if (args.prompt) {
        // Single value — commas are valid inside prompts, so no split. Use --prompts-file for multiple.
        prompts = [String(args.prompt).trim()].filter(Boolean);
      } else if (args["prompts-file"]) {
        try {
          const content = await Bun.file(String(args["prompts-file"])).text();
          prompts = content.split("\n").map((l) => l.trim()).filter(Boolean);
        } catch (e: any) {
          ui.fail(`Failed to read prompts file: ${e.message}`);
          process.exit(1);
        }
      }

      ui.heading("doraval eval — Generated session runs + comparative results");
      const workdirNote = args.workdir ? ` workdir=${args.workdir}` : "";
      const driveCmd = agentCfg?.command || 'default';
      ui.write(`  Running ${numRuns} sessions (generate=${Boolean(args.generate)}, real=${Boolean(args.real)}${workdirNote}, command=${driveCmd})... This can take a while for complex skills.`);

      const result = await runSkillSessions(skillPath, {
        runs: numRuns,
        prompts,
        generate: Boolean(args.generate),
        real: Boolean(args.real),
        verbose: Boolean(args.verbose),
        cwd: args.workdir ? resolve(String(args.workdir)) : undefined,
      });

      if (args.format === "json") {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      } else {
        ui.heading("doraval eval — Generated session runs + comparative results");
        for (let i = 0; i < result.runs.length; i++) {
          const r = result.runs[i]!;
          renderResult(r.eval, Boolean(args.verbose), true);
        }
        ui.blank();
        const table = renderBatchResults(result, Boolean(args.verbose));
        ui.write(table);
      }

      if (args.ci && result.summary.drifts > 0) {
        process.exit(1);
      }
      process.exit(0);
    }

    ui.heading("doraval eval — Session skill adherence");

    // Resolve session path(s)
    let sessionPaths: string[] = [];
    let discoveryAdapter: ReturnType<typeof getAdapter> = null;

    if (args.session) {
      // Support comma or space separated for multiple sessions from CLI.
      // Explicit --session does NOT require a supported coding agent (works for any compatible .jsonl).
      sessionPaths = String(args.session)
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      discoveryAdapter = getAdapter();
      if (!discoveryAdapter) {
        ui.fail("No supported coding agent detected. Is Claude Code installed?");
        process.exit(2);
      }
      let recent = discoveryAdapter.listRecentSessions(process.cwd(), 12);
      const withSkills = recent.filter((s: { skillCount: number }) => s.skillCount > 0);
      if (withSkills.length > 0) recent = withSkills;

      if (recent.length === 0) {
        ui.fail(`No sessions with skills found for ${process.cwd()}`);
        ui.info("  Use --session <path> to specify a session file.");
        process.exit(2);
      }
      if (recent.length === 1) {
        sessionPaths = [recent[0]!.path];
      } else if (!process.stdout.isTTY || !process.stdin.isTTY) {
        // non-interactive: fall back to latest with skills
        sessionPaths = [recent[0]!.path];
      } else {
        sessionPaths = selectRecentSessions(recent);
      }
    }

    if (sessionPaths.length === 0) {
      ui.fail("No sessions selected.");
      process.exit(2);
    }

    const allResults: EvalResult[] = [];
    for (const sessionPath of sessionPaths) {
      ui.info(`  Session: ${pc.dim(sessionPath)}`);

      let primitives: SessionPrimitives;
      try {
        if (discoveryAdapter) {
          primitives = discoveryAdapter.parse(sessionPath);
        } else {
          // explicit --session path: parse directly (no adapter or detect required)
          const text = readFileSync(sessionPath, "utf8");
          primitives = parseSession(text);
        }
      } catch (err: any) {
        ui.fail(`Failed to read or parse session: ${sessionPath}`);
        if (err?.message) ui.info(`  ${err.message}`);
        continue;
      }

      if (primitives.skillsInvoked.length === 0) {
        ui.warn("  No skills were invoked in this session.");
        continue;
      }

      // Filter skills if --skill provided
      let skillsToEval = primitives.skillsInvoked;
      if (args.skill) {
        skillsToEval = skillsToEval.filter((s) => s.includes(args.skill!));
        if (skillsToEval.length === 0) {
          ui.warn(`  No matching skills found for filter: ${args.skill}`);
          continue;
        }
      }

      // Privacy notice
      const judgeVia = canUseApiJudge(evalCfg) && evalCfg.model ? "direct (no proxy)" : "your agent CLI";
      ui.write(`  ${pc.dim("· Sending session summary (tool calls + 5 user messages) to")} ${pc.dim(evalCfg.model || "configured model")} ${pc.dim(`(${judgeVia})`)}${pc.dim(". Use --verbose to inspect.")}`);

      ensureDoravalDirs();

      for (const skillName of skillsToEval) {
        ui.info(`\n  Evaluating: ${pc.bold(skillName)}`);

        // Try to load skill content from cwd
        let skillContent = `Skill: ${skillName}\n(skill content not found locally — using skill name only for evaluation)`;
        const candidateDirs = [
          process.cwd(),
          join(process.cwd(), ".claude", "skills", skillName.split(":").pop() ?? skillName),
          join(process.cwd(), "skills", skillName.split(":").pop() ?? skillName),
        ];
        for (const dir of candidateDirs) {
          if (existsSync(join(dir, "SKILL.md"))) {
            const loaded = await loadSkill(dir);
            if (loaded.ok) {
              skillContent = loaded.model.content;
              break;
            }
          }
        }

        const result = await runEval(primitives, skillName, skillContent, agentCfg, evalCfg);
        allResults.push(result);

        // Save to history (use sanitized sessionId to prevent path traversal from untrusted JSONL)
        if (evalCfg.save_history) {
          const safeId = sanitizeSessionId(primitives.sessionId) || `unknown-${Date.now()}`;
          const evalPath = join(getEvalsDir(), `${safeId}-${Date.now()}.json`);
          await Bun.write(evalPath, JSON.stringify(result, null, 2));
        }
      }
    }

    if (args.format === "json") {
      process.stdout.write(JSON.stringify(allResults, null, 2) + "\n");
    } else {
      for (const result of allResults) {
        renderResult(result, Boolean(args.verbose));
      }
      ui.blank();
    }

    // --ci: exit 1 if any FAIL (DRIFTS in generated mode)
    if (args.ci && allResults.some((r) => r.verdict === "FAIL")) {
      process.exit(1);
    }

    process.exit(0);
  },
});
