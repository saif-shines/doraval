import { defineCommand } from "citty";
import { existsSync, mkdirSync, unlinkSync, rmdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { ui } from "../../out.js";
import {
  buildJournalHookCommand,
  isJournalHookCommand,
  journalHookGroup,
  resolveDoraBinary,
} from "../../../core/journal-hook.js";

function getGlobalSettingsPath(): string {
  return join(homedir(), ".claude", "settings.json");
}

function getLocalHooksPath(): string {
  return join(process.cwd(), "hooks", "hooks.json");
}

async function readJson(file: string): Promise<any> {
  if (!existsSync(file)) return {};
  try {
    const raw = await Bun.file(file).text();
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeJson(file: string, data: any) {
  const dir = dirname(file);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  await Bun.write(file, JSON.stringify(data, null, 2) + "\n");
}

function hasHook(config: any): boolean {
  const sessionStart = config?.hooks?.SessionStart;
  if (!Array.isArray(sessionStart)) return false;
  return sessionStart.some((group: any) =>
    Array.isArray(group?.hooks) &&
    group.hooks.some((h: any) => isJournalHookCommand(h?.command))
  );
}

async function addHook(
  file: string,
  opts?: { quiet?: boolean; upgrade?: boolean }
): Promise<{ changed: boolean; path: string }> {
  const original = await readJson(file);
  const config = JSON.parse(JSON.stringify(original)); // deep clone

  if (!config.hooks) config.hooks = {};
  if (!Array.isArray(config.hooks.SessionStart)) {
    config.hooks.SessionStart = [];
  }

  const desiredCommand = buildJournalHookCommand({ quiet: opts?.quiet });

  if (hasHook(config)) {
    if (!opts?.upgrade) {
      return { changed: false, path: file };
    }
    config.hooks.SessionStart = config.hooks.SessionStart.map((group: any) => {
      if (!group || !Array.isArray(group.hooks)) return group;
      group.hooks = group.hooks.map((h: any) =>
        isJournalHookCommand(h?.command) ? { ...h, command: desiredCommand } : h
      );
      return group;
    });
    await writeJson(file, config);
    return { changed: true, path: file };
  }

  config.hooks.SessionStart.push(journalHookGroup({ quiet: opts?.quiet }));
  await writeJson(file, config);
  return { changed: true, path: file };
}

async function removeHook(file: string): Promise<{ changed: boolean; path: string }> {
  if (!existsSync(file)) return { changed: false, path: file };

  const original = await readJson(file);
  const config = JSON.parse(JSON.stringify(original));

  if (!config.hooks || !Array.isArray(config.hooks.SessionStart)) {
    return { changed: false, path: file };
  }

  const beforeLen = config.hooks.SessionStart.length;

  config.hooks.SessionStart = config.hooks.SessionStart
    .map((group: any) => {
      if (!group || !Array.isArray(group.hooks)) return group;
      group.hooks = group.hooks.filter((h: any) => !isJournalHookCommand(h?.command));
      return group;
    })
    .filter((group: any) => Array.isArray(group?.hooks) && group.hooks.length > 0);

  if (config.hooks.SessionStart.length === 0) {
    delete config.hooks.SessionStart;
  }
  if (config.hooks && Object.keys(config.hooks).length === 0) {
    delete config.hooks;
  }

  const changed = JSON.stringify(config) !== JSON.stringify(original);
  if (changed) {
    const isEmpty = !config || Object.keys(config).length === 0;
    if (isEmpty && existsSync(file)) {
      try { unlinkSync(file); } catch {}
      // clean up empty hooks/ dir we may have created (only if now empty)
      try {
        const dir = dirname(file);
        if (existsSync(dir) && readdirSync(dir).length === 0) rmdirSync(dir);
      } catch {}
    } else {
      await writeJson(file, config);
    }
  }
  return { changed: changed, path: file };
}

const enable = defineCommand({
  meta: {
    name: "enable",
    description: "Install the journal decisions hook (SessionStart) so decisions are injected into Claude sessions",
  },
  args: {
    global: {
      type: "boolean",
      alias: "g",
      description: "Install to global ~/.claude/settings.json (recommended)",
      default: false,
    },
    quiet: {
      type: "boolean",
      description: "Swallow hook errors (2>/dev/null || true) — default shows failures",
      default: false,
    },
    upgrade: {
      type: "boolean",
      description: "Replace an existing journal hook with the latest command (absolute dora path + --json)",
      default: false,
    },
  },
  async run({ args }) {
    const useGlobal = !!args.global;
    const target = useGlobal ? getGlobalSettingsPath() : getLocalHooksPath();
    const result = await addHook(target, {
      quiet: !!args.quiet,
      upgrade: !!args.upgrade,
    });
    const hookCmd = buildJournalHookCommand({ quiet: !!args.quiet });
    if (result.changed) {
      ui.success(`Enabled journal hook in ${result.path}`);
      ui.dim(`Hook command: ${hookCmd}`);
      if (useGlobal) {
        ui.info("Installed globally — affects all new Claude Code sessions.");
      } else {
        ui.info("Installed in hooks/hooks.json for this project.");
        ui.warn(
          "Project hooks/hooks.json only loads when Claude runs from this directory with the plugin active."
        );
        ui.info("For most setups, prefer: dora journal hook enable -g");
        ui.info("Or use: dora journal context --append-to CLAUDE.md");
      }
      ui.info(`Resolved dora binary: ${resolveDoraBinary()}`);
      ui.info("Start a new Claude session (or restart) for the hook to take effect.");
      ui.dim("The hook runs `dora journal context --json` on SessionStart.");
      ui.info("Preview plain text: dora journal context");
      ui.info("Preview hook JSON: dora journal context --json");
    } else {
      ui.info(`Journal hook is already enabled in ${result.path}`);
      ui.info("To migrate an older hook, run: dora journal hook enable --upgrade" + (useGlobal ? " -g" : ""));
    }
  },
});

const disable = defineCommand({
  meta: {
    name: "disable",
    description: "Remove the journal decisions hook from Claude configuration",
  },
  args: {
    global: {
      type: "boolean",
      alias: "g",
      description: "Remove from global ~/.claude/settings.json",
      default: false,
    },
  },
  async run({ args }) {
    const useGlobal = !!args.global;
    const target = useGlobal ? getGlobalSettingsPath() : getLocalHooksPath();
    const result = await removeHook(target);
    if (result.changed) {
      ui.success(`Disabled journal hook in ${result.path}`);
      ui.info("The decisions will no longer be injected on new SessionStart.");
    } else {
      ui.info(`Journal hook was not present in ${result.path}`);
    }
  },
});

async function printHookStatus() {
  const localPath = getLocalHooksPath();
  const globalPath = getGlobalSettingsPath();

  const localHas = hasHook(await readJson(localPath));
  const globalHas = hasHook(await readJson(globalPath));

  if (localHas) {
    ui.success(`Enabled in project: ${localPath}`);
  }
  if (globalHas) {
    ui.success(`Enabled globally: ${globalPath}`);
  }
  if (!localHas && !globalHas) {
    ui.info("Journal hook is not installed.");
    ui.info("Run `dora journal hook enable -g` to install it (recommended).");
  } else {
    ui.dim(`Expected command shape: ${buildJournalHookCommand()}`);
  }
}

const status = defineCommand({
  meta: {
    name: "status",
    description: "Check where the journal hook is currently installed",
  },
  async run() {
    await printHookStatus();
  },
});

export default defineCommand({
  meta: {
    name: "hook",
    description: "Manage Claude hooks for automatically injecting journal decisions",
  },
  subCommands: {
    enable: () => Promise.resolve(enable),
    disable: () => Promise.resolve(disable),
    status: () => Promise.resolve(status),
  },
  async run() {
    // bare `dora journal hook` -> show status (common UX pattern)
    const cliArgs = process.argv.slice(2);
    const hookIdx = cliArgs.indexOf("hook");
    if (hookIdx !== -1 && cliArgs.length > hookIdx + 1) return;
    await printHookStatus();
  },
});

// --- Pure exports for the local UI dashboard and other consumers ---
export {
  getGlobalSettingsPath,
  getLocalHooksPath,
  hasHook,
  addHook,
  removeHook,
  readJson as readHookConfig,
  writeJson as writeHookConfig,
  buildJournalHookCommand,
  isJournalHookCommand,
};
