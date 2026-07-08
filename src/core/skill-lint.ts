import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import type { SkillModel } from "./skill-validate.js";
import type { EvalConfig } from "./journal-config.js";
import type { AgentConfig } from "./agent-invoke.js";
import { invokeAgent, getLastInvokeError } from "./agent-invoke.js";
import { resolveDirectCredentials, DEFAULT_JUDGE_TIMEOUT_MS } from "./llm-judge.js";
import type { Capabilities } from "./capability-detect.js";

// ── Schemas ────────────────────────────────────────────────────────────────────

export const LintFindingSchema = z.object({
  severity: z.enum(["error", "warning", "info"]),
  category: z.enum(["clarity", "actionability", "contradiction", "trigger", "scope"]),
  finding: z.string(),
  suggestion: z.string(),
});

export const LintSchema = z.object({
  overall: z.enum(["pass", "warn", "fail"]),
  summary: z.string(),
  findings: z.array(LintFindingSchema),
});

export type LintOutput = z.infer<typeof LintSchema>;
export type LintFinding = z.infer<typeof LintFindingSchema>;

export type LintResult =
  | { ok: true; output: LintOutput; method: "api" | "cli" }
  | { ok: false; error: string };

// ── Platform context ───────────────────────────────────────────────────────────

export const PLATFORM_CONTEXT: Record<string, string> = {
  claude: `Target platform: Claude Code.
- Skills are loaded via the Skill tool; the agent reads the skill body verbatim.
- Dynamic injection via $ARGUMENTS and backtick blocks is supported.
- The agent has access to Read, Edit, Write, Bash, Glob, Grep, and Agent tools.
- Skills are triggered by the when_to_use field; false-positive triggers waste the user's context.
- CLAUDE.md in the project root also injects context — avoid duplicating instructions from there.`,

  codex: `Target platform: Codex (OpenAI).
- Skills require an "interface" field defining their callable signature.
- Skills are loaded from a directory; the "name" field must match the directory name exactly.
- The agent does not have a Skill tool — skills are invoked as structured tool calls.
- Actionability means: every instruction must map to a tool call the agent can make.
- $ARGUMENTS-style injection is NOT supported; parameters come from the interface schema.`,

  cursor: `Target platform: Cursor.
- Skills are loaded as .mdc files; Cursor injects them as context, not as callable tools.
- There is no explicit trigger mechanism — all loaded skills are always active.
- Instructions should be written as passive rules, not imperative commands to "call" tools.
- Cursor does not expose a Bash tool by default; actionability must not assume shell access.
- Scope is especially important: a broad skill pollutes every chat with irrelevant context.`,

  copilot: `Target platform: Copilot CLI.
- Skills are referenced as an array of paths in the plugin manifest.
- The agent runs in a terminal context; Bash/shell tool access is expected.
- Skills are always-on context; no per-skill trigger mechanism.
- Instructions should not reference GUI or IDE-specific operations.`,
};

// ── Prompt ─────────────────────────────────────────────────────────────────────

export function buildLintPrompt(model: SkillModel, platform?: string, extraRubric?: string): string {
  const frontmatter = Object.entries(model.data)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const platformSection = platform && PLATFORM_CONTEXT[platform]
    ? `\nPLATFORM CONTEXT:\n${PLATFORM_CONTEXT[platform]}\n`
    : "";

  // Project principles recorded via `dora memory` — the judge must enforce them,
  // not just see them (B13a rubric integration).
  const rubricSection = extraRubric?.trim()
    ? `\nPROJECT PRINCIPLES (recorded by this team via dora memory — flag any instruction in the skill that violates one, citing the principle):\n${extraRubric}\n`
    : "";

  return `You are a skill linter for AI coding agents. Analyze this skill and identify quality issues.
${platformSection}${rubricSection}
FRONTMATTER:
${frontmatter}

BODY:
${model.content}

Evaluate across five dimensions:
1. CLARITY: Are instructions unambiguous? Would two engineers interpret them identically?
2. ACTIONABILITY: Can an AI agent actually execute each instruction with the tools it has?${platform ? ` Use the platform context above to judge what tools are available.` : ""}
3. CONTRADICTION: Do any instructions conflict with each other or with the frontmatter?
4. TRIGGER: Is the when_to_use / trigger condition specific enough to avoid false positives?
5. SCOPE: Is the skill focused, or does it combine unrelated responsibilities?

Rules:
- "error" = the skill will likely malfunction or be ignored
- "warning" = the skill may work inconsistently across sessions
- "info" = improvement opportunity; skill works but could be better
- If no issues found in a category, omit it from findings (do not invent problems)
- overall = "fail" if any errors, "warn" if any warnings, "pass" otherwise

CRITICAL: Return ONLY a JSON object. No markdown, no prose. First char '{', last char '}'.

{
  "overall": "pass" | "warn" | "fail",
  "summary": "<one sentence>",
  "findings": [
    {
      "severity": "error" | "warning" | "info",
      "category": "clarity" | "actionability" | "contradiction" | "trigger" | "scope",
      "finding": "<what the issue is>",
      "suggestion": "<concrete fix>"
    }
  ]
}`;
}

// ── Provider factory (mirrors llm-judge.ts, kept local to avoid coupling) ─────

function makeProvider(baseUrl: string, apiKey: string, providerName: string) {
  if (providerName === "openai" || baseUrl === "https://api.openai.com/v1") {
    return createOpenAI({ apiKey, baseURL: baseUrl });
  }
  return createOpenAICompatible({
    name: providerName,
    apiKey,
    baseURL: baseUrl.replace(/\/+$/, ""),
  });
}

// ── API path ───────────────────────────────────────────────────────────────────

async function lintViaApi(prompt: string, evalCfg: Partial<EvalConfig>): Promise<LintResult> {
  const { apiKey, baseUrl, model, providerName } = resolveDirectCredentials(evalCfg);
  if (!apiKey) {
    return { ok: false, error: "No API key configured for lint judge" };
  }
  const provider = makeProvider(baseUrl, apiKey, providerName);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_JUDGE_TIMEOUT_MS);
  try {
    const { object } = await generateObject({
      model: provider(model),
      schema: LintSchema,
      system: "You are a strict linter. Return ONLY a valid JSON object matching the schema. No markdown, no prose.",
      prompt,
      temperature: 0,
      abortSignal: controller.signal,
    });
    return { ok: true, output: object, method: "api" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "API lint request failed";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── CLI path ───────────────────────────────────────────────────────────────────

function mapCliRaw(raw: Record<string, unknown>): LintOutput | null {
  if (typeof raw.overall !== "string" || !["pass", "warn", "fail"].includes(raw.overall)) return null;
  if (typeof raw.summary !== "string") return null;
  if (!Array.isArray(raw.findings)) return null;

  const findings: LintFinding[] = [];
  for (const item of raw.findings as unknown[]) {
    if (
      item !== null &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>).severity === "string" &&
      typeof (item as Record<string, unknown>).category === "string" &&
      typeof (item as Record<string, unknown>).finding === "string" &&
      typeof (item as Record<string, unknown>).suggestion === "string"
    ) {
      const f = item as Record<string, unknown>;
      findings.push({
        severity: f.severity as LintFinding["severity"],
        category: f.category as LintFinding["category"],
        finding: f.finding as string,
        suggestion: f.suggestion as string,
      });
    }
  }
  return { overall: raw.overall as LintOutput["overall"], summary: raw.summary, findings };
}

async function lintViaCli(prompt: string, agentCfg: AgentConfig): Promise<LintResult> {
  const raw = await invokeAgent(prompt, agentCfg, ["overall", "findings"]);
  if (!raw) {
    const detail = getLastInvokeError();
    return { ok: false, error: detail ? `CLI agent: ${detail}` : "CLI agent returned no response" };
  }
  const output = mapCliRaw(raw);
  if (!output) return { ok: false, error: "CLI agent response did not match lint schema" };
  return { ok: true, output, method: "cli" };
}

// ── Public entry point ─────────────────────────────────────────────────────────

export async function lintSkill(
  model: SkillModel,
  caps: Capabilities,
  agentCfg: AgentConfig,
  evalCfg: Partial<EvalConfig>,
  platform?: string,
  extraRubric?: string
): Promise<LintResult> {
  const prompt = buildLintPrompt(model, platform, extraRubric);

  if (caps.preferred === "api") {
    const result = await lintViaApi(prompt, evalCfg);
    if (result.ok) return result;
    // API failed — fall back to CLI if available
    if (caps.cli && caps.cliCommand) {
      return lintViaCli(prompt, { ...agentCfg, command: caps.cliCommand });
    }
    return result;
  }

  if (caps.preferred === "cli") {
    return lintViaCli(prompt, { ...agentCfg, command: agentCfg.command || caps.cliCommand! });
  }

  return {
    ok: false,
    error: "No judge available. Set an API key (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.) or install claude CLI.",
  };
}
