/**
 * Single source of truth for doraval's command tree.
 *
 * index.ts builds the real citty CLI from these exports. completion.ts
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

export const journal = defineGroup(
  "journal",
  "Decision & note memory (with optional pushback/tags) — record, view, and sync project principles and useful notes",
  {
    init: () =>
      import("./commands/journal/init.js").then((m) => m.default),
    list: () =>
      import("./commands/journal/list.js").then((m) => m.default),
    context: () =>
      import("./commands/journal/context.js").then((m) => m.default),
    hook: () =>
      import("./commands/journal/hook.js").then((m) => m.default),
    update: () =>
      import("./commands/journal/update.js").then((m) => m.default),
    add: () =>
      import("./commands/journal/add.js").then((m) => m.default),
    sync: () =>
      import("./commands/journal/sync.js").then((m) => m.default),
  }
);

export const memory = defineGroup(
  "memory",
  "Project principles — capture, enforce in review, promote to AGENTS.md",
  {
    add: () => import("./commands/memory/add.js").then((m) => m.default),
    list: () => import("./commands/memory/list.js").then((m) => m.default),
    stash: () => import("./commands/memory/stash.js").then((m) => m.default),
  }
);

// config command module already defines its own subCommands (set/get)
export const config = () => import("./commands/config.js").then((m) => m.default);

export const claude = defineGroup(
  "claude",
  "Claude Code-specific commands (packaging, scaffolding, distribution)",
  {
    new: () => import("./commands/claude/new.js").then((m) => m.default),
    bump: () => import("./commands/bump.js").then((m) => m.default),
  }
);

export const codex = defineGroup(
  "codex",
  "Codex (OpenAI)-specific commands (packaging, scaffolding, distribution)",
  {
    new: () => import("./commands/codex/new.js").then((m) => m.default),
    bump: () => import("./commands/bump.js").then((m) => m.default),
  }
);

export const cursor = defineGroup(
  "cursor",
  "Cursor-specific commands (packaging, scaffolding, distribution)",
  {
    new: () => import("./commands/cursor/new.js").then((m) => m.default),
    bump: () => import("./commands/bump.js").then((m) => m.default),
  }
);

export const copilot = defineGroup(
  "copilot",
  "Copilot CLI-specific commands (packaging, scaffolding, distribution)",
  {
    new: () => import("./commands/copilot/new.js").then((m) => m.default),
    bump: () => import("./commands/bump.js").then((m) => m.default),
  }
);

/** The exact subCommands map used to build the root `doraval` command. */
export const topLevelSubCommands = {
  scan: () => import("./commands/scan.js").then((m) => m.default),
  review: () => import("./commands/review.js").then((m) => m.default),
  fix: () => import("./commands/fix.js").then(m => m.default),
  bump: () => import("./commands/bump.js").then((m) => m.default),
  update: () => import("./commands/update.js").then((m) => m.default),
  providers: () => import("./commands/providers.js").then((m) => m.default),
  completion: () => import("./commands/completion.js").then((m) => m.default),
  journal: () => Promise.resolve(journal),
  memory: () => Promise.resolve(memory),
  config,
  claude: () => Promise.resolve(claude),
  codex: () => Promise.resolve(codex),
  cursor: () => Promise.resolve(cursor),
  copilot: () => Promise.resolve(copilot),
  sessions: () => import("./commands/sessions.js").then((m) => m.default),
};
