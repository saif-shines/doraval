import { defineCommand } from "citty";
import { select, text, isCancel } from "@clack/prompts";
import pc from "picocolors";
import { YAML } from "bun";
import { ui, guidedError, resolveOutputMode, outJson } from "../out.js";
import { readConfig, writeConfig, ensureDoravalDirs } from "../../core/journal-config.js";
import { exit } from "../render/exit.js";

/** Keys we document and show in interactive / table surfaces (B37). */
export const KNOWN_CONFIG_KEYS: Array<{ key: string; description: string }> = [
  { key: "eval.model", description: "LLM model id for review/judge (e.g. gpt-4o-mini)" },
  { key: "eval.provider", description: "Provider name from registry (openai, zai, groq, …)" },
  { key: "eval.api_key", description: "API key for the judge provider (prefer env vars when possible)" },
  { key: "eval.base_url", description: "OpenAI-compatible base URL override" },
  { key: "eval.judge", description: "Judge backend: auto | api | cli" },
  { key: "eval.max_tool_calls", description: "Max tool calls per judge session" },
  { key: "eval.timeout_ms", description: "Per-call judge timeout in ms" },
  { key: "agent.command", description: "CLI command used when driving an agent session" },
  { key: "agent.cwd_flag", description: "Flag the agent uses for working directory (e.g. --cwd)" },
  { key: "journal.repo", description: "Legacy journal remote (unused after journal removal; keep if migrating)" },
];

export function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
  const parts = keyPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setNestedValue(obj: Record<string, unknown>, keyPath: string, value: unknown): void {
  const parts = keyPath.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

function coerceValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  const num = Number(raw);
  if (!isNaN(num) && raw.trim() !== "") return num;
  return raw;
}

function describeKey(key: string): string {
  return KNOWN_CONFIG_KEYS.find((k) => k.key === key)?.description ?? "";
}

/** Flatten known keys + any extra top-level paths we can show. */
export function listConfigRows(
  config: Record<string, unknown> | null,
): Array<{ key: string; value: string; description: string }> {
  const rows: Array<{ key: string; value: string; description: string }> = [];
  for (const { key, description } of KNOWN_CONFIG_KEYS) {
    const raw = config ? getNestedValue(config, key) : undefined;
    const value =
      raw === undefined || raw === ""
        ? "(not set)"
        : typeof raw === "string"
          ? raw
          : JSON.stringify(raw);
    rows.push({ key, value, description });
  }
  return rows;
}

export function formatConfigTable(
  rows: Array<{ key: string; value: string; description: string }>,
): string {
  const keyW = Math.max(3, ...rows.map((r) => r.key.length));
  const valW = Math.max(5, ...rows.map((r) => Math.min(40, r.value.length)));
  const lines = [
    `${"key".padEnd(keyW)}  ${"value".padEnd(valW)}  description`,
    `${"─".repeat(keyW)}  ${"─".repeat(valW)}  ${"─".repeat(12)}`,
  ];
  for (const r of rows) {
    const v = r.value.length > 40 ? r.value.slice(0, 37) + "…" : r.value;
    lines.push(`${r.key.padEnd(keyW)}  ${v.padEnd(valW)}  ${r.description}`);
  }
  return lines.join("\n");
}

const KEY_HELP =
  "common: eval.model, eval.provider, eval.judge, agent.command — see `dora config get` for the full table";

const configSet = defineCommand({
  meta: { name: "set", description: "Set a config value" },
  args: {
    key: { type: "positional", description: `Dot-notation key (e.g. eval.model). ${KEY_HELP}`, required: true },
    value: { type: "positional", description: "Value to set", required: true },
  },
  async run({ args }) {
    ensureDoravalDirs();
    const config = (await readConfig()) ?? {
      journal: { repo: "", projects: {} },
    };
    const coerced = coerceValue(String(args.value));
    setNestedValue(config as unknown as Record<string, unknown>, String(args.key), coerced);
    await writeConfig(config as unknown as Parameters<typeof writeConfig>[0]);
    ui.success(`${args.key} = ${JSON.stringify(coerced)}`);
    await exit(0);
  },
});

const configGet = defineCommand({
  meta: { name: "get", description: "Get a config value (omit key to print all)" },
  args: {
    key: { type: "positional", description: "Dot-notation key (omit to print all)", required: false },
    format: { type: "string", description: "Output format: table | json", default: "table" },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: args.ci as boolean });
    const config = await readConfig();
    if (!config) {
      if (mode.format === "json") {
        outJson({ config: null, keys: {} });
        return await exit(0);
      }
      guidedError({
        context: "doraval config and most commands (eval, memory, etc.) read ~/.doraval/config.yml.",
        problem: "No doraval config found",
        solutions: ["dora config set eval.model <model>   (creates ~/.doraval/config.yml)"],
        next: "dora config set eval.model <model>",
      });
      return await exit(0);
    }

    const asRecord = config as unknown as Record<string, unknown>;

    if (!args.key) {
      if (mode.format === "json") {
        const keys: Record<string, unknown> = {};
        for (const { key } of KNOWN_CONFIG_KEYS) {
          keys[key] = getNestedValue(asRecord, key) ?? null;
        }
        outJson({ config: asRecord, keys });
        return await exit(0);
      }
      const rows = listConfigRows(asRecord);
      ui.blank();
      ui.heading("dora config");
      ui.write(formatConfigTable(rows));
      ui.blank();
      ui.dim(`  ${KEY_HELP}`);
      ui.blank();
      return await exit(0);
    }

    const key = String(args.key);
    const value = getNestedValue(asRecord, key);
    if (mode.format === "json") {
      outJson({ key, value: value ?? null, description: describeKey(key) });
      return await exit(0);
    }
    if (value === undefined) {
      ui.info(`${key}: (not set)`);
      if (describeKey(key)) ui.dim(`  ${describeKey(key)}`);
    } else {
      process.stdout.write(`${JSON.stringify(value)}\n`);
    }
    await exit(0);
  },
});

export default defineCommand({
  meta: {
    name: "config",
    description: `Get or set doraval configuration (dot-notation keys). ${KEY_HELP}`,
  },
  subCommands: { set: configSet, get: configGet },
  async run() {
    const interactive = process.stdin.isTTY === true && process.stderr.isTTY === true;
    if (!interactive) {
      ui.info("Usage: doraval config set <key> <value>  |  doraval config get [key] [--format json]");
      ui.dim(`  ${KEY_HELP}`);
      await exit(0);
      return;
    }

    // Interactive bare `dora config` (B37)
    const options = [
      { value: "__list", label: "List all keys (table)", hint: "values + descriptions" },
      ...KNOWN_CONFIG_KEYS.map((k) => ({
        value: k.key,
        label: k.key,
        hint: k.description,
      })),
      { value: "__set", label: "Set a key…", hint: "prompt for key and value" },
      { value: "__cancel", label: "Cancel", hint: "exit" },
    ];

    const choice = await select({
      message: "Config",
      options,
      output: process.stderr,
    });
    if (isCancel(choice) || choice === "__cancel") {
      ui.dim("  cancelled");
      await exit(0);
      return;
    }

    if (choice === "__list") {
      const config = await readConfig();
      const rows = listConfigRows(config as unknown as Record<string, unknown> | null);
      ui.blank();
      ui.write(formatConfigTable(rows));
      ui.blank();
      await exit(0);
      return;
    }

    if (choice === "__set") {
      const keyAns = await text({
        message: "Key (dot-notation)",
        placeholder: "eval.model",
        defaultValue: "eval.model",
        output: process.stderr,
      });
      if (isCancel(keyAns)) {
        await exit(0);
        return;
      }
      const valAns = await text({
        message: `Value for ${keyAns}`,
        placeholder: "gpt-4o-mini",
        output: process.stderr,
      });
      if (isCancel(valAns)) {
        await exit(0);
        return;
      }
      ensureDoravalDirs();
      const config = (await readConfig()) ?? { journal: { repo: "", projects: {} } };
      const coerced = coerceValue(String(valAns));
      setNestedValue(config as unknown as Record<string, unknown>, String(keyAns), coerced);
      await writeConfig(config as unknown as Parameters<typeof writeConfig>[0]);
      ui.success(`${keyAns} = ${JSON.stringify(coerced)}`);
      await exit(0);
      return;
    }

    // View one known key
    const config = await readConfig();
    const value = config
      ? getNestedValue(config as unknown as Record<string, unknown>, String(choice))
      : undefined;
    ui.blank();
    ui.write(`  ${pc.bold(String(choice))}`);
    ui.write(`  ${value === undefined ? pc.dim("(not set)") : JSON.stringify(value)}`);
    const desc = describeKey(String(choice));
    if (desc) ui.dim(`  ${desc}`);
    ui.blank();
    ui.dim(`  Set: dora config set ${choice} <value>`);
    ui.blank();
    await exit(0);
  },
});
