import { defineCommand } from "citty";
import { readConfig } from "../../core/journal-config.js";
import { runProbe } from "../../core/probe.js";
import { isAgentCaller, refuseAgentWrite, shouldBlockAgentWrite } from "../agent-detect.js";
import { ui, resolveOutputMode, outJson, nextAction, summaryLine } from "../out.js";
import { exit } from "../render/exit.js";

export default defineCommand({
  meta: {
    name: "probe",
    description: [
      "Send hello to doraval.dev and wait for ack",
      "",
      "Write. Detected agents need --yes or --dry-run.",
      "",
      "Examples:",
      "  dora probe --dry-run",
      "  dora probe --yes",
      "Exit: 0 acked · 1 timeout or bad key · 2 could not run",
    ].join("\n"),
  },
  args: {
    yes: { type: "boolean", description: "Run without prompting", default: false, alias: "y" },
    "dry-run": { type: "boolean", description: "Show the plan, send nothing", default: false },
    format: { type: "string", description: "Output format: table | json", default: "table" },
    json: { type: "boolean", description: "Alias for --format json", default: false },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
  },
  async run({ args }) {
    const mode = resolveOutputMode({
      format: args.format as string,
      ci: args.ci as boolean,
      json: args.json as boolean,
    });
    const dryRun = Boolean(args["dry-run"]);
    const yes = Boolean(args.yes);
    if (shouldBlockAgentWrite({ agent: isAgentCaller(), yes, dryRun })) {
      refuseAgentWrite("dora probe --dry-run");
      await exit(2);
      return;
    }

    const config = await readConfig();
    const key = config?.identity?.api_key;
    const site = process.env.DORAVAL_SITE ?? "https://doraval.dev";

    if (dryRun) {
      if (mode.format === "json") {
        outJson({ status: key ? "pending" : "no-key", applied: false });
      } else {
        ui.info(key ? `Would POST hello to ${site}/probe` : "No identity.api_key");
      }
      await exit(key ? 0 : 2);
      return;
    }

    const result = await runProbe({ key, site, fetch });
    if (mode.format === "json") outJson(result);
    else if (result.status === "acked") summaryLine("ack");
    else if (result.status === "no-key") {
      summaryLine("No identity.api_key.");
      nextAction("dora config set identity.api_key <token> --yes");
    } else if (result.status === "timeout") {
      summaryLine("Probe timed out.");
      nextAction("dora probe --yes");
    } else if (result.status === "bad-key") {
      summaryLine("Bad or revoked key.");
      nextAction("dora config set identity.api_key <token> --yes");
    } else {
      summaryLine("Probe failed.");
      nextAction("dora probe --dry-run");
    }

    if (result.status === "acked") await exit(0);
    else if (result.status === "no-key") await exit(2);
    else await exit(1);
  },
});
