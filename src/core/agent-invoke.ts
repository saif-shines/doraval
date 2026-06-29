import { spawnSync } from "bun";
import { canUseApiJudge as _canUseApiJudge, invokeJudge as _invokeJudge } from "./llm-judge.js";

// Re-exports for backward compatibility during transition
export { canUseApiJudge } from "./llm-judge.js";
export { invokeJudge } from "./llm-judge.js";

export interface AgentConfig {
  command: string;
  prompt_template?: string;
  cwd_flag?: string;
}

let lastInvokeError = "";

export function getLastInvokeError(): string {
  return lastInvokeError;
}

function isClaudeCommand(command: string): boolean {
  return /claude/i.test(command);
}

function isGrokCommand(command: string): boolean {
  return /grok/i.test(command);
}

/**
 * Returns a sensible default prompt_template based on the agent command name.
 */
export function getDefaultPromptTemplate(command: string): string {
  const lower = (command || '').toLowerCase();

  if (lower.includes('claude')) {
    // --output-format json produces {"type":"result","result":"..."} wrapping the model's text.
    // extractCandidates unwraps result. --bare is intentionally omitted: it bypasses session auth.
    return '-p "{{prompt}}" --output-format json';
  }

  if (lower.includes('grok')) {
    return '-p "{{prompt}}" --no-auto-update --no-alt-screen --always-approve';
  }

  return '-p "{{prompt}}"';
}

/**
 * Returns agent config with prompt_template corrected for the actual CLI.
 * Strips cross-agent flags (e.g. Grok flags in a Claude template) and removes
 * unsupported cwd_flag for Claude (Claude has no --cwd; uses spawn cwd).
 */
export function resolveAgentConfig(agent: AgentConfig): AgentConfig {
  const command = agent.command || "";
  const desired = getDefaultPromptTemplate(command);
  let template = agent.prompt_template;

  if (template) {
    if (isClaudeCommand(command) && /--no-auto-update|--no-alt-screen|--always-approve/.test(template)) {
      template = desired;
    } else if (isGrokCommand(command) && /--output-format\s+json/.test(template)) {
      template = desired;
    }
  } else {
    template = desired;
  }

  let cwd_flag = agent.cwd_flag;
  if (isClaudeCommand(command) && cwd_flag) {
    cwd_flag = undefined;
  }

  return {
    command,
    prompt_template: template,
    ...(cwd_flag ? { cwd_flag } : {}),
  };
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

  function collectObjects(obj: any, out: any[] = []): any[] {
    if (!obj || typeof obj !== 'object') return out;
    if (Array.isArray(obj)) {
      for (const item of obj) collectObjects(item, out);
    } else {
      out.push(obj);
      for (const v of Object.values(obj)) collectObjects(v, out);
    }
    return out;
  }

  const nested: Record<string, unknown>[] = [];
  for (const c of [...candidates, ...unwrapped]) {
    collectObjects(c, nested);
  }

  return [...unwrapped, ...nested];
}

function formatAgentFailure(stdout: string, stderr: string, exitCode: number | null): string {
  if (stderr) return stderr;
  const candidates = extractCandidates(stdout);
  for (const c of candidates) {
    if (c.is_error === true && typeof c.result === "string" && c.result.trim()) {
      return c.result.trim();
    }
    if (typeof c.error === "string" && c.error.trim()) return c.error.trim();
  }
  if (stdout) return stdout;
  return `agent exited with code ${exitCode ?? "unknown"}`;
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
  lastInvokeError = "";
  const resolved = resolveAgentConfig(agentCfg);
  const template = resolved.prompt_template ?? getDefaultPromptTemplate(resolved.command);
  const extraArgs = buildAgentArgv(template, promptText);

  let result: ReturnType<typeof spawnSync>;
  try {
    result = spawnSync([resolved.command, ...extraArgs], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env },
    });
  } catch (e) {
    lastInvokeError = e instanceof Error ? e.message : "agent spawn failed";
    return null;
  }

  const stdout = (result.stdout ?? "").toString().trim();
  const stderr = (result.stderr ?? "").toString().trim();

  const cleaned = stdout.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();
  const unwrapped = extractCandidates(cleaned);

  // Prefer first blob that has one of the expected keys
  for (const c of unwrapped) {
    if (expectedKeys.some((k) => k in c)) return c;
  }

  if (result.exitCode !== 0) {
    lastInvokeError = formatAgentFailure(stdout, stderr, result.exitCode);
    return null;
  }

  if (unwrapped[0]) return unwrapped[0];

  lastInvokeError = formatAgentFailure(stdout, stderr, result.exitCode);
  return null;
}

/**
 * Runs the agent in "full session" mode for test/skill exercise runs.
 * Unlike invokeAgent (which forces JSON for judges), this aims to let the
 * agent perform real work following a skill + task.
 */
export async function runAgentSession(
  promptText: string,
  agentCfg: AgentConfig,
  opts: { cwd?: string; alwaysApprove?: boolean; stream?: boolean } = {}
): Promise<string> {
  const { cwd, alwaysApprove = true, stream = true } = opts;
  const resolved = resolveAgentConfig(agentCfg);
  const cmd = resolved.command || "grok";

  let args: string[] = [];

  const isGrok = isGrokCommand(cmd);
  if (isGrok) {
    args = [
      "--no-auto-update",
      "-p", promptText,
      "--cwd", cwd || process.cwd(),
      "--always-approve",
      "--no-alt-screen",
      "--output-format", "plain",
    ];
  } else {
    const template = (resolved.prompt_template && !resolved.prompt_template.includes("output-format json"))
      ? resolved.prompt_template
      : '-p "{{prompt}}"';
    args = buildAgentArgv(template, promptText);

    if (cwd && resolved.cwd_flag) {
      args.push(resolved.cwd_flag, cwd);
    }

    if (alwaysApprove && isClaudeCommand(cmd)) {
      args.push("--dangerously-skip-permissions");
    }
  }

  const proc = Bun.spawn([cmd, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
    cwd: cwd || process.cwd(),
  });

  let stdout = "";
  const decoder = new TextDecoder();
  const reader = proc.stdout.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      stdout += text;
      if (stream) {
        process.stdout.write(text);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    if (stderr && !stream) process.stderr.write(stderr);
    return `ERROR (exit ${exitCode}):\n${stderr || stdout}`;
  }

  return stdout.trim() || "(no output)";
}


