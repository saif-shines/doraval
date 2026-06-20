import { defineCommand } from "citty";
import { join, basename } from "path";
import { existsSync, readFileSync } from "fs";
import pc from "picocolors";
import { ui } from "../out.js";
import { getAdapter } from "../../core/session-adapters.js";
import { parseSession, sanitizeSessionId, type SessionPrimitives } from "../../core/session-parse.js";
import { runEval, type EvalResult } from "../../core/session-eval.js";
import { readConfig, getEvalConfig, ensureDoravalDirs, getEvalsDir } from "../../core/journal-config.js";
import { loadSkill } from "../../core/skill-validate.js";
import { prompt } from "../prompt.js";

function renderResult(result: EvalResult, verbose: boolean): void {
  const verdictColor = result.verdict === "PASS" ? pc.green : result.verdict === "FAIL" ? pc.red : pc.yellow;
  const verdictSymbol = result.verdict === "PASS" ? "✓" : result.verdict === "FAIL" ? "✗" : "?";

  ui.write(`\n  ${verdictColor(`[${result.verdict}]`)} ${pc.bold(result.skill)}`);
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
    ui.write(`\n  Result: ${passed}/${result.checklist.length}  [${verdictColor(result.verdict)}${result.verdictReason ? ` — ${result.verdictReason}` : ""}]`);
  } else if (result.verdictReason) {
    ui.write(`\n  ${verdictColor(verdictSymbol)} ${result.verdictReason}`);
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
    description: "Evaluate a real coding agent session against skill instructions",
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
      description: "Exit with code 1 if any verdict is FAIL",
      default: false,
    },
    verbose: {
      type: "boolean",
      alias: "v",
      description: "Show full checklist reasoning",
      default: false,
    },
  },

  async run({ args }) {
    ui.heading("doraval eval — Session skill adherence");

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
      ui.write(`  ${pc.dim("· Sending session summary (tool calls + 5 user messages) to")} ${pc.dim(evalCfg.model || "configured model")}${pc.dim(". Use --verbose to inspect.")}`);

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

    // --ci: exit 1 if any FAIL
    if (args.ci && allResults.some((r) => r.verdict === "FAIL")) {
      process.exit(1);
    }

    process.exit(0);
  },
});
