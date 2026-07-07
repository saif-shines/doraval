import { defineCommand } from "citty";
import pc from "picocolors";
import { loadPrinciples } from "../../../core/memory-rubric.js";
import { ui, resolveOutputMode, outJson, summaryLine } from "../../out.js";
import { exit } from "../../render/exit.js";

export default defineCommand({
  meta: { name: "list", description: "List active principles from memory" },
  args: {
    format: { type: "string", description: "Output format: table | json", default: "table" },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: args.ci as boolean });
    const principles = loadPrinciples(process.cwd());

    if (mode.format === "json") {
      outJson(principles);
      await exit(0);
      return;
    }

    ui.blank();
    ui.heading("dora memory — active principles");
    ui.blank();

    if (principles.length === 0) {
      ui.dim("  No principles recorded yet.");
      ui.blank();
      ui.write(`  ${pc.white("Next:")} ${pc.dim('dora memory add "Prefer named exports" --weight 8')}`);
      ui.blank();
      await exit(0);
      return;
    }

    for (const p of principles) {
      const strength = p.weight >= 7 ? pc.red(`w${p.weight}`) : pc.yellow(`w${p.weight}`);
      const scope = pc.dim(p.source === "global" ? "[global]" : "[project]");
      ui.write(`  ${strength}  ${p.title}  ${scope}`);
      if (p.body) ui.write(`       ${pc.dim(p.body)}`);
    }

    ui.blank();
    summaryLine(`${principles.length} active principle${principles.length === 1 ? "" : "s"}`);
    ui.blank();

    await exit(0);
  },
});
