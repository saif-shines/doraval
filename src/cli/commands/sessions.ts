import { defineCommand } from "citty";
import pc from "picocolors";
import { listSessions, isKnownAgent, resolveAgentAlias } from "../../core/sessions-view.js";
import { ui, resolveOutputMode, outJson, summaryLine, emitError, nextAction } from "../out.js";
import { exit } from "../render/exit.js";

function renderTable(entries: ReturnType<typeof listSessions>): void {
  ui.blank();
  ui.heading("dora sessions");
  ui.blank();
  ui.write(
    `  ${"AGENT".padEnd(12)} ${"WHEN".padEnd(17)} ${"TITLE".padEnd(24)} ${"TURNS".padEnd(6)} ${"TOOLS".padEnd(6)} ID`,
  );
  for (const e of entries) {
    const id = e.sessionId;
    const idShort = id.length > 12 ? id.slice(0, 12) + "…" : id;
    ui.write(
      `  ${e.agent.padEnd(12)} ${e.when.padEnd(17)} ${e.title.slice(0, 22).padEnd(24)} ${String(e.turns).padEnd(6)} ${String(e.toolCalls).padEnd(6)} ${pc.dim(idShort)}`,
    );
  }
  ui.blank();
  summaryLine(`${entries.length} session${entries.length === 1 ? "" : "s"}`);
  // B40: real sessionId from the list for drill-down
  const first = entries[0];
  if (first) {
    nextAction(`dora sessions show ${first.sessionId}`);
  }
  ui.blank();
}

export default defineCommand({
  meta: { name: "sessions", description: "List coding-agent sessions for this project" },
  args: {
    agent: { type: "string", description: "Filter by agent (claude, grok, cursor, codex, copilot)" },
    limit: { type: "string", description: "Max sessions per agent", default: "10" },
    format: { type: "string", description: "Output format: table | json", default: "table" },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
  },
  subCommands: {
    show: () => import("./sessions/show.js").then((m) => m.default),
  },
  async run({ args }) {
    // citty calls this command's own run() even after dispatching to a
    // subcommand (verified in node_modules/citty/dist/index.mjs) — bail
    // out if "show" was the subcommand actually invoked, matching the
    // guard style already used by defineGroup() in command-tree.ts.
    const cliArgs = process.argv.slice(2);
    if (cliArgs[0] === "sessions" && cliArgs[1] === "show") return;

    const mode = resolveOutputMode({ format: args.format as string, ci: args.ci as boolean });
    const agent = args.agent as string | undefined;

    try {
      if (agent && !isKnownAgent(agent)) {
        if (mode.format === "json") {
          outJson([]);
        } else {
          ui.blank();
          ui.write(`  ${pc.yellow("⚠")} No session adapter for "${agent}" — supported agents: claude, grok, cursor, codex, copilot.`);
          ui.blank();
        }
        await exit(0);
        return;
      }

      const entries = listSessions(process.cwd(), {
        agent: agent ? resolveAgentAlias(agent) : undefined,
        limit: parseInt(args.limit as string, 10) || 10,
      });

      if (mode.format === "json") {
        outJson(entries);
      } else if (entries.length === 0) {
        ui.blank();
        if (agent) {
          ui.write(`  No sessions found for ${agent} in this project.`);
        } else {
          ui.write(`  No sessions found. Supported agents: claude, grok, cursor, codex, copilot.`);
        }
        ui.blank();
      } else {
        renderTable(entries);
      }

      await exit(0);
    } catch (e) {
      emitError(e, mode);
      await exit(2);
    }
  },
});
