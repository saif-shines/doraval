/**
 * Single source of truth for doraval's command tree.
 *
 * index.ts builds the real citty CLI from these exports. completion-script.ts
 * introspects the same objects (Object.keys on subCommands — citty's
 * defineCommand is an identity function, so this reads names without
 * invoking any lazy import) to generate shell completions. Add a command
 * here once and both the CLI and its completions pick it up.
 */
import { defineCommand, showUsage } from "citty";

/**
 * Command group: bare invocation lists (or usage), otherwise the subcommand runs.
 */
export function defineGroup(
  name: string,
  description: string,
  subCommands: Parameters<typeof defineCommand>[0]["subCommands"],
  list?: () => Promise<{ default: { run?: (ctx: unknown) => unknown } }>,
) {
  const group = defineCommand({
    meta: { name, description },
    args: {
      format: { type: "string", description: "Output format: table | json", default: "table" },
      json: { type: "boolean", description: "Alias for --format json", default: false },
      ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
      cwd: { type: "string", description: "Working directory override" },
    },
    subCommands,
    async run(ctx) {
      const cliArgs = process.argv.slice(2);
      if (cliArgs[0] === name && cliArgs[1] && !cliArgs[1].startsWith("-")) return;
      if (list) {
        const m = await list();
        await m.default.run?.(ctx);
        return;
      }
      showUsage(group);
    },
  });
  return group;
}

export const skill = defineGroup(
  "skill",
  "List Skills; unused, remove, restore, new",
  {
    unused: () => import("./commands/skill/unused.js").then((m) => m.default),
    remove: () => import("./commands/skill/remove.js").then((m) => m.default),
    restore: () => import("./commands/skill/restore.js").then((m) => m.default),
    new: () => import("./commands/new.js").then((m) => m.default),
  },
  () => import("./commands/skill/list.js"),
);

export const memory = defineGroup(
  "memory",
  "Capture principles; enforce in review; promote to AGENTS.md",
  {
    add: () => import("./commands/memory/add.js").then((m) => m.default),
    list: () => import("./commands/memory/list.js").then((m) => m.default),
    context: () => import("./commands/memory/context.js").then((m) => m.default),
    promote: () => import("./commands/memory/promote.js").then((m) => m.default),
    stash: () => import("./commands/memory/stash.js").then((m) => m.default),
    restore: () => import("./commands/memory/restore.js").then((m) => m.default),
    sync: () => import("./commands/memory/sync.js").then((m) => m.default),
  },
  () => import("./commands/memory/list.js"),
);

export const agent = defineGroup(
  "agent",
  "List Subagents; new",
  {
    new: () => import("./commands/new.js").then((m) => m.default),
  },
  () => import("./commands/agent/list.js"),
);

export const plugin = defineGroup(
  "plugin",
  "List Plugins; new; bump semver",
  {
    new: () => import("./commands/new.js").then((m) => m.default),
    bump: () => import("./commands/bump.js").then((m) => m.default),
  },
  () => import("./commands/plugin/list.js"),
);

export const config = () => import("./commands/config.js").then((m) => m.default);
export const rule = () => import("./commands/rules.js").then((m) => m.default);

/** The exact subCommands map used to build the root `doraval` command. */
export const topLevelSubCommands = {
  review: () => import("./commands/review.js").then((m) => m.default),
  fix: () => import("./commands/fix.js").then((m) => m.default),
  scan: () => import("./commands/scan.js").then((m) => m.default),
  skill: () => Promise.resolve(skill),
  rule,
  session: () => import("./commands/sessions.js").then((m) => m.default),
  memory: () => Promise.resolve(memory),
  conflicts: () => import("./commands/reconcile.js").then((m) => m.default),
  config,
  agent: () => Promise.resolve(agent),
  plugin: () => Promise.resolve(plugin),
  update: () => import("./commands/update.js").then((m) => m.default),
  probe: () => import("./commands/probe.js").then((m) => m.default),
};
