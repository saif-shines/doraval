import { isCancel, select } from "@clack/prompts";
import { defineCommand } from "citty";
import type { RuleOverride } from "../../core/journal-config.js";
import { outJson, resolveOutputMode, ui, type OutputMode } from "../out.js";
import { exit } from "../render/exit.js";
import {
  applyOverride,
  applyPackage,
  buildListRows,
  explainRule,
  formatRulesListHuman,
  persist,
  readRulesConfig,
  resolveListPackageName,
  resolveScope,
  validatePackagePreview,
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

const outputArgs = {
  format: { type: "string" as const, description: "Output format: table | json", default: "table" },
  json: { type: "boolean" as const, description: "Output JSON", default: false },
  ci: { type: "boolean" as const, description: "Machine mode (implies JSON)", default: false },
};

type CommonArgs = {
  global?: boolean;
  project?: boolean;
  cwd?: string;
  format?: string;
  json?: boolean;
  ci?: boolean;
};

function modeFor(args: CommonArgs): OutputMode {
  return resolveOutputMode({ format: args.json ? "json" : args.format, ci: args.ci });
}

async function failRules(message: string, mode: OutputMode): Promise<never> {
  if (mode.format === "json") {
    process.stderr.write(JSON.stringify({ error: { message } }) + "\n");
  } else {
    ui.fail(message);
  }
  return await exit(1);
}

function emitSuccess(message: string, mode: OutputMode): void {
  if (mode.format === "json") outJson({ message });
  else ui.success(message);
}

function isInteractive(): boolean {
  return process.stdin.isTTY === true && process.stderr.isTTY === true;
}

async function withScope(
  args: CommonArgs,
  mode: OutputMode,
  run: (
    config: Extract<Awaited<ReturnType<typeof readRulesConfig>>, { ok: true }>["config"],
    scope: Scope,
    cwd: string,
  ) => Promise<void>,
): Promise<void> {
  const cwd = args.cwd || process.cwd();
  const loaded = await readRulesConfig();
  if (!loaded.ok) return await failRules(loaded.error, mode);

  const scoped = resolveScope(loaded.config, {
    global: args.global,
    project: args.project,
    cwd,
  });
  if (!scoped.ok) return await failRules(scoped.error, mode);

  try {
    await run(loaded.config, scoped.scope, cwd);
  } catch (error) {
    return await failRules(error instanceof Error ? error.message : String(error), mode);
  }
}

const rulesList = defineCommand({
  meta: { name: "list", description: "List rules and their effective state" },
  args: {
    ...scopeArgs,
    ...outputArgs,
    package: { type: "string", description: "Preview a package instead of stored config" },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    const mode = modeFor(args);
    const packageName = args.package as string | undefined;
    const packageError = validatePackagePreview(packageName);
    if (packageError) return await failRules(packageError, mode);

    await withScope(args, mode, async (config, scope, cwd) => {
      const listCwd = scope.kind === "global" ? "" : cwd;
      const rows = buildListRows(config, listCwd, packageName);
      if (mode.format === "json") {
        outJson(rows);
        return await exit(0);
      }
      const scopeLabel =
        scope.kind === "project" ? `scope: project (${scope.name})` : "scope: global";
      const packageLabel = resolveListPackageName(config, listCwd, packageName);
      for (const line of formatRulesListHuman(rows, {
        packageName: packageName ? `${packageLabel} (preview)` : packageLabel,
        scopeLabel,
      })) {
        ui.write(line);
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
      ...outputArgs,
      rule: { type: "positional" as const, description: "Rule code or slug", required: false },
      cwd: { type: "string" as const, description: "Working directory override" },
    },
    async run({ args }) {
      const mode = modeFor(args);
      const rule = args.rule as string | undefined;
      if (!rule) return await failRules(`Missing rule. Usage: dora rules ${name} <rule>.`, mode);
      await withScope(args, mode, async (config, scope) => {
        const result = applyOverride(config, scope, rule, value);
        if (!result.ok) return await failRules(result.error, mode);
        await persist(result.config);
        emitSuccess(result.message, mode);
        return await exit(0);
      });
    },
  });
}

const rulesSet = defineCommand({
  meta: { name: "set", description: "Set a rule severity" },
  args: {
    ...scopeArgs,
    ...outputArgs,
    rule: { type: "positional", description: "Rule code or slug", required: false },
    assignment: {
      type: "positional",
      description: "severity=error|warning|fyi",
      required: false,
    },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    const mode = modeFor(args);
    const rule = args.rule as string | undefined;
    if (!rule) return await failRules("Missing rule. Usage: dora rules set <rule> severity=<level>.", mode);
    const assignment = args.assignment as string | undefined;
    if (!assignment) {
      return await failRules("Missing severity assignment. Expected severity=error|warning|fyi.", mode);
    }
    const match = assignment.match(/^severity=(error|warning|fyi)$/);
    if (!match) return await failRules("Expected severity=error|warning|fyi", mode);

    await withScope(args, mode, async (config, scope) => {
      const result = applyOverride(config, scope, rule, match[1] as RuleOverride);
      if (!result.ok) return await failRules(result.error, mode);
      await persist(result.config);
      emitSuccess(result.message, mode);
      return await exit(0);
    });
  },
});

const rulesPackage = defineCommand({
  meta: { name: "package", description: "Set the base rules package" },
  args: {
    ...scopeArgs,
    ...outputArgs,
    name: {
      type: "positional",
      description: "recommended | strict | minimal",
      required: false,
    },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    const mode = modeFor(args);
    const packageName = args.name as string | undefined;
    if (!packageName) return await failRules("Missing package. Usage: dora rules package <name>.", mode);
    await withScope(args, mode, async (config, scope) => {
      const result = applyPackage(config, scope, packageName);
      if (!result.ok) return await failRules(result.error, mode);
      await persist(result.config);
      emitSuccess(result.message, mode);
      return await exit(0);
    });
  },
});

const rulesExplain = defineCommand({
  meta: { name: "explain", description: "Explain a rule" },
  args: {
    ...scopeArgs,
    ...outputArgs,
    rule: { type: "positional", description: "Rule code or slug", required: false },
    cwd: { type: "string", description: "Working directory override" },
  },
  async run({ args }) {
    const mode = modeFor(args);
    const rule = args.rule as string | undefined;
    if (!rule) return await failRules("Missing rule. Usage: dora rules explain <rule>.", mode);
    await withScope(args, mode, async (config, scope, cwd) => {
      const result = explainRule(config, scope.kind === "global" ? "" : cwd, rule);
      if (!result.ok) return await failRules(result.error, mode);
      if (mode.format === "json") outJson({ lines: result.lines });
      else for (const line of result.lines) ui.write(line);
      return await exit(0);
    });
  },
});

async function runInteractive(): Promise<void> {
  const loaded = await readRulesConfig();
  if (!loaded.ok) return await failRules(loaded.error, { format: "table", ci: false });

  const cwd = process.cwd();
  let config = loaded.config;
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
          label: `${row.enabled ? "[x]" : "[ ]"} ${row.code} ${row.slug} (${row.enabled ? row.severity : "off"})${row.locked ? " 🔒" : ""}`,
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
