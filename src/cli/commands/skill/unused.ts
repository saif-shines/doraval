import { defineCommand } from "citty";
import { homedir } from "os";
import { resolve } from "path";
import { isStandaloneUnused, listUnusedReport, unusedNext } from "../../../core/skill-remove.js";
import { loadRecentSessions } from "../../../core/session-evidence.js";
import { resolveReviewWindow } from "../../../core/review-window.js";
import { readConfig } from "../../../core/journal-config.js";
import { ui, resolveOutputMode, outJson, summaryLine, nextAction } from "../../out.js";
import { exit } from "../../render/exit.js";

export default defineCommand({
  meta: {
    name: "unused",
    description: [
      "List unused Skills. Remove candidates are never invoked and not a Recent install",
      "",
      "Read-only. Writes nothing.",
      "",
      "Examples:",
      "  dora skill unused",
      "  dora skill unused --json",
      "  dora skill unused --last 10 --since 30",
      "  dora skill unused --global",
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
    global: { type: "boolean", description: "Global unused: home Skills, Sessions from every project", default: false },
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
    const scope = args.global ? "global" : "project";
    const loaded = loadRecentSessions(cwd, undefined, window, scope);
    const report = listUnusedReport({ cwd, home: homedir(), loaded, scope });
    const row = (m: (typeof report.candidates)[number], recentInstall: boolean) => ({
      name: m.name,
      dir: m.dir,
      origin: m.origin,
      agent: m.agent,
      kind: m.kind,
      removable: m.removable,
      pluginRoot: m.pluginRoot,
      recentInstall,
    });
    const candidates = report.candidates.map((m) => row(m, false));
    const recent = report.recent.map((m) => row(m, true));

    if (mode.format === "json") {
      outJson({
        load: loaded.kind ?? scope,
        sessions: loaded.sessions.length,
        last: window.last,
        maxAgeDays: window.maxAgeDays,
        installAgeDays: report.installAgeDays,
        candidates,
        recent,
        ...(loaded.sessions.length === 0 ? { reason: "no-sessions" } : {}),
      });
      await exit(0);
      return;
    }

    ui.blank();
    ui.heading("dora skill — Unused");
    ui.blank();

    if (loaded.sessions.length === 0) {
      summaryLine("No recent sessions. Cannot mark unused Skills.");
      nextAction("dora session");
      ui.blank();
      await exit(0);
      return;
    }

    const standRecent = recent.filter(isStandaloneUnused);
    const importedN = [...candidates, ...recent].filter((r) => r.origin === "imported").length;
    const shownCandidates = candidates.filter((c) => c.origin !== "imported");

    for (const c of shownCandidates) {
      const where = c.agent ? `${c.agent}  ${c.dir}` : c.dir;
      const tag = c.kind === "plugin" ? "plugin" : c.removable ? "" : "keep";
      ui.info(`  ${c.name}  ${where}${tag ? `  ${tag}` : ""}`);
    }
    if (standRecent.length > 0 || recent.some((r) => r.kind === "plugin")) {
      if (shownCandidates.length > 0) ui.blank();
      ui.heading("Unused — recent install");
      ui.blank();
      for (const r of standRecent) {
        ui.info(`  ${r.name}  never invoked  installed in the last ${report.installAgeDays} days`);
      }
      for (const r of recent.filter((x) => x.kind === "plugin")) {
        ui.info(`  ${r.name}  plugin  installed in the last ${report.installAgeDays} days`);
      }
    }
    if (importedN > 0) ui.dim(`  ${importedN} imported cache Skill${importedN === 1 ? "" : "s"} (not removable)`);

    if (shownCandidates.length === 0 && standRecent.length === 0 && importedN === 0) {
      summaryLine("No unused Skills.");
      ui.blank();
      await exit(0);
      return;
    }

    if (shownCandidates.length === 0) {
      const n = standRecent.length;
      summaryLine(
        n > 0
          ? `No Remove candidates. ${n} unused recent install${n === 1 ? "" : "s"}.`
          : "No Remove candidates.",
      );
      ui.blank();
      await exit(0);
      return;
    }

    ui.blank();
    const extra = standRecent.length > 0
      ? `. ${standRecent.length} unused recent install${standRecent.length === 1 ? "" : "s"}`
      : "";
    summaryLine(`${shownCandidates.length} Remove candidate${shownCandidates.length === 1 ? "" : "s"}${extra}`);
    const next = unusedNext(shownCandidates);
    if (next) nextAction(next);
    ui.blank();
    await exit(0);
  },
});
