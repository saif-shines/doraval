import { defineCommand } from "citty";
import { entireEnabled, searchPastWork } from "../../core/entire.js";
import { resolveOutputMode, outJson, emitError, nextAction } from "../out.js";
import { acknowledgeEntire } from "../preflight.js";
import { exit } from "../render/exit.js";

export default defineCommand({
  meta: {
    name: "search",
    description: [
      "Search past Entire sessions and commits.",
      "",
      "Read-only. Needs the entire command on PATH.",
      "",
      "Examples:",
      "  dora search \"add login\"",
      "Exit: 0 hits · 2 could not run",
    ].join("\n"),
  },
  args: {
    query: { type: "positional", description: "What past work to find", required: true },
    format: { type: "string", description: "Output format: table | json", default: "table" },
    json: { type: "boolean", description: "Alias for --format json", default: false },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    const query = String(args.query ?? "").trim();
    const cwd = typeof args.cwd === "string" && args.cwd ? args.cwd : process.cwd();
    const mode = resolveOutputMode({
      format: args.format as string,
      ci: args.ci as boolean,
      json: args.json as boolean,
    });
    if (!query) {
      emitError("Pass the words to search for.");
      nextAction("dora search \"add login\"");
      await exit(2);
      return;
    }
    if (!entireEnabled(cwd)) {
      emitError("Entire is not enabled in this repo.");
      nextAction("entire status");
      await exit(2);
      return;
    }
    acknowledgeEntire(mode, cwd);
    const result = searchPastWork(query, cwd);
    if (!result.ok) {
      emitError(result.message);
      nextAction(result.suggestion);
      await exit(2);
      return;
    }
    if (mode.format === "json") outJson({ query, text: result.text });
    else process.stdout.write(result.text.endsWith("\n") ? result.text : `${result.text}\n`);
    await exit(0);
  },
});
