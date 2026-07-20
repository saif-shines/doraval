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
 * Define a command group that shows its own usage when invoked bare
 * (e.g. `dora skill`) but defers to the matched subcommand otherwise.
 * Collapses the repeated `run()` guard that used to be hand-written per group.
 */
export function defineGroup(
  name: string,
  description: string,
  subCommands: Parameters<typeof defineCommand>[0]["subCommands"]
) {
  const group = defineCommand({
    meta: { name, description },
    subCommands,
    run() {
      const cliArgs = process.argv.slice(2);
      if (cliArgs[0] === name && cliArgs.length > 1) return;
      showUsage(group);
    },
  });
  return group;
}

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
  }
);

// config command module already defines its own subCommands (set/get)
export const config = () => import("./commands/config.js").then((m) => m.default);
export const rules = () => import("./commands/rules.js").then((m) => m.default);

/** The exact subCommands map used to build the root `doraval` command. */
export const topLevelSubCommands = {
  // ── primary ────────────────────────────────────────────────────
  scan: () => import("./commands/scan.js").then((m) => m.default),
  review: () => import("./commands/review.js").then((m) => m.default),
  fix: () => import("./commands/fix.js").then((m) => m.default),
  new: () => import("./commands/new.js").then((m) => m.default),
  memory: () => Promise.resolve(memory),
  reconcile: () => import("./commands/reconcile.js").then((m) => m.default),
  config,
  rules,
  sessions: () => import("./commands/sessions.js").then((m) => m.default),
  // ── tooling ────────────────────────────────────────────────────
  bump: () => import("./commands/bump.js").then((m) => m.default),
  update: () => import("./commands/update.js").then((m) => m.default),
  providers: () => import("./commands/providers.js").then((m) => m.default),
};
