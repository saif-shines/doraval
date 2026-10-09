import { defineCommand } from "citty";
import { entireState, searchPastWork } from "../../core/entire.js";
import { resolveOutputMode, outJson, guidedError, type OutputMode } from "../out.js";
import { acknowledgeEntire } from "../preflight.js";
import { exit } from "../render/exit.js";

function failSearch(mode: OutputMode, problem: string, suggestion: string): void {
  if (mode.format === "json") {
    process.stderr.write(JSON.stringify({ error: { message: problem, suggestion } }) + "\n");
    return;
  }
  guidedError({ context: "dora search", problem, solutions: [suggestion], next: suggestion });
}

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
      "Exit: 0 hits, or Entire is not enabled · 2 entire is missing, empty query, or the search failed",
    ].join("\n"),
  },
  args: {
    query: { type: "positional", description: "What past work to find", required: false },
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
      failSearch(mode, "Pass the words to search for.", "dora search \"add login\"");
      await exit(2);
      return;
    }
    const state = entireState(cwd);
    if (state === "missing") {
      failSearch(mode, "entire is not installed", "Install Entire, then run dora search again");
      await exit(2);
      return;
    }
    if (state === "disabled") {
      if (mode.format === "json") outJson({ enabled: false, query, text: "" });
      await exit(0);
      return;
    }
    acknowledgeEntire(mode, true);
    const result = searchPastWork(query, cwd);
    if (!result.ok) {
      failSearch(mode, result.message, result.suggestion);
      await exit(2);
      return;
    }
    if (mode.format === "json") outJson({ query, text: result.text });
    else process.stdout.write(result.text.endsWith("\n") ? result.text : `${result.text}\n`);
    await exit(0);
  },
});
