import { defineCommand } from "citty";
import { resolve } from "path";
import { walkForTargets } from "../bump.js";
import { ui, resolveOutputMode, outJson, summaryLine } from "../../out.js";
import { exit } from "../../render/exit.js";

export default defineCommand({
  meta: { name: "list", description: "List Plugins and marketplaces in this repo" },
  args: {
    format: { type: "string", description: "Output format: table | json", default: "table" },
    json: { type: "boolean", description: "Alias for --format json", default: false },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: args.ci as boolean, json: args.json as boolean });
    const cwd = args.cwd ? resolve(args.cwd as string) : process.cwd();
    const rows = walkForTargets(cwd);
    if (mode.format === "json") {
      outJson({ plugins: rows });
      await exit(0);
      return;
    }
    ui.blank();
    ui.heading("dora plugin");
    ui.dim("  Review a Plugin with dora review <plugin-root>. Bump also touches marketplaces.");
    ui.blank();
    if (rows.length === 0) {
      summaryLine("No Plugins.");
      ui.blank();
      await exit(0);
      return;
    }
    for (const r of rows) ui.info(`  ${r.kind}  ${r.label}  ${r.file}`);
    ui.blank();
    summaryLine(`${rows.length} manifest${rows.length === 1 ? "" : "s"}`);
    ui.blank();
    await exit(0);
  },
});