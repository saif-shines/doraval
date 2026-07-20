import { isCancel, select } from "@clack/prompts";
import { defineCommand } from "citty";
import type { RuleOverride } from "../../core/journal-config.js";
import { ui, outJson, resolveOutputMode } from "../out.js";
import { exit } from "../render/exit.js";
import {
  applyOverride,
  applyPackage,
  buildListRows,
  explainRule,
  persist,
  readConfig,
  resolveScope,
  type Scope,
} from "./rules-core.js";

const scopeArgs = {
  global: { type: "boolean" as const, description: "Apply to global config", default: false },
  project: {
    type: "boolean" as const,
    description: "Apply to the current registered project",
    default: false,
  },
};

function isInteractive(): boolean {
  return process.stdin.isTTY === true && process.stderr.isTTY === true;
}

async function withScope(
  args: { global?: boolean; project?: boolean; cwd?: string },
  run: (
    config: Awaited<ReturnType<typeof readConfig>>,
    scope: Scope,
    cwd: string,
  ) => Promise<void>,
): Promise<void> {
  const cwd = args.cwd || process.cwd();
  const config = await readConfig();
  const result = resolveScope(config, { global: args.global, project: args.project, cwd });
  if (!result.ok) {
    ui.fail(result.error);
    return await exit(1);
  }
  await run(config, result.scope, cwd);
}

const rulesList = defineCommand({
  meta: { name: "list", description: "List rules and their effective state" },
  args: {
    ...scopeArgs,
    package: { type: "string", description: "Preview a package instead of stored config" },
    format: { type: "string", description: "Output format: table | json", default: "table" },
    json: { type: "boolean", description: "Output JSON", default: false },
    ci: { type: "boolean", description: "Machine mode (implies JSON)", default: false },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    const mode = resolveOutputMode({
      format: args.json ? "json" : (args.format as string),
      ci: args.ci as boolean,
    });
    await withScope(args, async (config, scope, cwd) => {
      const effectiveCwd = scope.kind === "global" ? "" : cwd;
      const rows = buildListRows(config, effectiveCwd, args.package as string | undefined);
      if (mode.format === "json") {
        outJson(rows);
        return await exit(0);
      }
      for (const row of rows) {
        ui.write(
          `${row.enabled ? "[x]" : "[ ]"} ${row.code}  ${row.slug.padEnd(24)} ${row.severity.padEnd(8)}${row.locked ? " 🔒" : ""}`,
        );
      }
      return await exit(0);
    });
  },
});

function onOff(name: "on" | "off", value: RuleOverride) {
  return defineCommand({
    meta: { name, description: `Turn a rule ${name}` },
    args: {
      ...scopeArgs,
      rule: { type: "positional" as const, description: "Rule code or slug", required: true },
      cwd: { type: "string" as const, description: "Working directory override" },
    },
    async run({ args }) {
      await withScope(args, async (config, scope) => {
        const result = applyOverride(config, scope, args.rule as string, value);
        if (!result.ok) {
          ui.fail(result.error);
          return await exit(1);
        }
        await persist(result.config);
        ui.success(result.message);
        return await exit(0);
      });
    },
  });
}

const rulesSet = defineCommand({
  meta: { name: "set", description: "Set a rule severity" },
  args: {
    ...scopeArgs,
    rule: { type: "positional", description: "Rule code or slug", required: true },
    assignment: {
      type: "positional",
      description: "severity=error|warning|fyi",
      required: true,
    },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    const match = String(args.assignment).match(/^severity=(error|warning|fyi)$/);
    if (!match) {
      ui.fail("Expected severity=error|warning|fyi");
      return await exit(1);
    }
    await withScope(args, async (config, scope) => {
      const result = applyOverride(config, scope, args.rule as string, match[1] as RuleOverride);
      if (!result.ok) {
        ui.fail(result.error);
        return await exit(1);
      }
      await persist(result.config);
      ui.success(result.message);
      return await exit(0);
    });
  },
});

const rulesPackage = defineCommand({
  meta: { name: "package", description: "Set the base rules package" },
  args: {
    ...scopeArgs,
    name: {
      type: "positional",
      description: "recommended | strict | minimal",
      required: true,
    },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    await withScope(args, async (config, scope) => {
      const result = applyPackage(config, scope, args.name as string);
      if (!result.ok) {
        ui.fail(result.error);
        return await exit(1);
      }
      await persist(result.config);
      ui.success(result.message);
      return await exit(0);
    });
  },
});

const rulesExplain = defineCommand({
  meta: { name: "explain", description: "Explain a rule" },
  args: {
    rule: { type: "positional", description: "Rule code or slug", required: true },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    const result = explainRule(
      await readConfig(),
      (args.cwd as string | undefined) || process.cwd(),
      args.rule as string,
    );
    if (!result.ok) {
      ui.fail(result.error);
      return await exit(1);
    }
    for (const line of result.lines) ui.write(line);
    return await exit(0);
  },
});

async function runInteractive(): Promise<void> {
  const cwd = process.cwd();
  let config = await readConfig();
  const scopeResult = resolveScope(config, { cwd });
  const scope: Scope = scopeResult.ok ? scopeResult.scope : { kind: "global" };

  ui.heading("dora rules");
  ui.dim(scope.kind === "project" ? `Scope: project (${scope.name})` : "Scope: global");

  for (;;) {
    const rows = buildListRows(config, cwd);
    const choice = await select({
      message: "Toggle a rule",
      output: process.stderr,
      options: [
        { value: "__package", label: "Change package…" },
        ...rows.map((row) => ({
          value: row.code,
          label: `${row.enabled ? "[x]" : "[ ]"} ${row.code} ${row.slug} (${row.severity})${row.locked ? " 🔒" : ""}`,
        })),
        { value: "__quit", label: "Save & quit" },
      ],
    });
    if (isCancel(choice) || choice === "__quit") break;

    if (choice === "__package") {
      const packageName = await select({
        message: "Package",
        output: process.stderr,
        options: ["recommended", "strict", "minimal"].map((value) => ({ value, label: value })),
      });
      if (!isCancel(packageName)) {
        const result = applyPackage(config, scope, packageName as string);
        if (result.ok) {
          config = result.config;
          await persist(config);
        } else ui.fail(result.error);
      }
      continue;
    }

    const row = rows.find((candidate) => candidate.code === choice)!;
    const result = applyOverride(config, scope, row.code, row.enabled ? "off" : "on");
    if (result.ok) {
      config = result.config;
      await persist(config);
      ui.success(result.message);
    } else ui.fail(result.error);
  }

  ui.success("Saved.");
  return await exit(0);
}

export default defineCommand({
  meta: { name: "rules", description: "View and configure dora review rules" },
  subCommands: {
    list: rulesList,
    on: onOff("on", "on"),
    off: onOff("off", "off"),
    set: rulesSet,
    package: rulesPackage,
    explain: rulesExplain,
  },
  async run() {
    if (!isInteractive()) {
      ui.info("Usage: dora rules <list|on|off|set|package|explain> [--global|--project]");
      return await exit(0);
    }
    await runInteractive();
  },
});
