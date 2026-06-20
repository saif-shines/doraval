import { defineCommand } from "citty";
import { existsSync, mkdirSync, unlinkSync, rmdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { ui } from "../../out.js";

const HOOK_COMMAND = "sh -c 'dora journal context 2>/dev/null || true'";
const HOOK_GROUP = {
  hooks: [
    {
      type: "command",
      command: HOOK_COMMAND,
    },
  ],
};

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
    group.hooks.some((h: any) => h?.command === HOOK_COMMAND)
  );
}

async function addHook(file: string): Promise<{ changed: boolean; path: string }> {
  const original = await readJson(file);
  const config = JSON.parse(JSON.stringify(original)); // deep clone

  if (!config.hooks) config.hooks = {};
  if (!Array.isArray(config.hooks.SessionStart)) {
    config.hooks.SessionStart = [];
  }

  if (hasHook(config)) {
    return { changed: false, path: file };
  }

  config.hooks.SessionStart.push(HOOK_GROUP);
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
      group.hooks = group.hooks.filter((h: any) => h?.command !== HOOK_COMMAND);
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
      description: "Install to global ~/.claude/settings.json (instead of project hooks/hooks.json)",
      default: false,
    },
  },
  async run({ args }) {
    const useGlobal = !!args.global;
    const target = useGlobal ? getGlobalSettingsPath() : getLocalHooksPath();
    const result = await addHook(target);
    if (result.changed) {
      ui.success(`Enabled journal hook in ${result.path}`);
      if (useGlobal) {
        ui.info("Installed globally — will affect all new Claude sessions (your typical setup with many plugins).");
      } else {
        ui.info("Installed locally for this project — will affect Claude sessions started from this directory.");
        ui.info("If your Claude hooks live in the global ~/.claude/settings.json (very common), re-run with -g/--global.");
      }
      ui.info("Start a new Claude session (or restart) for the hook to take effect.");
      ui.dim("The hook runs `dora journal context` on SessionStart and injects your active decisions.");
      ui.info("Preview what gets injected: dora journal context");
      ui.info("Test inside Claude: ask it to list or recall your recent journal decisions.");
    } else {
      ui.info(`Journal hook is already enabled in ${result.path}`);
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
    ui.info("Run `dora journal hook enable` to install it.");
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
};
