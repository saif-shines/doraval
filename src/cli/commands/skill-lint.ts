import { defineCommand } from "citty";
import pc from "picocolors";
import { ui } from "../out.js";
import { loadSkill } from "../../core/skill-validate.js";
import { lintSkill, type LintFinding } from "../../core/skill-lint.js";
import { detectCapabilities, describeCapabilities } from "../../core/capability-detect.js";
import { readConfig, getEvalConfig } from "../../core/journal-config.js";
import { resolveRenderMode } from "../render/mode.js";
import { initBackend, currentMode, resetToText } from "../render/index.js";
import type { TuiBackend } from "../render/tui-backend.js";
import { noopWorkSink } from "../../core/work-events.js";
import { exit } from "../render/exit.js";

function hasCommand(x: unknown): x is { command: string } {
  return !!x && typeof x === "object" && typeof (x as Record<string, unknown>).command === "string";
}

function severityColor(s: LintFinding["severity"]): (t: string) => string {
  if (s === "error") return pc.red;
  if (s === "warning") return pc.yellow;
  return pc.cyan;
}

function severitySymbol(s: LintFinding["severity"]): string {
  if (s === "error") return "✗";
  if (s === "warning") return "⚠";
  return "ℹ";
}

export default defineCommand({
  meta: {
    name: "lint",
    description: "LLM-based quality check of a skill (clarity, actionability, contradictions)",
  },
  args: {
    path: {
      type: "positional",
      description: "Path to skill directory (default: current directory)",
      required: false,
      default: ".",
    },
    for: {
      type: "string",
      description: 'Target platform for platform-aware linting ("claude", "cursor", "codex", "copilot")',
    },
    format: {
      type: "string",
      alias: "f",
      description: "Output format: table or json",
      default: "table",
    },
    ci: {
      type: "boolean",
      description: "Exit non-zero if overall is warn or fail",
      default: false,
    },
  },

  async run({ args }) {
    const skillPath = args.path as string;
    const format = args.format as string;
    const mode = resolveRenderMode({ format, ci: Boolean(args.ci) });
    const backend = await initBackend(mode);

    const sink = currentMode() === "tui"
      ? (backend as TuiBackend).createWorkProgress("dora skill lint")
      : noopWorkSink;

    const loaded = await loadSkill(skillPath);
    if (!loaded.ok) {
      await backend.destroy();
      resetToText();
      ui.fail(`Cannot load skill at "${skillPath}": ${loaded.error}`);
      return await exit(1);
    }

    const cfg = await readConfig().catch(() => null);
    const evalCfg = cfg ? getEvalConfig(cfg) : {};
    const agentCfg = { command: hasCommand(cfg?.agent) ? cfg.agent.command : "claude" };

    const caps = detectCapabilities(evalCfg);
    const platform = args.for as string | undefined;

    if (format === "table" && currentMode() !== "tui") {
      const platformLabel = platform ? pc.dim(` · platform: ${platform}`) : "";
      ui.write(pc.dim(`  judge: ${describeCapabilities(caps)}`) + platformLabel);
    }

    if (caps.preferred === "none") {
      await backend.destroy();
      resetToText();
      ui.fail("No judge available. Set an API key (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.) or install claude CLI.");
      return await exit(1);
    }

    // Show spinner for the LLM call
    const label = platform ? `quality check for ${platform}` : "quality check";
    sink.emit({ kind: "start", index: 0, label });

    const result = await lintSkill(loaded.model, caps, agentCfg, evalCfg, platform);

    if (!result.ok) {
      sink.emit({ kind: "done", label: `failed: ${result.error}` });
      await backend.destroy();
      resetToText();
      ui.fail(`Lint failed: ${result.error}`);
      return await exit(1);
    }

    // Signal completion before rendering output
    const doneLabel = result.output.overall === "pass" ? "✓ pass" : result.output.overall === "warn" ? "⚠ warn" : "✗ fail";
    sink.emit({ kind: "done", label: doneLabel });

    if (format === "json") {
      await backend.destroy();
      resetToText();
      process.stdout.write(JSON.stringify({ ...result.output, method: result.method }, null, 2) + "\n");
      if (args.ci && result.output.overall !== "pass") return await exit(1);
      return;
    }

    const overallColor =
      result.output.overall === "pass" ? pc.green
      : result.output.overall === "warn" ? pc.yellow
      : pc.red;

    ui.write(`\n  ${overallColor(`[${result.output.overall.toUpperCase()}]`)}  ${result.output.summary}`);
    ui.write(`  via: ${pc.dim(result.method)}\n`);

    if (result.output.findings.length === 0) {
      ui.write(pc.green("  No issues found."));
    } else {
      for (const f of result.output.findings) {
        const col = severityColor(f.severity);
        const sym = severitySymbol(f.severity);
        ui.write(`  ${col(sym)} ${pc.bold(f.category)}  ${f.finding}`);
        ui.write(`    ${pc.dim("→")} ${f.suggestion}`);
      }
    }
    ui.write("");

    await backend.destroy();
    resetToText();

    if (args.ci && result.output.overall !== "pass") await exit(1);
  },
});
