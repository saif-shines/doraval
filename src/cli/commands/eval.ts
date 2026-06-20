import { defineCommand } from "citty";
import { join } from "path";
import { existsSync } from "fs";
import pc from "picocolors";
import { ui } from "../out.js";
import { getAdapter } from "../../core/session-adapters.js";
import { runEval, type EvalResult } from "../../core/session-eval.js";
import { readConfig, getEvalConfig, ensureDoravalDirs, getEvalsDir } from "../../core/journal-config.js";
import { loadSkill } from "../../core/skill-validate.js";

function resolveApiKey(evalCfg: { api_key?: string }): string | undefined {
  return process.env.ANTHROPIC_API_KEY ?? evalCfg.api_key ?? undefined;
}

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

export default defineCommand({
  meta: {
    name: "eval",
    description: "Evaluate a real coding agent session against skill instructions",
  },
  args: {
    session: {
      type: "string",
      description: "Path to a .jsonl session file (default: auto-detect latest)",
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

    // Resolve API key
    const apiKey = resolveApiKey(evalCfg);
    if (!apiKey && !evalCfg.model) {
      ui.fail("No eval model configured.");
      ui.info("  Run: doraval config set eval.model claude-sonnet-4-6");
      ui.info("  And set: ANTHROPIC_API_KEY env var, or doraval config set eval.api_key <key>");
      process.exit(2);
    }

    const agentCfg = config?.agent;
    if (!agentCfg) {
      ui.fail("No coding agent configured. Run: doraval init");
      process.exit(2);
    }

    // Find session
    let sessionPath: string | null = args.session ?? null;
    if (!sessionPath) {
      const adapter = getAdapter();
      if (!adapter) {
        ui.fail("No supported coding agent detected. Is Claude Code installed?");
        process.exit(2);
      }
      sessionPath = adapter.findLatestSession(process.cwd());
      if (!sessionPath) {
        ui.fail(`No sessions found for ${process.cwd()}`);
        ui.info("  Use --session <path> to specify a session file.");
        process.exit(2);
      }
    }

    ui.info(`  Session: ${pc.dim(sessionPath)}`);

    // Parse session
    const adapter = getAdapter();
    if (!adapter) {
      ui.fail("No supported coding agent detected.");
      process.exit(2);
    }
    const primitives = adapter.parse(sessionPath);

    if (primitives.skillsInvoked.length === 0) {
      ui.warn("No skills were invoked in this session.");
      if (args.format === "json") {
        process.stdout.write(JSON.stringify([], null, 2) + "\n");
      }
      process.exit(0);
    }

    // Filter skills if --skill provided
    let skillsToEval = primitives.skillsInvoked;
    if (args.skill) {
      skillsToEval = skillsToEval.filter((s) => s.includes(args.skill!));
      if (skillsToEval.length === 0) {
        ui.warn(`No matching skills found for filter: ${args.skill}`);
        process.exit(0);
      }
    }

    // Privacy notice
    ui.write(`  ${pc.dim("· Sending session summary (tool calls + 5 user messages) to")} ${pc.dim(evalCfg.model || "configured model")}${pc.dim(". Use --verbose to inspect.")}`);

    ensureDoravalDirs();
    const results: EvalResult[] = [];

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
      results.push(result);

      // Save to history
      if (evalCfg.save_history) {
        const evalPath = join(getEvalsDir(), `${primitives.sessionId}-${Date.now()}.json`);
        await Bun.write(evalPath, JSON.stringify(result, null, 2));
      }
    }

    if (args.format === "json") {
      process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    } else {
      for (const result of results) {
        renderResult(result, Boolean(args.verbose));
      }
      ui.blank();
    }

    // --ci: exit 1 if any FAIL
    if (args.ci && results.some((r) => r.verdict === "FAIL")) {
      process.exit(1);
    }

    process.exit(0);
  },
});
