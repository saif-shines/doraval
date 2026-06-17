import { defineCommand } from "citty";
import { ui } from "../out.js";
import { spawnSync } from "node:child_process";
import {
  detectInstallMethod,
  fetchLatestVersionInfo,
  buildUpgradeCommand,
  shouldUpdate,
  writeInstallMarker,
} from "../../core/update.js";

export default defineCommand({
  meta: {
    name: "update",
    description: "Update doraval to the latest version",
  },
  args: {
    check: {
      type: "boolean",
      description: "Only check for updates, do not install",
      default: false,
    },
    yes: {
      type: "boolean",
      description: "Skip confirmation prompt",
      default: false,
    },
  },
  async run({ args }) {
    const currentVersion = require("../../../package.json").version;  // or import

    // Enhanced npx/bunx early detection
    const argv1 = process.argv[1] || '';
    const isNpx = process.env.npm_execpath?.includes('npx') || argv1.includes('/.npm/') || process.env.npm_lifecycle_script?.includes('npx');
    const isBunx = process.env.BUN_INSTALL || argv1.includes('.bun/bin/bunx') || argv1.includes('bunx');
    if (isNpx || isBunx) {
      ui.info("It looks like you're using doraval via npx or bunx.");
      ui.info("These always fetch the latest version on the next run.");
      ui.info("");
      ui.info("For easier updates, install globally:");
      ui.info("  brew install saif-shines/tap/doraval");
      ui.info("  npm install -g @hacksmith/doraval");
      ui.info("  bun add -g @hacksmith/doraval");
      process.exit(0);
    }

    const method = await detectInstallMethod();
    if (method.type === 'transient') {
      // Should not reach here after above check
      ui.info("Transient usage detected. Install globally for update support.");
      process.exit(0);
    }

    // Fetch and use for version check, --check exit, and conditional summary display
    const latestInfo = await fetchLatestVersionInfo();

    if (!shouldUpdate(currentVersion, latestInfo.version)) {
      ui.success(`doraval is up to date (${currentVersion}).`);
      process.exit(0);
    }

    if (args.check) {
      ui.info(`Update available: ${currentVersion} → ${latestInfo.version}`);
      process.exit(1);
    }

    // Heading and info (with summary) shown only when an update is available
    ui.heading("doraval update");
    ui.info(`  Current: ${currentVersion}`);
    ui.info(`  Latest:  ${latestInfo.version}\n`);
    ui.info(`  ${latestInfo.summary}\n`);

    if (!args.yes) {
      const confirmed = await confirmUpdate();
      if (!confirmed) {
        ui.info("Update cancelled.");
        process.exit(0);
      }
    }

    const cmd = buildUpgradeCommand(method);
    ui.info(`Running: ${cmd.join(' ')}\n`);

    const result = spawnSync(cmd[0]!, cmd.slice(1), { stdio: 'inherit' });

    if (result.status === 0) {
      ui.success(`Successfully updated to ${latestInfo.version}.`);
      ui.info("You may need to restart your shell to pick up the new version.");
      // Write marker
      await writeInstallMarker(method);
    } else {
      ui.fail("Update failed.");
      ui.info("Common fixes:");
      if (cmd[0] === 'brew') ui.info("  • Try: sudo brew upgrade doraval  or  ensure you are in the admin group");
      if (cmd[0] === 'npm' || cmd[0] === 'bun') ui.info("  • Try running with appropriate permissions or check network.");
      ui.info("\nRaw output above.");
      process.exit(result.status ?? 1);
    }
  },
});

async function confirmUpdate(): Promise<boolean> {
  // Simple async confirm using readline (project's prompt helper is sync + fallback-oriented).
  const { createInterface } = await import('node:readline');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('Update now? (y/N) ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}
