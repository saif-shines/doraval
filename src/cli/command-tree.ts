/**
 * Single source of truth for doraval's command tree.
 *
 * index.ts builds the real citty CLI from these exports. completion.ts
 * introspects the same objects (Object.keys on subCommands — citty's
 * defineCommand is an identity function, so this reads names without
 * invoking any lazy import) to generate shell completions. Add a command
 * here once and both the CLI and its completions pick it up.
 *
 * `evals setup` is the one exception: citty subCommand matching rejects a
 * bare path like `.` as an unknown command, so `evals` dispatches "setup"
 * vs. a skill path manually inside its own `run()` (see commands/evals.ts)
 * instead of via `subCommands`. It won't show up in Object.keys(evals) —
 * completion.ts lists it by hand for that reason.
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

export const skill = defineGroup(
  "skill",
  "Validate, measure drift, run sessions with prompts, and judge AI agent skills",
  {
    validate: () =>
      import("./commands/validate.js").then((m) => m.default),
    lint: () => import("./commands/skill-lint.js").then((m) => m.default),
    drift: () => import("./commands/drift.js").then((m) => m.default),
    judge: () => import("./commands/judge.js").then((m) => m.default),
  }
);

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

export const ui = defineCommand({
  meta: {
    name: "ui",
    description: "Launch the local doraval web dashboard (no more typing commands for common tasks)",
  },
  args: {
    port: {
      type: "string",
      description: "Port to run the local UI server on (default 3737)",
      default: "3737",
    },
    open: {
      type: "boolean",
      description: "Automatically open the dashboard in your browser",
      default: true,
    },
    host: {
      type: "string",
      description: "Host to bind (default 127.0.0.1 for local only)",
      default: "127.0.0.1",
    },
    status: {
      type: "boolean",
      description: "Check if a dashboard is running and print its URL (no start)",
      default: false,
    },
    force: {
      type: "boolean",
      description: "Force start/restart even if one is already running",
      default: false,
    },
  },
  async run({ args }) {
    // Always delegate for `dora ui` (with or without flags). The old guard pattern was only for groups that show usage.
    await import("./commands/ui.js").then((m) => m.default.run({ args }));
  },
});

/** The exact subCommands map used to build the root `doraval` command. */
export const topLevelSubCommands = {
  scan: () => import("./commands/scan.js").then((m) => m.default),
  validate: () =>
    import("./commands/validate-top.js").then((m) => m.default),
  bump: () => import("./commands/bump.js").then((m) => m.default),
  update: () => import("./commands/update.js").then((m) => m.default),
  providers: () => import("./commands/providers.js").then((m) => m.default),
  completion: () => import("./commands/completion.js").then((m) => m.default),
  skill: () => Promise.resolve(skill),
  journal: () => Promise.resolve(journal),
  eval: () => import("./commands/judge.js").then((m) => m.default),
  // Dual: `evals setup` configures LLM; `evals <path>` aliases judge (see commands/evals.ts)
  evals: () => import("./commands/evals.js").then((m) => m.default),
  drift: () => import("./commands/drift.js").then((m) => m.default),
  config,
  claude: () => Promise.resolve(claude),
  codex: () => Promise.resolve(codex),
  cursor: () => Promise.resolve(cursor),
  copilot: () => Promise.resolve(copilot),
  ui: () => Promise.resolve(ui),
};
