import { spawnSync } from "bun";
import type { Routine } from "./routine.js";

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

export function onePassArgs(
  routine: Pick<Routine, "prompt"> & Partial<Pick<Routine, "maxTick" | "skillsRun">>,
): string[] {
  const args = [
    "chat",
    "--toolsets",
    `mcp-${MCP_SERVER}`,
    "--oneshot",
    "--run-budget",
    String(hermesTimeoutSec(routine.maxTick ?? "10m")),
  ];
  for (const skill of routine.skillsRun ?? []) {
    args.push("--skills", skill);
  }
  args.push("-q", routine.prompt.trim());
  return args;
}

export function onePassCommand(
  routine: Pick<Routine, "prompt"> & Partial<Pick<Routine, "maxTick" | "skillsRun">>,
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

export function bootArgs(routine: Routine): string[][] {
  const create = [
    "cron",
    "create",
    hermesSchedule(routine.interval ?? "1h"),
    routine.prompt.trim(),
    "--name",
    routine.slug,
  ];
  for (const skill of routine.skillsRun) {
    create.push("--skill", skill);
  }
  return [
    ["gateway", "install"],
    ["gateway", "start"],
    ["mcp", "add", MCP_SERVER, "--url", routine.mcpUrl, "--auth", "oauth"],
    ["mcp", "test", MCP_SERVER],
    ["tools", "enable", `mcp-${MCP_SERVER}`, "--platform", "cron"],
    create,
  ];
}

export function pauseArgs(slug: string): string[] {
  return ["cron", "pause", slug];
}

export function resumeArgs(slug: string): string[] {
  return ["cron", "resume", slug];
}

export function parseCronList(stdout: string): Map<string, "running" | "paused"> {
  const out = new Map<string, "running" | "paused">();
  for (const line of stdout.split("\n")) {
    const paused = /\[paused\]/i.test(line);
    const active = /\[active\]/i.test(line);
    if (!paused && !active) continue;
    const m = line.match(/\[(?:paused|active)\]\s+(\S+)/i);
    if (m) out.set(m[1]!, paused ? "paused" : "running");
  }
  return out;
}

export function listJobStates(run: HermesRun = defaultHermesRun): Map<string, "running" | "paused"> {
  const r = run(["cron", "list"]);
  if (r.exitCode !== 0) return new Map();
  return parseCronList(r.stdout);
}
