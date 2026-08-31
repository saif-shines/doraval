import { spawnSync } from "bun";
import { homedir } from "os";
import { defineCommand } from "citty";
import { listRoutineSlugs, openRoutine } from "../../core/routine.js";
import { ui, resolveOutputMode, outJson, summaryLine, guidedError, nextAction } from "../out.js";
import { exit } from "../render/exit.js";

function hermesInstalled(): boolean {
  try {
    return spawnSync(["which", "hermes"], { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
  } catch {
    return false;
  }
}

async function requireHermes(): Promise<void> {
  if (hermesInstalled()) return;
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
  await exit(2);
}

export const harnessNew = defineCommand({
  meta: { name: "new", description: "Start the grill and create a routine" },
});

export const harnessBoot = defineCommand({
  meta: { name: "boot", description: "Start a routine on Hermes" },
  run: requireHermes,
});

export const harnessPause = defineCommand({
  meta: { name: "pause", description: "Pause a routine" },
  run: requireHermes,
});

export const harnessResume = defineCommand({
  meta: { name: "resume", description: "Resume a paused routine" },
  run: requireHermes,
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
    if (mode.format === "json") {
      outJson(slugs);
      await exit(0);
      return;
    }
    ui.blank();
    ui.heading("dora harness");
    ui.blank();
    if (slugs.length === 0) {
      summaryLine("No routines.");
    } else {
      for (const slug of slugs) ui.info(`  ${slug}`);
      ui.blank();
      summaryLine(`${slugs.length} routine${slugs.length === 1 ? "" : "s"}`);
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
