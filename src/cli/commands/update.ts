import { defineCommand } from "citty";
import { ui } from "../out.js";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { realpath, access } from "node:fs/promises";
import {
  detectInstallMethod,
  fetchLatestVersionInfo,
  buildUpgradeCommand,
  shouldUpdate,
  readMarker,
  writeMarker,
} from "../../core/update.js";
import type { InstallMethod, DetectCtx, InstallMarker } from "../../core/update.js";

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
    via: {
      type: "string",
      description: 'Force install method detection: "homebrew" | "npm" | "bun"',
    },
  },
  async run({ args }) {
    const currentVersion = require("../../../package.json").version;

    const entrypoint = fileURLToPath(import.meta.url);

    const ctx: DetectCtx = {
      entrypoint,
      argv: process.argv,
      env: process.env,
      homeDir: homedir(),
      realpath: (p: string) => realpath(p),
      exists: async (p: string) => {
        try {
          await access(p);
          return true;
        } catch {
          return false;
        }
      },
      run: async (cmd: string, args: string[]) => {
        const res = spawnSync(cmd, args, { encoding: "utf8" });
        return { ok: res.status === 0, stdout: res.stdout || "" };
      },
      readMarker,
    };

    const method = await detectInstallMethod(ctx, args.via ? { force: args.via } : undefined);

    if (method.type === "transient") {
      ui.info("It looks like you're using doraval via npx or bunx.");
      ui.info("These always fetch the latest version on the next run.");
      ui.info("");
      ui.info("For easier updates, install globally:");
      ui.info("  brew install saif-shines/tap/doraval");
      ui.info("  npm install -g @hacksmith/doraval");
      ui.info("  bun add -g @hacksmith/doraval");
      process.exit(0);
    }

    if (method.type === "unknown") {
      ui.fail(`Could not determine how doraval was installed: ${method.reason}`);
      ui.info("You can force it with --via homebrew|npm|bun");
      process.exit(2);
    }

    const latestInfo = await fetchLatestVersionInfo();

    if (!shouldUpdate(currentVersion, latestInfo.version)) {
      ui.success(`doraval is up to date (${currentVersion}).`);
      process.exit(0);
    }

    if (args.check) {
      ui.info(`Update available: ${currentVersion} → ${latestInfo.version}`);
      process.exit(1);
    }

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
    ui.info(`Running: ${cmd.join(" ")}\n`);

    const result = spawnSync(cmd[0]!, cmd.slice(1), { stdio: "inherit" });

    if (result.status === 0) {
      ui.success(`Successfully updated to ${latestInfo.version}.`);
      ui.info("You may need to restart your shell to pick up the new version.");

      const marker: InstallMarker = {
        type: method.type,
        packageRoot: undefined,
        entrypointRealpath: await realpath(entrypoint).catch(() => entrypoint),
        version: latestInfo.version,
        writtenAt: new Date().toISOString(),
      };
      await writeMarker(marker);
    } else {
      ui.fail("Update failed.");
      ui.info("Common fixes:");
      if (cmd[0] === "brew") {
        ui.info("  • Try: sudo brew upgrade doraval  or  ensure you are in the admin group");
      }
      if (cmd[0] === "npm" || cmd[0] === "bun") {
        ui.info("  • Try running with appropriate permissions or check network.");
      }
      ui.info("\nRaw output above.");
      process.exit(result.status ?? 1);
    }
  },
});

async function confirmUpdate(): Promise<boolean> {
  const { createInterface } = await import("node:readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("Update now? (y/N) ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith("y"));
    });
  });
}
