import { spawnSync, YAML } from "bun";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
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

type Inference = Partial<Pick<Routine, "model" | "provider" | "reasoningEffort">>;

function pushPin(args: string[], routine: Inference, modelFlag: string, empty: boolean): void {
  if (empty ? routine.model !== undefined : Boolean(routine.model)) {
    args.push(modelFlag, routine.model ?? "");
  }
  if (empty ? routine.provider !== undefined : Boolean(routine.provider)) {
    args.push("--provider", routine.provider ?? "");
  }
}

export function onePassArgs(
  routine: Pick<Routine, "prompt" | "slug"> &
    Partial<Pick<Routine, "maxTick" | "skillsRun" | "mcpUrl">> &
    Inference,
): string[] {
  const args = ["chat"];
  args.push(
    "--oneshot",
    "--run-budget",
    String(hermesTimeoutSec(routine.maxTick ?? "10m")),
    "--reasoning",
    routine.reasoningEffort ?? "xhigh",
  );
  pushPin(args, routine, "-m", false);
  for (const skill of routine.skillsRun ?? []) {
    args.push("--skills", skill);
  }
  args.push("-q", hermesPrompt(routine.prompt, routine.slug));
  return args;
}

export function onePassCommand(
  routine: Pick<Routine, "prompt" | "slug"> & Partial<Pick<Routine, "maxTick" | "skillsRun">> & Inference,
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
    "--reasoning-effort",
    routine.reasoningEffort ?? "xhigh",
  ];
  pushPin(create, routine, "--model", false);
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

export function editArgs(routine: Routine, jobId: string): string[] {
  const args = [
    "cron",
    "edit",
    jobId,
    "--schedule",
    hermesSchedule(routine.interval ?? "1h"),
    "--prompt",
    hermesPrompt(routine.prompt, routine.slug),
    "--reasoning-effort",
    routine.reasoningEffort ?? "xhigh",
  ];
  pushPin(args, routine, "--model", true);
  if (routine.skillsRun.length === 0) args.push("--clear-skills");
  else for (const skill of routine.skillsRun) args.push("--skill", skill);
  return args;
}

export function parseCreatedJobId(text: string): string | undefined {
  return text.match(/Created job:\s*([0-9a-f]{12})/i)?.[1];
}

export function pauseArgs(jobId: string): string[] {
  return ["cron", "pause", jobId];
}

export function resumeArgs(jobId: string): string[] {
  return ["cron", "resume", jobId];
}

export function runsArgs(jobId: string): string[] {
  return ["cron", "runs", jobId];
}

export function removeArgs(jobId: string): string[] {
  return ["cron", "remove", jobId];
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

export const HERMES_REASONING = ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"] as const;

export type HermesProviderModels = { name: string; models: string[] };

export type HermesCatalog = {
  defaultModel: string;
  defaultProvider: string;
  reasoning: readonly string[];
  providers: HermesProviderModels[];
};

export function hermesDir(home: string): string {
  const env = process.env.HERMES_HOME?.trim();
  return env || join(home, ".hermes");
}

export function parseProviderModelsCache(raw: unknown): HermesProviderModels[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const out: HermesProviderModels[] = [];
  for (const [name, rec] of Object.entries(raw as Record<string, unknown>)) {
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) continue;
    const models = (rec as { models?: unknown }).models;
    if (!Array.isArray(models)) continue;
    out.push({
      name,
      models: models.filter((m): m is string => typeof m === "string" && Boolean(m.trim())),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function parseHermesModelConfig(raw: unknown): { defaultModel: string; defaultProvider: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { defaultModel: "", defaultProvider: "" };
  const model = (raw as { model?: unknown }).model;
  if (typeof model === "string") return { defaultModel: model.trim(), defaultProvider: "" };
  if (!model || typeof model !== "object" || Array.isArray(model)) return { defaultModel: "", defaultProvider: "" };
  const rec = model as Record<string, unknown>;
  return {
    defaultModel: typeof rec.default === "string" ? rec.default.trim() : "",
    defaultProvider: typeof rec.provider === "string" ? rec.provider.trim() : "",
  };
}

export function readHermesCatalog(home: string): HermesCatalog {
  const dir = hermesDir(home);
  let defaultModel = "";
  let defaultProvider = "";
  let providers: HermesProviderModels[] = [];
  const cfgPath = join(dir, "config.yaml");
  if (existsSync(cfgPath)) {
    try {
      const parsed = parseHermesModelConfig(YAML.parse(readFileSync(cfgPath, "utf8")));
      defaultModel = parsed.defaultModel;
      defaultProvider = parsed.defaultProvider;
    } catch {
      // unreadable config stays empty
    }
  }
  const cachePath = join(dir, "provider_models_cache.json");
  if (existsSync(cachePath)) {
    try {
      providers = parseProviderModelsCache(JSON.parse(readFileSync(cachePath, "utf8")));
    } catch {
      // unreadable cache stays empty
    }
  }
  return { defaultModel, defaultProvider, reasoning: HERMES_REASONING, providers };
}

export function formatHermesCatalog(cat: HermesCatalog): string[] {
  const lines = [
    `default     ${cat.defaultModel || "—"}`,
    `provider    ${cat.defaultProvider || "—"}`,
    `reasoning   ${cat.reasoning.join(", ")}`,
  ];
  if (cat.providers.length === 0) {
    lines.push("", "No provider list on disk. Run hermes model once, then retry.");
    return lines;
  }
  lines.push("");
  for (const p of cat.providers) {
    lines.push(p.name);
    for (const m of p.models) lines.push(`  ${m}`);
  }
  return lines;
}
