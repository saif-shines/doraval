import { guidedError } from "./out.js";

/** Frozen env sentinels. A set value means the caller is an agent CLI. */
export const AGENT_ENV_SENTINELS = [
  "CLAUDECODE",
  "GEMINI_CLI",
  "COPILOT_CLI",
  "PI_CODING_AGENT",
] as const;

/** True when the process looks like an agent or CI, not a human at a TTY. */
export function isAgentCaller(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): boolean {
  if (env.CI) return true;
  if (env.GIT_TERMINAL_PROMPT === "0") return true;
  return AGENT_ENV_SENTINELS.some((key) => Boolean(env[key]));
}

/** Detected agent must pass --yes / --dry-run / --apply to write. */
export function shouldBlockAgentWrite(opts: {
  agent: boolean;
  yes: boolean;
  dryRun: boolean;
  apply?: boolean;
  brief?: boolean;
}): boolean {
  if (!opts.agent) return false;
  return !opts.yes && !opts.dryRun && !opts.apply && !opts.brief;
}

/** Exit path for a blocked agent write. Caller still `exit(2)`. */
export function refuseAgentWrite(next: string): void {
  guidedError({
    context: "detected agent caller",
    problem: "this command writes files. Pass --yes or --dry-run.",
    solutions: ["Preview with --dry-run", "Apply with --yes"],
    next,
  });
}
