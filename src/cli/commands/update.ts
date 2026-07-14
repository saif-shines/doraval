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
import { exit } from "../render/exit.js";

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
      description: "Force install method: homebrew | npm | bun (skips auto-detect)",
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

    let method: InstallMethod;

    if (args.via) {
      const f = args.via;
      if (['homebrew', 'npm', 'bun'].includes(f)) {
        method = { type: f as any, source: 'user' };
      } else if (f === 'npx' || f === 'bunx') {
        method = { type: 'transient', via: f as any, source: 'path' };
      } else {
        ui.fail(`Invalid --via value: "${f}". Valid: homebrew | npm | bun (or npx | bunx for transient).`);
        ui.info("Use --via to bypass detection for scripts/CI.");
        return await exit(2);
      }
    } else {
      method = await detectInstallMethod(ctx);
    }

    if (method.type === "transient") {
      ui.info("It looks like you're using doraval via npx or bunx.");
      ui.info("These always fetch the latest version on the next run.");
      ui.info("");
      ui.info("For easier updates, install globally:");
      ui.info("");
      ui.info("macOS (Homebrew, recommended):");
      ui.info("  brew tap saif-shines/tap");
      ui.info("  brew trust saif-shines/tap");
      ui.info("  brew install doraval");
      ui.info("");
      ui.info("npm:");
      ui.info("  npm install -g @hacksmith/doraval");
      ui.info("");
      ui.info("Bun:");
      ui.info("  bun add -g @hacksmith/doraval");
      return await exit(0);
    }

    const latestInfo = await fetchLatestVersionInfo();

    if (!shouldUpdate(currentVersion, latestInfo.version)) {
      ui.success(`doraval is up to date (${currentVersion}).`);
      return await exit(0);
    }

    if (args.check) {
      ui.info(`Update available: ${currentVersion} → ${latestInfo.version}`);
      return await exit(1);
    }

    ui.heading("doraval update");
    ui.info(`  Current: ${currentVersion}`);
    ui.info(`  Latest:  ${latestInfo.version}\n`);
    ui.info(`  ${latestInfo.summary}\n`);

    // Only prompt for unknown installs when we are actually going to upgrade.
    // --check and "up to date" cases never need the method.
    if (method.type === "unknown") {
      ui.fail(`Could not determine how doraval was installed: ${method.reason}`);
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        ui.info("Use --via homebrew|npm|bun to specify (non-interactive).");
        return await exit(2);
      }
      const chosen = await promptInstallMethod();
      if (chosen) {
        method = { type: chosen, source: 'user' } as InstallMethod;
      } else {
        ui.info("Update cancelled.");
        return await exit(0);
      }
    }

    if (!args.yes) {
      const confirmed = await confirmUpdate();
      if (!confirmed) {
        ui.info("Update cancelled.");
        return await exit(0);
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
        ui.info("  • For custom taps (e.g. saif-shines/tap): run `brew trust saif-shines/tap`");
        ui.info("    or `brew trust --formula saif-shines/tap/doraval`");
      }
      if (cmd[0] === "npm" || cmd[0] === "bun") {
        ui.info("  • Try running with appropriate permissions or check network.");
      }
      ui.info("\nRaw output above.");
      await exit(result.status ?? 1);
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

async function promptInstallMethod(): Promise<'homebrew' | 'npm' | 'bun' | null> {
  const { createInterface } = await import("node:readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    ui.info("How was doraval installed?");
    ui.info("  1. homebrew (brew tap + trust + brew install doraval)");
    ui.info("  2. npm    (npm install -g @hacksmith/doraval)");
    ui.info("  3. bun    (bun add -g @hacksmith/doraval)");
    rl.question("Enter 1, 2, or 3 (or q to cancel): ", (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (a === "1" || a === "homebrew") return resolve("homebrew");
      if (a === "2" || a === "npm") return resolve("npm");
      if (a === "3" || a === "bun") return resolve("bun");
      if (a === "q" || a === "quit" || a === "cancel") return resolve(null);
      ui.info("Invalid choice.");
      resolve(null);
    });
  });
}
