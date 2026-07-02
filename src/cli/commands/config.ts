import { defineCommand } from "citty";
import { ui, guidedError } from "../out.js";
import { readConfig, writeConfig, ensureDoravalDirs } from "../../core/journal-config.js";
import { YAML } from "bun";
import { exit } from "../render/exit.js";

function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
  const parts = keyPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, keyPath: string, value: unknown): void {
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

const configSet = defineCommand({
  meta: { name: "set", description: "Set a config value" },
  args: {
    key: { type: "positional", description: "Dot-notation key (e.g. eval.model)", required: true },
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
  },
  async run({ args }) {
    const config = await readConfig();
    if (!config) {
      guidedError({
        context: "doraval config and most commands (eval, journal, etc.) read ~/.doraval/config.yml.",
        problem: "No doraval config found",
        solutions: [
          "dora init   (one-time setup for journal + agent + eval)",
        ],
        next: "dora init",
      });
      return await exit(0);
    }
    if (!args.key) {
      process.stdout.write(YAML.stringify(config as unknown as Record<string, unknown>));
      return await exit(0);
    }
    const value = getNestedValue(config as unknown as Record<string, unknown>, String(args.key));
    if (value === undefined) {
      ui.info(`${args.key}: (not set)`);
    } else {
      process.stdout.write(`${JSON.stringify(value)}\n`);
    }
    await exit(0);
  },
});

export default defineCommand({
  meta: { name: "config", description: "Get or set doraval configuration (dot-notation keys)" },
  subCommands: { set: configSet, get: configGet },
  async run() {
    ui.info("Usage: doraval config set <key> <value>  |  doraval config get [key]");
    await exit(0);
  },
});
