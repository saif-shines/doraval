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
  writeRoutine,
} from "../../core/routine.js";
import {
  bootArgs,
  defaultHermesRun,
  listJobStates,
  loginCommand,
  MCP_SERVER,
  onePassArgs,
  onePassCommand,
  pauseArgs,
  resumeArgs,
} from "../../core/hermes.js";
import { ui, resolveOutputMode, outJson, summaryLine, guidedError, nextAction } from "../out.js";
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
    context: "dora harness needs Hermes to boot, pause, or resume a routine",
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
}

function mcpNotReady(detail?: string): Error {
  return new Error(
    [detail, `Scalekit MCP is not ready. Run: ${loginCommand()}`, "If the Scalekit connected account is dead, open the provider link again."]
      .filter(Boolean)
      .join("\n"),
  );
}

async function requireHermesSlug(raw: unknown, context: string): Promise<string | undefined> {
  if (!hermesInstalled()) {
    printHermesInstall();
    await exit(2);
    return;
  }
  const slug = String(raw ?? "").trim();
  if (!slug) {
    guidedError({
      context,
      problem: "Missing slug",
      solutions: ["Pass the slug from `dora harness list`."],
      next: "dora harness list",
    });
    await exit(2);
    return;
  }
  return slug;
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
    const mcpUrl = (typeof args["mcp-url"] === "string" ? args["mcp-url"] : readDefaultMcpUrl(home) ?? "").trim();
    const skillsRun = splitDirs(args["skills-run"] as string | undefined);
    const skillsRefer = splitDirs(args["skills-refer"] as string | undefined);

    if (!slug || !promptText.trim() || !mcpUrl) {
      guidedError({
        context: "dora harness new writes a routine only after the grill gate",
        problem: "Missing slug, prompt, or MCP URL",
        solutions: [
          "Finish the grill. Collect skills to run, skills to refer to, and the MCP URL.",
          "Then pass --slug, --prompt-file, and --mcp-url.",
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
        const r = defaultHermesRun(onePassArgs(draft));
        if (r.exitCode !== 0) {
          ui.fail(r.stderr.trim() || "One-pass command failed.");
          printMcpNext();
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
      if (!readDefaultMcpUrl(home)) writeDefaultMcpUrl(home, mcpUrl);
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

function runBoot(slug: string): void {
  const routine = readRoutine(homedir(), slug);
  for (const args of bootArgs(routine)) {
    const r = defaultHermesRun(args);
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
}

export const harnessBoot = defineCommand({
  meta: {
    name: "boot",
    description: [
      "Start a routine on Hermes",
      "",
      "Starts the Hermes gateway as a machine service, writes one cron job, then exits.",
      "Laptop close is host sleep, not pause. Cron does not run while the host sleeps.",
      "Due jobs can fire on wake if the job is not paused.",
    ].join("\n"),
  },
  args: {
    slug: { type: "positional", description: "Routine slug", required: false },
  },
  async run({ args }) {
    let slug = String(args.slug ?? "").trim();
    const home = homedir();
    if (!slug) {
      const slugs = listRoutineSlugs(home);
      ui.blank();
      ui.heading("dora harness boot");
      ui.blank();
      if (slugs.length === 0) {
        summaryLine("No routines.");
        nextAction("dora harness new");
        ui.blank();
        await exit(0);
        return;
      }
      for (const s of slugs) ui.info(`  ${s}`);
      ui.blank();
      if (!process.stdin.isTTY || !process.stderr.isTTY) {
        nextAction("dora harness boot <slug>");
        nextAction("dora harness new");
        ui.blank();
        await exit(2);
        return;
      }
      const picked = await promptSelect(
        "Boot which routine?",
        [
          ...slugs.map((s) => ({ value: s, label: s })),
          { value: "__new__", label: "Create a new routine" },
        ],
        slugs[0]!,
      );
      if (picked === "__new__") {
        printGrill(home);
        await exit(0);
        return;
      }
      slug = picked;
    }
    if (!hermesInstalled()) {
      printHermesInstall();
      await exit(2);
      return;
    }
    try {
      runBoot(slug);
      ui.info(`  Booted ${slug}. Dora does not own the timer.`);
      ui.dim("  Laptop close is host sleep, not pause. Due jobs can fire on wake if the job is not paused.");
      printMcpNext();
      ui.blank();
      await exit(0);
    } catch (e) {
      ui.fail(e instanceof Error ? e.message : String(e));
      printMcpNext();
      nextAction("dora harness list");
      await exit(2);
    }
  },
});

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
    slug: { type: "positional", description: "Routine slug", required: true },
  },
  async run({ args }) {
    const slug = await requireHermesSlug(args.slug, "dora harness pause needs a routine slug");
    if (!slug) return;
    const r = defaultHermesRun(pauseArgs(slug));
    if (r.exitCode !== 0) {
      ui.fail(r.stderr.trim() || "Pause failed.");
      await exit(2);
      return;
    }
    ui.info(`  Paused ${slug}. Later ticks skip. A pass that already started may finish.`);
    ui.blank();
    await exit(0);
  },
});

export const harnessResume = defineCommand({
  meta: { name: "resume", description: "Resume a paused routine" },
  args: {
    slug: { type: "positional", description: "Routine slug", required: true },
  },
  async run({ args }) {
    const slug = await requireHermesSlug(args.slug, "dora harness resume needs a routine slug");
    if (!slug) return;
    const r = defaultHermesRun(resumeArgs(slug));
    if (r.exitCode !== 0) {
      ui.fail(r.stderr.trim() || "Resume failed.");
      await exit(2);
      return;
    }
    ui.info(`  Resumed ${slug}.`);
    ui.blank();
    await exit(0);
  },
});

export const harnessList = defineCommand({
  meta: { name: "list", description: "List routines" },
  args: {
    format: { type: "string", description: "Output format: table | json", default: "table" },
    json: { type: "boolean", description: "Alias for --format json", default: false },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
  },
  async run({ args }) {
    const mode = resolveOutputMode({
      format: args.format as string,
      ci: args.ci as boolean,
      json: args.json as boolean,
    });
    const slugs = listRoutineSlugs(homedir());
    const jobs = hermesInstalled() ? listJobStates() : new Map();
    const rows = slugs.map((slug) => ({ slug, state: jobs.get(slug) ?? "none" }));
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
    } else {
      for (const r of rows) {
        const state = r.state === "none" ? "—" : r.state;
        ui.info(`  ${r.slug}  ${state}`);
      }
      ui.blank();
      summaryLine(`${rows.length} routine${rows.length === 1 ? "" : "s"}`);
    }
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
