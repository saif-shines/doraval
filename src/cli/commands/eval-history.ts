import { defineCommand } from "citty";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import pc from "picocolors";
import { ui, guidedError } from "../out.js";
import { getEvalsDir } from "../../core/journal-config.js";
import type { EvalResult } from "../../core/session-eval.js";

export default defineCommand({
  meta: {
    name: "history",
    description: "List stored eval results",
  },
  args: {
    limit: {
      type: "string",
      description: "Maximum number of results to show (default: 20)",
      default: "20",
    },
    skill: {
      type: "string",
      description: "Filter by skill name",
    },
    format: {
      type: "string",
      alias: "f",
      description: "Output format: table (default) or json",
      default: "table",
    },
  },

  async run({ args }) {
    const evalsDir = getEvalsDir();
    if (!existsSync(evalsDir)) {
      guidedError({
        context: "dora eval history shows past judgments. It is populated after you run dora eval (or --runs).",
        problem: "No eval history yet",
        solutions: [
          "dora eval",
          "dora eval --runs 3 --skill ./skills/example",
        ],
        next: "dora eval",
      });
      process.exit(0);
    }

    const files = readdirSync(evalsDir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse();

    const limit = parseInt(String(args.limit), 10) || 20;
    const results: EvalResult[] = [];

    for (const file of files) {
      if (results.length >= limit) break;
      try {
        const raw = await Bun.file(join(evalsDir, file)).text();
        const parsed = JSON.parse(raw) as EvalResult;
        // Skip unknown schema versions
        if (parsed.schemaVersion !== 1) continue;
        // Filter by skill
        if (args.skill && !parsed.skill.includes(args.skill)) continue;
        results.push(parsed);
      } catch {
        // skip unreadable files
      }
    }

    if (results.length === 0) {
      ui.info("No eval results found.");
      process.exit(0);
    }

    if (args.format === "json") {
      process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    } else {
      ui.heading("doraval eval history");
      ui.write(`  ${"DATE".padEnd(20)} ${"SESSION TITLE".padEnd(35)} ${"SKILL".padEnd(35)} RESULT`);
      ui.write(`  ${"-".repeat(100)}`);
      for (const r of results) {
        const date = r.timestamp.slice(0, 10);
        const title = (r.sessionTitle ?? r.sessionId.slice(0, 8)).slice(0, 33).padEnd(35);
        const skill = r.skill.slice(0, 33).padEnd(35);
        const verdictColor = r.verdict === "PASS" ? pc.green : r.verdict === "FAIL" ? pc.red : pc.yellow;
        ui.write(`  ${date.padEnd(20)} ${title} ${skill} ${verdictColor(r.verdict)}`);
      }
      ui.blank();
    }

    process.exit(0);
  },
});
