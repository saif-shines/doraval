import { defineCommand } from "citty";
import { existsSync, readdirSync } from "fs";
import { join, resolve, basename } from "path";
import { ui, resolveOutputMode, outJson, summaryLine } from "../../out.js";
import { exit } from "../../render/exit.js";

const AGENT_DIRS = [".claude/agents", ".codex/agents", ".cursor/agents", ".github/agents"];

export default defineCommand({
  meta: { name: "list", description: "List Subagents in this repo" },
  args: {
    format: { type: "string", description: "Output format: table | json", default: "table" },
    json: { type: "boolean", description: "Alias for --format json", default: false },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: args.ci as boolean, json: args.json as boolean });
    const cwd = args.cwd ? resolve(args.cwd as string) : process.cwd();
    const rows: { name: string; dir: string }[] = [];
    for (const rel of AGENT_DIRS) {
      const dir = join(cwd, rel);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) {
        if (!f.endsWith(".md")) continue;
        rows.push({ name: basename(f, ".md"), dir: join(dir, f) });
      }
    }
    if (mode.format === "json") {
      outJson({ agents: rows });
      await exit(0);
      return;
    }
    ui.blank();
    ui.heading("dora agent");
    ui.dim("  Subagents (not coding-agent vendors). Review a Plugin with dora review <plugin-root>.");
    ui.blank();
    if (rows.length === 0) {
      summaryLine("No Subagents.");
      ui.blank();
      await exit(0);
      return;
    }
    for (const r of rows) ui.info(`  ${r.name}  ${r.dir}`);
    ui.blank();
    summaryLine(`${rows.length} Subagent${rows.length === 1 ? "" : "s"}`);
    ui.blank();
    await exit(0);
  },
});
