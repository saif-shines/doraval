import { spawnSync } from "bun";
import { defineCommand } from "citty";
import { ui, resolveOutputMode, outJson, summaryLine, guidedError } from "../out.js";
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
    if (mode.format === "json") {
      outJson([]);
      await exit(0);
      return;
    }
    ui.blank();
    ui.heading("dora harness");
    ui.blank();
    summaryLine("No routines.");
    ui.blank();
    await exit(0);
  },
});

export const harnessOpen = defineCommand({
  meta: { name: "open", description: "Open a routine folder" },
});

export default harnessList;
