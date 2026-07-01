import type { AgentConfig } from "./agent-invoke.js";
import { invokeAgent, getLastInvokeError } from "./agent-invoke.js";
import { invokeJudge, canUseApiJudge, type JudgeResult, type JudgeOutput } from "./llm-judge.js";
import type { EvalConfig } from "./journal-config.js";
import { truncateToolCalls, type SessionPrimitives, type ToolCall } from "./session-parse.js";

export interface ChecklistItem {
  instruction: string;
  bindingness: "MANDATORY" | "CONDITIONAL" | "DISCRETIONARY";
  itemVerdict: "ALIGNED" | "DRIFTED" | "JUSTIFIED" | "UNCLEAR";
  evidence: string;
  detail?: string;
}

export interface EvalResult {
  schemaVersion: 1;
  sessionId: string;
  sessionTitle?: string;
  timestamp: string;
  agent: string;
  model: string;
  skill: string;
  userFamiliarity: number;
  userFamiliarityReason: string;
  closure: "1-shot" | "multi-turn" | "incomplete";
  userTurnsAfterSkill: number;
  skillsInvoked: string[];
  toolCallCounts: Record<string, number>;
  verdict: "PASS" | "FAIL" | "UNKNOWN";
  verdictReason: string;
  checklist: ChecklistItem[];
  ambiguityFlags: string[];
  judgeMethod: "api" | "cli" | "unknown";
}

function toolCallSummary(call: ToolCall): string {
  const inputStr = JSON.stringify(call.input).slice(0, 100);
  return `${call.name}: ${inputStr}`;
}

export function buildEvalPrompt(
  primitives: SessionPrimitives,
  skillContent: string,
  maxToolCalls: number
): string {
  const truncated = truncateToolCalls(primitives.toolCalls, maxToolCalls);
  const wasTruncated = truncated.length < primitives.toolCalls.length;

  const toolCallLines = truncated.map((c) => toolCallSummary(c)).join("\n");
  const truncationNote = wasTruncated
    ? `\n[truncated: showing ${truncated.length} of ${primitives.toolCalls.length} total tool calls]`
    : "";

  const userMsgLines = primitives.userMessages.slice(0, 5).join("\n---\n");

  // Include up to 10 assistant text entries, capped at ~2000 chars total
  const assistantEntries = primitives.assistantText.slice(0, 10);
  let assistantTextBlock = "";
  if (assistantEntries.length > 0) {
    let combined = assistantEntries.join("\n---\n");
    if (combined.length > 2000) {
      combined = combined.slice(0, 2000) + "\n[truncated]";
    }
    assistantTextBlock = `\nASSISTANT REASONING (first ${assistantEntries.length} entries):\n${combined}\n`;
  }

  return `You are evaluating whether a coding agent followed a skill's instructions during a real session.

SKILL CONTENT:
${skillContent}

TOOL CALL SEQUENCE (ordered):
${toolCallLines}${truncationNote}
${assistantTextBlock}
USER MESSAGES (first 5, for familiarity inference):
${userMsgLines}

PASS 1 — CLASSIFY each instruction from the skill:
- MANDATORY: the agent MUST do this in every applicable session
- CONDITIONAL: depends on context; only binding when the triggering condition is met
- DISCRETIONARY: example, suggestion, or stylistic guidance — not binding

PASS 2 — JUDGE each MANDATORY instruction and each CONDITIONAL instruction whose trigger was met:
- ALIGNED: agent followed the instruction
- DRIFTED: agent clearly violated the instruction
- JUSTIFIED: agent deviated but for a documented reason that justifies it
- UNCLEAR: judge genuinely cannot tell from available evidence (not "probably fine")
Note: DISCRETIONARY instructions do not need a judgment — set itemVerdict to "ALIGNED" for them.
Note: UNCLEAR items are treated as ALIGNED (benefit of the doubt) for the overall verdict but are flagged in ambiguityFlags so the skill author can improve clarity.

ADDITIONAL TASKS:
1. Infer user familiarity 1-10 from the user messages:
   - 1-3: vague/brief prompts, many typos, relies on agent to figure things out
   - 4-6: clear intent but informal, some corrections
   - 7-10: precise, technical, specific file paths/function names
2. Determine closure:
   - "1-shot": ≤2 user turns after first Skill invocation
   - "multi-turn": >2 user turns after first Skill invocation
   - "incomplete": no end_turn signal or session appears cut off
3. Overall verdict: "PASS" if zero DRIFTED items, "FAIL" if any DRIFTED item exists.

CRITICAL: Output *ONLY* the JSON object. No markdown fences, no explanations, no text before or after it. The first character of your response must be '{' and the last must be '}'.

Return ONLY a valid JSON object with exactly these keys:
{
  "userFamiliarity": <number 1-10>,
  "userFamiliarityReason": "<one sentence>",
  "closure": "<1-shot|multi-turn|incomplete>",
  "userTurnsAfterSkill": <number>,
  "verdict": "<PASS|FAIL>",
  "verdictReason": "<one sentence>",
  "checklist": [
    {
      "instruction": "<what skill said>",
      "bindingness": "<MANDATORY|CONDITIONAL|DISCRETIONARY>",
      "itemVerdict": "<ALIGNED|DRIFTED|JUSTIFIED|UNCLEAR>",
      "evidence": "<tool-call index or agent quote; empty string if none>",
      "detail": "<optional extra detail>"
    }
  ],
  "ambiguityFlags": ["<instruction strings from UNCLEAR items only>"]
}`;
}

export function makeUnknownResult(
  primitives: SessionPrimitives,
  skillName: string,
  reason: string
): EvalResult {
  return {
    schemaVersion: 1,
    sessionId: primitives.sessionId,
    sessionTitle: primitives.sessionTitle,
    timestamp: new Date().toISOString(),
    agent: primitives.agent,
    model: primitives.model,
    skill: skillName,
    userFamiliarity: 0,
    userFamiliarityReason: "",
    closure: "incomplete",
    userTurnsAfterSkill: 0,
    skillsInvoked: primitives.skillsInvoked,
    toolCallCounts: primitives.toolCallCounts,
    verdict: "UNKNOWN",
    verdictReason: reason,
    checklist: [],
    ambiguityFlags: [],
    judgeMethod: "unknown",
  };
}

export async function runEval(
  primitives: SessionPrimitives,
  skillName: string,
  skillContent: string,
  agentCfg: AgentConfig,
  evalCfg: EvalConfig
): Promise<EvalResult> {
  const prompt = buildEvalPrompt(primitives, skillContent, evalCfg.max_tool_calls);

  const preference = evalCfg.judge ?? 'auto';

  let judged: JudgeOutput | null = null;
  let judgeError: string | undefined;
  let judgeCode: string | undefined;
  let usedMethod: "api" | "cli" | "unknown" = "unknown";

  const shouldTryApi =
    preference !== 'cli' &&
    (preference === 'api' || canUseApiJudge(evalCfg)) &&
    !!evalCfg.model;

  if (shouldTryApi) {
    const timeoutMs = evalCfg.timeout_ms ?? 180_000;
    const result: JudgeResult = await invokeJudge(prompt, evalCfg, { timeoutMs });
    if (result.success) {
      judged = result.data;
      usedMethod = "api";
    } else {
      judgeError = result.error;
      judgeCode = result.code;
    }
  }

  // Fallback: CLI agent returns Record<string, unknown>; map it to JudgeOutput shape
  if (!judged && preference !== 'api') {
    const raw = await invokeAgent(prompt, agentCfg, ["verdict", "checklist"]);
    if (raw && typeof raw.verdict === "string" && Array.isArray(raw.checklist)) {
      judged = {
        verdict: raw.verdict === "PASS" ? "PASS" : "FAIL",
        verdictReason: typeof raw.verdictReason === "string" ? raw.verdictReason : "",
        checklist: (raw.checklist as unknown[]).map((item) => {
          const i = item as Record<string, unknown>;
          const bindingness = (["MANDATORY", "CONDITIONAL", "DISCRETIONARY"] as const).includes(i.bindingness as never)
            ? (i.bindingness as "MANDATORY" | "CONDITIONAL" | "DISCRETIONARY")
            : "MANDATORY";
          const itemVerdict = (["ALIGNED", "DRIFTED", "JUSTIFIED", "UNCLEAR"] as const).includes(i.itemVerdict as never)
            ? (i.itemVerdict as "ALIGNED" | "DRIFTED" | "JUSTIFIED" | "UNCLEAR")
            : "UNCLEAR";
          return {
            instruction: typeof i.instruction === "string" ? i.instruction : "unknown",
            bindingness,
            itemVerdict,
            evidence: typeof i.evidence === "string" ? i.evidence : "",
            detail: typeof i.detail === "string" ? i.detail : undefined,
          };
        }),
        ambiguityFlags: Array.isArray(raw.ambiguityFlags)
          ? (raw.ambiguityFlags as unknown[]).filter((f): f is string => typeof f === "string")
          : [],
        userFamiliarity: typeof raw.userFamiliarity === "number" ? raw.userFamiliarity : 0,
        userFamiliarityReason: typeof raw.userFamiliarityReason === "string" ? raw.userFamiliarityReason : "",
        closure: (raw.closure as JudgeOutput["closure"]) ?? "incomplete",
        userTurnsAfterSkill: typeof raw.userTurnsAfterSkill === "number" ? raw.userTurnsAfterSkill : 0,
      };
      if (judged) usedMethod = "cli";
    }
  }

  if (!judged) {
    const err = judgeError || getLastInvokeError();
    const codeSuffix = judgeCode ? ` [${judgeCode}]` : "";
    return makeUnknownResult(
      primitives,
      skillName,
      err ? `LLM call failed${codeSuffix}: ${err}` : "LLM call failed — no response"
    );
  }

  // Derive ambiguityFlags from UNCLEAR checklist items (programmatic, not LLM-guessed)
  const ambiguityFlags = judged.checklist
    .filter((item) => item.itemVerdict === "UNCLEAR")
    .map((item) => item.instruction);

  // Derive verdict programmatically to prevent LLM self-reporting contradictions
  const derivedVerdict = judged.checklist.some(
    (c) => c.itemVerdict === "DRIFTED" && c.bindingness !== "DISCRETIONARY"
  ) ? "FAIL" : "PASS";

  return {
    schemaVersion: 1,
    sessionId: primitives.sessionId,
    sessionTitle: primitives.sessionTitle,
    timestamp: new Date().toISOString(),
    agent: primitives.agent,
    model: primitives.model,
    skill: skillName,
    userFamiliarity: judged.userFamiliarity,
    userFamiliarityReason: judged.userFamiliarityReason,
    closure: judged.closure,
    userTurnsAfterSkill: judged.userTurnsAfterSkill,
    skillsInvoked: primitives.skillsInvoked,
    toolCallCounts: primitives.toolCallCounts,
    verdict: derivedVerdict,
    verdictReason: judged.verdictReason,
    checklist: judged.checklist,
    ambiguityFlags,
    judgeMethod: usedMethod,
  };
}
