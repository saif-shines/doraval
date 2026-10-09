import { spawnSync } from "child_process";

export interface EntireCheckpoint {
  id: string;
  prompt: string | null;
}

export interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  code?: string;
}

export type SearchHit =
  | { ok: true; text: string }
  | { ok: false; message: string; suggestion: string };

const TRAILER = /^Entire-Checkpoint:[ \t]*(\S+)[ \t]*$/gm;

/** Human line when Entire is already enabled in this repo. */
export const ENTIRE_ENABLED_NOTICE =
  "Entire is enabled. Dora will use it while it checks this repo.";

function runStatus(cmd: string, args: string[], cwd: string): CommandResult {
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8", timeout: 5000 });
  const error = result.error as NodeJS.ErrnoException | undefined;
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    code: error?.code,
  };
}

/** True only when `entire status --json` reports enabled. Missing command means false. */
export function entireEnabled(
  repo: string,
  run: (cmd: string, args: string[], cwd: string) => CommandResult = runStatus,
): boolean {
  const result = run("entire", ["status", "--json"], repo);
  if (result.code === "ENOENT") return false;
  try {
    return (JSON.parse(result.stdout) as { enabled?: boolean }).enabled === true;
  } catch {
    return false;
  }
}

type GitRun = (repo: string, args: string[]) => string | null;

function git(repo: string, args: string[]): string | null {
  const result = spawnSync("git", ["-C", repo, "--no-pager", ...args], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout ?? "";
}

function promptSpec(id: string): string | null {
  if (/^[0-9a-f]{12}$/i.test(id)) {
    return `entire/checkpoints/v1:${id.slice(0, 2)}/${id.slice(2)}/1/prompt.txt`;
  }
  if (id.length === 26) {
    return `refs/entire/checkpoints/${id.slice(-2)}/${id}:1/prompt.txt`;
  }
  return null;
}

/** Latest commit that touched `file`. Null when that commit has no Entire trailer. */
export function readCheckpoint(repo: string, file: string, run: GitRun = git): EntireCheckpoint | null {
  const body = run(repo, ["log", "-1", "--format=%B", "--", file]);
  if (body == null) return null;
  const id = [...body.matchAll(TRAILER)][0]?.[1];
  if (!id) return null;
  const spec = promptSpec(id);
  const raw = spec ? run(repo, ["show", spec]) : null;
  const prompt = raw?.trim() ? raw.trim() : null;
  return { id, prompt };
}

/** True when the checkpoint prompt invokes this skill by slash command or SKILL.md path. */
export function promptInvokesSkill(prompt: string | null, skillName: string): boolean {
  if (!prompt || !skillName) return false;
  const slash = new RegExp(`(?:^|\\s)/${skillName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`);
  if (slash.test(prompt)) return true;
  return prompt.includes(`${skillName}/SKILL.md`);
}

function runEntire(cmd: string, args: string[], cwd: string): CommandResult {
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  const error = result.error as NodeJS.ErrnoException | undefined;
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    code: error?.code,
  };
}

/** Pass Entire's search text through. Does not parse Entire's JSON. */
export function searchPastWork(
  query: string,
  cwd: string,
  run: (cmd: string, args: string[], cwd: string) => CommandResult = runEntire,
): SearchHit {
  const result = run("entire", ["search", query], cwd);
  if (result.code === "ENOENT") {
    return {
      ok: false,
      message: "entire is not installed",
      suggestion: "Install Entire, then run dora search again",
    };
  }
  if (result.status !== 0) {
    return {
      ok: false,
      message: result.stderr.trim() || "entire search failed",
      suggestion: "entire search --help",
    };
  }
  return { ok: true, text: result.stdout };
}
