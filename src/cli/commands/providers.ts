/**
 * Packaging/spec reference only (Q1 option A).
 * Repo-relative "which agents does this project use?" lives on bare `dora` scan.
 */
import { defineCommand } from "citty";
import pc from "picocolors";
import { ui, nextAction } from "../out.js";
import { supportedProviders, getProviderSpec } from "../../providers/spec.js";
import { exit } from "../render/exit.js";

export default defineCommand({
  meta: {
    name: "providers",
    description:
      "Packaging/spec reference for supported agents (not this-repo support — run `dora`)",
  },
  args: {
    json: {
      type: "boolean",
      description: "Output as JSON",
      default: false,
    },
  },
  async run({ args }) {
    if (args.json) {
      console.log(
        JSON.stringify(
          supportedProviders.map((id) => {
            const spec = getProviderSpec(id);
            return { ...spec, id };
          }),
          null,
          2,
        ),
      );
      return await exit(0);
    }

    ui.heading("doraval providers — packaging/spec reference");
    ui.dim("  Not “what this repo supports.” For that, run bare `dora` (Agent surfaces).");
    ui.blank();

    for (const id of supportedProviders) {
      const spec = getProviderSpec(id);
      ui.write(`\n  ${pc.bold(id)} — ${spec.name}`);
      ui.info(`  Manifest: ${spec.manifestPath}`);
      ui.info(`  Marketplace: ${spec.marketplacePath}`);
      ui.info(`  MCP: ${spec.mcpFilename}`);
      ui.info(`  Keywords in plugin.json: supported for agent discovery`);
    }

    ui.blank();
    nextAction("dora                          which agents this repo uses");
    nextAction("dora new --for <agent>        scaffold skill / rule / plugin");
    ui.dim("  Use --json for machine-readable packaging specs.");
    await exit(0);
  },
});
