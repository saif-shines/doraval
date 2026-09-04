import { existsSync, readFileSync } from "fs";
import { spawnSync } from "bun";
import { homedir } from "os";
import { join } from "path";
import { defineCommand } from "citty";
import { isAgentCaller, refuseAgentWrite, shouldBlockAgentWrite } from "../agent-detect.js";
import {
  listRoutineSlugs,
  openRoutine,
  readDefaultMcpUrl,
  readRoutine,
  writeDefaultMcpUrl,
  usesMcp,
  writeRoutine,
  writeRoutineJobId,
} from "../../core/routine.js";
import {
  bootArgs,
  defaultHermesRun,
  editArgs,
  listCronJobs,
  loginCommand,
  MCP_SERVER,
  onePassArgs,
  onePassCommand,
  parseCreatedJobId,
  pauseArgs,
  resumeArgs,
  runsArgs,
  watchCommands,
  type CronJob,
} from "../../core/hermes.js";
import { ui, resolveOutputMode, outJson, summaryLine, guidedError, nextAction, type OutputMode } from "../out.js";
import { exit } from "../render/exit.js";
import { promptSelect } from "../prompt.js";

function hermesInstalled(): boolean {
  try {
    return spawnSync(["which", "hermes"], { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
  } catch {
    return false;
  }
}

function grillSkillDir(): string {
  const here = join(import.meta.dir, "../../../skills/grilling-for-routine");
  if (existsSync(join(here, "SKILL.md"))) return here;
  const cwd = join(process.cwd(), "skills/grilling-for-routine");
  if (existsSync(join(cwd, "SKILL.md"))) return cwd;
  throw new Error("grilling-for-routine skill not found");
}

function splitDirs(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function printHermesInstall(): void {
  guidedError({
    context: "dora harness needs Hermes to apply, pause, resume, or print logs",
    problem: "Hermes is not installed",
    solutions: [
      "Linux / macOS / WSL2: curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash",
      "Windows: iex (irm https://hermes-agent.nousresearch.com/install.ps1)",
    ],
    next: "Reload the shell, then retry. Dora does not install Hermes.",
    docUrl: "https://hermes-agent.nousresearch.com/docs/",
  });
}

function printGrill(home: string): void {
  const dir = grillSkillDir();
  ui.blank();
  ui.heading("dora harness new");
  ui.blank();
  ui.info("  Start: ask-dora");
  ui.info(`  Grill: ${dir}`);
  ui.info("  Hermes is the agent. Read SKILL.md. Interview the teammate.");
  ui.blank();
  ui.info("  Gate: skills to run, skills to refer to, MCP URL.");
  ui.info("  Order: interview, write the unattended prompt, one pass, then save.");
  const def = readDefaultMcpUrl(home);
  if (def) ui.info(`  Default MCP URL: ${def}`);
  ui.blank();
  nextAction(
    "dora harness new --accept --yes --slug <slug> --prompt-file <prompt.md> --mcp-url <url> --skills-run <dir> --skills-refer <dir>",
  );
  ui.blank();
}

function printMcpNext(): void {
  nextAction(loginCommand());
  ui.dim("  If a refresh token dies, run that login again.");
  ui.dim("  If the Scalekit connected account is dead, open the provider link again.");
  printWatch();
}

function printWatch(): void {
  for (const cmd of watchCommands()) nextAction(cmd);
}

function mcpNotReady(detail?: string): Error {
  return new Error(
    [detail, `Scalekit MCP is not ready. Run: ${loginCommand()}`, "If the Scalekit connected account is dead, open the provider link again."]
      .filter(Boolean)
      .join("\n"),
  );
}

function readJobs(): CronJob[] {
  if (!hermesInstalled()) return [];
  return listCronJobs() ?? [];
}

function resolveJob(home: string, slug: string, jobs: CronJob[]): CronJob | undefined {
  const routine = readRoutine(home, slug);
  if (routine.jobId) return jobs.find((j) => j.id === routine.jobId);
  const hit = jobs.find((j) => j.name === slug);
  if (hit) writeRoutineJobId(home, slug, hit.id);
  return hit;
}

type ListRow = { slug: string; state: "running" | "paused" | "none"; interval: string; lastRun: string | null };

function listRow(home: string, slug: string, jobs: CronJob[]): ListRow {
  const routine = readRoutine(home, slug);
  const job = resolveJob(home, slug, jobs);
  return { slug, state: job?.state ?? "none", interval: routine.interval ?? "1h", lastRun: job?.lastRun ?? null };
}

type ShowCard = ListRow & { maxTick: string; mcp: "yes" | "none"; folder: string; jobId: string | null };

function showCard(home: string, slug: string, jobs: CronJob[]): ShowCard {
  const row = listRow(home, slug, jobs);
  const routine = readRoutine(home, slug);
  return {
    ...row,
    maxTick: routine.maxTick ?? "10m",
    mcp: usesMcp(routine.mcpUrl) ? "yes" : "none",
    folder: routine.dir,
    jobId: routine.jobId ?? null,
  };
}

function printTable(rows: ListRow[]): void {
  const data = rows.map((r) => [r.slug, r.state, r.interval, r.lastRun ?? "—"]);
  const headers = ["slug", "state", "interval", "last run"];
  const widths = headers.map((h, i) => Math.max(h.length, ...data.map((row) => row[i]!.length)));
  const fmt = (row: string[]) => "  " + row.map((c, i) => c.padEnd(widths[i]!)).join("  ");
  ui.info(fmt(headers));
  for (const row of data) ui.info(fmt(row));
}

function printCard(card: ShowCard): void {
  const lines: [string, string][] = [
    ["slug", card.slug],
    ["state", card.state],
    ["interval", card.interval],
    ["max tick", card.maxTick],
    ["mcp", card.mcp],
    ["last run", card.lastRun ?? "—"],
    ["folder", card.folder],
  ];
  const w = Math.max(...lines.map(([k]) => k.length));
  for (const [k, v] of lines) ui.info(`  ${k.padEnd(w)}  ${v}`);
}

async function pickSlug(raw: unknown, verb: string): Promise<string | undefined> {
  const given = String(raw ?? "").trim();
  if (given) return given;
  const slugs = listRoutineSlugs(homedir());
  ui.blank();
  ui.heading(`dora harness ${verb}`);
  ui.blank();
  if (slugs.length === 0) {
    summaryLine("No routines.");
    nextAction("dora harness new");
    ui.blank();
    await exit(2);
    return;
  }
  for (const s of slugs) ui.info(`  ${s}`);
  ui.blank();
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    nextAction(`dora harness ${verb} ${slugs[0]}`);
    ui.blank();
    await exit(2);
    return;
  }
  return promptSelect(
    "Which routine?",
    slugs.map((s) => ({ value: s, label: s })),
    slugs[0]!,
  );
}

async function runShow(home: string, slug: string, mode: OutputMode): Promise<void> {
  let card: ShowCard;
  try {
    card = showCard(home, slug, readJobs());
  } catch (e) {
    ui.fail(e instanceof Error ? e.message : String(e));
    nextAction("dora harness list");
    await exit(1);
    return;
  }
  if (mode.format === "json") {
    outJson(card);
    await exit(0);
    return;
  }
  ui.blank();
  ui.heading("dora harness show");
  ui.blank();
  printCard(card);
  ui.blank();
  nextAction("dora harness list");
  ui.blank();
  await exit(0);
}

export const harnessNew = defineCommand({
  meta: {
    name: "new",
    description: [
      "Start ask-dora / grilling-for-routine and create a routine",
      "",
      "Bare new starts ask-dora, which loads grilling-for-routine.",
      "Write the folder only after one pass, or after --accept of the printed command.",
    ].join("\n"),
  },
  args: {
    slug: { type: "string", description: "Routine slug" },
    prompt: { type: "string", description: "Unattended prompt text" },
    "prompt-file": { type: "string", description: "Read the unattended prompt from this file" },
    "mcp-url": { type: "string", description: "Scalekit Agent Gateway MCP URL" },
    "skills-run": { type: "string", description: "Comma-separated skill directories to run" },
    "skills-refer": { type: "string", description: "Comma-separated skill directories to refer to" },
    interval: { type: "string", description: "Schedule interval (default 1h)" },
    "max-tick": { type: "string", description: "Max tick (default 10m)" },
    accept: { type: "boolean", description: "Accept the printed one-pass command and write the folder", default: false },
    "run-one-pass": { type: "boolean", description: "Run the one-pass command when Hermes is present", default: false },
    yes: { type: "boolean", description: "Write without prompting (agents)", default: false, alias: "y" },
    "dry-run": { type: "boolean", description: "Print the one-pass command, write nothing", default: false },
  },
  async run({ args }) {
    const home = homedir();
    const accept = Boolean(args.accept);
    const dryRun = Boolean(args["dry-run"]);
    const runPass = Boolean(args["run-one-pass"]);
    const yes = Boolean(args.yes);
    const slug = typeof args.slug === "string" ? args.slug.trim() : "";

    if (!accept && !runPass && !dryRun && !slug) {
      printGrill(home);
      await exit(0);
      return;
    }

    const promptFile = typeof args["prompt-file"] === "string" ? args["prompt-file"] : "";
    const promptText = typeof args.prompt === "string" ? args.prompt : promptFile ? readFileSync(promptFile, "utf8") : "";
    const mcpUrlRaw = (typeof args["mcp-url"] === "string" ? args["mcp-url"] : readDefaultMcpUrl(home) ?? "").trim();
    const mcpUrl = mcpUrlRaw.toLowerCase() === "none" ? "" : mcpUrlRaw;
    const skillsRun = splitDirs(args["skills-run"] as string | undefined);
    const skillsRefer = splitDirs(args["skills-refer"] as string | undefined);

    if (!slug || !promptText.trim()) {
      guidedError({
        context: "dora harness new writes a routine only after the grill gate",
        problem: "Missing slug or prompt",
        solutions: [
          "Finish the grill. Collect skills to run, skills to refer to, and the MCP URL or none.",
          "Then pass --slug, --prompt-file, and --mcp-url (or --mcp-url none).",
        ],
        next: "dora harness new",
      });
      await exit(2);
      return;
    }

    const draft = {
      slug,
      prompt: promptText,
      skillsRun,
      skillsRefer,
      mcpUrl,
      interval: typeof args.interval === "string" ? args.interval : undefined,
      maxTick: typeof args["max-tick"] === "string" ? args["max-tick"] : undefined,
    };
    const cmd = onePassCommand(draft);
    ui.blank();
    ui.heading("One-pass command");
    ui.blank();
    ui.info(`  ${cmd}`);
    ui.blank();

    const hasHermes = hermesInstalled();
    if (!hasHermes) {
      printHermesInstall();
      if (runPass) {
        ui.fail("Hermes is not installed. Dora will not fake a test run.");
        await exit(2);
        return;
      }
    } else {
      let shouldRun = runPass;
      if (!shouldRun && !dryRun && process.stdin.isTTY && process.stderr.isTTY) {
        const ans = await promptSelect("Run the one-pass now?", [
          { value: "yes", label: "Run it" },
          { value: "no", label: "Print only" },
        ], "no");
        shouldRun = ans === "yes";
      }
      if (shouldRun) {
        if (usesMcp(mcpUrl)) {
          const added = defaultHermesRun(["mcp", "add", MCP_SERVER, "--url", mcpUrl, "--auth", "oauth"]);
          if (added.exitCode !== 0) {
            const tested = defaultHermesRun(["mcp", "test", MCP_SERVER]);
            if (tested.exitCode !== 0) {
              ui.fail(mcpNotReady(added.stderr.trim()).message);
              printMcpNext();
              await exit(2);
              return;
            }
          }
        }
        const r = defaultHermesRun(onePassArgs(draft));
        if (r.exitCode !== 0) {
          ui.fail(r.stderr.trim() || "One-pass command failed.");
          if (usesMcp(mcpUrl)) printMcpNext();
          else printWatch();
          await exit(2);
          return;
        }
      }
    }

    if (!accept || dryRun) {
      nextAction("dora harness new --accept --yes --slug " + slug);
      ui.blank();
      await exit(0);
      return;
    }

    if (shouldBlockAgentWrite({ agent: isAgentCaller(), yes, dryRun })) {
      refuseAgentWrite("dora harness new --accept --yes");
      await exit(2);
      return;
    }

    try {
      const dir = writeRoutine(home, draft, { cwd: process.cwd() });
      if (usesMcp(mcpUrl) && !readDefaultMcpUrl(home)) writeDefaultMcpUrl(home, mcpUrl);
      ui.info(`  Wrote ${dir}`);
      ui.blank();
      await exit(0);
    } catch (e) {
      ui.fail(e instanceof Error ? e.message : String(e));
      nextAction("dora harness open " + slug);
      await exit(2);
    }
  },
});

function formatHermesCmd(args: string[]): string {
  return ["hermes", ...args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a))].join(" ");
}

function runHermesCmds(cmds: string[][]): string {
  let lastOut = "";
  for (const args of cmds) {
    const r = defaultHermesRun(args);
    lastOut = r.stdout + r.stderr;
    if (args[0] === "mcp" && args[1] === "add" && r.exitCode !== 0) {
      const tested = defaultHermesRun(["mcp", "test", MCP_SERVER]);
      if (tested.exitCode !== 0) throw mcpNotReady(r.stderr.trim());
      continue;
    }
    if (args[0] === "mcp" && args[1] === "test" && r.exitCode !== 0) {
      throw mcpNotReady(r.stderr.trim());
    }
    if (r.exitCode !== 0) {
      throw new Error(r.stderr.trim() || `hermes ${args.join(" ")} failed`);
    }
  }
  return lastOut;
}

const WRITE_ARGS = {
  slug: { type: "positional" as const, description: "Routine slug", required: false },
  yes: { type: "boolean" as const, description: "Write without prompting (agents)", default: false, alias: "y" },
  "dry-run": { type: "boolean" as const, description: "Print the Runtime commands, write nothing", default: false },
  format: { type: "string" as const, description: "Output format: table | json", default: "table" },
  json: { type: "boolean" as const, description: "Alias for --format json", default: false },
  ci: { type: "boolean" as const, description: "Machine mode (implies --format json)", default: false },
};

async function runApply(slug: string, args: { yes?: boolean; "dry-run"?: boolean; format?: string; json?: boolean; ci?: boolean }): Promise<void> {
  if (!hermesInstalled()) {
    printHermesInstall();
    await exit(2);
    return;
  }
  const dryRun = Boolean(args["dry-run"]);
  const yes = Boolean(args.yes);
  if (shouldBlockAgentWrite({ agent: isAgentCaller(), yes, dryRun })) {
    refuseAgentWrite("dora harness apply <slug> --yes");
    await exit(2);
    return;
  }
  const home = homedir();
  const mode = resolveOutputMode(args);
  let routine;
  try {
    routine = readRoutine(home, slug);
  } catch (e) {
    ui.fail(e instanceof Error ? e.message : String(e));
    nextAction("dora harness list");
    await exit(1);
    return;
  }
  const jobs = listCronJobs();
  let action: "create" | "edit" = "create";
  let jobId: string | undefined;
  const live = routine.jobId && jobs?.some((j) => j.id === routine.jobId) ? routine.jobId : undefined;
  const named = jobs?.find((j) => j.name === slug);
  if (live) {
    action = "edit";
    jobId = live;
  } else if (named) {
    action = "edit";
    jobId = named.id;
    if (!dryRun) writeRoutineJobId(home, slug, named.id);
  } else if (routine.jobId && jobs === null) {
    action = "edit";
    jobId = routine.jobId;
  }
  const cmds = action === "edit" && jobId ? [editArgs(routine, jobId)] : bootArgs(routine);
  if (dryRun) {
    for (const c of cmds) ui.info(`  ${formatHermesCmd(c)}`);
    if (mode.format === "json") outJson({ slug, action, dryRun: true });
    nextAction(`dora harness apply ${slug} --yes`);
    ui.blank();
    await exit(0);
    return;
  }
  try {
    const out = runHermesCmds(cmds);
    if (action === "create") {
      const created = parseCreatedJobId(out);
      if (!created) throw new Error("Hermes did not print a job id.");
      writeRoutineJobId(home, slug, created);
      jobId = created;
    }
    if (mode.format === "json") {
      outJson({ slug, action, jobId: jobId ?? null });
      await exit(0);
      return;
    }
    ui.info(`  Applied ${slug}. Dora does not own the timer.`);
    ui.dim("  Laptop close is host sleep, not pause. Due jobs can fire on wake if the job is not paused.");
    if (usesMcp(routine.mcpUrl)) printMcpNext();
    else printWatch();
    nextAction(`dora harness show ${slug}`);
    ui.blank();
    await exit(0);
  } catch (e) {
    ui.fail(e instanceof Error ? e.message : String(e));
    if (usesMcp(routine.mcpUrl)) printMcpNext();
    else printWatch();
    nextAction("dora harness list");
    await exit(1);
  }
}

export const harnessApply = defineCommand({
  meta: {
    name: "apply",
    description: [
      "Push the routine folder onto the Runtime job",
      "",
      "Creates the job on first apply. Later apply edits that job.",
      "boot is the same command. There is no set verb.",
    ].join("\n"),
  },
  args: WRITE_ARGS,
  async run({ args }) {
    const slug = await pickSlug(args.slug, "apply");
    if (!slug) return;
    await runApply(slug, args);
  },
});

export const harnessBoot = defineCommand({
  meta: {
    name: "boot",
    description: [
      "Alias of apply",
      "",
      "Starts the Hermes gateway if needed, then creates or edits the Runtime job.",
      "Laptop close is host sleep, not pause. Due jobs can fire on wake if the job is not paused.",
    ].join("\n"),
  },
  args: WRITE_ARGS,
  async run({ args }) {
    const slug = await pickSlug(args.slug, "boot");
    if (!slug) return;
    await runApply(slug, args);
  },
});

const READ_ARGS = {
  format: { type: "string" as const, description: "Output format: table | json", default: "table" },
  json: { type: "boolean" as const, description: "Alias for --format json", default: false },
  ci: { type: "boolean" as const, description: "Machine mode (implies --format json)", default: false },
};

async function runPauseResume(verb: "pause" | "resume", slug: string, mode: OutputMode): Promise<void> {
  if (!hermesInstalled()) {
    printHermesInstall();
    await exit(2);
    return;
  }
  const home = homedir();
  let jobId: string | undefined;
  try {
    jobId = liveJobId(home, slug);
  } catch (e) {
    ui.fail(e instanceof Error ? e.message : String(e));
    nextAction("dora harness list");
    await exit(1);
    return;
  }
  if (!jobId) {
    ui.fail("That job is gone.");
    nextAction("dora harness list");
    await exit(1);
    return;
  }
  const r = defaultHermesRun(verb === "pause" ? pauseArgs(jobId) : resumeArgs(jobId));
  if (r.exitCode !== 0) {
    ui.fail(r.stderr.trim() || `${verb === "pause" ? "Pause" : "Resume"} failed.`);
    nextAction("dora harness list");
    await exit(1);
    return;
  }
  if (mode.format === "json") {
    outJson({ slug, state: verb === "pause" ? "paused" : "running" });
    await exit(0);
    return;
  }
  ui.info(
    verb === "pause"
      ? `  Paused ${slug}. Later ticks skip. A pass that already started may finish.`
      : `  Resumed ${slug}.`,
  );
  printWatch();
  nextAction(verb === "pause" ? `dora harness resume ${slug}` : "dora harness list");
  ui.blank();
  await exit(0);
}

export const harnessPause = defineCommand({
  meta: {
    name: "pause",
    description: [
      "Pause a routine",
      "",
      "Pauses that Hermes cron job only. The gateway stays up.",
      "Laptop close is host sleep, not pause.",
    ].join("\n"),
  },
  args: {
    slug: { type: "positional", description: "Routine slug", required: false },
    ...READ_ARGS,
  },
  async run({ args }) {
    const slug = await pickSlug(args.slug, "pause");
    if (!slug) return;
    await runPauseResume("pause", slug, resolveOutputMode(args));
  },
});

export const harnessResume = defineCommand({
  meta: { name: "resume", description: "Resume a paused routine" },
  args: {
    slug: { type: "positional", description: "Routine slug", required: false },
    ...READ_ARGS,
  },
  async run({ args }) {
    const slug = await pickSlug(args.slug, "resume");
    if (!slug) return;
    await runPauseResume("resume", slug, resolveOutputMode(args));
  },
});

function liveJobId(home: string, slug: string): string | undefined {
  const routine = readRoutine(home, slug);
  const jobs = listCronJobs();
  if (routine.jobId) {
    if (jobs && !jobs.some((j) => j.id === routine.jobId)) return undefined;
    return routine.jobId;
  }
  const hit = jobs?.find((j) => j.name === slug);
  if (!hit) return undefined;
  writeRoutineJobId(home, slug, hit.id);
  return hit.id;
}

async function runLogs(slug: string, mode: OutputMode): Promise<void> {
  if (!hermesInstalled()) {
    printHermesInstall();
    await exit(2);
    return;
  }
  const home = homedir();
  let jobId: string | undefined;
  try {
    jobId = liveJobId(home, slug);
  } catch (e) {
    ui.fail(e instanceof Error ? e.message : String(e));
    nextAction("dora harness list");
    await exit(1);
    return;
  }
  if (!jobId) {
    ui.fail("That job is gone.");
    nextAction("dora harness list");
    await exit(1);
    return;
  }
  const r = defaultHermesRun(runsArgs(jobId));
  if (r.exitCode !== 0) {
    ui.fail(r.stderr.trim() || "Logs failed.");
    nextAction("dora harness list");
    await exit(1);
    return;
  }
  if (mode.format === "json") {
    outJson({ slug, jobId, output: r.stdout });
    await exit(0);
    return;
  }
  ui.blank();
  ui.heading("dora harness logs");
  ui.blank();
  const text = r.stdout.replace(/\n$/, "");
  if (text) {
    for (const line of text.split("\n")) ui.info(line);
  } else {
    summaryLine("No runs.");
  }
  ui.blank();
  nextAction(`dora harness show ${slug}`);
  ui.blank();
  await exit(0);
}

export const harnessLogs = defineCommand({
  meta: {
    name: "logs",
    description: [
      "Print run history for one routine",
      "",
      "Uses the Runtime per-job runs command for the stored id.",
      "Does not dump the global Runtime agent log.",
    ].join("\n"),
  },
  args: {
    slug: { type: "positional", description: "Routine slug", required: false },
    ...READ_ARGS,
  },
  async run({ args }) {
    const slug = await pickSlug(args.slug, "logs");
    if (!slug) return;
    await runLogs(slug, resolveOutputMode(args));
  },
});

export const harnessShow = defineCommand({
  meta: {
    name: "show",
    description: [
      "Show one routine card",
      "",
      "Prints slug, state, interval, max tick, MCP, last run, and folder.",
      "Hex job id only in --json. Use open to read files.",
    ].join("\n"),
  },
  args: {
    slug: { type: "positional", description: "Routine slug", required: false },
    ...READ_ARGS,
  },
  async run({ args }) {
    const slug = await pickSlug(args.slug, "show");
    if (!slug) return;
    await runShow(homedir(), slug, resolveOutputMode(args));
  },
});

export const harnessList = defineCommand({
  meta: { name: "list", description: "List routines" },
  args: {
    slug: { type: "positional", description: "Routine slug (same as show)", required: false },
    ...READ_ARGS,
  },
  async run({ args }) {
    const mode = resolveOutputMode(args);
    const slug = String(args.slug ?? "").trim();
    if (slug) {
      await runShow(homedir(), slug, mode);
      return;
    }
    const home = homedir();
    const slugs = listRoutineSlugs(home);
    const jobs = readJobs();
    const rows = slugs.map((s) => listRow(home, s, jobs));
    if (mode.format === "json") {
      outJson(rows);
      await exit(0);
      return;
    }
    ui.blank();
    ui.heading("dora harness");
    ui.blank();
    if (rows.length === 0) {
      summaryLine("No routines.");
      nextAction("dora harness new");
    } else {
      printTable(rows);
      ui.blank();
      summaryLine(`${rows.length} routine${rows.length === 1 ? "" : "s"}`);
      nextAction(`dora harness show ${rows[0]!.slug}`);
    }
    printWatch();
    ui.blank();
    await exit(0);
  },
});

export const harnessOpen = defineCommand({
  meta: { name: "open", description: "Open a routine folder" },
  args: {
    slug: { type: "positional", description: "Routine slug", required: true },
  },
  async run({ args }) {
    const slug = String(args.slug ?? "").trim();
    if (!slug) {
      guidedError({
        context: "dora harness open needs a routine slug",
        problem: "Missing slug",
        solutions: ["Pass the slug from `dora harness list`."],
        next: "dora harness list",
      });
      await exit(2);
      return;
    }
    try {
      const dir = openRoutine(homedir(), slug);
      ui.info(dir);
      await exit(0);
    } catch (e) {
      ui.fail(e instanceof Error ? e.message : String(e));
      nextAction("dora harness list");
      await exit(1);
    }
  },
});

export default harnessList;
