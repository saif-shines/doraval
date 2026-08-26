import { defineCommand } from "citty";
import { homedir } from "os";
import { resolve } from "path";
import { listRemoveCandidates } from "../../../core/skill-remove.js";
import { loadRecentSessions } from "../../../core/session-evidence.js";
import { resolveReviewWindow } from "../../../core/review-window.js";
import { readConfig } from "../../../core/journal-config.js";
import { ui, resolveOutputMode, outJson, summaryLine, nextAction } from "../../out.js";
import { exit } from "../../render/exit.js";

export default defineCommand({
  meta: {
    name: "unused",
    description: [
      "List Authored Skills that are Remove candidates (never invoked, not a Recent install)",
      "",
      "Read-only. Writes nothing.",
      "",
      "Examples:",
      "  dora skill unused",
      "  dora skill unused --json",
      "  dora skill unused --last 10 --since 30",
      "Exit: 0 listed · 2 could not run",
    ].join("\n"),
  },
  args: {
    format: { type: "string", description: "Output format: table | json", default: "table" },
    json: { type: "boolean", description: "Alias for --format json", default: false },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
    cwd: { type: "string", description: "Working directory override" },
    last: { type: "string", description: "How many recent Sessions to read (default 30)" },
    since: { type: "string", description: "Drop Sessions older than this many days (default 90)" },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: args.ci as boolean, json: args.json as boolean });
    const cwd = args.cwd ? resolve(args.cwd as string) : process.cwd();
    const lastRaw = args.last != null ? Number(args.last) : undefined;
    const sinceRaw = args.since != null ? Number(args.since) : undefined;
    const window = resolveReviewWindow({
      last: lastRaw,
      maxAgeDays: sinceRaw,
      config: await readConfig(),
    });
    const loaded = loadRecentSessions(cwd, undefined, window);
    const matches = listRemoveCandidates({ cwd, home: homedir(), loaded });
    const candidates = matches.map((m) => ({
      name: m.name,
      dir: m.dir,
      origin: m.origin,
      agent: m.agent,
    }));

    if (mode.format === "json") {
      outJson({
        sessions: loaded.sessions.length,
        candidates,
        ...(loaded.sessions.length === 0 ? { reason: "no-sessions" } : {}),
      });
      await exit(0);
      return;
    }

    ui.blank();
    ui.heading("dora skill — Remove candidates");
    ui.blank();

    if (loaded.sessions.length === 0) {
      summaryLine("No recent sessions. Cannot mark Remove candidates.");
      nextAction("dora session");
      ui.blank();
      await exit(0);
      return;
    }

    if (candidates.length === 0) {
      summaryLine("No Remove candidates.");
      ui.blank();
      await exit(0);
      return;
    }

    for (const c of candidates) {
      const where = c.agent ? `${c.agent}  ${c.dir}` : c.dir;
      ui.info(`  ${c.name}  ${where}`);
    }
    ui.blank();
    summaryLine(`${candidates.length} Remove candidate${candidates.length === 1 ? "" : "s"}`);
    nextAction(`dora skill remove ${candidates[0]!.name} --dry-run`);
    ui.blank();
    await exit(0);
  },
});
