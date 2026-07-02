import { defineCommand } from "citty";
import { join, basename, resolve, dirname } from "path";
import { existsSync, readFileSync } from "fs";
import pc from "picocolors";
import { ui, guidedError, nextAction } from "../out.js";
import { getAdapter } from "../../core/session-adapters.js";
import { parseSession, sanitizeSessionId, type SessionPrimitives } from "../../core/session-parse.js";
import { runEval, type EvalResult } from "../../core/session-eval.js";
import { readConfig, getEvalConfig, ensureDoravalDirs, getEvalsDir } from "../../core/journal-config.js";
import { canUseApiJudge } from "../../core/llm-judge.js";
import { loadSkill } from "../../core/skill-validate.js";
import { prompt } from "../prompt.js";
import { runSkillSessions, renderBatchResults, displayVerdict } from "../../core/skill-runner.js";
import { resolveRenderMode } from "../render/mode.js";
import { initBackend, currentMode, resetToText } from "../render/index.js";
import type { TuiBackend } from "../render/tui-backend.js";
import { noopWorkSink } from "../../core/work-events.js";
import { exit } from "../render/exit.js";

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
      const ok = item.itemVerdict === "ALIGNED" || item.itemVerdict === "JUSTIFIED";
      const sym = ok ? pc.green("✓") : pc.red("✗");
      const detail = item.detail ? `  ${pc.dim(item.detail)}` : "";
      ui.write(`  ${sym} ${item.instruction}${detail}`);
    }
    const passed = result.checklist.filter((c) => c.itemVerdict === "ALIGNED" || c.itemVerdict === "JUSTIFIED").length;
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
    // Resolve render mode but DO NOT init TUI here — createCliRenderer captures stdin, which
    // would intercept the interactive session-selection readSync prompt below.
    // TUI is initialized only for the --runs path (no interactive prompt) immediately before use.
    const mode = resolveRenderMode({ format: args.format as string | undefined, ci: Boolean(args.ci) });

    const config = await readConfig();
    const evalCfg = getEvalConfig(config);

    const agentCfg = config?.agent;
    if (!agentCfg) {
      guidedError({
        context: "doraval eval judges real agent sessions (or generates runs) and needs to know which coding agent CLI to use or proxy through.",
        problem: "No coding agent configured in ~/.doraval/config.yml",
        solutions: [
          "dora init                 (recommended — sets up agent + eval.model)",
          "dora eval --session <path>  (bypass discovery; use an explicit transcript)",
        ],
        next: "dora init",
      });
      return await exit(2);
    }

    // The point of eval is to reuse whatever agent the user already has configured.
    // We only need eval.model for the "sending to ..." notice and the result record.
    if (!evalCfg.model) {
      ui.warn("No eval.model configured — falling back to your agent CLI for the judge LLM.");
      ui.info("  This works, but direct API (with OPENAI_API_KEY or ZAI_API_KEY + eval.model) is usually faster/cheaper.");
      nextAction("dora config set eval.model gpt-4o-mini   (or glm-4, claude-3-5-sonnet-20241022, ...)");
    }

    const numRuns = parseInt(String(args.runs || "0"), 10) || 0;
    if (numRuns > 0) {
      if (!args.skill) {
        guidedError({
          context: "--runs generates new sessions using a skill then evaluates them.",
          problem: "--runs requires --skill",
          solutions: [
            "dora eval --runs 3 --skill ./skills/my-skill",
          ],
          next: "dora eval --runs 3 --skill ./path/to/skill",
        });
        return await exit(1);
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
          return await exit(1);
        }
      }

      // --runs path: no interactive prompt — safe to init TUI now.
      const backend = await initBackend(mode);

      // TUI mode: progress drives the split-footer dashboard (no heading/status text).
      // Text mode: print status and let results scroll normally.
      let evalProgress = undefined;
      if (currentMode() === "tui" && "createEvalProgress" in backend) {
        evalProgress = (backend as any).createEvalProgress();
      } else {
        ui.heading("doraval eval — Generated session runs + comparative results");
        const workdirNote = args.workdir ? ` workdir=${args.workdir}` : "";
        const driveCmd = agentCfg?.command || "default";
        ui.write(`  Running ${numRuns} sessions (generate=${Boolean(args.generate)}, real=${Boolean(args.real)}${workdirNote}, command=${driveCmd})... This can take a while for complex skills.`);
      }

      const result = await runSkillSessions(skillPath, {
        runs: numRuns,
        prompts,
        generate: Boolean(args.generate),
        real: Boolean(args.real),
        verbose: Boolean(args.verbose),
        cwd: args.workdir ? resolve(String(args.workdir)) : undefined,
        progress: evalProgress,
      });

      if (args.format === "json") {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      } else if (currentMode() === "tui") {
        // Results were already written to scrollback by the dashboard's onRunDone.
        // Print the batch summary to scrollback and tear down.
        const table = renderBatchResults(result, Boolean(args.verbose));
        ui.write(table);
        await backend.destroy();
        resetToText();
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
        return await exit(1);
      }
      return await exit(0);
    }

    // Session-judge path. TUI is NOT init'd yet — readSync prompt below owns stdin.
    // We init TUI only after session selection resolves.

    let sessionPaths: string[] = [];
    let discoveryAdapter: ReturnType<typeof getAdapter> = null;

    if (args.session) {
      sessionPaths = String(args.session)
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      discoveryAdapter = getAdapter();
      if (!discoveryAdapter) {
        guidedError({
          context: "Without --session, dora eval discovers recent sessions with skills from your local coding agent history (~/.claude or ~/.grok).",
          problem: "No supported coding agent with history detected for this directory",
          solutions: [
            "dora eval --session <path-to-.jsonl>   (explicit transcript, works without local agent)",
            "Install/use Claude Code (or Grok) and run a session that invokes a skill",
          ],
          next: "dora eval --session ~/.claude/projects/.../latest.jsonl",
        });
        return await exit(2);
      }
      let recent = discoveryAdapter.listRecentSessions(process.cwd(), 12);
      const withSkills = recent.filter((s: { skillCount: number }) => s.skillCount > 0);
      if (withSkills.length > 0) recent = withSkills;

      if (recent.length === 0) {
        guidedError({
          context: `dora eval looks for recent .jsonl sessions (with skill invocations) under your agent's history for ${process.cwd()}.`,
          problem: "No sessions with skills found",
          solutions: [
            "Run a session that uses a skill, then retry",
            "dora eval --session <path-to-.jsonl>",
          ],
          next: "dora eval --session <path>",
        });
        return await exit(2);
      }
      if (recent.length === 1) {
        sessionPaths = [recent[0]!.path];
      } else if (!process.stdout.isTTY || !process.stdin.isTTY) {
        sessionPaths = [recent[0]!.path];
      } else {
        // readSync prompt — must happen before TUI init (renderer captures stdin)
        sessionPaths = selectRecentSessions(recent);
      }
    }

    if (sessionPaths.length === 0) {
      guidedError({
        context: "Session selection (interactive or via args) produced no paths.",
        problem: "No sessions selected",
        solutions: [
          "Provide --session <path>",
          "Run interactively and choose from the list",
        ],
        next: "dora eval --session <path>",
      });
      return await exit(2);
    }

    // Parse all sessions up-front to know total skill count before TUI init.
    type SessionWork = { path: string; primitives: SessionPrimitives; skills: string[] };
    const workList: SessionWork[] = [];
    for (const sessionPath of sessionPaths) {
      let primitives: SessionPrimitives;
      try {
        if (discoveryAdapter) {
          primitives = discoveryAdapter.parse(sessionPath);
        } else {
          const text = readFileSync(sessionPath, "utf8");
          primitives = parseSession(text);
        }
      } catch (err: any) {
        guidedError({
          context: `Could not load the session transcript at ${sessionPath}.`,
          problem: "Failed to read or parse session",
          solutions: [
            "Check the path and that it is a valid .jsonl from your agent",
            "Use a different --session",
          ],
        });
        if (err?.message) ui.dim(`  ${err.message}`);
        continue;
      }

      if (primitives.skillsInvoked.length === 0) {
        ui.warn(`  No skills invoked in ${basename(sessionPath)} — skipping.`);
        continue;
      }

      let skillsToEval = primitives.skillsInvoked;
      if (args.skill) {
        skillsToEval = skillsToEval.filter((s) => s.includes(args.skill!));
        if (skillsToEval.length === 0) {
          guidedError({
            context: `Filtering the skills invoked in the session to only those matching "${args.skill}".`,
            problem: "No matching skills found for filter",
            solutions: [
              "Omit --skill to eval all skills in the session",
              "Use a skill name that appears in the session",
            ],
          });
          continue;
        }
      }

      workList.push({ path: sessionPath, primitives, skills: skillsToEval });
    }

    if (workList.length === 0) {
      ui.warn("No skills to evaluate.");
      return await exit(0);
    }

    // All session parsing done (no more readSync). Safe to init TUI now.
    const backend = await initBackend(mode);

    const totalSkills = workList.reduce((n, w) => n + w.skills.length, 0);
    const sink = currentMode() === "tui"
      ? (backend as TuiBackend).createWorkProgress("dora eval")
      : noopWorkSink;

    sink.emit({ kind: "plan", total: totalSkills, label: "session eval" });

    if (currentMode() !== "tui") {
      ui.heading("doraval eval — Session skill adherence");
    }

    ensureDoravalDirs();
    const judgeVia = canUseApiJudge(evalCfg) && evalCfg.model ? "direct (no proxy)" : "your agent CLI";

    const allResults: EvalResult[] = [];
    let stepIndex = 0;

    for (const { path: sessionPath, primitives, skills: skillsToEval } of workList) {
      if (currentMode() !== "tui") {
        ui.info(`  Session: ${pc.dim(sessionPath)}`);
        ui.write(`  ${pc.dim("· Sending to")} ${pc.dim(evalCfg.model || "configured model")} ${pc.dim(`(${judgeVia})`)}`);
      }

      for (const skillName of skillsToEval) {
        sink.emit({ kind: "start", index: stepIndex, label: skillName });

        if (currentMode() !== "tui") {
          ui.info(`\n  Evaluating: ${pc.bold(skillName)}`);
        }

        let skillContent = `Skill: ${skillName}\n(skill content not found locally — using skill name only for evaluation)`;
        const candidateDirs = [
          process.cwd(),
          join(process.cwd(), ".claude", "skills", skillName.split(":").pop() ?? skillName),
          join(process.cwd(), "skills", skillName.split(":").pop() ?? skillName),
        ];
        for (const dir of candidateDirs) {
          if (existsSync(join(dir, "SKILL.md"))) {
            const loaded = await loadSkill(dir);
            if (loaded.ok) { skillContent = loaded.model.content; break; }
          }
        }

        const result = await runEval(primitives, skillName, skillContent, agentCfg, evalCfg);
        allResults.push(result);

        if (evalCfg.save_history) {
          const safeId = sanitizeSessionId(primitives.sessionId) || `unknown-${Date.now()}`;
          const evalPath = join(getEvalsDir(), `${safeId}-${Date.now()}.json`);
          await Bun.write(evalPath, JSON.stringify(result, null, 2));
        }

        // Log result to scrollback (TUI) or inline (text)
        if (currentMode() === "tui") {
          const isPass = result.verdict === "PASS";
          const isFail = result.verdict === "FAIL";
          const sym = isPass ? "✓" : isFail ? "✗" : "?";
          const label = isPass ? "ADHERES" : isFail ? "DRIFTS" : "UNKNOWN";
          const reason = result.verdictReason ? `  ${result.verdictReason.slice(0, 60)}` : "";
          const level = isPass ? "info" : isFail ? "fail" : "warn";
          sink.emit({ kind: "log", level, text: `${sym} ${skillName}  ${label}${reason}` });
        } else {
          renderResult(result, Boolean(args.verbose));
        }

        stepIndex++;
      }
    }

    sink.emit({ kind: "done", label: `${allResults.length} skill${allResults.length === 1 ? "" : "s"} evaluated` });

    if (args.format === "json") {
      await backend.destroy();
      resetToText();
      process.stdout.write(JSON.stringify(allResults, null, 2) + "\n");
    } else {
      if (currentMode() !== "tui") ui.blank();
      await backend.destroy();
      resetToText();
    }

    if (args.ci && allResults.some((r) => r.verdict === "FAIL")) {
      await exit(1);
    }
    await exit(0);
  },
});
