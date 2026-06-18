import { defineCommand } from "citty";
import pc from "picocolors";
import { ui } from "../out.js";
import { supportedProviders, getProviderSpec } from "../../providers/spec.js";

export default defineCommand({
  meta: {
    name: "providers",
    description: "List supported providers and their packaging details",
  },
  args: {
    json: {
      type: "boolean",
      description: "Output as JSON",
      default: false,
    },
  },
  run({ args }) {
    if (args.json) {
      console.log(JSON.stringify(
        supportedProviders.map((id) => {
          const spec = getProviderSpec(id as any);
          return { ...spec, id };
        }),
        null,
        2
      ));
      process.exit(0);
    }

    ui.heading("doraval providers — Supported platforms");

    for (const id of supportedProviders) {
      const spec = getProviderSpec(id as any);
      ui.write(`\n  ${pc.bold(id)} — ${spec.name}`);
      ui.info(`  Manifest: ${spec.manifestPath}`);
      ui.info(`  Marketplace: ${spec.marketplacePath}`);
      ui.info(`  MCP: ${spec.mcpFilename}`);
      ui.info(`  Example: doraval validate . --for ${id}`);
    }

    ui.write(`\n  Use --json for machine-readable output.`);
    process.exit(0);
  },
});
