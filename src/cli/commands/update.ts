import { defineCommand } from "citty";
import { ui } from "../out.js";
import { spawnSync } from "node:child_process";
import {
  detectInstallMethod,
  fetchLatestVersionInfo,
  buildUpgradeCommand,
  shouldUpdate,
  InstallMethod,
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

    // Early npx/bunx detection (simple for now)
    const isTransient = process.env.npm_lifecycle_event || process.argv[1]?.includes('npx') || process.argv[1]?.includes('bunx');
    if (isTransient) {
      ui.info("It looks like you're using doraval via npx or bunx.");
      ui.info("These always fetch the latest on the next run.");
      ui.info("For easier updates, install globally with brew, npm, or bun.");
      process.exit(0);
    }

    const method = await detectInstallMethod();
    if (method.type === 'transient') {
      // Should not reach here after above check
      ui.info("Transient usage detected. Install globally for update support.");
      process.exit(0);
    }

    const latestInfo = await fetchLatestVersionInfo();
    const latest = latestInfo.version;

    if (!shouldUpdate(currentVersion, latest)) {
      ui.success(`doraval is up to date (${currentVersion}).`);
      process.exit(0);
    }

    if (args.check) {
      ui.info(`Update available: ${currentVersion} → ${latest}`);
      process.exit(1);
    }

    ui.heading("doraval update");
    ui.info(`  Current: ${currentVersion}`);
    ui.info(`  Latest:  ${latest}\n`);
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

    const result = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' });

    if (result.status === 0) {
      ui.success(`Successfully updated to ${latest}.`);
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
  // Reuse or simple prompt. For now use a basic implementation.
  // In real, import from prompt.ts or use readline
  const { createInterface } = await import('node:readline');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('Update now? (y/N) ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

async function writeInstallMarker(method: InstallMethod) {
  // simple re-export or duplicate for now; will clean in refactor
  const { writeInstallMarker } = await import("../../core/update.js");
  await writeInstallMarker(method);
}
