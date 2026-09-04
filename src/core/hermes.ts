import { spawnSync } from "bun";
import { usesMcp, type Routine } from "./routine.js";

export const MCP_SERVER = "scalekit";

export type HermesRun = (args: string[]) => { exitCode: number; stdout: string; stderr: string };

export function defaultHermesRun(args: string[]): { exitCode: number; stdout: string; stderr: string } {
  const r = spawnSync(["hermes", ...args], { stdout: "pipe", stderr: "pipe" });
  return { exitCode: r.exitCode ?? 1, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

export function hermesSchedule(interval: string): string {
  if (/^every\s/i.test(interval) || interval.includes("*")) return interval;
  return `every ${interval}`;
}

export function hermesTimeoutSec(maxTick: string): number {
  const m = maxTick.trim().match(/^(\d+)\s*(s|m|h)?$/i);
  if (!m) return 600;
  const n = Number(m[1]);
  const u = (m[2] ?? "s").toLowerCase();
  if (u === "h") return n * 3600;
  if (u === "m") return n * 60;
  return n;
}

function hermesPrompt(prompt: string, slug: string): string {
  return `${prompt.trim()}\n\nHuman-visible messages end with: Sent by pocket agent ${slug}`;
}

export function onePassArgs(
  routine: Pick<Routine, "prompt" | "slug"> & Partial<Pick<Routine, "maxTick" | "skillsRun" | "mcpUrl">>,
): string[] {
  const args = ["chat"];
  if (usesMcp(routine.mcpUrl ?? "")) args.push("--toolsets", `mcp-${MCP_SERVER}`);
  args.push("--oneshot", "--run-budget", String(hermesTimeoutSec(routine.maxTick ?? "10m")));
  for (const skill of routine.skillsRun ?? []) {
    args.push("--skills", skill);
  }
  args.push("-q", hermesPrompt(routine.prompt, routine.slug));
  return args;
}

export function onePassCommand(
  routine: Pick<Routine, "prompt" | "slug"> & Partial<Pick<Routine, "maxTick" | "skillsRun">>,
): string {
  const args = onePassArgs(routine);
  return ["hermes", ...args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a))].join(" ");
}

export function loginArgs(): string[] {
  return ["mcp", "login", MCP_SERVER];
}

export function loginCommand(): string {
  return `hermes ${loginArgs().join(" ")}`;
}

export function watchCommands(): string[] {
  return ["hermes cron list", "hermes cron runs", "hermes logs", "hermes dashboard"];
}

export function bootArgs(routine: Routine): string[][] {
  const create = [
    "cron",
    "create",
    hermesSchedule(routine.interval ?? "1h"),
    hermesPrompt(routine.prompt, routine.slug),
    "--name",
    routine.slug,
  ];
  for (const skill of routine.skillsRun) {
    create.push("--skill", skill);
  }
  const cmds: string[][] = [
    ["gateway", "install"],
    ["gateway", "start"],
  ];
  if (usesMcp(routine.mcpUrl)) {
    cmds.push(
      ["mcp", "add", MCP_SERVER, "--url", routine.mcpUrl, "--auth", "oauth"],
      ["mcp", "test", MCP_SERVER],
      ["tools", "enable", `mcp-${MCP_SERVER}`, "--platform", "cron"],
    );
  }
  cmds.push(create);
  return cmds;
}

export function pauseArgs(jobId: string): string[] {
  return ["cron", "pause", jobId];
}

export function resumeArgs(jobId: string): string[] {
  return ["cron", "resume", jobId];
}

export type CronJob = {
  id: string;
  name: string;
  state: "running" | "paused";
  lastRun?: string;
};

export function parseCronList(stdout: string): CronJob[] {
  const jobs: CronJob[] = [];
  let cur: CronJob | undefined;
  const flush = () => {
    if (cur?.name) jobs.push(cur);
    cur = undefined;
  };
  for (const line of stdout.split("\n")) {
    const head = line.match(/^\s*([0-9a-f]{12})\s+\[(active|paused)\]/i);
    if (head) {
      flush();
      cur = { id: head[1]!, name: "", state: head[2]!.toLowerCase() === "paused" ? "paused" : "running" };
      continue;
    }
    if (!cur) continue;
    const name = line.match(/^\s*Name:\s+(\S+)/i);
    if (name) {
      cur.name = name[1]!;
      continue;
    }
    const last = line.match(/^\s*Last run:\s+(\S+)/i);
    if (last && last[1] && !/^(never|—|-)$/i.test(last[1])) cur.lastRun = last[1];
  }
  flush();
  return jobs;
}

export function listCronJobs(run: HermesRun = defaultHermesRun): CronJob[] | null {
  const r = run(["cron", "list"]);
  if (r.exitCode !== 0) return null;
  return parseCronList(r.stdout);
}
