import { defineCommand } from "citty";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import pc from "picocolors";
import pkg from "../../../package.json" with { type: "json" };
import { ui } from "../out.js";
import { loadSkill } from "../../core/skill-validate.js";
import { invokeJudge } from "../../core/llm-judge.js";
import { PLATFORM_CONTEXT } from "../../core/skill-lint.js";
import { readConfig, getEvalConfig } from "../../core/journal-config.js";

// ── Valid platforms ────────────────────────────────────────────────────────────

const VALID_PLATFORMS = ["claude", "codex", "cursor", "copilot"] as const;
type Platform = (typeof VALID_PLATFORMS)[number];

// ── Build the judge prompt ─────────────────────────────────────────────────────

function buildJudgePrompt(
  rubricText: string,
  frontmatter: Record<string, unknown>,
  body: string
): string {
  const fmLines = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  return `You are a strict evaluator judging whether an AI agent skill artifact is ALIGNED with a given rubric/best-practices guide.

RUBRIC / BEST PRACTICES:
${rubricText}

---

ARTIFACT FRONTMATTER:
${fmLines}

ARTIFACT BODY:
${body.trim()}

---

TASK:
1. Score each rubric criterion against the artifact. For each criterion, decide:
   - itemVerdict: "ALIGNED" | "DRIFTED" | "JUSTIFIED" | "UNCLEAR"
   - bindingness: "MANDATORY" (core rubric criterion) | "CONDITIONAL" | "DISCRETIONARY"
   - evidence: a short quote or "n/a"
2. Derive a top-level verdict:
   - "PASS" if no criterion is DRIFTED
   - "FAIL" if any MANDATORY or CONDITIONAL criterion is DRIFTED
3. Provide a verdictReason (1-2 sentences).
4. List any ambiguityFlags for UNCLEAR criteria.

For userFamiliarity, userFamiliarityReason, closure, and userTurnsAfterSkill:
  - These fields are required by schema; set userFamiliarity=5, userFamiliarityReason="not applicable (rubric mode)", closure="1-shot", userTurnsAfterSkill=0.

Return ONLY a valid JSON object — no prose, no markdown fences.`;
}

// ── Render table output ────────────────────────────────────────────────────────

function renderTable(
  verdict: string,
  verdictReason: string,
  checklist: Array<{
    instruction: string;
    bindingness: string;
    itemVerdict: string;
    evidence: string;
    detail?: string;
  }>,
  ambiguityFlags: string[],
  verbose: boolean
): void {
  const isPass = verdict === "PASS";
  const verdictColor = isPass ? pc.green : pc.red;
  ui.write(`\n  ${verdictColor(`[${verdict}]`)} ${pc.bold("Rubric alignment")}`);
  ui.write(`  ${verdictReason}`);

  if (verbose && checklist.length > 0) {
    ui.write(`\n  Checklist:`);
    for (const item of checklist) {
      const icon =
        item.itemVerdict === "ALIGNED"
          ? pc.green("✓")
          : item.itemVerdict === "DRIFTED"
            ? pc.red("✗")
            : item.itemVerdict === "JUSTIFIED"
              ? pc.yellow("~")
              : pc.dim("?");
      ui.write(`    ${icon}  [${item.bindingness}] ${item.instruction}`);
      if (item.evidence) ui.write(`         evidence: ${item.evidence}`);
    }
  }

  if (ambiguityFlags.length > 0) {
    ui.write(`\n  Ambiguous criteria:`);
    for (const f of ambiguityFlags) {
      ui.write(`    ${pc.yellow("?")}  ${f}`);
    }
  }

  ui.blank();
}

// ── Command ────────────────────────────────────────────────────────────────────

export default defineCommand({
  meta: {
    name: "judge",
    description:
      "Judge a skill artifact against a rubric (session-free). Outputs a signed verdict envelope.",
  },
  args: {
    path: {
      type: "positional",
      description: "Path to skill directory",
      required: true,
    },
    rubric: {
      type: "string",
      description: "Path to custom best-practices markdown file",
    },
    for: {
      type: "string",
      description: 'Platform rubric to use: "claude" | "codex" | "cursor" | "copilot" (default: claude)',
      default: "claude",
    },
    format: {
      type: "string",
      alias: "f",
      description: "Output format: table (default) | json",
      default: "table",
    },
    ci: {
      type: "boolean",
      description: "Exit 1 if FAIL",
      default: false,
    },
    verbose: {
      type: "boolean",
      alias: "v",
      description: "Show full checklist",
      default: false,
    },
  },

  async run({ args }) {
    const skillPath = resolve(args.path as string);
    const platform = ((args.for as string) || "claude") as Platform;
    const format = (args.format as string) || "table";
    const isJson = format === "json";

    // ── Load skill ─────────────────────────────────────────────────────────────

    const loadResult = await loadSkill(skillPath);
    if (!loadResult.ok) {
      if (isJson) {
        process.stdout.write(JSON.stringify({ error: loadResult.error }) + "\n");
      } else {
        ui.fail(`Cannot load skill: ${loadResult.error}`);
        ui.info(`Path: ${skillPath}`);
      }
      process.exit(1);
    }

    const { model } = loadResult;

    // ── Resolve rubric ─────────────────────────────────────────────────────────

    let rubricText: string;
    let rubricRef: string;

    if (args.rubric) {
      const rubricPath = resolve(args.rubric as string);
      if (!existsSync(rubricPath)) {
        if (isJson) {
          process.stdout.write(JSON.stringify({ error: `Rubric file not found: ${rubricPath}` }) + "\n");
        } else {
          ui.fail(`Rubric file not found: ${rubricPath}`);
        }
        process.exit(1);
      }
      rubricText = readFileSync(rubricPath, "utf8");
      rubricRef = rubricPath;
    } else {
      const validPlatform = VALID_PLATFORMS.includes(platform) ? platform : "claude";
      rubricText = PLATFORM_CONTEXT[validPlatform] ?? PLATFORM_CONTEXT["claude"];
      rubricRef = `built-in:${validPlatform}`;
    }

    // ── Build prompt ───────────────────────────────────────────────────────────

    const promptText = buildJudgePrompt(rubricText, model.data, model.content);

    // ── Load eval config ───────────────────────────────────────────────────────

    const config = await readConfig();
    const evalCfg = getEvalConfig(config);

    // ── Invoke judge ───────────────────────────────────────────────────────────

    const timeoutMs = evalCfg.timeout_ms ?? 180_000;
    ui.info(`  calling judge (${Math.round(timeoutMs / 1000)}s timeout) …`);
    const result = await invokeJudge(promptText, evalCfg, { timeoutMs });

    if (!result.success) {
      if (isJson) {
        process.stdout.write(
          JSON.stringify({ error: result.error, code: result.code }) + "\n"
        );
      } else {
        ui.fail(`Judge failed: ${result.error}`);
        if (result.code === "config") {
          ui.info("Run: dora evals setup  — to configure your judge LLM.");
        }
      }
      process.exit(1);
    }

    const output = result.data;

    // Derive verdict programmatically to prevent LLM self-reporting contradictions
    const derivedVerdict = output.checklist.some(
      (c) => c.itemVerdict === "DRIFTED" && c.bindingness !== "DISCRETIONARY"
    ) ? "FAIL" : "PASS";

    // ── Build signed verdict envelope ──────────────────────────────────────────

    const { apiKey: _key, baseUrl, model: modelId, providerName } = await resolveCredentials(evalCfg);

    const envelope = {
      verdict: derivedVerdict,
      verdictReason: output.verdictReason,
      rubricRef,
      model: modelId,
      provider: providerName,
      judgeMethod: "api" as const,
      timestamp: new Date().toISOString(),
      doravalVersion: pkg.version,
      checklist: output.checklist,
      ambiguityFlags: output.ambiguityFlags,
    };

    // ── Output ─────────────────────────────────────────────────────────────────

    if (isJson) {
      process.stdout.write(JSON.stringify(envelope, null, 2) + "\n");
    } else {
      renderTable(
        derivedVerdict,
        output.verdictReason,
        output.checklist,
        output.ambiguityFlags,
        args.verbose as boolean
      );
    }

    if (args.ci && derivedVerdict === "FAIL") {
      process.exit(1);
    }
  },
});

// ── Helper: resolve credentials for envelope metadata ─────────────────────────

async function resolveCredentials(evalCfg: Parameters<typeof invokeJudge>[1]) {
  const { resolveDirectCredentials } = await import("../../core/llm-judge.js");
  return resolveDirectCredentials(evalCfg);
}
