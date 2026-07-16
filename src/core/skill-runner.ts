import { loadSkill } from "./skill-validate.js";
import type { AgentConfig } from "./agent-invoke.js";
import { runAgentSession } from "./agent-invoke.js";
import { runEval, type EvalResult } from "./session-eval.js";
import { getEvalConfig, readConfig, getEvalsDir, ensureDoravalDirs } from "./journal-config.js";
import { randomPromptsForSkill } from "./prompt-gen.js";
import { safeJsonParse } from "./session-parse.js";
import { join, resolve as pathResolve } from "path";
import { homedir } from "os";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "fs";
import { ui } from "../cli/out.js";

function cwdToGrokSessionDir(cwd: string): string {
  const encoded = cwd.split('/').map(encodeURIComponent).join('%2F');
  return pathResolve(homedir(), '.grok', 'sessions', encoded);
}

function parseGrokUpdatesToPrimitives(updatesPath: string, sessionId: string, cwd: string): any {
  if (!existsSync(updatesPath)) return null;
  const lines = readFileSync(updatesPath, 'utf8').trim().split('\n').filter(Boolean);
  const toolCalls: any[] = [];
  const userMessages: string[] = [];
  let idx = 0;

  for (const line of lines) {
    const j = safeJsonParse<any>(line);
    if (!j) continue;
    const u = j.params?.update || {};
    const su = u.sessionUpdate;

    if (su === 'user_message_chunk' && u.content?.text) {
      userMessages.push(u.content.text);
    }
    if ((su === 'tool_call' || su === 'tool_call_update') && u.title) {
      toolCalls.push({
        name: u.title,  // Grok tool titles: list_dir, read_file, run_terminal_command, etc. (different from Claude)
        input: u.input || u.args || { title: u.title },
        timestamp: new Date((j.timestamp || 0) * 1000).toISOString(),
        index: idx++,
      });
    }
  }

  const toolCallCounts: Record<string, number> = {};
  for (const t of toolCalls) {
    toolCallCounts[t.name] = (toolCallCounts[t.name] || 0) + 1;
  }

  return {
    sessionId,
    sessionTitle: `Grok session`,
    model: 'grok',
    agent: 'grok',
    cwd,
    toolCalls,
    toolCallCounts,
    skillsInvoked: [],   // Grok doesn't emit a special "Skill" tool the same way
    userMessages: userMessages.slice(0, 5),
    userTurnCount: userMessages.length,
  };
}

export interface SkillRunOptions {
  runs: number;
  prompts?: string[];           // explicit user prompts
  generate?: boolean;           // auto-generate variations
  real?: boolean;               // force real CLI even if simulation available
  cwd?: string;                 // base for isolation
  verbose?: boolean;
  progress?: import("./eval-progress.js").EvalProgress;  // TUI dashboard hook — ignored by text path
}

export interface SkillRunResult {
  batchId: string;
  skill: string;
  runs: Array<{
    prompt: string;
    trace: string;
    eval: EvalResult;
  }>;
  summary: {
    total: number;
    adheres: number;
    drifts: number;
    unknown: number;
  };
}

/**
 * Core: run N sessions for a skill using prompts (user or generated),
 * drive the agent (preferring real CLI when possible), capture trace,
 * run eval, return batch of results.
 */
export async function runSkillSessions(
  skillDir: string,
  opts: SkillRunOptions
): Promise<SkillRunResult> {
  const skill = await loadSkill(skillDir);
  if (!skill.ok) {
    throw new Error(`Failed to load skill: ${skill.error}`);
  }

  const skillContent = skill.model.content;
  const skillName = (skill.model.data.name as string) || skillDir.split("/").pop() || "unknown-skill";

  const config = await readConfig();
  const agentCfg: AgentConfig | undefined = config?.agent;
  if (!agentCfg?.command) {
    throw new Error("No coding agent configured. Run: doraval init");
  }

  const evalCfg = getEvalConfig(config);

  // Collect prompts
  let prompts: string[] = [];
  if (opts.prompts && opts.prompts.length > 0) {
    // Use supplied prompts, cycling to reach the requested number of runs
    const supplied = opts.prompts;
    for (let k = 0; k < opts.runs; k++) {
      prompts.push(supplied[k % supplied.length]);
    }
  } else if (opts.generate) {
    ui.write(`  Generating prompt variations using the agent...`);
    prompts = await randomPromptsForSkill(skillContent, opts.runs, agentCfg);
  } else {
    // default: a few sensible defaults + generate to reach N
    prompts = [
      "Perform the main task described by the skill on the current project.",
      "Use the skill to analyze and improve the current directory.",
    ];
    if (prompts.length < opts.runs) {
      ui.write(`  Generating additional prompt variations...`);
      const more = await randomPromptsForSkill(skillContent, opts.runs - prompts.length, agentCfg);
      prompts = prompts.concat(more);
    }
    prompts = prompts.slice(0, opts.runs);
  }

  // Sanitize prompts: remove any garbage like previous result JSONs
  prompts = prompts
    .map(p => String(p).trim())
    .filter(p => p.length > 10 && !p.includes('"type":"result"') && !p.includes('session_id') && !p.startsWith('{'));

  opts.progress?.onPlan(prompts.length, skillName);

  const batchId = `run-${Date.now()}-${skillName.replace(/[^a-z0-9]/gi, "-")}`;
  const results: SkillRunResult["runs"] = [];

  const isGrok = /grok/i.test(agentCfg.command || '');

  for (let i = 0; i < prompts.length; i++) {
    const taskPrompt = prompts[i]!;
    opts.progress?.onRunStart(i, taskPrompt);
    const fullPrompt = buildSkillPrompt(skillContent, taskPrompt, skillName);

    // Isolation dir for this run.
    // - If user passed --workdir (opts.cwd), we create per-run subdirs under it.
    //   This lets you point at a populated checkout while keeping runs isolated.
    // - Otherwise: if agent has cwd_flag or it's Grok → isolated /tmp dir.
    // - Else → real process.cwd() (agent sees your project as normal).
    const useIsolated = !!opts.cwd || isGrok || !!agentCfg.cwd_flag;
    const runCwd = opts.cwd
      ? `${opts.cwd}/run-${i}`
      : useIsolated
        ? `/tmp/doraval-skill-run/${batchId}/run-${i}`
        : process.cwd();

    if (useIsolated) {
      try {
        mkdirSync(runCwd, { recursive: true });
        await Bun.write(`${runCwd}/.gitkeep`, "");
      } catch {
        // intentional: isolated cwd prep best-effort; run continues
      }
    }

    // Drive the agent (real full session) — output is streamed live for progress if verbose
    const trace = await runAgentSession(fullPrompt, agentCfg, {
      cwd: runCwd,
      alwaysApprove: true,
      stream: Boolean(opts.verbose),
    });

    // Try to use real Grok session primitives if we can find the updates.jsonl
    let primitives: any = null;
    if (isGrok) {
      const grokBase = cwdToGrokSessionDir(runCwd);
      try {
        if (existsSync(grokBase)) {
          const subs = readdirSync(grokBase).filter((d: string) => d && !d.startsWith('.'));
          if (subs.length) {
            subs.sort().reverse(); // newest first heuristic
            const updatesPath = pathResolve(grokBase, subs[0]!, 'updates.jsonl');
            const real = parseGrokUpdatesToPrimitives(updatesPath, `${batchId}-${i}`, runCwd);
            if (real && real.toolCalls && real.toolCalls.length > 0) {
              // Prepend a synthetic "Skill" invocation so the judge sees the skill was "used"
              const augmentedCalls = [
                {
                  name: "Skill",
                  input: { skill: skillName, args: taskPrompt },
                  timestamp: real.toolCalls[0]?.timestamp || new Date().toISOString(),
                  index: -1,
                },
                ...real.toolCalls,
              ];
              primitives = {
                ...real,
                toolCalls: augmentedCalls,
                sessionId: `${batchId}-${i}`,
                sessionTitle: taskPrompt,
                skillsInvoked: [skillName],
              };
            }
          }
        }
      } catch {
        // intentional: fall back to synthetic primitives below
      }
    }

    if (!primitives) {
      // Fallback (very limited evidence for the judge)
      primitives = {
        sessionId: `${batchId}-${i}`,
        sessionTitle: `Run ${i + 1} for ${skillName}`,
        model: "run-driver",
        agent: isGrok ? "grok" : "agent",
        cwd: runCwd,
        toolCalls: [
          {
            name: "Skill",
            input: { skill: skillName, args: taskPrompt },
            timestamp: new Date().toISOString(),
            index: 0,
          },
          {
            name: "AgentResponse",
            input: { output: trace.slice(0, 2000) },
            timestamp: new Date().toISOString(),
            index: 1,
          },
        ],
        toolCallCounts: { Skill: 1, AgentResponse: 1 },
        skillsInvoked: [skillName],
        userMessages: [taskPrompt],
        userTurnCount: 1,
        durationMs: 0,
      } as any;
    }

    const evalResult = await runEval(primitives, skillName, skillContent, agentCfg, evalCfg);
    opts.progress?.onRunDone(i, evalResult);

    results.push({
      prompt: taskPrompt,
      trace,
      eval: evalResult,
    });
  }

  const summary = {
    total: results.length,
    adheres: results.filter((r) => r.eval.verdict === "PASS").length,
    drifts: results.filter((r) => r.eval.verdict === "FAIL").length,
    unknown: results.filter((r) => r.eval.verdict === "UNKNOWN").length,
  };

  // Persist individual eval results (so UI/history can see them) with batch tag
  try {
    ensureDoravalDirs();
    const evalsDir = getEvalsDir();
    for (const r of results) {
      const fname = `${r.eval.sessionId}.json`;
      await Bun.write(join(evalsDir, fname), JSON.stringify({ ...r.eval, _batchId: batchId, _prompt: r.prompt }, null, 2));
    }
  } catch {
    // intentional: eval persistence optional; return results either way
  }

  opts.progress?.onDone(summary);

  return {
    batchId,
    skill: skillName,
    runs: results,
    summary,
  } as SkillRunResult;
}

function buildSkillPrompt(skillContent: string, task: string, skillName: string): string {
  return `You are a careful coding agent. You MUST follow the instructions in this skill as closely as possible.

SKILL: ${skillName}

${skillContent}

TASK:
${task}

Instructions:
- Strictly adhere to the skill's rules, steps, and style.
- If the skill tells you to use certain tools, formats, or produce specific outputs, do so.
- At the end, briefly summarize the key actions you took in service of the skill.
- Work in the current working directory. Do not escape the provided context.
`;
}

/**
 * Map internal verdict to display form.
 * For generated runs we use ADHERES/DRIFTS (drift-focused language) instead of PASS/FAIL.
 * Pure and tiny — pragmatic FP style (no mutation, easy to test/reason about).
 */
export function displayVerdict(
  verdict: "PASS" | "FAIL" | "UNKNOWN",
  useDriftTerms = false
): string {
  if (!useDriftTerms) return verdict;
  if (verdict === "PASS") return "ADHERES";
  if (verdict === "FAIL") return "DRIFTS";
  return "UNKNOWN";
}

/**
 * Simple helper to turn a SkillRunResult into a human table (for CLI).
 */
export function renderBatchResults(result: SkillRunResult, verbose = false): string {
  const lines: string[] = [];
  lines.push(`\nBatch ${result.batchId} for skill: ${result.skill}`);
  lines.push(`Summary: ${result.summary.adheres} ADHERES / ${result.summary.drifts} DRIFTS / ${result.summary.unknown} UNKNOWN (${result.summary.total} runs)\n`);

  result.runs.forEach((r, i) => {
    const v = r.eval.verdict;
    const displayV = displayVerdict(v, true);
    const color = v === "PASS" ? "\x1b[32m" : v === "FAIL" ? "\x1b[31m" : "\x1b[33m";
    const reset = "\x1b[0m";
    lines.push(`${i + 1}. ${color}[${displayV}]${reset} ${r.prompt.slice(0, 80)}${r.prompt.length > 80 ? "..." : ""}`);
    if (r.eval.checklist?.length) {
      const passed = r.eval.checklist.filter((c) => c.itemVerdict === "ALIGNED" || c.itemVerdict === "JUSTIFIED").length;
      lines.push(`   Score: ${passed}/${r.eval.checklist.length}`);
      if (verbose) {
        r.eval.checklist.forEach((c) => {
          const ok = c.itemVerdict === "ALIGNED" || c.itemVerdict === "JUSTIFIED";
          lines.push(`     ${ok ? "✓" : "✗"} ${c.instruction}`);
        });
      }
    }
  });

  return lines.join("\n");
}
