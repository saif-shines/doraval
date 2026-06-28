import type { AgentConfig } from "./agent-invoke.js";
import { invokeAgent, getLastInvokeError } from "./agent-invoke.js";
import { invokeJudge, canUseApiJudge, type JudgeResult, type JudgeOutput } from "./llm-judge.js";
import type { EvalConfig } from "./journal-config.js";
import { truncateToolCalls, type SessionPrimitives, type ToolCall } from "./session-parse.js";

export interface ChecklistItem {
  instruction: string;
  pass: boolean;
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

  return `You are evaluating whether a coding agent followed a skill's instructions during a real session.

SKILL CONTENT:
${skillContent}

TOOL CALL SEQUENCE (ordered):
${toolCallLines}${truncationNote}

USER MESSAGES (first 5, for familiarity inference):
${userMsgLines}

TASKS:
1. Extract the key actions the skill instructs (e.g. "invoke X tool", "fetch N URLs", "create tasks for each item").
2. For each expected action, check if the tool call sequence shows it happened.
3. Infer user familiarity 1-10 from the user messages:
   - 1-3: vague/brief prompts, many typos, relies on agent to figure things out
   - 4-6: clear intent but informal, some corrections
   - 7-10: precise, technical, specific file paths/function names
4. Determine closure:
   - "1-shot": ≤2 user turns after first Skill invocation
   - "multi-turn": >2 user turns after first Skill invocation
   - "incomplete": no end_turn signal or session appears cut off
5. Overall verdict: "PASS" if all critical instructions were followed, "FAIL" if any critical instruction was missed.

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
    { "instruction": "<what skill said>", "pass": <true|false>, "detail": "<optional>" }
  ]
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

  const shouldTryApi =
    preference !== 'cli' &&
    (preference === 'api' || canUseApiJudge(evalCfg)) &&
    !!evalCfg.model;

  if (shouldTryApi) {
    const result: JudgeResult = await invokeJudge(prompt, evalCfg);
    if (result.success) {
      judged = result.data;
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
          return {
            instruction: typeof i.instruction === "string" ? i.instruction : "unknown",
            pass: i.pass === true,
            detail: typeof i.detail === "string" ? i.detail : undefined,
          };
        }),
        userFamiliarity: typeof raw.userFamiliarity === "number" ? raw.userFamiliarity : 0,
        userFamiliarityReason: typeof raw.userFamiliarityReason === "string" ? raw.userFamiliarityReason : "",
        closure: (raw.closure as JudgeOutput["closure"]) ?? "incomplete",
        userTurnsAfterSkill: typeof raw.userTurnsAfterSkill === "number" ? raw.userTurnsAfterSkill : 0,
      };
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
    verdict: judged.verdict,
    verdictReason: judged.verdictReason,
    checklist: judged.checklist,
  };
}
