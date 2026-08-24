import { defineCommand } from "citty";
import { homedir } from "os";
import { resolve, join } from "path";
import { statSync } from "fs";
import { listProjectSkills, isRemoveCandidate, isRecentInstall } from "../../../core/skill-remove.js";
import { loadRecentSessions, skillWasInvoked } from "../../../core/session-evidence.js";
import { ui, resolveOutputMode, outJson, summaryLine } from "../../out.js";
import { exit } from "../../render/exit.js";

export default defineCommand({
  meta: { name: "list", description: "List Authored and Global Skills" },
  args: {
    format: { type: "string", description: "Output format: table | json", default: "table" },
    json: { type: "boolean", description: "Alias for --format json", default: false },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: args.ci as boolean, json: args.json as boolean });
    const argv = process.argv.slice(2);
    const cwdFlag = argv.indexOf("--cwd");
    const cwd = args.cwd
      ? resolve(args.cwd as string)
      : cwdFlag >= 0 && argv[cwdFlag + 1]
        ? resolve(argv[cwdFlag + 1]!)
        : process.cwd();
    const loaded = loadRecentSessions(cwd);
    const nowMs = Date.now();
    const rows = listProjectSkills(cwd, homedir())
      .filter((s) => s.origin === "authored" || s.origin === "global")
      .map((s) => {
        let unused = false;
        try {
          const mtimeMs = statSync(join(s.dir, "SKILL.md")).mtimeMs;
          unused = isRemoveCandidate({
            origin: s.origin,
            invoked: skillWasInvoked(s.name, s.dir, loaded),
            recentInstall: isRecentInstall(mtimeMs, nowMs),
          });
        } catch {
          unused = false;
        }
        return { name: s.name, origin: s.origin, agent: s.agent, dir: s.dir, unused };
      });

    if (mode.format === "json") {
      outJson({ skills: rows });
      await exit(0);
      return;
    }

    ui.blank();
    ui.heading("dora skill");
    ui.blank();
    if (rows.length === 0) {
      summaryLine("No Authored or Global Skills.");
      ui.blank();
      await exit(0);
      return;
    }
    for (const r of rows) {
      const mark = r.unused ? "unused" : r.origin;
      ui.info(`  ${r.name}  ${r.origin}${r.agent ? `  ${r.agent}` : ""}  ${mark === "unused" ? "unused" : ""}`.trimEnd());
    }
    ui.blank();
    summaryLine(`${rows.length} skill${rows.length === 1 ? "" : "s"}`);
    ui.blank();
    await exit(0);
  },
});
