import { spawnSync } from "bun";
import pc from "picocolors";
import { ui } from "../cli/out.js";

export interface AgentConfig {
  command: string;
  prompt_template?: string;
}

/**
 * Turns a template string (e.g. '-p "{{prompt}}" --output-format json')
 * into a proper argv array, keeping the prompt as a single argument.
 * Exported separately so it can be unit-tested without spawning a process.
 */
export function buildAgentArgv(template: string, promptText: string): string[] {
  const marker = "__DORA_PROMPT__";
  const substituted = template.replace("{{prompt}}", marker);
  const rawParts = substituted.split(/\s+/).filter(Boolean);

  return rawParts.map((part) => {
    let cleaned = part;
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) cleaned = cleaned.slice(1, -1);
    if (cleaned.startsWith("'") && cleaned.endsWith("'")) cleaned = cleaned.slice(1, -1);
    return cleaned === marker ? promptText : cleaned;
  });
}

function extractCandidates(text: string): Record<string, unknown>[] {
  let cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();

  const candidates: Record<string, unknown>[] = [];
  const allMatches = cleaned.match(/\{[\s\S]*?\}(?=\s*(?:\{|$))/g) ?? [];
  const fullMatch = cleaned.match(/\{[\s\S]*\}/);
  if (fullMatch) {
    try { candidates.push(JSON.parse(fullMatch[0]) as Record<string, unknown>); } catch {}
  }
  for (const m of allMatches) {
    try { candidates.push(JSON.parse(m) as Record<string, unknown>); } catch {}
  }

  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    try {
      const direct = JSON.parse(cleaned);
      if (direct && typeof direct === 'object') candidates.push(direct as Record<string, unknown>);
    } catch {}
  }

  const unwrapped: Record<string, unknown>[] = [];
  for (const c of candidates) {
    if (c.result) {
      let inner = c.result;
      if (typeof inner === "string") { try { inner = JSON.parse(inner); } catch {} }
      if (inner && typeof inner === "object") unwrapped.push(inner as Record<string, unknown>);
    }
    unwrapped.push(c);
  }
  return unwrapped;
}

/**
 * Invokes the configured coding agent with promptText and returns the first
 * parsed JSON object that contains at least one of expectedKeys.
 * Returns null on any failure (bad exit code, no JSON, wrong shape).
 */
export async function invokeAgent(
  promptText: string,
  agentCfg: AgentConfig,
  expectedKeys: string[]
): Promise<Record<string, unknown> | null> {
  const template = agentCfg.prompt_template ?? '-p "{{prompt}}" --output-format json --bare';
  const extraArgs = buildAgentArgv(template, promptText);

  const shortTemplate = template.slice(0, 80);
  ui.write(`  ${pc.dim(`→ ${agentCfg.command} ${shortTemplate}...`)}`);

  let result: ReturnType<typeof spawnSync>;
  try {
    result = spawnSync([agentCfg.command, ...extraArgs], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env },
    });
  } catch (e) {
    ui.write(`  ${pc.yellow("⚠")} Failed to spawn ${agentCfg.command}: ${(e as Error).message}`);
    return null;
  }

  const stdout = result.stdout.toString().trim();
  const stderr = result.stderr.toString().trim();

  if (result.exitCode !== 0) {
    ui.write(`  ${pc.yellow("⚠")} Agent exited with code ${result.exitCode}.`);
    const out = stdout.replace(/sk-[a-zA-Z0-9_-]+/g, "sk-REDACTED").slice(0, 800);
    const err = stderr.replace(/sk-[a-zA-Z0-9_-]+/g, "sk-REDACTED").slice(0, 800);
    if (err) ui.write(`    stderr: ${err}`);
    if (out) ui.write(`    stdout: ${out}`);
    if (!err && !out) ui.write(`    (no output captured)`);
    return null;
  }

  // Clean markdown code fences that models often add
  let cleaned = stdout.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();

  // Extract candidates using shared helper
  const unwrapped = extractCandidates(cleaned);

  // Prefer first blob that has one of the expected keys
  for (const c of unwrapped) {
    if (expectedKeys.some((k) => k in c)) return c;
  }

  if (unwrapped[0]) return unwrapped[0];

  ui.write(`  ${pc.yellow("⚠")} Agent produced no usable JSON. stdout (700 chars): ${stdout.slice(0, 700)}`);
  return null;
}
