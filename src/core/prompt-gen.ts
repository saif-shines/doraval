import { invokeAgent } from "./agent-invoke.js";
import type { AgentConfig } from "./agent-invoke.js";

/**
 * Generate varied task prompts that would benefit from the given skill.
 * Falls back to simple templates if agent not usable.
 */
export async function randomPromptsForSkill(
  skillContent: string,
  count: number,
  agentCfg?: AgentConfig
): Promise<string[]> {
  // Extract the main purpose from the skill frontmatter (pragmatic first-success chain).
  // Array of prioritized extractors keeps the flow linear and easy to extend.
  const focusExtractors = [
    (s: string) => s.match(/name:\s*["']?(.+?)["']?\n/i)?.[1],
    (s: string) => s.match(/when_to_use:\s*["']?(.+?)["']?\n/i)?.[1],
    (s: string) => s.match(/description:\s*["']?(.+?)["']?\n/i)?.[1],
  ];
  const skillFocus =
    focusExtractors.map((fn) => fn(skillContent)?.trim()).find(Boolean) ||
    "the task described in the skill";

  if (agentCfg?.command) {
    try {
      const genPrompt = `Given this skill (focus: ${skillFocus}), generate exactly ${count} specific, varied, realistic prompts for a coding agent.

The agent will be given the full skill and told "You MUST follow this skill exactly".

Generate prompts that are direct applications of this skill's purpose (e.g. "Set up Scalekit auth following the skill's exact steps and requirements").

Output ONLY valid JSON: {"prompts": ["prompt1", "prompt2", ...]}
No other text.`;

      const res = await invokeAgent(genPrompt, agentCfg, ["prompts"]);
      if (res && typeof res === "object") {
        let promptList: any = (res as any).prompts;
        if (Array.isArray(promptList)) {
          const cleaned = promptList
            .map((p: any) => String(p).trim())
            .filter((p: string) => p.length > 20 && !p.toLowerCase().includes("explore the current project") && !p.includes("result") && !p.includes("session_id"));
          if (cleaned.length > 0) {
            return cleaned.slice(0, count);
          }
        }
      }
    } catch {
    // intentional: fall through to deterministic prompt templates
  }
  }

  // Always produce skill-specific prompts based on the skill's own when_to_use / focus.
  // (LLM-based generation for test prompts was too flaky and often fell back to useless "explore" prompts.)
  const focus =
    focusExtractors.map((fn) => fn(skillContent)?.trim()).find(Boolean) ||
    "accomplish the main goal of the skill";

  const prompts: string[] = [];
  for (let i = 0; i < count; i++) {
    const base = `Follow the instructions in this skill exactly to ${focus.toLowerCase()}.`;
    prompts.push(i === 0 ? base : `${base} (variation ${i + 1})`);
  }
  return prompts;
}
