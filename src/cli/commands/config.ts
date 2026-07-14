import { defineCommand } from "citty";
import { select, text, password, isCancel } from "@clack/prompts";
import pc from "picocolors";
import { ui, guidedError, resolveOutputMode, outJson } from "../out.js";
import {
  readConfig,
  writeConfig,
  ensureDoravalDirs,
  type JournalConfig,
} from "../../core/journal-config.js";
import { PROVIDERS, findProvider } from "../../core/providers.js";
import { exit } from "../render/exit.js";

// ── Key catalog ────────────────────────────────────────────────────

export type ConfigKeyKind = "text" | "enum" | "secret" | "number";

export type ConfigKeyDef = {
  key: string;
  description: string;
  kind?: ConfigKeyKind;
  /** Allowed values when kind is "enum". */
  options?: readonly string[];
  /** Hidden from interactive edit unless already set (migration leftovers). */
  legacy?: boolean;
};

export const JUDGE_OPTIONS = ["auto", "api", "cli"] as const;

export const KNOWN_CONFIG_KEYS: ConfigKeyDef[] = [
  { key: "eval.model", description: "LLM model id for review/judge (e.g. gpt-4o-mini)" },
  {
    key: "eval.provider",
    description: "Judge provider from registry",
    kind: "enum",
    options: PROVIDERS.map((p) => p.name),
  },
  {
    key: "eval.api_key",
    description: "API key for the judge provider (prefer env vars when possible)",
    kind: "secret",
  },
  { key: "eval.base_url", description: "OpenAI-compatible base URL override" },
  {
    key: "eval.judge",
    description: "Judge backend: auto | api | cli",
    kind: "enum",
    options: JUDGE_OPTIONS,
  },
  {
    key: "eval.max_tool_calls",
    description: "Max tool calls per judge session",
    kind: "number",
  },
  {
    key: "eval.timeout_ms",
    description: "Per-call judge timeout in ms",
    kind: "number",
  },
  { key: "agent.command", description: "CLI command used when driving an agent session" },
  {
    key: "agent.cwd_flag",
    description: "Flag the agent uses for working directory (e.g. --cwd)",
  },
  {
    key: "journal.repo",
    description: "Legacy journal remote (unused after journal removal)",
    legacy: true,
  },
];

const KEY_HELP =
  "common: eval.model, eval.provider, eval.judge, agent.command — `dora config get` · `dora config setup`";

const stderr = process.stderr;

function isInteractive(): boolean {
  return process.stdin.isTTY === true && process.stderr.isTTY === true;
}

// ── Pure helpers (tested) ──────────────────────────────────────────

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

export function findKeyDef(key: string): ConfigKeyDef | undefined {
  return KNOWN_CONFIG_KEYS.find((k) => k.key === key);
}

export function isSecretKey(key: string): boolean {
  return findKeyDef(key)?.kind === "secret" || /(^|\.)api_key$/i.test(key);
}

/** Keys shown in interactive edit menus (excludes legacy). */
export function editableConfigKeys(): ConfigKeyDef[] {
  return KNOWN_CONFIG_KEYS.filter((k) => !k.legacy);
}

/** Human-safe display of a stored value (masks secrets). */
export function displayConfigValue(key: string, raw: unknown): string {
  if (raw === undefined || raw === null || raw === "") return "(not set)";
  if (isSecretKey(key)) {
    const s = String(raw);
    if (s.length <= 8) return "(set)";
    return `${s.slice(0, 4)}…${s.slice(-4)}`;
  }
  return typeof raw === "string" ? raw : JSON.stringify(raw);
}

/** Success-line value: never echo secrets in full. */
export function formatSetDisplay(key: string, value: unknown): string {
  if (isSecretKey(key)) return "(set)";
  return JSON.stringify(value);
}

export function coerceValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  const num = Number(raw);
  if (!isNaN(num) && raw.trim() !== "") return num;
  return raw;
}

/** Soft validation for known enum keys. Returns error message or null. */
export function validateConfigValue(key: string, value: unknown): string | null {
  const def = findKeyDef(key);
  if (!def?.options?.length) return null;
  const s = String(value);
  if (!def.options.includes(s)) {
    return `${key} must be one of: ${def.options.join(", ")} (got ${JSON.stringify(s)})`;
  }
  return null;
}

function describeKey(key: string): string {
  return findKeyDef(key)?.description ?? "";
}

/**
 * Flatten known keys for tables.
 * Legacy keys only appear when they already have a value.
 * Secrets are masked for human surfaces.
 */
export function listConfigRows(
  config: Record<string, unknown> | null,
): Array<{ key: string; value: string; description: string }> {
  const rows: Array<{ key: string; value: string; description: string }> = [];
  for (const { key, description, legacy } of KNOWN_CONFIG_KEYS) {
    const raw = config ? getNestedValue(config, key) : undefined;
    if (legacy && (raw === undefined || raw === "" || raw === null)) continue;
    rows.push({ key, value: displayConfigValue(key, raw), description });
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

async function emptyOrReadConfig(): Promise<JournalConfig> {
  return (
    (await readConfig()) ?? {
      journal: { repo: "", projects: {} },
    }
  );
}

async function saveKey(key: string, value: unknown): Promise<void> {
  ensureDoravalDirs();
  const config = await emptyOrReadConfig();
  setNestedValue(config as unknown as Record<string, unknown>, key, value);
  await writeConfig(config);
  ui.success(`${key} = ${formatSetDisplay(key, value)}`);
}

function cancelled(): boolean {
  ui.dim("  cancelled");
  return true;
}

// ── Interactive prompts ────────────────────────────────────────────

async function promptEnum(
  message: string,
  options: readonly string[],
  current?: string,
): Promise<string | null> {
  const opts = options.map((v) => ({
    value: v,
    label: v,
    hint: v === current ? "current" : undefined,
  }));
  const ans = await select({
    message,
    options: opts,
    initialValue: current && options.includes(current) ? current : options[0],
    output: stderr,
  });
  if (isCancel(ans)) return null;
  return String(ans);
}

async function promptValueForKey(key: string, current?: unknown): Promise<unknown | null> {
  const def = findKeyDef(key);
  const curStr =
    current === undefined || current === null || current === ""
      ? undefined
      : String(current);

  if (def?.kind === "enum" && def.options?.length) {
    return promptEnum(`${key}`, def.options, curStr);
  }

  if (def?.kind === "secret") {
    const ans = await password({
      message: curStr ? `${key} (leave empty to keep current)` : key,
      output: stderr,
    });
    if (isCancel(ans)) return null;
    const s = String(ans);
    if (!s && curStr !== undefined) return current;
    if (!s) return null;
    return s;
  }

  const placeholder =
    def?.kind === "number"
      ? curStr ?? "0"
      : curStr ?? (key === "eval.model" ? "gpt-4o-mini" : "");
  const ans = await text({
    message: key,
    placeholder,
    defaultValue: curStr ?? placeholder,
    output: stderr,
  });
  if (isCancel(ans)) return null;
  const raw = String(ans).trim();
  if (!raw && curStr !== undefined) return current;
  if (!raw) return null;
  return def?.kind === "number" ? coerceValue(raw) : raw;
}

async function runEditKeyFlow(): Promise<void> {
  const config = await readConfig();
  const asRecord = (config ?? {}) as unknown as Record<string, unknown>;
  const keys = editableConfigKeys();
  const choice = await select({
    message: "Edit key",
    options: keys.map((k) => ({
      value: k.key,
      label: k.key,
      hint: displayConfigValue(k.key, getNestedValue(asRecord, k.key)),
    })),
    output: stderr,
  });
  if (isCancel(choice)) {
    cancelled();
    return;
  }
  const key = String(choice);
  const current = getNestedValue(asRecord, key);
  const next = await promptValueForKey(key, current);
  if (next === null) {
    cancelled();
    return;
  }
  const err = validateConfigValue(key, next);
  if (err) {
    ui.fail(err);
    return;
  }
  await saveKey(key, next);
}

async function runSetupWizard(): Promise<void> {
  ui.blank();
  ui.heading("Judge setup");
  ui.dim("  Configures eval.provider, eval.model, eval.judge (+ optional key / base URL).");
  ui.blank();

  const existing = await readConfig();
  const rec = (existing ?? {}) as unknown as Record<string, unknown>;
  const curProvider = getNestedValue(rec, "eval.provider");
  const curModel = getNestedValue(rec, "eval.model");
  const curJudge = getNestedValue(rec, "eval.judge");
  const curBase = getNestedValue(rec, "eval.base_url");
  const curKey = getNestedValue(rec, "eval.api_key");

  const provider = await promptEnum(
    "Provider",
    PROVIDERS.map((p) => p.name),
    typeof curProvider === "string" ? curProvider : undefined,
  );
  if (provider === null) {
    cancelled();
    return;
  }

  const def = findProvider(provider);
  let baseUrl: string | undefined =
    typeof curBase === "string" && curBase ? curBase : def?.baseUrl || undefined;

  if (provider === "custom" || !def?.baseUrl) {
    const ans = await text({
      message: "Base URL (OpenAI-compatible)",
      placeholder: baseUrl || "https://api.example.com/v1",
      defaultValue: baseUrl || "",
      output: stderr,
    });
    if (isCancel(ans)) {
      cancelled();
      return;
    }
    baseUrl = String(ans).trim() || undefined;
  } else if (def.baseUrl) {
    // Keep provider default unless already overridden to something else.
    if (!curBase) baseUrl = def.baseUrl;
  }

  const modelDefault =
    (typeof curModel === "string" && curModel) ||
    def?.defaultModels[0] ||
    "gpt-4o-mini";
  const modelAns = await text({
    message: "Model id",
    placeholder: modelDefault,
    defaultValue: modelDefault,
    output: stderr,
  });
  if (isCancel(modelAns)) {
    cancelled();
    return;
  }
  const model = String(modelAns).trim() || modelDefault;

  const judge = await promptEnum(
    "Judge backend",
    JUDGE_OPTIONS,
    typeof curJudge === "string" ? curJudge : "auto",
  );
  if (judge === null) {
    cancelled();
    return;
  }

  let apiKey: string | undefined =
    typeof curKey === "string" && curKey ? curKey : undefined;
  if (def?.requiresApiKey !== false) {
    const envHint = def ? [def.envKey, ...def.altEnvKeys].join(" / ") : "API key env";
    const ans = await password({
      message: `API key (optional — prefer ${envHint}; empty keeps current / env)`,
      output: stderr,
    });
    if (isCancel(ans)) {
      cancelled();
      return;
    }
    const s = String(ans);
    if (s) apiKey = s;
  }

  ensureDoravalDirs();
  const config = await emptyOrReadConfig();
  const root = config as unknown as Record<string, unknown>;
  setNestedValue(root, "eval.provider", provider);
  setNestedValue(root, "eval.model", model);
  setNestedValue(root, "eval.judge", judge);
  if (baseUrl) setNestedValue(root, "eval.base_url", baseUrl);
  if (apiKey) setNestedValue(root, "eval.api_key", apiKey);
  await writeConfig(config);

  ui.blank();
  ui.success("Judge config saved");
  ui.dim(`  eval.provider = ${provider}`);
  ui.dim(`  eval.model    = ${model}`);
  ui.dim(`  eval.judge    = ${judge}`);
  if (baseUrl) ui.dim(`  eval.base_url = ${baseUrl}`);
  if (apiKey) ui.dim(`  eval.api_key  = ${displayConfigValue("eval.api_key", apiKey)}`);
  ui.blank();
  ui.dim("  Next: dora review --deep   (or dora config get)");
  ui.blank();
}

async function runInteractiveHub(): Promise<void> {
  const choice = await select({
    message: "Config",
    options: [
      { value: "__list", label: "List all keys", hint: "table (secrets masked)" },
      { value: "__edit", label: "Edit a key…", hint: "pick key, set value" },
      { value: "__setup", label: "Setup judge…", hint: "provider · model · backend" },
      { value: "__set_custom", label: "Set custom key…", hint: "dot-notation freeform" },
      { value: "__cancel", label: "Cancel", hint: "exit" },
    ],
    output: stderr,
  });

  if (isCancel(choice) || choice === "__cancel") {
    cancelled();
    return;
  }

  if (choice === "__list") {
    const config = await readConfig();
    const rows = listConfigRows(config as unknown as Record<string, unknown> | null);
    ui.blank();
    ui.heading("dora config");
    ui.write(formatConfigTable(rows));
    ui.blank();
    return;
  }

  if (choice === "__edit") {
    await runEditKeyFlow();
    return;
  }

  if (choice === "__setup") {
    await runSetupWizard();
    return;
  }

  if (choice === "__set_custom") {
    const keyAns = await text({
      message: "Key (dot-notation)",
      placeholder: "eval.model",
      defaultValue: "eval.model",
      output: stderr,
    });
    if (isCancel(keyAns)) {
      cancelled();
      return;
    }
    const key = String(keyAns).trim();
    if (!key) {
      cancelled();
      return;
    }
    const config = await readConfig();
    const current = config
      ? getNestedValue(config as unknown as Record<string, unknown>, key)
      : undefined;
    const next = await promptValueForKey(key, current);
    if (next === null) {
      cancelled();
      return;
    }
    const err = validateConfigValue(key, next);
    if (err) {
      ui.fail(err);
      return;
    }
    await saveKey(key, next);
  }
}

// ── Subcommands ────────────────────────────────────────────────────

const configSet = defineCommand({
  meta: { name: "set", description: "Set a config value" },
  args: {
    key: { type: "positional", description: "Dot-notation key (e.g. eval.model)", required: true },
    value: { type: "positional", description: "Value to set", required: true },
  },
  async run({ args }) {
    const key = String(args.key);
    const coerced = coerceValue(String(args.value));
    const err = validateConfigValue(key, coerced);
    if (err) {
      ui.fail(err);
      await exit(1);
      return;
    }
    await saveKey(key, coerced);
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
        context: "doraval config and review/judge settings live in ~/.doraval/config.yml.",
        problem: "No doraval config found",
        solutions: [
          "dora config setup                 (interactive judge wizard)",
          "dora config set eval.model <id>   (creates ~/.doraval/config.yml)",
        ],
        next: "dora config setup",
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
      // Machine mode: real values (agents/CI may need the key).
      outJson({ key, value: value ?? null, description: describeKey(key) });
      return await exit(0);
    }
    if (value === undefined || value === null || value === "") {
      ui.info(`${key}: (not set)`);
      if (describeKey(key)) ui.dim(`  ${describeKey(key)}`);
    } else if (isSecretKey(key)) {
      // Human stdout: never dump secrets.
      process.stdout.write(`${JSON.stringify(displayConfigValue(key, value))}\n`);
      ui.dim("  (secret masked — use --format json for the raw value)");
    } else {
      process.stdout.write(`${JSON.stringify(value)}\n`);
    }
    await exit(0);
  },
});

const configSetup = defineCommand({
  meta: {
    name: "setup",
    description: "Interactive judge wizard (provider · model · backend)",
  },
  async run() {
    if (!isInteractive()) {
      ui.info("dora config setup needs a TTY. For scripts:");
      ui.dim("  dora config set eval.provider <name>");
      ui.dim("  dora config set eval.model <id>");
      ui.dim("  dora config set eval.judge auto|api|cli");
      await exit(1);
      return;
    }
    await runSetupWizard();
    await exit(0);
  },
});

export default defineCommand({
  meta: {
    name: "config",
    description: "Get, set, or interactively edit config",
  },
  subCommands: { set: configSet, get: configGet, setup: configSetup },
  async run() {
    if (!isInteractive()) {
      ui.info(
        "Usage: doraval config set <key> <value>  |  get [key]  |  setup  |  (TTY: interactive hub)",
      );
      ui.dim(`  ${KEY_HELP}`);
      await exit(0);
      return;
    }
    await runInteractiveHub();
    await exit(0);
  },
});
