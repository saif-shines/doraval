import { defineCommand } from "citty";
import { buildCapabilities, type CommandCapability } from "../capabilities.js";
import { ui, resolveOutputMode, outJson, nextAction } from "../out.js";
import { exit } from "../render/exit.js";

function renderTable(commands: CommandCapability[]): void {
  const nameW = Math.max(...commands.map((c) => c.name.length), 8);
  const labelW = 9;
  for (const c of commands) {
    const example = c.examples[0] ?? "";
    ui.write(`  ${c.name.padEnd(nameW)}  ${c.label.padEnd(labelW)}  ${example}`);
  }
}

function renderOne(c: CommandCapability): void {
  ui.heading(`dora ${c.name}`);
  ui.info(`  ${c.label} — ${c.description}`);
  if (c.examples.length) {
    ui.blank();
    ui.info("  Examples:");
    for (const ex of c.examples) ui.info(`    ${ex}`);
  }
  const flags = Object.entries(c.flags);
  if (flags.length) {
    ui.blank();
    ui.info("  Flags:");
    for (const [name, meta] of flags) ui.info(`    ${name}  ${meta.description}`);
  }
  ui.blank();
  ui.info(`  Exit: 0 ${c.exit_codes["0"]} · 1 ${c.exit_codes["1"]} · 2 ${c.exit_codes["2"]}`);
}

export default defineCommand({
  meta: {
    name: "agent-help",
    description: "Live command map for agents (text or --json)",
  },
  args: {
    command: { type: "positional", description: "Verb to drill into", required: false },
    json: { type: "boolean", description: "Alias for --format json", default: false },
    format: { type: "string", description: "Output format: table | json", default: "table" },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, json: args.json as boolean });
    const manifest = buildCapabilities();
    const name = ((args.command as string) || "").trim();

    if (name) {
      const one = manifest.commands.find((c) => c.name === name);
      if (!one) {
        ui.fail(`Unknown command: ${name}`);
        nextAction("dora agent-help");
        await exit(1);
        return;
      }
      if (mode.format === "json") {
        outJson({ command: one, version: manifest.version });
        await exit(0);
        return;
      }
      renderOne(one);
      await exit(0);
      return;
    }

    if (mode.format === "json") {
      outJson(manifest);
      await exit(0);
      return;
    }

    ui.heading("dora agent-help");
    ui.dim("  read-only = safe unprompted · writes = needs --yes or --dry-run");
    ui.blank();
    renderTable(manifest.commands);
    ui.blank();
    ui.dim("  Drill in: dora agent-help <command>    JSON: dora agent-help --json");
    await exit(0);
  },
});
