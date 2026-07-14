import { defineCommand } from "citty";
import pc from "picocolors";
import { findSession } from "../../../core/sessions-view.js";
import { ui, resolveOutputMode, outJson, summaryLine, emitError } from "../../out.js";
import { exit } from "../../render/exit.js";

function truncate(value: unknown, max: number): string {
  const s = JSON.stringify(value);
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export default defineCommand({
  meta: { name: "show", description: "Show a session's timeline: turns, tool calls, skills invoked" },
  args: {
    id: { type: "positional", description: "Session ID (from `dora sessions`)", required: true },
    agent: { type: "string", description: "Restrict lookup to this agent" },
    format: { type: "string", description: "Output format: table | json", default: "table" },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: false });
    const id = args.id as string;

    try {
      const found = findSession(process.cwd(), id, { agent: args.agent as string | undefined });

      if (!found) {
        if (mode.format === "json") {
          emitError(new Error(`No session found matching "${id}"`), mode);
        } else {
          ui.blank();
          ui.write(`  ${pc.red("✗")} No session found matching "${id}". Run ${pc.dim("dora sessions")} to list available ids.`);
          ui.blank();
        }
        await exit(1);
        return;
      }

      const { entry, primitives } = found;

      if (mode.format === "json") {
        outJson({ entry, primitives });
        await exit(0);
        return;
      }

      ui.blank();
      ui.heading(`Session ${entry.sessionId} — ${entry.agent}`);
      ui.write(`  ${entry.title} · ${entry.when}`);
      ui.blank();

      ui.write(`  Turns (${primitives.userMessages.length}):`);
      primitives.userMessages.slice(0, 10).forEach((m, i) => {
        ui.write(`    ${i + 1}. ${m.slice(0, 100)}${m.length > 100 ? "…" : ""}`);
      });
      ui.blank();

      // Aggregate tool names by count (B40 drill-down)
      const toolCounts = new Map<string, number>();
      for (const t of primitives.toolCalls) {
        toolCounts.set(t.name, (toolCounts.get(t.name) ?? 0) + 1);
      }
      const toolsByCount = [...toolCounts.entries()].sort((a, b) => b[1] - a[1]);

      ui.write(`  Tool calls (${primitives.toolCalls.length}):`);
      if (toolsByCount.length === 0) {
        ui.write(`    ${pc.dim("none")}`);
      } else {
        for (const [name, n] of toolsByCount.slice(0, 30)) {
          ui.write(`    ${pc.dim("·")} ${name}${n > 1 ? pc.dim(` ×${n}`) : ""}`);
        }
        if (toolsByCount.length > 30) {
          ui.write(`    ${pc.dim(`… +${toolsByCount.length - 30} more tool types`)}`);
        }
      }
      // Sample of recent calls with truncated input (first 8)
      if (primitives.toolCalls.length > 0) {
        ui.blank();
        ui.write(`  Recent calls:`);
        primitives.toolCalls.slice(0, 8).forEach((t) => {
          ui.write(`    ${pc.dim("·")} ${t.name} ${pc.dim(truncate(t.input, 80))}`);
        });
      }
      ui.blank();

      // Skills with counts when detectable from Skill tool calls
      const skillCounts = new Map<string, number>();
      for (const t of primitives.toolCalls) {
        if (t.name === "Skill" || t.name === "skill") {
          const input = t.input as Record<string, unknown> | undefined;
          const skillName =
            (typeof input?.skill === "string" && input.skill) ||
            (typeof input?.name === "string" && input.name) ||
            null;
          if (skillName) skillCounts.set(skillName, (skillCounts.get(skillName) ?? 0) + 1);
        }
      }
      for (const s of primitives.skillsInvoked) {
        if (!skillCounts.has(s)) skillCounts.set(s, 1);
      }
      ui.write(`  Skills invoked:`);
      if (skillCounts.size === 0) {
        ui.write(`    ${pc.dim("none")}`);
      } else {
        for (const [name, n] of [...skillCounts.entries()].sort((a, b) => b[1] - a[1])) {
          ui.write(`    ${pc.dim("·")} ${name}${n > 1 ? pc.dim(` ×${n}`) : ""}`);
        }
      }
      ui.write(`  Tokens: ${pc.dim("unavailable")}`);
      ui.blank();

      summaryLine(
        `${primitives.userTurnCount} turns · ${primitives.toolCalls.length} tool calls · ${skillCounts.size} skill(s)`,
      );
      ui.blank();

      await exit(0);
    } catch (e) {
      emitError(e, mode);
      await exit(2);
    }
  },
});
