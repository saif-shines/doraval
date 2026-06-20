import { spawnSync } from "bun";

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

  let result: ReturnType<typeof spawnSync>;
  try {
    result = spawnSync([agentCfg.command, ...extraArgs], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env },
    });
  } catch (e) {
    return null;
  }

  const stdout = (result.stdout ?? "").toString().trim();
  const stderr = (result.stderr ?? "").toString().trim();

  if (result.exitCode !== 0) {
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

  return null;
}

/**
 * Runs the agent in "full session" mode for test/skill exercise runs.
 * Unlike invokeAgent (which forces JSON for judges), this aims to let the
 * agent perform real work following a skill + task.
 *
 * Returns the full stdout text (the "trace" or response).
 * Grok gets special headless flags (including --cwd for session isolation + updates.jsonl capture).
 * Other agents rely on the cwd passed to Bun.spawn; put agent-specific flags in prompt_template.
 */
export async function runAgentSession(
  promptText: string,
  agentCfg: AgentConfig,
  opts: { cwd?: string; alwaysApprove?: boolean; stream?: boolean } = {}
): Promise<string> {
  const { cwd, alwaysApprove = true, stream = true } = opts;
  const cmd = agentCfg.command || "grok";

  let args: string[] = [];

  const isGrok = /grok/i.test(cmd);
  if (isGrok) {
    // Use exact flags from Grok docs for headless scripting + real persisted session
    args = [
      "--no-auto-update",
      "-p", promptText,
      "--cwd", cwd || process.cwd(),
      "--always-approve",
      "--no-alt-screen",
      "--output-format", "plain",
    ];
  } else {
    // Fallback for other agents: use a non-JSON template if provided, else basic -p
    const template = agentCfg.prompt_template && !agentCfg.prompt_template.includes("output-format json")
      ? agentCfg.prompt_template
      : '-p "{{prompt}}"';
    args = buildAgentArgv(template, promptText);
    // If the agent declares a cwd_flag (e.g. "--cwd" or "-C"), pass the run directory so the *agent*
    // knows which repo/dir is the current project (in addition to the spawn cwd).
    // This is needed because many agent CLIs key their sessions, indexing, and context off the
    // explicit project directory, not just process PWD.
    if (cwd && agentCfg.cwd_flag) {
      args.push(agentCfg.cwd_flag, cwd);
    }
    // We intentionally do not default to --cwd or --always-approve for unknown agents.
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
