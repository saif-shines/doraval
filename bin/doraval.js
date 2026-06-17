#!/usr/bin/env bun
// @bun
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = import.meta.require;

// node_modules/.bun/citty@0.2.2/node_modules/citty/dist/_chunks/libs/scule.mjs
function isUppercase(char = "") {
  if (NUMBER_CHAR_RE.test(char))
    return;
  return char !== char.toLowerCase();
}
function splitByCase(str, separators) {
  const splitters = separators ?? STR_SPLITTERS;
  const parts = [];
  if (!str || typeof str !== "string")
    return parts;
  let buff = "";
  let previousUpper;
  let previousSplitter;
  for (const char of str) {
    const isSplitter = splitters.includes(char);
    if (isSplitter === true) {
      parts.push(buff);
      buff = "";
      previousUpper = undefined;
      continue;
    }
    const isUpper = isUppercase(char);
    if (previousSplitter === false) {
      if (previousUpper === false && isUpper === true) {
        parts.push(buff);
        buff = char;
        previousUpper = isUpper;
        continue;
      }
      if (previousUpper === true && isUpper === false && buff.length > 1) {
        const lastChar = buff.at(-1);
        parts.push(buff.slice(0, Math.max(0, buff.length - 1)));
        buff = lastChar + char;
        previousUpper = isUpper;
        continue;
      }
    }
    buff += char;
    previousUpper = isUpper;
    previousSplitter = isSplitter;
  }
  parts.push(buff);
  return parts;
}
function upperFirst(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : "";
}
function lowerFirst(str) {
  return str ? str[0].toLowerCase() + str.slice(1) : "";
}
function pascalCase(str, opts) {
  return str ? (Array.isArray(str) ? str : splitByCase(str)).map((p) => upperFirst(opts?.normalize ? p.toLowerCase() : p)).join("") : "";
}
function camelCase(str, opts) {
  return lowerFirst(pascalCase(str || "", opts));
}
function kebabCase(str, joiner) {
  return str ? (Array.isArray(str) ? str : splitByCase(str)).map((p) => p.toLowerCase()).join(joiner ?? "-") : "";
}
function snakeCase(str) {
  return kebabCase(str || "", "_");
}
var NUMBER_CHAR_RE, STR_SPLITTERS;
var init_scule = __esm(() => {
  NUMBER_CHAR_RE = /\d/;
  STR_SPLITTERS = [
    "-",
    "_",
    "/",
    "."
  ];
});

// node_modules/.bun/citty@0.2.2/node_modules/citty/dist/index.mjs
import { parseArgs as parseArgs$1 } from "util";
function toArray(val) {
  if (Array.isArray(val))
    return val;
  return val === undefined ? [] : [val];
}
function formatLineColumns(lines, linePrefix = "") {
  const maxLength = [];
  for (const line of lines)
    for (const [i, element] of line.entries())
      maxLength[i] = Math.max(maxLength[i] || 0, element.length);
  return lines.map((l) => l.map((c, i) => linePrefix + c[i === 0 ? "padStart" : "padEnd"](maxLength[i])).join("  ")).join(`
`);
}
function resolveValue(input) {
  return typeof input === "function" ? input() : input;
}
function parseRawArgs(args = [], opts = {}) {
  const booleans = new Set(opts.boolean || []);
  const strings = new Set(opts.string || []);
  const aliasMap = opts.alias || {};
  const defaults = opts.default || {};
  const aliasToMain = /* @__PURE__ */ new Map;
  const mainToAliases = /* @__PURE__ */ new Map;
  for (const [key, value] of Object.entries(aliasMap)) {
    const targets = value;
    for (const target of targets) {
      aliasToMain.set(key, target);
      if (!mainToAliases.has(target))
        mainToAliases.set(target, []);
      mainToAliases.get(target).push(key);
      aliasToMain.set(target, key);
      if (!mainToAliases.has(key))
        mainToAliases.set(key, []);
      mainToAliases.get(key).push(target);
    }
  }
  const options = {};
  function getType(name) {
    if (booleans.has(name))
      return "boolean";
    const aliases = mainToAliases.get(name) || [];
    for (const alias of aliases)
      if (booleans.has(alias))
        return "boolean";
    return "string";
  }
  function isStringType(name) {
    if (strings.has(name))
      return true;
    const aliases = mainToAliases.get(name) || [];
    for (const alias of aliases)
      if (strings.has(alias))
        return true;
    return false;
  }
  const allOptions = new Set([
    ...booleans,
    ...strings,
    ...Object.keys(aliasMap),
    ...Object.values(aliasMap).flat(),
    ...Object.keys(defaults)
  ]);
  for (const name of allOptions)
    if (!options[name])
      options[name] = {
        type: getType(name),
        default: defaults[name]
      };
  for (const [alias, main] of aliasToMain.entries())
    if (alias.length === 1 && options[main] && !options[main].short)
      options[main].short = alias;
  const processedArgs = [];
  const negatedFlags = {};
  for (let i = 0;i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") {
      processedArgs.push(...args.slice(i));
      break;
    }
    if (arg.startsWith("--no-")) {
      const flagName = arg.slice(5);
      negatedFlags[flagName] = true;
      continue;
    }
    processedArgs.push(arg);
  }
  let parsed;
  try {
    parsed = parseArgs$1({
      args: processedArgs,
      options: Object.keys(options).length > 0 ? options : undefined,
      allowPositionals: true,
      strict: false
    });
  } catch {
    parsed = {
      values: {},
      positionals: processedArgs
    };
  }
  const out = { _: [] };
  out._ = parsed.positionals;
  for (const [key, value] of Object.entries(parsed.values)) {
    let coerced = value;
    if (getType(key) === "boolean" && typeof value === "string")
      coerced = value !== "false";
    else if (isStringType(key) && typeof value === "boolean")
      coerced = "";
    out[key] = coerced;
  }
  for (const [name] of Object.entries(negatedFlags)) {
    out[name] = false;
    const mainName = aliasToMain.get(name);
    if (mainName)
      out[mainName] = false;
    const aliases = mainToAliases.get(name);
    if (aliases)
      for (const alias of aliases)
        out[alias] = false;
  }
  for (const [alias, main] of aliasToMain.entries()) {
    if (out[alias] !== undefined && out[main] === undefined)
      out[main] = out[alias];
    if (out[main] !== undefined && out[alias] === undefined)
      out[alias] = out[main];
    if (out[alias] !== out[main] && defaults[main] === out[main])
      out[main] = out[alias];
  }
  return out;
}
function parseArgs(rawArgs, argsDef) {
  const parseOptions = {
    boolean: [],
    string: [],
    alias: {},
    default: {}
  };
  const args = resolveArgs(argsDef);
  for (const arg of args) {
    if (arg.type === "positional")
      continue;
    if (arg.type === "string" || arg.type === "enum")
      parseOptions.string.push(arg.name);
    else if (arg.type === "boolean")
      parseOptions.boolean.push(arg.name);
    if (arg.default !== undefined)
      parseOptions.default[arg.name] = arg.default;
    if (arg.alias)
      parseOptions.alias[arg.name] = arg.alias;
    const camelName = camelCase(arg.name);
    const kebabName = kebabCase(arg.name);
    if (camelName !== arg.name || kebabName !== arg.name) {
      const existingAliases = toArray(parseOptions.alias[arg.name] || []);
      if (camelName !== arg.name && !existingAliases.includes(camelName))
        existingAliases.push(camelName);
      if (kebabName !== arg.name && !existingAliases.includes(kebabName))
        existingAliases.push(kebabName);
      if (existingAliases.length > 0)
        parseOptions.alias[arg.name] = existingAliases;
    }
  }
  const parsed = parseRawArgs(rawArgs, parseOptions);
  const [...positionalArguments] = parsed._;
  const parsedArgsProxy = new Proxy(parsed, { get(target, prop) {
    return target[prop] ?? target[camelCase(prop)] ?? target[kebabCase(prop)];
  } });
  for (const [, arg] of args.entries())
    if (arg.type === "positional") {
      const nextPositionalArgument = positionalArguments.shift();
      if (nextPositionalArgument !== undefined)
        parsedArgsProxy[arg.name] = nextPositionalArgument;
      else if (arg.default === undefined && arg.required !== false)
        throw new CLIError(`Missing required positional argument: ${arg.name.toUpperCase()}`, "EARG");
      else
        parsedArgsProxy[arg.name] = arg.default;
    } else if (arg.type === "enum") {
      const argument = parsedArgsProxy[arg.name];
      const options = arg.options || [];
      if (argument !== undefined && options.length > 0 && !options.includes(argument))
        throw new CLIError(`Invalid value for argument: ${cyan(`--${arg.name}`)} (${cyan(argument)}). Expected one of: ${options.map((o) => cyan(o)).join(", ")}.`, "EARG");
    } else if (arg.required && parsedArgsProxy[arg.name] === undefined)
      throw new CLIError(`Missing required argument: --${arg.name}`, "EARG");
  return parsedArgsProxy;
}
function resolveArgs(argsDef) {
  const args = [];
  for (const [name, argDef] of Object.entries(argsDef || {}))
    args.push({
      ...argDef,
      name,
      alias: toArray(argDef.alias)
    });
  return args;
}
async function resolvePlugins(plugins) {
  return Promise.all(plugins.map((p) => resolveValue(p)));
}
function defineCommand(def) {
  return def;
}
async function runCommand(cmd, opts) {
  const cmdArgs = await resolveValue(cmd.args || {});
  const parsedArgs = parseArgs(opts.rawArgs, cmdArgs);
  const context = {
    rawArgs: opts.rawArgs,
    args: parsedArgs,
    data: opts.data,
    cmd
  };
  const plugins = await resolvePlugins(cmd.plugins ?? []);
  let result;
  let runError;
  try {
    for (const plugin of plugins)
      await plugin.setup?.(context);
    if (typeof cmd.setup === "function")
      await cmd.setup(context);
    const subCommands = await resolveValue(cmd.subCommands);
    if (subCommands && Object.keys(subCommands).length > 0) {
      const subCommandArgIndex = findSubCommandIndex(opts.rawArgs, cmdArgs);
      const explicitName = opts.rawArgs[subCommandArgIndex];
      if (explicitName) {
        const subCommand = await _findSubCommand(subCommands, explicitName);
        if (!subCommand)
          throw new CLIError(`Unknown command ${cyan(explicitName)}`, "E_UNKNOWN_COMMAND");
        await runCommand(subCommand, { rawArgs: opts.rawArgs.slice(subCommandArgIndex + 1) });
      } else {
        const defaultSubCommand = await resolveValue(cmd.default);
        if (defaultSubCommand) {
          if (cmd.run)
            throw new CLIError(`Cannot specify both 'run' and 'default' on the same command.`, "E_DEFAULT_CONFLICT");
          const subCommand = await _findSubCommand(subCommands, defaultSubCommand);
          if (!subCommand)
            throw new CLIError(`Default sub command ${cyan(defaultSubCommand)} not found in subCommands.`, "E_UNKNOWN_COMMAND");
          await runCommand(subCommand, { rawArgs: opts.rawArgs });
        } else if (!cmd.run)
          throw new CLIError(`No command specified.`, "E_NO_COMMAND");
      }
    }
    if (typeof cmd.run === "function")
      result = await cmd.run(context);
  } catch (error) {
    runError = error;
  }
  const cleanupErrors = [];
  if (typeof cmd.cleanup === "function")
    try {
      await cmd.cleanup(context);
    } catch (error) {
      cleanupErrors.push(error);
    }
  for (const plugin of [...plugins].reverse())
    try {
      await plugin.cleanup?.(context);
    } catch (error) {
      cleanupErrors.push(error);
    }
  if (runError)
    throw runError;
  if (cleanupErrors.length === 1)
    throw cleanupErrors[0];
  if (cleanupErrors.length > 1)
    throw new Error("Multiple cleanup errors", { cause: cleanupErrors });
  return { result };
}
async function resolveSubCommand(cmd, rawArgs, parent) {
  const subCommands = await resolveValue(cmd.subCommands);
  if (subCommands && Object.keys(subCommands).length > 0) {
    const subCommandArgIndex = findSubCommandIndex(rawArgs, await resolveValue(cmd.args || {}));
    const subCommandName = rawArgs[subCommandArgIndex];
    const subCommand = await _findSubCommand(subCommands, subCommandName);
    if (subCommand)
      return resolveSubCommand(subCommand, rawArgs.slice(subCommandArgIndex + 1), cmd);
  }
  return [cmd, parent];
}
async function _findSubCommand(subCommands, name) {
  if (name in subCommands)
    return resolveValue(subCommands[name]);
  for (const sub of Object.values(subCommands)) {
    const resolved = await resolveValue(sub);
    const meta = await resolveValue(resolved?.meta);
    if (meta?.alias) {
      if (toArray(meta.alias).includes(name))
        return resolved;
    }
  }
}
function findSubCommandIndex(rawArgs, argsDef) {
  for (let i = 0;i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === "--")
      return -1;
    if (arg.startsWith("-")) {
      if (!arg.includes("=") && _isValueFlag(arg, argsDef))
        i++;
      continue;
    }
    return i;
  }
  return -1;
}
function _isValueFlag(flag, argsDef) {
  const name = flag.replace(/^-{1,2}/, "");
  const normalized = camelCase(name);
  for (const [key, def] of Object.entries(argsDef)) {
    if (def.type !== "string" && def.type !== "enum")
      continue;
    if (normalized === camelCase(key))
      return true;
    if ((Array.isArray(def.alias) ? def.alias : def.alias ? [def.alias] : []).includes(name))
      return true;
  }
  return false;
}
async function showUsage(cmd, parent) {
  try {
    console.log(await renderUsage(cmd, parent) + `
`);
  } catch (error) {
    console.error(error);
  }
}
async function renderUsage(cmd, parent) {
  const cmdMeta = await resolveValue(cmd.meta || {});
  const cmdArgs = resolveArgs(await resolveValue(cmd.args || {}));
  const parentMeta = await resolveValue(parent?.meta || {});
  const commandName = `${parentMeta.name ? `${parentMeta.name} ` : ""}` + (cmdMeta.name || process.argv[1]);
  const argLines = [];
  const posLines = [];
  const commandsLines = [];
  const usageLine = [];
  for (const arg of cmdArgs)
    if (arg.type === "positional") {
      const name = arg.name.toUpperCase();
      const isRequired = arg.required !== false && arg.default === undefined;
      posLines.push([cyan(name + renderValueHint(arg)), renderDescription(arg, isRequired)]);
      usageLine.push(isRequired ? `<${name}>` : `[${name}]`);
    } else {
      const isRequired = arg.required === true && arg.default === undefined;
      const argStr = [...(arg.alias || []).map((a) => `-${a}`), `--${arg.name}`].join(", ") + renderValueHint(arg);
      argLines.push([cyan(argStr), renderDescription(arg, isRequired)]);
      if (arg.type === "boolean" && (arg.default === true || arg.negativeDescription) && !negativePrefixRe.test(arg.name)) {
        const negativeArgStr = [...(arg.alias || []).map((a) => `--no-${a}`), `--no-${arg.name}`].join(", ");
        argLines.push([cyan(negativeArgStr), [arg.negativeDescription, isRequired ? gray("(Required)") : ""].filter(Boolean).join(" ")]);
      }
      if (isRequired)
        usageLine.push(`--${arg.name}` + renderValueHint(arg));
    }
  if (cmd.subCommands) {
    const commandNames = [];
    const subCommands = await resolveValue(cmd.subCommands);
    for (const [name, sub] of Object.entries(subCommands)) {
      const meta = await resolveValue((await resolveValue(sub))?.meta);
      if (meta?.hidden)
        continue;
      const aliases = toArray(meta?.alias);
      const label = [name, ...aliases].join(", ");
      commandsLines.push([cyan(label), meta?.description || ""]);
      commandNames.push(name, ...aliases);
    }
    usageLine.push(commandNames.join("|"));
  }
  const usageLines = [];
  const version = cmdMeta.version || parentMeta.version;
  usageLines.push(gray(`${cmdMeta.description} (${commandName + (version ? ` v${version}` : "")})`), "");
  const hasOptions = argLines.length > 0 || posLines.length > 0;
  usageLines.push(`${underline(bold("USAGE"))} ${cyan(`${commandName}${hasOptions ? " [OPTIONS]" : ""} ${usageLine.join(" ")}`)}`, "");
  if (posLines.length > 0) {
    usageLines.push(underline(bold("ARGUMENTS")), "");
    usageLines.push(formatLineColumns(posLines, "  "));
    usageLines.push("");
  }
  if (argLines.length > 0) {
    usageLines.push(underline(bold("OPTIONS")), "");
    usageLines.push(formatLineColumns(argLines, "  "));
    usageLines.push("");
  }
  if (commandsLines.length > 0) {
    usageLines.push(underline(bold("COMMANDS")), "");
    usageLines.push(formatLineColumns(commandsLines, "  "));
    usageLines.push("", `Use ${cyan(`${commandName} <command> --help`)} for more information about a command.`);
  }
  return usageLines.filter((l) => typeof l === "string").join(`
`);
}
function renderValueHint(arg) {
  const valueHint = arg.valueHint ? `=<${arg.valueHint}>` : "";
  const fallbackValueHint = valueHint || `=<${snakeCase(arg.name)}>`;
  if (!arg.type || arg.type === "positional" || arg.type === "boolean")
    return valueHint;
  if (arg.type === "enum" && arg.options?.length)
    return `=<${arg.options.join("|")}>`;
  return fallbackValueHint;
}
function renderDescription(arg, required) {
  const requiredHint = required ? gray("(Required)") : "";
  const defaultHint = arg.default === undefined ? "" : gray(`(Default: ${arg.default})`);
  return [
    arg.description,
    requiredHint,
    defaultHint
  ].filter(Boolean).join(" ");
}
async function runMain(cmd, opts = {}) {
  const rawArgs = opts.rawArgs || process.argv.slice(2);
  const showUsage$1 = opts.showUsage || showUsage;
  try {
    const builtinFlags = await _resolveBuiltinFlags(cmd);
    if (builtinFlags.help.length > 0 && rawArgs.some((arg) => builtinFlags.help.includes(arg))) {
      await showUsage$1(...await resolveSubCommand(cmd, rawArgs));
      process.exit(0);
    } else if (rawArgs.length === 1 && builtinFlags.version.includes(rawArgs[0])) {
      const meta = typeof cmd.meta === "function" ? await cmd.meta() : await cmd.meta;
      if (!meta?.version)
        throw new CLIError("No version specified", "E_NO_VERSION");
      console.log(meta.version);
    } else
      await runCommand(cmd, { rawArgs });
  } catch (error) {
    if (error instanceof CLIError) {
      await showUsage$1(...await resolveSubCommand(cmd, rawArgs));
      console.error(error.message);
    } else
      console.error(error, `
`);
    process.exit(1);
  }
}
async function _resolveBuiltinFlags(cmd) {
  const argsDef = await resolveValue(cmd.args || {});
  const userNames = /* @__PURE__ */ new Set;
  const userAliases = /* @__PURE__ */ new Set;
  for (const [name, def] of Object.entries(argsDef)) {
    userNames.add(name);
    for (const alias of toArray(def.alias))
      userAliases.add(alias);
  }
  return {
    help: _getBuiltinFlags("help", "h", userNames, userAliases),
    version: _getBuiltinFlags("version", "v", userNames, userAliases)
  };
}
function _getBuiltinFlags(long, short, userNames, userAliases) {
  if (userNames.has(long) || userAliases.has(long))
    return [];
  if (userNames.has(short) || userAliases.has(short))
    return [`--${long}`];
  return [`--${long}`, `-${short}`];
}
var CLIError, noColor, _c = (c, r = 39) => (t) => noColor ? t : `\x1B[${c}m${t}\x1B[${r}m`, bold, cyan, gray, underline, negativePrefixRe;
var init_dist = __esm(() => {
  init_scule();
  CLIError = class extends Error {
    code;
    constructor(message, code) {
      super(message);
      this.name = "CLIError";
      this.code = code;
    }
  };
  noColor = /* @__PURE__ */ (() => {
    const env = globalThis.process?.env ?? {};
    return env.NO_COLOR === "1" || env.TERM === "dumb" || env.TEST || env.CI;
  })();
  bold = /* @__PURE__ */ _c(1, 22);
  cyan = /* @__PURE__ */ _c(36);
  gray = /* @__PURE__ */ _c(90);
  underline = /* @__PURE__ */ _c(4, 24);
  negativePrefixRe = /^no[-A-Z]/;
});

// package.json
var require_package = __commonJS((exports, module) => {
  module.exports = {
    name: "@hacksmith/doraval",
    version: "0.2.23",
    author: "Saif",
    repository: {
      type: "git",
      url: "git+https://github.com/saif-shines/doraval.git"
    },
    devDependencies: {
      "@types/bun": "latest"
    },
    bin: {
      doraval: "bin/doraval-wrapper.js",
      dora: "bin/doraval-wrapper.js"
    },
    description: "The context engineering toolkit for coding agents",
    engines: {
      bun: ">=1.2.0",
      node: ">=14.18.0"
    },
    files: [
      "bin/",
      "dist/",
      "README.md"
    ],
    keywords: [
      "cli",
      "skills",
      "plugins",
      "agent",
      "validation",
      "lint",
      "claude-code",
      "grok",
      "cursor",
      "windsurf",
      "mcp"
    ],
    license: "MIT",
    workspaces: [
      "apps/*"
    ],
    scripts: {
      build: "bun build ./src/cli/index.ts --outfile ./bin/doraval.js --target bun",
      dev: "bun run ./src/cli/index.ts",
      test: "bun test",
      typecheck: "bunx tsc --noEmit --skipLibCheck",
      prepublishOnly: `bun run build && node -e "const p=require('./package.json'),j=require('./jsr.json');if(p.version!==j.version){console.error('Version mismatch: package.json='+p.version+' jsr.json='+j.version);process.exit(1)}"`,
      bump: "bun run scripts/bump.ts",
      release: "bun run scripts/release.ts",
      "jsr:publish": "bunx jsr publish",
      "site:dev": "cd apps/website && bun run dev",
      "site:build": "cd apps/website && bun run build",
      "site:preview": "cd apps/website && bun run preview"
    },
    type: "module",
    dependencies: {
      citty: "^0.2.2",
      picocolors: "^1.1.1"
    }
  };
});

// node_modules/.bun/picocolors@1.1.1/node_modules/picocolors/picocolors.js
var require_picocolors = __commonJS((exports, module) => {
  var p = process || {};
  var argv = p.argv || [];
  var env = p.env || {};
  var isColorSupported = !(!!env.NO_COLOR || argv.includes("--no-color")) && (!!env.FORCE_COLOR || argv.includes("--color") || p.platform === "win32" || (p.stdout || {}).isTTY && env.TERM !== "dumb" || !!env.CI);
  var formatter = (open, close, replace = open) => (input) => {
    let string = "" + input, index = string.indexOf(close, open.length);
    return ~index ? open + replaceClose(string, close, replace, index) + close : open + string + close;
  };
  var replaceClose = (string, close, replace, index) => {
    let result = "", cursor = 0;
    do {
      result += string.substring(cursor, index) + replace;
      cursor = index + close.length;
      index = string.indexOf(close, cursor);
    } while (~index);
    return result + string.substring(cursor);
  };
  var createColors = (enabled = isColorSupported) => {
    let f = enabled ? formatter : () => String;
    return {
      isColorSupported: enabled,
      reset: f("\x1B[0m", "\x1B[0m"),
      bold: f("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m"),
      dim: f("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"),
      italic: f("\x1B[3m", "\x1B[23m"),
      underline: f("\x1B[4m", "\x1B[24m"),
      inverse: f("\x1B[7m", "\x1B[27m"),
      hidden: f("\x1B[8m", "\x1B[28m"),
      strikethrough: f("\x1B[9m", "\x1B[29m"),
      black: f("\x1B[30m", "\x1B[39m"),
      red: f("\x1B[31m", "\x1B[39m"),
      green: f("\x1B[32m", "\x1B[39m"),
      yellow: f("\x1B[33m", "\x1B[39m"),
      blue: f("\x1B[34m", "\x1B[39m"),
      magenta: f("\x1B[35m", "\x1B[39m"),
      cyan: f("\x1B[36m", "\x1B[39m"),
      white: f("\x1B[37m", "\x1B[39m"),
      gray: f("\x1B[90m", "\x1B[39m"),
      bgBlack: f("\x1B[40m", "\x1B[49m"),
      bgRed: f("\x1B[41m", "\x1B[49m"),
      bgGreen: f("\x1B[42m", "\x1B[49m"),
      bgYellow: f("\x1B[43m", "\x1B[49m"),
      bgBlue: f("\x1B[44m", "\x1B[49m"),
      bgMagenta: f("\x1B[45m", "\x1B[49m"),
      bgCyan: f("\x1B[46m", "\x1B[49m"),
      bgWhite: f("\x1B[47m", "\x1B[49m"),
      blackBright: f("\x1B[90m", "\x1B[39m"),
      redBright: f("\x1B[91m", "\x1B[39m"),
      greenBright: f("\x1B[92m", "\x1B[39m"),
      yellowBright: f("\x1B[93m", "\x1B[39m"),
      blueBright: f("\x1B[94m", "\x1B[39m"),
      magentaBright: f("\x1B[95m", "\x1B[39m"),
      cyanBright: f("\x1B[96m", "\x1B[39m"),
      whiteBright: f("\x1B[97m", "\x1B[39m"),
      bgBlackBright: f("\x1B[100m", "\x1B[49m"),
      bgRedBright: f("\x1B[101m", "\x1B[49m"),
      bgGreenBright: f("\x1B[102m", "\x1B[49m"),
      bgYellowBright: f("\x1B[103m", "\x1B[49m"),
      bgBlueBright: f("\x1B[104m", "\x1B[49m"),
      bgMagentaBright: f("\x1B[105m", "\x1B[49m"),
      bgCyanBright: f("\x1B[106m", "\x1B[49m"),
      bgWhiteBright: f("\x1B[107m", "\x1B[49m")
    };
  };
  module.exports = createColors();
  module.exports.createColors = createColors;
});

// src/cli/out.ts
function write(s) {
  process.stderr.write(s.endsWith(`
`) ? s : s + `
`);
}
var import_picocolors, ui;
var init_out = __esm(() => {
  import_picocolors = __toESM(require_picocolors(), 1);
  ui = {
    write,
    info: (s) => write(s),
    dim: (s) => write(import_picocolors.default.dim(import_picocolors.default.gray(s))),
    blank: () => write(""),
    heading: (s) => write(`
  ${import_picocolors.default.bold(import_picocolors.default.white(s))}
`),
    success: (s) => write(`  ${import_picocolors.default.green("\u2713")} ${import_picocolors.default.white(s)}`),
    warn: (s) => write(`  ${import_picocolors.default.yellow("\u26A0")} ${import_picocolors.default.white(s)}`),
    fail: (s) => write(`${import_picocolors.default.red("\u2717")} ${import_picocolors.default.white(s)}`),
    pass: (s) => write(`  ${import_picocolors.default.green("\u2713")} ${import_picocolors.default.white(s)}`),
    failItem: (s) => write(`  ${import_picocolors.default.red("\u2717")} ${import_picocolors.default.white(s)}`),
    warnItem: (s) => write(`  ${import_picocolors.default.yellow("\u26A0")} ${import_picocolors.default.white(s)}`)
  };
});

// src/core/frontmatter.ts
var {YAML } = globalThis.Bun;
function parseFrontmatter(raw) {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { data: {}, content: raw };
  }
  const data = YAML.parse(match[1]) ?? {};
  return { data, content: match[2] ?? "" };
}
var FRONTMATTER_RE;
var init_frontmatter = __esm(() => {
  FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
});

// src/core/skill-validate.ts
function checkFrontmatterPresence(model, _ctx) {
  const keys = Object.keys(model.data);
  if (keys.length === 0) {
    return { warnings: ["YAML frontmatter is empty (description recommended for discoverability)"] };
  }
  return { passes: ["YAML frontmatter present and parseable"] };
}
function checkName(model, _ctx) {
  if (!model.data.name) {
    return { warnings: ['No "name" in frontmatter \u2014 directory name provides the /command (name is optional except for plugin-root skills)'] };
  }
  const name = String(model.data.name);
  if (!NAME_REGEX.test(name)) {
    return { errors: [`Invalid name format: "${name}" \u2014 should be kebab-case (a-z, 0-9, hyphens) for best compatibility`] };
  }
  if (name.length < 2 || name.length > 64) {
    return { errors: [`Name length out of range: ${name.length} chars (recommended 2-64)`] };
  }
  return { passes: [`name: "${name}"`] };
}
function checkDescription(model, _ctx) {
  if (!model.data.description) {
    return { warnings: ['Missing "description" (recommended) \u2014 helps Claude decide when to load the skill automatically'] };
  }
  return { passes: ["description field present"] };
}
function checkBody(model, _ctx) {
  if (!model.content.trim()) {
    return { errors: ["Markdown body is empty"] };
  }
  return { passes: ["Markdown body is non-empty"] };
}
function checkAdvancedFields(model, _ctx) {
  const advanced = Object.keys(model.data).filter((k) => KNOWN_FIELDS.has(k) && k !== "name" && k !== "description");
  if (advanced.length > 0) {
    return { passes: [`advanced frontmatter: ${advanced.join(", ")}`] };
  }
  return {};
}
function checkUnknownFields(model, _ctx) {
  const warnings = Object.keys(model.data).filter((k) => !KNOWN_FIELDS.has(k)).map((k) => `Unknown frontmatter field: "${k}" (may be a typo or newer spec addition)`);
  return { warnings };
}
function checkSupportingDirs(_model, ctx) {
  const passes = SUPPORTING_DIRS.filter((dir) => ctx.existingDirs.includes(dir)).map((dir) => `${dir}/ directory exists`);
  return { passes };
}
function checkDynamicInjection(model, _ctx) {
  const passes = [];
  if (/!\s*`[^`]+`/.test(model.content) || /```\s*!/.test(model.content)) {
    passes.push("uses dynamic context injection (!`...` or ```! blocks)");
  }
  if (/\$ARGUMENTS|\$[0-9]|\$\{CLAUDE_/.test(model.content)) {
    passes.push("uses argument / session substitutions ($ARGUMENTS, $0, ${CLAUDE_*})");
  }
  return { passes };
}
function validateSkillModel(model, context = { existingDirs: [] }) {
  return checks.reduce((acc, check) => merge(acc, check(model, context)), EMPTY);
}
var merge = (a, b) => ({
  errors: [...a.errors, ...b.errors ?? []],
  warnings: [...a.warnings, ...b.warnings ?? []],
  passes: [...a.passes, ...b.passes ?? []]
}), NAME_REGEX, KNOWN_FIELDS, SUPPORTING_DIRS, EMPTY, checks;
var init_skill_validate = __esm(() => {
  NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
  KNOWN_FIELDS = new Set([
    "name",
    "description",
    "when_to_use",
    "argument-hint",
    "arguments",
    "disable-model-invocation",
    "user-invocable",
    "allowed-tools",
    "disallowed-tools",
    "model",
    "effort",
    "context",
    "agent",
    "hooks",
    "paths",
    "shell"
  ]);
  SUPPORTING_DIRS = ["references", "scripts", "assets", "examples"];
  EMPTY = { errors: [], warnings: [], passes: [] };
  checks = [
    checkFrontmatterPresence,
    checkName,
    checkDescription,
    checkBody,
    checkAdvancedFields,
    checkUnknownFields,
    checkSupportingDirs,
    checkDynamicInjection
  ];
});

// src/cli/commands/validate.ts
var exports_validate = {};
__export(exports_validate, {
  default: () => validate_default
});
import { existsSync } from "fs";
import { resolve } from "path";
var import_picocolors2, OPTIONAL_DIRS, validate_default;
var init_validate = __esm(() => {
  init_dist();
  init_out();
  init_frontmatter();
  init_skill_validate();
  import_picocolors2 = __toESM(require_picocolors(), 1);
  OPTIONAL_DIRS = ["references", "scripts", "assets"];
  validate_default = defineCommand({
    meta: {
      name: "validate",
      description: "Validate structure and schema of a skill or plugin"
    },
    args: {
      path: {
        type: "positional",
        description: "Path to skill directory or plugin root",
        required: true
      },
      for: {
        type: "string",
        description: 'Target a provider ("claude") or specific validator ("claude:skill")'
      },
      format: {
        type: "string",
        alias: "f",
        description: "Output format (json or table)",
        default: "table"
      },
      verbose: {
        type: "boolean",
        alias: "v",
        description: "Show detailed diagnostics",
        default: false
      },
      ci: {
        type: "boolean",
        description: "Machine-friendly output, non-zero exit on issues",
        default: false
      }
    },
    async run({ args }) {
      const targetPath = args.path;
      const fullPath = resolve(targetPath);
      if (!existsSync(fullPath)) {
        ui.fail(`Path not found: ${targetPath}

Check that the path is correct and the directory exists.`);
        process.exit(1);
      }
      const skillMd = resolve(fullPath, "SKILL.md");
      if (!existsSync(skillMd)) {
        ui.fail(`No skill or plugin found at ${targetPath}

Searched for:
  \u2022 SKILL.md (Agent Skills spec)
  \u2022 .claude-plugin/plugin.json (Claude Code plugin)

Try:
  \u2022 Check the path points to a skill or plugin directory
  \u2022 Use --for to target a specific validator`);
        process.exit(1);
      }
      const raw = await Bun.file(skillMd).text();
      let parsed;
      try {
        parsed = parseFrontmatter(raw);
      } catch {
        ui.fail(`Failed to parse YAML frontmatter in SKILL.md

Fix the YAML syntax and retry.`);
        process.exit(1);
      }
      const existingDirs = OPTIONAL_DIRS.filter((dir) => existsSync(resolve(fullPath, dir)));
      const { errors, warnings, passes } = validateSkillModel(parsed, {
        existingDirs: [...existingDirs]
      });
      if (args.format === "json") {
        const result = { path: targetPath, errors, warnings, passes };
        console.log(JSON.stringify(result, null, 2));
      } else {
        ui.heading("dora skill validate \u2014 Structural validation");
        ui.info(`  Path:  ${targetPath}
`);
        for (const p of passes) {
          ui.pass(p);
        }
        for (const w of warnings) {
          ui.warnItem(w);
        }
        for (const e of errors) {
          ui.failItem(e);
        }
        if (errors.length === 0 && warnings.length === 0) {
          ui.write(`
  ${import_picocolors2.default.green("\u2713")} ${import_picocolors2.default.white("All checks passed.")}
`);
        } else {
          ui.info(`
  Result: ${errors.length} error(s), ${warnings.length} warning(s)
`);
        }
      }
      if (errors.length > 0) {
        process.exit(1);
      }
      process.exit(0);
    }
  });
});

// src/core/skill-drift.ts
function checkTrigger(input) {
  const hasTriggers = input.description.includes("use when") || input.description.includes("Use when") || input.description.includes("trigger") || input.description.includes("invoke");
  return {
    drifted: !hasTriggers,
    category: "Trigger",
    detail: hasTriggers ? "Description includes activation phrases" : 'No trigger phrases found \u2014 add "Use when..." to description'
  };
}
function checkStructure(input) {
  const hasSteps = /^\s*\d+\.\s/m.test(input.content) || /^\s*[-*]\s/m.test(input.content);
  return {
    drifted: !hasSteps,
    category: "Structure",
    detail: hasSteps ? "Has step-by-step instructions" : "No ordered steps or checklists \u2014 agent needs a clear sequence to follow"
  };
}
function checkVoice(input) {
  const hasImperative = /\b(Create|Add|Run|Install|Configure|Set|Build|Use|Check|Verify|Ensure)\b/.test(input.content);
  return {
    drifted: !hasImperative,
    category: "Voice",
    detail: hasImperative ? 'Uses imperative voice ("Do X" not "You might X")' : "Passive or suggestive phrasing \u2014 use direct imperatives"
  };
}
function checkExample(input) {
  const hasCode = input.content.includes("```");
  return {
    drifted: !hasCode,
    category: "Example",
    detail: hasCode ? "Has code examples" : "No code blocks found \u2014 add examples if the skill involves code"
  };
}
function checkGuardrail(input) {
  const hasConstraints = /\bMUST\b/.test(input.content) || /\bMUST NOT\b/.test(input.content);
  return {
    drifted: !hasConstraints,
    category: "Guardrail",
    detail: hasConstraints ? "Has MUST/MUST NOT constraints" : "No explicit constraints \u2014 add MUST / MUST NOT guardrails"
  };
}
function checkClarity(input) {
  const ambiguous = input.content.match(/\b(maybe|possibly|consider|you might want to|perhaps)\b/gi);
  const drifted = !!ambiguous && ambiguous.length > 0;
  return {
    drifted,
    category: "Clarity",
    detail: drifted ? `Ambiguous phrasing detected: ${ambiguous.slice(0, 3).join(", ")}` : "No ambiguous language found"
  };
}
function analyzeDrift(input) {
  const drifts = checks2.map((check) => check(input));
  return { drifts, driftCount: drifts.filter((d) => d.drifted).length, total: drifts.length };
}
var checks2;
var init_skill_drift = __esm(() => {
  checks2 = [
    checkTrigger,
    checkStructure,
    checkVoice,
    checkExample,
    checkGuardrail,
    checkClarity
  ];
});

// src/cli/commands/drift.ts
var exports_drift = {};
__export(exports_drift, {
  default: () => drift_default
});
import { existsSync as existsSync2 } from "fs";
import { resolve as resolve2 } from "path";
var import_picocolors3, drift_default;
var init_drift = __esm(() => {
  init_dist();
  init_out();
  init_frontmatter();
  init_skill_drift();
  import_picocolors3 = __toESM(require_picocolors(), 1);
  drift_default = defineCommand({
    meta: {
      name: "drift",
      description: "Measure how far a skill has drifted from rubric standards"
    },
    args: {
      path: {
        type: "positional",
        description: "Path to skill directory or plugin root",
        required: true
      },
      for: {
        type: "string",
        description: 'Target a provider ("claude") or specific validator ("claude:skill")'
      },
      format: {
        type: "string",
        alias: "f",
        description: "Output format (json or table)",
        default: "table"
      },
      verbose: {
        type: "boolean",
        alias: "v",
        description: "Show detailed diagnostics",
        default: false
      },
      ci: {
        type: "boolean",
        description: "Machine-friendly output, non-zero exit on issues",
        default: false
      }
    },
    async run({ args }) {
      const targetPath = args.path;
      const fullPath = resolve2(targetPath);
      const skillMd = resolve2(fullPath, "SKILL.md");
      if (!existsSync2(skillMd)) {
        ui.fail(`No SKILL.md found at ${targetPath}

Check that the path points to a skill directory containing SKILL.md.`);
        process.exit(1);
      }
      const raw = await Bun.file(skillMd).text();
      let parsed;
      try {
        parsed = parseFrontmatter(raw);
      } catch {
        ui.fail("Failed to parse YAML frontmatter in SKILL.md");
        process.exit(1);
      }
      const desc = String(parsed.data.description || "");
      const when = String(parsed.data.when_to_use || "");
      const { drifts, driftCount, total } = analyzeDrift({
        description: (desc + " " + when).trim(),
        content: parsed.content
      });
      if (args.format === "json") {
        console.log(JSON.stringify({ path: targetPath, driftCount, total, drifts }, null, 2));
      } else {
        ui.heading("dora skill drift \u2014 Measuring rubric drift");
        ui.info(`  Path:  ${targetPath}
`);
        for (const d of drifts) {
          const icon = d.drifted ? import_picocolors3.default.yellow("\u2197") : import_picocolors3.default.green("\xB7");
          const cat = d.drifted ? import_picocolors3.default.yellow(d.category.padEnd(10)) : import_picocolors3.default.dim(d.category.padEnd(10));
          ui.write(`  ${icon} ${cat} ${import_picocolors3.default.white(d.detail)}`);
        }
        if (driftCount === 0) {
          ui.write(`
  ${import_picocolors3.default.green("No drift detected.")} ${import_picocolors3.default.white("Skill aligns with rubric standards.")}
`);
        } else {
          ui.write(`
  ${import_picocolors3.default.yellow(`${driftCount}/${total}`)} ${import_picocolors3.default.white("rubric areas have drifted.")}
`);
        }
      }
      if (args.ci && driftCount > 0) {
        process.exit(1);
      }
      process.exit(0);
    }
  });
});

// src/cli/commands/judge.ts
var exports_judge = {};
__export(exports_judge, {
  default: () => judge_default
});
var judge_default;
var init_judge = __esm(() => {
  init_dist();
  init_out();
  judge_default = defineCommand({
    meta: {
      name: "judge",
      description: "AI-driven qualitative assessment of a skill"
    },
    args: {
      path: {
        type: "positional",
        description: "Path to skill directory",
        required: true
      },
      for: {
        type: "string",
        description: 'Target a provider ("claude") or specific validator ("claude:skill")'
      },
      format: {
        type: "string",
        alias: "f",
        description: "Output format (json or table)",
        default: "table"
      },
      verbose: {
        type: "boolean",
        alias: "v",
        description: "Show detailed diagnostics",
        default: false
      }
    },
    async run({ args }) {
      ui.heading("doraval skill judge \u2014 AI-driven assessment");
      ui.info(`  Path:  ${args.path}
`);
      ui.warn(`Not yet implemented. This command will send the skill to an LLM for qualitative review (clarity, completeness, effectiveness).
`);
      process.exit(2);
    }
  });
});

// src/core/journal-config.ts
import { existsSync as existsSync3, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
var {YAML: YAML2 } = globalThis.Bun;
function getDoravalDir() {
  return process.env.DORAVAL_HOME ?? join(homedir(), ".doraval");
}
function getConfigPath() {
  return join(getDoravalDir(), "config.yml");
}
function getJournalsDir() {
  return join(getDoravalDir(), "journals");
}
function getPendingDir() {
  return join(getDoravalDir(), "pending");
}
function getPendingProjectDir(project) {
  return join(getPendingDir(), project);
}
function ensureDoravalDirs() {
  const base = getDoravalDir();
  for (const dir of [base, getJournalsDir(), getPendingDir()]) {
    if (!existsSync3(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
async function readConfig() {
  const path = getConfigPath();
  if (!existsSync3(path))
    return null;
  const raw = await Bun.file(path).text();
  return YAML2.parse(raw);
}
async function writeConfig(config) {
  ensureDoravalDirs();
  const raw = serializeConfig(config);
  await Bun.write(getConfigPath(), raw);
}
function serializeConfig(config) {
  return YAML2.stringify(config);
}
function resolveProjectName(config) {
  if (!config)
    return null;
  const cwd = process.cwd();
  const base = cwd.split("/").pop() ?? "";
  if (config.journal.projects[base]) {
    try {
      return sanitizeProjectName(base);
    } catch {
      return null;
    }
  }
  return null;
}
function sanitizeProjectName(name) {
  if (!name || typeof name !== "string") {
    throw new Error("Project name must be a non-empty string");
  }
  let sanitized = name.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^[-_]+|[-_]+$/g, "").slice(0, 64);
  if (!sanitized || sanitized.includes("..")) {
    throw new Error(`Invalid or unsafe project name: "${name}"`);
  }
  return sanitized;
}
var init_journal_config = () => {};

// src/core/journal-remote.ts
var {spawnSync } = globalThis.Bun;
function hasGhCli() {
  const result = spawnSync(["gh", "--version"], {
    stdout: "pipe",
    stderr: "pipe"
  });
  return result.exitCode === 0;
}
function ensureGhCli() {
  if (hasGhCli())
    return { ok: true, value: true };
  return { ok: false, error: "GH_CLI_MISSING" };
}
function fetchRemoteJournalFile(repo, path) {
  const result = spawnSync(["gh", "api", `repos/${repo}/contents/${path}`, "--jq", "{sha, content, encoding}"], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    if (stderr.includes("404") || stderr.includes("Not Found")) {
      return { ok: false, error: "not found", isNotFound: true };
    }
    return { ok: false, error: stderr };
  }
  try {
    const parsed = JSON.parse(result.stdout.toString());
    let decoded;
    if (!parsed.encoding || parsed.encoding === "base64") {
      decoded = Buffer.from(parsed.content, "base64").toString("utf-8");
    } else {
      decoded = parsed.content;
    }
    return {
      ok: true,
      value: {
        content: decoded,
        sha: parsed.sha
      }
    };
  } catch {
    return { ok: false, error: `Unexpected response when fetching ${path} from ${repo}` };
  }
}
async function refreshLocalJournalFile(repo, remotePath, localPath) {
  const res = fetchRemoteJournalFile(repo, remotePath);
  if (!res.ok) {
    if (res.isNotFound) {
      return { ok: true, value: false };
    }
    return { ok: false, error: res.error };
  }
  const remote = res.value;
  await Bun.write(localPath, remote.content);
  return { ok: true, value: true };
}
function getRemoteJournalFileMeta(repo, path) {
  const result = spawnSync(["gh", "api", `repos/${repo}/contents/${path}`, "--jq", "{sha, content, encoding}"], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    if (stderr.includes("404") || stderr.includes("Not Found")) {
      return { ok: false, error: "not found", isNotFound: true };
    }
    return { ok: false, error: stderr };
  }
  try {
    const parsed = JSON.parse(result.stdout.toString());
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, error: `Unexpected response when fetching ${path} from ${repo}` };
  }
}
function getGitRemoteOwner() {
  const result = spawnSync(["git", "config", "--get", "remote.origin.url"], {
    stdout: "pipe",
    stderr: "pipe"
  });
  if (result.exitCode !== 0)
    return null;
  const url = result.stdout.toString().trim();
  if (!url)
    return null;
  const match = url.match(/[:/]([^/]+)\/([^/.]+)(\.git)?$/);
  return match ? match[1] : null;
}
function ghUser() {
  const result = spawnSync(["gh", "api", "user", "--jq", ".login"], {
    stdout: "pipe",
    stderr: "pipe"
  });
  if (result.exitCode !== 0)
    return null;
  return result.stdout.toString().trim() || null;
}
function repoExists(repo) {
  const result = spawnSync(["gh", "api", `repos/${repo}`, "--jq", ".full_name"], { stdout: "pipe", stderr: "pipe" });
  return result.exitCode === 0 && result.stdout.toString().trim().length > 0;
}
var init_journal_remote = () => {};

// src/cli/prompt.ts
function prompt(label, fallback) {
  process.stderr.write(`${label} ${import_picocolors4.default.dim(`(${fallback})`)} `);
  const buf = new Uint8Array(1024);
  const n = __require("fs").readSync(0, buf);
  const input = new TextDecoder().decode(buf.subarray(0, n)).trim();
  return input || fallback;
}
var import_picocolors4;
var init_prompt = __esm(() => {
  import_picocolors4 = __toESM(require_picocolors(), 1);
});

// src/cli/commands/journal/init.ts
var exports_init = {};
__export(exports_init, {
  default: () => init_default
});
import { basename, join as join2 } from "path";
var import_picocolors5, init_default;
var init_init = __esm(() => {
  init_dist();
  init_out();
  init_journal_config();
  init_journal_remote();
  init_prompt();
  import_picocolors5 = __toESM(require_picocolors(), 1);
  init_default = defineCommand({
    meta: {
      name: "init",
      description: "Register a project and link it to your journal repo"
    },
    args: {
      repo: {
        type: "string",
        alias: "r",
        description: "Journal repo (owner/name). Smart default from git remote or gh account. Env: DORAVAL_JOURNAL_REPO"
      },
      project: {
        type: "string",
        alias: "p",
        description: "Project name (default: basename of current directory)"
      },
      refresh: {
        type: "boolean",
        description: "Re-fetch journal files even if the project is already registered",
        default: false
      }
    },
    async run({ args }) {
      ui.write(`
  ${import_picocolors5.default.bold(import_picocolors5.default.white("dora journal init"))} (or top-level ${import_picocolors5.default.dim(import_picocolors5.default.gray("dora init"))}) \u2014 Set up your journal
`);
      const ghCheck = ensureGhCli();
      if (!ghCheck.ok) {
        ui.write(`  ${import_picocolors5.default.red("\u2717")} ${import_picocolors5.default.white("The GitHub CLI (")}${import_picocolors5.default.bold("gh")}${import_picocolors5.default.white(") is not installed.")}
`);
        ui.write(`  doraval uses ${import_picocolors5.default.bold("gh")} to fetch and sync journal files with GitHub.
`);
        ui.write(`  Install it:
`);
        ui.write(`    macOS:   ${import_picocolors5.default.dim("brew install gh")}`);
        ui.write(`    Linux:   ${import_picocolors5.default.dim("https://github.com/cli/cli/blob/trunk/docs/install_linux.md")}`);
        ui.write(`    Windows: ${import_picocolors5.default.dim("winget install --id GitHub.cli")}
`);
        ui.write(`  Then authenticate: ${import_picocolors5.default.dim("gh auth login")}
`);
        process.exit(1);
      }
      let repo = args.repo || process.env.DORAVAL_JOURNAL_REPO;
      if (!repo) {
        const gitOwner = getGitRemoteOwner();
        const ghLogin = ghUser();
        let defaultRepo;
        let sourceNote = "";
        if (gitOwner) {
          defaultRepo = `${gitOwner}/${gitOwner}.md`;
          if (ghLogin && ghLogin !== gitOwner) {
            sourceNote = `  ${import_picocolors5.default.dim("(from git remote; your active gh account is " + ghLogin + ")")}
`;
          } else {
            sourceNote = `  ${import_picocolors5.default.dim("(from git remote)")}
`;
          }
        } else if (ghLogin) {
          defaultRepo = `${ghLogin}/${ghLogin}.md`;
          sourceNote = `  ${import_picocolors5.default.dim("(from your active gh account)")}
`;
        } else {
          ui.write(`  ${import_picocolors5.default.yellow("\u26A0")} Not logged in to GitHub. Run ${import_picocolors5.default.dim("gh auth login")} first.
`);
          process.exit(1);
        }
        const existingConfig = await readConfig();
        if (existingConfig?.journal.repo) {
          defaultRepo = existingConfig.journal.repo;
          sourceNote = `  ${import_picocolors5.default.dim("(from your previous journal setup)")}
`;
        }
        ui.write(`  Journal repo ${import_picocolors5.default.dim(import_picocolors5.default.gray("(owner/name)"))}`);
        if (sourceNote)
          ui.write(sourceNote);
        repo = prompt("  >", defaultRepo);
      }
      let project = args.project || process.env.DORAVAL_PROJECT;
      if (!project) {
        const defaultProject = basename(process.cwd());
        project = prompt("  Project name", defaultProject);
      }
      project = sanitizeProjectName(project);
      if (!repoExists(repo)) {
        ui.write(`  ${import_picocolors5.default.red("\u2717")} Repository ${import_picocolors5.default.bold(import_picocolors5.default.white(repo))} not found on GitHub.
`);
        ui.write(`  Create it first:
`);
        ui.write(`    ${import_picocolors5.default.dim(`gh repo create ${repo} --private --description "Personal journal for agent decisions"`)}
`);
        ui.write(`  The repo should be private. doraval will populate it on first ${import_picocolors5.default.dim("dora journal sync")}.
`);
        process.exit(1);
      }
      const existing = await readConfig();
      const alreadyRegistered = existing?.journal.projects[project];
      const isRefresh = alreadyRegistered && args.refresh;
      if (alreadyRegistered && !isRefresh) {
        ui.write(`  ${import_picocolors5.default.yellow("\u26A0")} Project ${import_picocolors5.default.bold(import_picocolors5.default.white(project))} is already registered.
`);
        ui.write(`  Repo:   ${import_picocolors5.default.gray(existing.journal.repo)}`);
        ui.write(`  Remote: ${existing.journal.projects[project]?.remote_path}
`);
        ui.write(`  To refresh local files, run: ${import_picocolors5.default.dim(import_picocolors5.default.gray(`dora journal update`))}
` + `  (init --refresh still works for compatibility.)
` + `  Or remove the project from ${import_picocolors5.default.dim(import_picocolors5.default.gray("~/.doraval/config.yml"))} to fully re-initialize.
`);
        process.exit(0);
      }
      const journalsDir = getJournalsDir();
      const remotePath = `projects/${project}.md`;
      const localPath = join2(journalsDir, `${project}.md`);
      const effectiveRepo = isRefresh && !args.repo ? existing.journal.repo : repo;
      const config = existing ?? {
        journal: { repo: effectiveRepo, projects: {} }
      };
      config.journal.repo = effectiveRepo;
      config.journal.projects[project] = {
        remote_path: remotePath,
        local_path: localPath
      };
      ensureDoravalDirs();
      const actionLabel = isRefresh ? "Refreshing" : "Fetching";
      ui.write(`  ${import_picocolors5.default.dim(import_picocolors5.default.gray(`${actionLabel} journal files from`))} ${import_picocolors5.default.gray(effectiveRepo)}${import_picocolors5.default.dim(import_picocolors5.default.gray("..."))}
`);
      const globalDest = join2(journalsDir, "global.md");
      const refreshGlobalRes = await refreshLocalJournalFile(effectiveRepo, "global.md", globalDest);
      let wroteGlobal;
      if (!refreshGlobalRes.ok) {
        if (refreshGlobalRes.isNotFound) {
          wroteGlobal = false;
        } else {
          ui.write(`  ${import_picocolors5.default.red("\u2717")} Failed to fetch global.md from ${effectiveRepo}:`);
          ui.write(refreshGlobalRes.error);
          process.exit(1);
        }
      } else {
        wroteGlobal = refreshGlobalRes.value;
      }
      if (wroteGlobal) {
        ui.write(`  ${import_picocolors5.default.green("\u2713")} global.md`);
      } else {
        ui.write(`  ${import_picocolors5.default.dim("\xB7")} global.md ${import_picocolors5.default.dim("(not found \u2014 will be created on first sync)")}`);
        await Bun.write(globalDest, `# Global Journal

Cross-project principles.
`);
      }
      const refreshProjectRes = await refreshLocalJournalFile(effectiveRepo, remotePath, localPath);
      let wroteProject;
      if (!refreshProjectRes.ok) {
        if (refreshProjectRes.isNotFound) {
          wroteProject = false;
        } else {
          ui.write(`  ${import_picocolors5.default.red("\u2717")} Failed to fetch ${remotePath} from ${effectiveRepo}:`);
          ui.write(refreshProjectRes.error);
          process.exit(1);
        }
      } else {
        wroteProject = refreshProjectRes.value;
      }
      if (wroteProject) {
        ui.write(`  ${import_picocolors5.default.green("\u2713")} ${remotePath}`);
      } else {
        ui.write(`  ${import_picocolors5.default.dim("\xB7")} ${remotePath} ${import_picocolors5.default.dim("(not found \u2014 will be created on first sync)")}`);
        await Bun.write(localPath, `# ${project} Journal

Project-specific decisions.
`);
      }
      await writeConfig(config);
      ui.write(`
  ${import_picocolors5.default.green("\u2713")} Project ${import_picocolors5.default.bold(import_picocolors5.default.white(project))} registered to ${import_picocolors5.default.bold(import_picocolors5.default.white(repo))}.
`);
      ui.write(`  Config:   ${import_picocolors5.default.dim(import_picocolors5.default.gray("~/.doraval/config.yml"))}`);
      ui.write(`  Journals: ${import_picocolors5.default.dim(import_picocolors5.default.gray("~/.doraval/journals/"))}`);
      ui.write(`  Pending:  ${import_picocolors5.default.dim(import_picocolors5.default.gray("~/.doraval/pending/"))}
`);
      ui.write(`  Use ${import_picocolors5.default.dim(import_picocolors5.default.gray("dora journal add"))} to propose decisions and ${import_picocolors5.default.dim(import_picocolors5.default.gray("dora journal list"))} to view them.
`);
      process.exit(0);
    }
  });
});

// src/core/journal-parse.ts
var {YAML: YAML3 } = globalThis.Bun;
function parseJournalEntries(raw) {
  const { entries } = parseJournalEntriesWithWarnings(raw);
  return entries;
}
function parseJournalEntriesWithWarnings(raw) {
  const entries = [];
  const warnings = [];
  if (!raw || !raw.trim()) {
    return { entries, warnings };
  }
  const sectionRegex = /^##\s+(.+)$/gm;
  const matches = Array.from(raw.matchAll(sectionRegex));
  if (matches.length === 0) {
    return { entries, warnings };
  }
  for (let i = 0;i < matches.length; i++) {
    const match = matches[i];
    const title = match[1].trim();
    const start = match.index + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    const sectionBody = raw.slice(start, end).trim();
    const yamlFenceMatch = sectionBody.match(/```(?:ya?ml)?\s*\n([\s\S]*?)\n```/);
    if (!yamlFenceMatch) {
      warnings.push(`Entry "${title}" has no YAML metadata block`);
      continue;
    }
    const yamlContent = yamlFenceMatch[1];
    let meta = {};
    try {
      const parsed = YAML3.parse(yamlContent);
      if (parsed && typeof parsed === "object") {
        meta = parsed;
      }
    } catch (err) {
      warnings.push(`Entry "${title}" has invalid YAML: ${err.message}`);
      continue;
    }
    const yamlBlockEnd = sectionBody.indexOf(yamlFenceMatch[0]) + yamlFenceMatch[0].length;
    const rationale = sectionBody.slice(yamlBlockEnd).trim();
    const pushback = Number(meta.pushback);
    const tags = Array.isArray(meta.tags) ? meta.tags : Array.isArray(meta.scope) ? meta.scope : [];
    const author = typeof meta.author === "string" ? meta.author : "human";
    const date = (typeof meta.date === "string" ? meta.date : "") ?? "";
    const status = (meta.status || "active") ?? "active";
    const superseded_by = typeof meta.superseded_by === "string" ? meta.superseded_by : undefined;
    entries.push({
      title,
      pushback: isNaN(pushback) ? 0 : pushback,
      tags,
      author,
      date,
      status,
      superseded_by,
      rationale
    });
  }
  return { entries, warnings };
}
var init_journal_parse = () => {};

// src/cli/commands/journal/list.ts
var exports_list = {};
__export(exports_list, {
  default: () => list_default
});
import { existsSync as existsSync4, readdirSync } from "fs";
import { join as join3 } from "path";
var import_picocolors6, list_default;
var init_list = __esm(() => {
  init_dist();
  init_out();
  init_journal_config();
  init_journal_parse();
  import_picocolors6 = __toESM(require_picocolors(), 1);
  list_default = defineCommand({
    meta: {
      name: "list",
      description: "List active journal entries for the current project"
    },
    args: {
      project: {
        type: "string",
        alias: "p",
        description: "Project name (defaults to directory-based mapping)"
      },
      all: {
        type: "boolean",
        description: "Include non-active entries (superseded/retired)",
        default: false
      },
      format: {
        type: "string",
        alias: "f",
        description: "Output format (table or json)",
        default: "table"
      }
    },
    async run({ args }) {
      const config = await readConfig();
      let project = args.project;
      if (!project) {
        project = resolveProjectName(config) ?? undefined;
      }
      if (project) {
        project = sanitizeProjectName(project);
      }
      if (!project) {
        ui.write(`${import_picocolors6.default.yellow("\u26A0")} ${import_picocolors6.default.yellow("No project mapping found.")}

` + `Run ${import_picocolors6.default.dim(import_picocolors6.default.gray("dora init"))} (or ${import_picocolors6.default.dim(import_picocolors6.default.gray("doraval journal init"))}) first, or pass ${import_picocolors6.default.dim(import_picocolors6.default.gray("--project <name>"))}.`);
        process.exit(1);
      }
      const journalRepo = config?.journal.repo ?? "(unknown)";
      const journalsDir = getJournalsDir();
      const projectFile = join3(journalsDir, `${project}.md`);
      const globalFile = join3(journalsDir, "global.md");
      let raw = "";
      try {
        raw = await Bun.file(projectFile).text();
      } catch {
        raw = "";
      }
      let allEntries = parseJournalEntries(raw);
      if (!args.all) {
        allEntries = allEntries.filter((e) => e.status === "active");
      }
      const staged = [];
      try {
        const pdir = getPendingProjectDir(project);
        if (existsSync4(pdir)) {
          const files = readdirSync(pdir).filter((f) => f.endsWith(".md") && f !== ".gitkeep");
          for (const f of files) {
            const txt = await Bun.file(join3(pdir, f)).text();
            const parsed = parseJournalEntries(txt);
            for (const e of parsed) {
              e._staged = true;
              staged.push(e);
            }
          }
        }
      } catch {}
      if (args.format === "json") {
        console.log(JSON.stringify({ project, entries: [...staged, ...allEntries] }, null, 2));
        return;
      }
      ui.write(`
  ${import_picocolors6.default.bold(import_picocolors6.default.white("dora journal list"))} \u2014 ${import_picocolors6.default.white(project)}  ${import_picocolors6.default.dim(import_picocolors6.default.gray(`(from ${journalRepo})`))}
`);
      const hasStaged = staged.length > 0;
      const hasCommitted = allEntries.length > 0;
      const seen = new Set;
      const dups = [];
      for (const e of [...staged, ...allEntries]) {
        if (seen.has(e.title))
          dups.push(e.title);
        else
          seen.add(e.title);
      }
      if (dups.length > 0) {
        const uniqueDups = [...new Set(dups)];
        ui.write(`  ${import_picocolors6.default.yellow("\u26A0")} ${import_picocolors6.default.yellow("Duplicate titles in this view (clean in your journal repo + update):")} ${uniqueDups.map((t) => import_picocolors6.default.yellow(`"${t}"`)).join(", ")}
`);
      }
      if (!hasStaged && !hasCommitted) {
        ui.write(`  ${import_picocolors6.default.dim(import_picocolors6.default.gray("No active entries found for"))} ${import_picocolors6.default.bold(import_picocolors6.default.white(project))}.
`);
        ui.write(`  Journal repo: ${import_picocolors6.default.dim(import_picocolors6.default.gray(journalRepo))}`);
        ui.write(`  Local file:   ${import_picocolors6.default.dim(import_picocolors6.default.gray(projectFile))}
`);
        ui.write(`  ${import_picocolors6.default.dim(import_picocolors6.default.gray("This is normal for a freshly initialized project."))}
` + `  Use ${import_picocolors6.default.dim(import_picocolors6.default.gray("dora journal add"))} to propose decisions.
` + `  They will be staged locally until you run ${import_picocolors6.default.dim(import_picocolors6.default.gray("dora journal sync"))}.
`);
        ui.write(`  If you expect content, try: ${import_picocolors6.default.dim(import_picocolors6.default.gray(`dora journal update`))}
`);
        return;
      }
      function printEntry(entry) {
        const pb = entry.pushback ?? 0;
        let pbColor = import_picocolors6.default.green;
        if (pb >= 7)
          pbColor = import_picocolors6.default.red;
        else if (pb >= 4)
          pbColor = import_picocolors6.default.yellow;
        const tagsStr = (entry.tags || []).join(", ") || import_picocolors6.default.dim("(none)");
        const statusNote = entry.status !== "active" ? import_picocolors6.default.dim(` [${entry.status}]`) : "";
        const stagedNote = entry._staged ? import_picocolors6.default.dim(" (staged)") : "";
        ui.write(`  ${pbColor(String(pb).padStart(2))}  ${import_picocolors6.default.bold(import_picocolors6.default.white(entry.title))}${statusNote}${stagedNote}`);
        ui.write(`      ${import_picocolors6.default.dim(import_picocolors6.default.gray("tags:"))} ${import_picocolors6.default.gray(tagsStr)}`);
        const by = entry.author?.startsWith("agent:") ? import_picocolors6.default.cyan(entry.author) : entry.author || "human";
        ui.write(`      ${import_picocolors6.default.dim(import_picocolors6.default.gray("by:"))} ${import_picocolors6.default.gray(by)}  ${import_picocolors6.default.dim(import_picocolors6.default.gray("on"))} ${import_picocolors6.default.gray(entry.date)}`);
        const rat = (entry.rationale || "").replace(/\s+/g, " ").trim();
        if (rat) {
          const preview = rat.length > 88 ? rat.slice(0, 85) + import_picocolors6.default.dim(import_picocolors6.default.gray("\u2026")) : rat;
          ui.write(`      ${import_picocolors6.default.dim(import_picocolors6.default.gray(preview))}`);
        }
        ui.write("");
      }
      if (hasStaged) {
        ui.write(`  ${import_picocolors6.default.yellow("\u25CF")} ${import_picocolors6.default.bold(import_picocolors6.default.white("Staged / pending"))} (not yet in remote; run ${import_picocolors6.default.dim(import_picocolors6.default.gray("dora journal sync"))} to publish):
`);
        for (const entry of staged) {
          printEntry(entry);
        }
        if (hasCommitted)
          ui.write("");
      }
      if (hasCommitted) {
        if (hasStaged) {
          ui.write(`  ${import_picocolors6.default.dim(import_picocolors6.default.gray("Committed (from local cache):"))}
`);
        }
        for (const entry of allEntries) {
          printEntry(entry);
        }
      }
      const totalShown = staged.length + allEntries.length;
      ui.write(`  ${import_picocolors6.default.dim(import_picocolors6.default.gray(`${totalShown} entries shown from ${journalRepo}.`))}
`);
      process.exit(0);
    }
  });
});

// src/cli/commands/journal/update.ts
var exports_update = {};
__export(exports_update, {
  default: () => update_default
});
import { existsSync as existsSync5 } from "fs";
import { join as join4 } from "path";
var import_picocolors7, update_default;
var init_update = __esm(() => {
  init_dist();
  init_out();
  init_journal_config();
  init_journal_remote();
  import_picocolors7 = __toESM(require_picocolors(), 1);
  update_default = defineCommand({
    meta: {
      name: "update",
      description: "Refresh local journal cache from the remote GitHub repo"
    },
    args: {
      project: {
        type: "string",
        alias: "p",
        description: "Project name (defaults to directory-based mapping)"
      },
      all: {
        type: "boolean",
        description: "Refresh all registered projects (and global.md)",
        default: false
      }
    },
    async run({ args }) {
      const ghCheck = ensureGhCli();
      if (!ghCheck.ok) {
        ui.write(`  ${import_picocolors7.default.red("\u2717")} ${import_picocolors7.default.white("The GitHub CLI (")}${import_picocolors7.default.bold("gh")}${import_picocolors7.default.white(") is not installed.")}
`);
        ui.write(`  doraval uses ${import_picocolors7.default.bold("gh")} to fetch and sync journal files with GitHub.
`);
        ui.write(`  Install it:
`);
        ui.write(`    macOS:   ${import_picocolors7.default.dim("brew install gh")}`);
        ui.write(`    Linux:   ${import_picocolors7.default.dim("https://github.com/cli/cli/blob/trunk/docs/install_linux.md")}`);
        ui.write(`    Windows: ${import_picocolors7.default.dim("winget install --id GitHub.cli")}
`);
        ui.write(`  Then authenticate: ${import_picocolors7.default.dim("gh auth login")}
`);
        process.exit(1);
      }
      const config = await readConfig();
      if (!config?.journal.repo) {
        ui.write(`${import_picocolors7.default.red("\u2717")} No journal repo configured. Run ${import_picocolors7.default.dim("dora init")} (or ${import_picocolors7.default.dim("doraval journal init")}) first.`);
        process.exit(1);
      }
      const journalRepo = config.journal.repo;
      ensureDoravalDirs();
      const journalsDir = getJournalsDir();
      ui.write(`
  ${import_picocolors7.default.bold(import_picocolors7.default.white("dora journal update"))} \u2014 ${import_picocolors7.default.dim(import_picocolors7.default.gray(journalRepo))}
`);
      const projectsToUpdate = [];
      if (args.all) {
        for (const name of Object.keys(config.journal.projects)) {
          try {
            projectsToUpdate.push(sanitizeProjectName(name));
          } catch {}
        }
      } else {
        let project = args.project;
        if (!project) {
          project = resolveProjectName(config) ?? undefined;
        }
        if (project) {
          try {
            projectsToUpdate.push(sanitizeProjectName(project));
          } catch {
            ui.write(`${import_picocolors7.default.red("\u2717")} Invalid project name: ${project}`);
            process.exit(1);
          }
        }
      }
      const globalLocal = join4(journalsDir, "global.md");
      const refreshGlobalRes = await refreshLocalJournalFile(journalRepo, "global.md", globalLocal);
      let gotGlobal;
      if (!refreshGlobalRes.ok) {
        if (refreshGlobalRes.isNotFound) {
          gotGlobal = false;
        } else {
          ui.write(`${import_picocolors7.default.red("\u2717")} Failed to fetch global.md from ${journalRepo}:`);
          ui.write(refreshGlobalRes.error);
          process.exit(1);
        }
      } else {
        gotGlobal = refreshGlobalRes.value;
      }
      if (gotGlobal) {
        ui.write(`  ${import_picocolors7.default.green("\u2713")} global.md`);
      } else {
        ui.write(`  ${import_picocolors7.default.dim("\xB7")} global.md ${import_picocolors7.default.dim("(not present on remote)")}`);
      }
      if (projectsToUpdate.length === 0) {
        if (args.all) {
          ui.write(`
  ${import_picocolors7.default.dim(import_picocolors7.default.gray("No projects registered."))}
`);
        } else {
          ui.write(`
  ${import_picocolors7.default.yellow("\u26A0")} No project mapping found.
` + `  Run ${import_picocolors7.default.dim("dora init")} or pass ${import_picocolors7.default.dim("--project <name>")} / ${import_picocolors7.default.dim("--all")}.
`);
        }
        return;
      }
      for (const project of projectsToUpdate) {
        const remotePath = `projects/${project}.md`;
        const localPath = join4(journalsDir, `${project}.md`);
        const refreshRes = await refreshLocalJournalFile(journalRepo, remotePath, localPath);
        let got;
        if (!refreshRes.ok) {
          if (refreshRes.isNotFound) {
            got = false;
          } else {
            ui.write(`${import_picocolors7.default.red("\u2717")} Failed to fetch ${remotePath} from ${journalRepo}:`);
            ui.write(refreshRes.error);
            process.exit(1);
          }
        } else {
          got = refreshRes.value;
        }
        if (got) {
          ui.write(`  ${import_picocolors7.default.green("\u2713")} ${remotePath}`);
        } else {
          ui.write(`  ${import_picocolors7.default.dim("\xB7")} ${remotePath} ${import_picocolors7.default.dim("(not present on remote \u2014 will be created on first sync)")}`);
          if (!existsSync5(localPath)) {
            await Bun.write(localPath, `# ${project} Journal

Project-specific decisions.
`);
          }
        }
      }
      const summary = args.all && projectsToUpdate.length > 1 ? `${projectsToUpdate.length} projects + global` : projectsToUpdate.length === 1 ? projectsToUpdate[0] : "journals";
      ui.write(`
  ${import_picocolors7.default.dim(import_picocolors7.default.gray("Local cache refreshed for"))} ${import_picocolors7.default.bold(import_picocolors7.default.white(summary))}.
`);
    }
  });
});

// src/core/journal-validate.ts
function validateEntry(entry) {
  const errors = [];
  const warnings = [];
  if (entry.pushback === undefined || entry.pushback === null) {
    warnings.push("pushback not supplied (will use default 5 when staging via journal add)");
  } else {
    const pb = Number(entry.pushback);
    if (!Number.isInteger(pb) || pb < 1 || pb > 10) {
      errors.push("pushback must be an integer between 1 and 10");
    }
  }
  if (!entry.tags || !Array.isArray(entry.tags) || entry.tags.length === 0) {
    warnings.push("tags not supplied or empty (will use [] when staging via journal add; consider canonical tags)");
  } else {
    const invalidTags = entry.tags.filter((s) => !CANONICAL_TAGS.includes(s));
    if (invalidTags.length > 0) {
      warnings.push(`tags contains non-canonical values: ${invalidTags.join(", ")} (valid: ${CANONICAL_TAGS.join(", ")})`);
    }
  }
  if (!entry.author || typeof entry.author !== "string") {
    errors.push("author is required");
  } else if (!entry.author.startsWith("human") && !entry.author.startsWith("agent:")) {
    warnings.push(`author "${entry.author}" does not follow the recommended pattern (human or agent:<name>)`);
  }
  if (!entry.date || typeof entry.date !== "string") {
    errors.push("date is required");
  }
  if (!entry.status || !VALID_STATUSES.includes(entry.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(", ")}`);
  }
  if (!entry.title || typeof entry.title !== "string" || entry.title.trim() === "") {
    errors.push("title is required");
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
var CANONICAL_TAGS, VALID_STATUSES;
var init_journal_validate = __esm(() => {
  CANONICAL_TAGS = [
    "naming",
    "cli",
    "architecture",
    "testing",
    "ux",
    "api",
    "docs",
    "notes"
  ];
  VALID_STATUSES = ["active", "superseded", "retired"];
});

// src/cli/commands/journal/add.ts
var exports_add = {};
__export(exports_add, {
  default: () => add_default,
  buildAgentArgv: () => buildAgentArgv
});
import { existsSync as existsSync6 } from "fs";
import { join as join5 } from "path";
var {spawnSync: spawnSync2 } = globalThis.Bun;
function buildAgentArgv(template, promptText) {
  const marker = "__DORA_PROMPT__";
  const substituted = template.replace("{{prompt}}", marker);
  const rawParts = substituted.split(/\s+/).filter(Boolean);
  return rawParts.map((part) => {
    let cleaned = part;
    if (cleaned.startsWith('"') && cleaned.endsWith('"'))
      cleaned = cleaned.slice(1, -1);
    if (cleaned.startsWith("'") && cleaned.endsWith("'"))
      cleaned = cleaned.slice(1, -1);
    if (cleaned === marker) {
      return promptText;
    }
    return cleaned;
  });
}
async function invokeConfiguredAgentForEntry(decisionText, agentCfg) {
  if (!agentCfg || !agentCfg.command)
    return null;
  const scaffold = `Raw user capture (a decision, observation, or useful note that just happened): "${decisionText}"

Turn this into a clean journal entry. Infer the core decision or note even if the input is phrased as a todo or reminder. Be professional and concise.

**CRITICAL INSTRUCTIONS (follow exactly):**
- Output *ONLY* a single valid JSON object. Nothing before it, nothing after it, no markdown fences, no explanations, no extra text.
- The JSON must have exactly these keys (use the suggested values as starting point but improve them):
{
  "title": "Short, scannable, professional title (past tense or present perfect, max ~80 chars)",
  "pushback": 4,
  "tags": ["cli", "ux"],
  "rationale": "2-5 sentences explaining context and implications (or the note content).",
  "author": "agent:claude-code"
}

If you cannot produce exactly this, output the JSON with the best you can and set "author" to "agent:claude-code" anyway.`;
  const template = agentCfg.prompt_template || '-p "{{prompt}}" --output-format json';
  const extraArgs = buildAgentArgv(template, scaffold);
  const shortTemplate = (agentCfg.prompt_template || '-p "{{prompt}}" --output-format json').slice(0, 80);
  ui.write(`  ${import_picocolors8.default.dim(`\u2192 ${agentCfg.command} ${shortTemplate}...`)}`);
  try {
    const result = spawnSync2([agentCfg.command, ...extraArgs], {
      stdout: "pipe",
      stderr: "pipe"
    });
    const stdout = result.stdout.toString().trim();
    const stderr = result.stderr.toString().trim();
    if (result.exitCode !== 0) {
      ui.write(`  ${import_picocolors8.default.yellow("\u26A0")} Configured agent (${agentCfg.command}) exited with code ${result.exitCode}. Falling back to defaults.`);
      if (stderr)
        ui.write(`    ${import_picocolors8.default.dim("stderr:")}
${stderr.slice(0, 800)}`);
      if (stdout)
        ui.write(`    ${import_picocolors8.default.dim("stdout:")}
${stdout.slice(0, 400)}`);
      return null;
    }
    let candidates = [];
    let jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        candidates.push(JSON.parse(jsonMatch[0]));
      } catch {}
    }
    const allMatches = stdout.match(/\{[\s\S]*?\}(?=\s*(?:\{|$))/g) || [];
    for (const m of allMatches) {
      try {
        const p = JSON.parse(m);
        candidates.push(p);
      } catch {}
    }
    let parsed = null;
    for (const c of candidates) {
      if (c && typeof c === "object" && (c.title || c.rationale)) {
        parsed = c;
        break;
      }
    }
    if (!parsed) {
      for (const c of candidates) {
        if (c && typeof c === "object" && c.result) {
          let inner = c.result;
          if (typeof inner === "string") {
            try {
              inner = JSON.parse(inner);
            } catch {}
          }
          if (inner && typeof inner === "object" && (inner.title || inner.rationale)) {
            parsed = inner;
            break;
          }
        }
      }
    }
    if (!parsed) {
      parsed = candidates[0] || null;
    }
    if (!parsed || typeof parsed !== "object") {
      ui.write(`  ${import_picocolors8.default.yellow("\u26A0")} Agent produced output but no usable JSON was found. Falling back.`);
      ui.write(`    ${import_picocolors8.default.dim("stdout (first 700 chars):")}
${stdout.slice(0, 700)}`);
      if (stderr)
        ui.write(`    ${import_picocolors8.default.dim("stderr:")}
${stderr.slice(0, 500)}`);
      return null;
    }
    if (!parsed.title && !parsed.rationale) {
      ui.write(`  ${import_picocolors8.default.yellow("\u26A0")} Agent returned JSON without expected fields (title/rationale). Using defaults.`);
      ui.write(`    ${import_picocolors8.default.dim("parsed keys:")} ${Object.keys(parsed).join(", ")}`);
      ui.write(`    ${import_picocolors8.default.dim("stdout (truncated):")}
${stdout.slice(0, 600)}`);
      return null;
    }
    return parsed;
  } catch (e) {
    ui.write(`  ${import_picocolors8.default.yellow("\u26A0")} Failed to invoke configured agent (${agentCfg.command}): ${e.message}. Using defaults.`);
    return null;
  }
}
function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "untitled";
}
var import_picocolors8, add_default;
var init_add = __esm(() => {
  init_dist();
  init_out();
  init_journal_config();
  init_journal_validate();
  import_picocolors8 = __toESM(require_picocolors(), 1);
  add_default = defineCommand({
    meta: {
      name: "add",
      description: "Propose a new decision, note or principle (pushback & tags optional; agent can enrich on the fly)"
    },
    args: {
      title: {
        type: "positional",
        description: "Title of the decision or principle (the only argument needed for the low-friction path; other fields use defaults or the configured agent)",
        required: false
      },
      pushback: {
        type: "string",
        alias: "b",
        description: "Pushback intensity (1-10). Optional \u2014 defaults are applied (or supplied by --json / on-the-fly agent).",
        required: false
      },
      tags: {
        type: "string",
        alias: "t",
        description: "Comma-separated tags (e.g. naming,cli,architecture). Optional \u2014 defaults are applied (or supplied by --json / on-the-fly agent). Renamed from --scope for broader use with notes too.",
        required: false
      },
      scope: {
        type: "string",
        description: "(deprecated) Use --tags instead",
        required: false
      },
      author: {
        type: "string",
        alias: "a",
        description: 'Author (default: "human", or "agent:grok", etc.)',
        default: "human"
      },
      status: {
        type: "string",
        description: "Status (active | superseded | retired)",
        default: "active"
      },
      rationale: {
        type: "string",
        alias: "r",
        description: "Rationale / explanation (one line). For rich/multi-line or long markdown content use --raw-markdown <file-or-> (or --json for full structured entries)."
      },
      rawMarkdown: {
        type: "string",
        description: 'Path to a raw markdown file (or "-" for stdin) to use as the entry body after the YAML block. Accepts --raw-markdown or --rawMarkdown. Title can be positional or extracted from the first "# Heading". Bypasses agent. Great for long notes and rich docs.'
      },
      project: {
        type: "string",
        alias: "p",
        description: "Project name (defaults to directory mapping)"
      },
      json: {
        type: "string",
        alias: "j",
        description: 'Full entry as JSON (title, pushback, tags, rationale, ...). Use "-" to read from stdin. Highest precedence; bypasses other input methods. (JSON may still use "scope" for legacy compat.)'
      },
      verbose: {
        type: "boolean",
        description: "Show full entry details (pushback, tags, author, file) in the success output",
        required: false
      }
    },
    async run({ args }) {
      const config = await readConfig();
      let project = args.project;
      if (!project) {
        project = resolveProjectName(config) ?? undefined;
      }
      if (project) {
        project = sanitizeProjectName(project);
      }
      if (!project) {
        ui.write(`${import_picocolors8.default.yellow("\u26A0")} No project mapping found.

` + `Run ${import_picocolors8.default.dim("dora init")} (or ${import_picocolors8.default.dim("doraval journal init")}) first, or pass ${import_picocolors8.default.dim("--project <name>")}.`);
        process.exit(1);
      }
      let title;
      let pushback;
      let tags = [];
      let author = String(args.author || "human");
      let status = args.status || "active";
      let rationale;
      let date = new Date().toISOString().split("T")[0];
      const jsonInput = args.json;
      if (jsonInput) {
        let rawJson = jsonInput;
        if (jsonInput === "-" || jsonInput === "") {
          const stdinText = await new Response(Bun.stdin.stream()).text();
          rawJson = stdinText.trim();
        }
        try {
          const parsed = JSON.parse(rawJson);
          title = parsed.title ? String(parsed.title).trim() : undefined;
          pushback = typeof parsed.pushback === "number" ? parsed.pushback : parsed.pushback ? Number(parsed.pushback) : undefined;
          if (Array.isArray(parsed.tags)) {
            tags = parsed.tags.map((s) => String(s).trim()).filter(Boolean);
          } else if (typeof parsed.tags === "string") {
            tags = parsed.tags.split(",").map((s) => s.trim()).filter(Boolean);
          } else if (Array.isArray(parsed.scope)) {
            tags = parsed.scope.map((s) => String(s).trim()).filter(Boolean);
          } else if (typeof parsed.scope === "string") {
            tags = parsed.scope.split(",").map((s) => s.trim()).filter(Boolean);
          }
          rationale = parsed.rationale ? String(parsed.rationale).trim() : undefined;
          if (parsed.author)
            author = String(parsed.author);
          if (parsed.status)
            status = parsed.status;
          if (parsed.date)
            date = String(parsed.date);
        } catch (e) {
          ui.write(`${import_picocolors8.default.red("\u2717")} Failed to parse --json input: ${e.message}`);
          process.exit(1);
        }
      }
      let rawBody;
      const rawMdArg = args.rawMarkdown;
      if (rawMdArg && !jsonInput) {
        if (rawMdArg === "-" || rawMdArg === "") {
          rawBody = (await new Response(Bun.stdin.stream()).text()).trim();
        } else if (existsSync6(rawMdArg)) {
          rawBody = (await Bun.file(rawMdArg).text()).trim();
        } else {
          rawBody = rawMdArg.trim();
        }
      }
      if (!title) {
        title = args.title?.trim() || "";
      }
      if (!title && rawBody) {
        const headingMatch = rawBody.match(/^#+\s+(.+?)(?:\r?\n|$)/m);
        if (headingMatch) {
          title = (headingMatch[1] ?? "").trim();
          rawBody = rawBody.replace(/^#+\s+(.+?)(?:\r?\n|$)/m, "").trimStart();
        } else {
          ui.write(`${import_picocolors8.default.red("\u2717")} --raw-markdown provided without a TITLE and without a leading '# Heading' in the markdown.`);
          process.exit(1);
        }
      }
      if (!title) {
        title = "Untitled decision";
      }
      if (pushback === undefined) {
        const cliPb = args.pushback;
        pushback = cliPb !== undefined ? Number(cliPb) : 5;
      }
      if (tags.length === 0) {
        let cliTagsStr = args.tags || args.scope;
        if (cliTagsStr != null) {
          if (typeof cliTagsStr !== "string")
            cliTagsStr = String(cliTagsStr);
          tags = cliTagsStr.split(",").map((s) => s.trim()).filter(Boolean);
        }
      }
      if (rawBody !== undefined && !args.pushback && !args.tags && !args.scope) {
        if (tags.length === 0)
          tags = ["notes"];
        if (pushback === 5)
          pushback = 1;
      }
      if (rawBody !== undefined) {
        rationale = rawBody;
      } else if (!rationale) {
        const cliRat = args.rationale?.trim();
        rationale = cliRat || title;
      }
      const cameFromExplicitJson = !!jsonInput;
      const isThinInput = !args.pushback && !args.tags && !args.scope && !args.rationale && !rawMdArg;
      let agentCfg = null;
      let attemptedAgent = false;
      if (!cameFromExplicitJson && isThinInput) {
        const fullConfigForAgent = await readConfig();
        agentCfg = fullConfigForAgent?.agent;
        if (agentCfg) {
          attemptedAgent = true;
          ui.write(`  ${import_picocolors8.default.dim(import_picocolors8.default.gray("(querying your configured coding agent...)"))}`);
          const agentResult = await invokeConfiguredAgentForEntry(title, agentCfg);
          if (agentResult) {
            if (agentResult.title)
              title = String(agentResult.title).trim();
            if (typeof agentResult.pushback === "number")
              pushback = agentResult.pushback;
            if (Array.isArray(agentResult.tags)) {
              tags = agentResult.tags.map((s) => String(s).trim()).filter(Boolean);
            } else if (Array.isArray(agentResult.scope)) {
              tags = agentResult.scope.map((s) => String(s).trim()).filter(Boolean);
            }
            if (agentResult.rationale)
              rationale = String(agentResult.rationale).trim();
            if (agentResult.author)
              author = String(agentResult.author);
            if (agentResult.status)
              status = agentResult.status;
            if (agentResult.date)
              date = String(agentResult.date);
          }
        }
      }
      const entry = {
        title,
        pushback,
        tags,
        author,
        date,
        status
      };
      const validation = validateEntry(entry);
      if (!validation.valid) {
        ui.write(`${import_picocolors8.default.red("\u2717")} Invalid entry:
`);
        for (const err of validation.errors) {
          ui.write(`  ${import_picocolors8.default.red("\u2022")} ${err}`);
        }
        process.exit(1);
      }
      for (const warn of validation.warnings) {
        if ((warn.includes("not supplied") || warn.includes("empty")) && attemptedAgent) {} else if (warn.includes("not supplied") || warn.includes("empty")) {
          ui.write(`${import_picocolors8.default.dim("\xB7")} ${warn}`);
        } else {
          ui.write(`${import_picocolors8.default.yellow("\u26A0")} ${warn}`);
        }
      }
      if (!rationale) {
        rationale = title;
      }
      const content = `## ${title}

\`\`\`yaml
pushback: ${pushback}
tags: [${tags.join(", ")}]
author: ${author}
date: ${date}
status: ${status}
\`\`\`

${rationale}
`;
      ensureDoravalDirs();
      const pendingDir = getPendingProjectDir(project);
      if (!existsSync6(pendingDir)) {
        await Bun.write(join5(pendingDir, ".gitkeep"), "");
      }
      const slug = slugify(title);
      const filename = `${date}-${slug}.md`;
      const filePath = join5(pendingDir, filename);
      await Bun.write(filePath, content);
      ui.write(`
  ${import_picocolors8.default.green("\u2713")} ${import_picocolors8.default.bold(import_picocolors8.default.white(title))}`);
      ui.write(`  Project: ${import_picocolors8.default.white(project)}  \xB7 run ${import_picocolors8.default.dim(import_picocolors8.default.gray("dora journal sync"))} to publish
`);
      if (args.verbose) {
        const authorDisplay = author.startsWith("agent:") ? import_picocolors8.default.cyan(author) : author;
        ui.write(`  Pushback: ${import_picocolors8.default.white(String(pushback))}`);
        ui.write(`  Tags:     ${import_picocolors8.default.gray(tags.join(", ") || import_picocolors8.default.dim("(none)"))}`);
        ui.write(`  Author:   ${authorDisplay}`);
        ui.write(`  File:     ${import_picocolors8.default.dim(import_picocolors8.default.gray(filePath))}
`);
      }
      if (isThinInput && !author.startsWith("agent:")) {
        if (attemptedAgent) {
          ui.write(`  ${import_picocolors8.default.dim(import_picocolors8.default.gray("Note: agent was called but returned no usable enrichment. Edit the pending file or re-run dora init."))}
`);
        } else {
          ui.write(`  ${import_picocolors8.default.dim(import_picocolors8.default.gray("Tip: run dora init to configure an agent for auto-enrichment."))}
`);
        }
      }
      process.exit(0);
    }
  });
});

// src/cli/commands/journal/sync.ts
var exports_sync = {};
__export(exports_sync, {
  default: () => sync_default
});
import { readdirSync as readdirSync2, existsSync as existsSync7 } from "fs";
import { join as join6 } from "path";
var {spawnSync: spawnSync3 } = globalThis.Bun;
function updateGitHubFile(repo, path, content, message, sha) {
  const payload = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    ...sha ? { sha } : {}
  };
  const args = [
    "gh",
    "api",
    "--method",
    "PUT",
    "-H",
    "Accept: application/vnd.github+json",
    `repos/${repo}/contents/${path}`,
    "-f",
    `message=${payload.message}`,
    "-f",
    `content=${payload.content}`
  ];
  if (sha) {
    args.push("-f", `sha=${sha}`);
  }
  const result = spawnSync3(args, {
    stdout: "pipe",
    stderr: "pipe"
  });
  if (result.exitCode !== 0) {
    ui.write(import_picocolors9.default.red(`Failed to update ${path} on ${repo}:`));
    ui.write(result.stderr.toString());
    process.exit(1);
  }
}
var import_picocolors9, sync_default;
var init_sync = __esm(() => {
  init_dist();
  init_out();
  init_journal_config();
  init_journal_remote();
  import_picocolors9 = __toESM(require_picocolors(), 1);
  sync_default = defineCommand({
    meta: {
      name: "sync",
      description: "Push pending journal entries to your remote GitHub journal repo"
    },
    args: {
      project: {
        type: "string",
        alias: "p",
        description: "Project to sync (defaults to current directory mapping)"
      },
      message: {
        type: "string",
        alias: "m",
        description: "Custom commit message for the sync"
      },
      verbose: {
        type: "boolean",
        alias: "v",
        description: "Show detailed diagnostics",
        default: false
      }
    },
    async run({ args }) {
      const config = await readConfig();
      let project = args.project;
      if (!project) {
        project = resolveProjectName(config) ?? undefined;
      }
      if (project) {
        project = sanitizeProjectName(project);
      }
      if (!project) {
        ui.write(`${import_picocolors9.default.yellow("\u26A0")} No project mapping found.

` + `Run ${import_picocolors9.default.dim("dora init")} (or ${import_picocolors9.default.dim("doraval journal init")}) first, or pass ${import_picocolors9.default.dim("--project <name>")}.`);
        process.exit(1);
      }
      if (!config?.journal.repo) {
        ui.write(`${import_picocolors9.default.red("\u2717")} No journal repo configured. Run ${import_picocolors9.default.dim("dora init")} (or ${import_picocolors9.default.dim("doraval journal init")}) first.`);
        process.exit(1);
      }
      const ghCheck = ensureGhCli();
      if (!ghCheck.ok) {
        ui.write(`  ${import_picocolors9.default.red("\u2717")} ${import_picocolors9.default.white("The GitHub CLI (")}${import_picocolors9.default.bold("gh")}${import_picocolors9.default.white(") is not installed.")}
`);
        ui.write(`  doraval uses ${import_picocolors9.default.bold("gh")} to fetch and sync journal files with GitHub.
`);
        ui.write(`  Install it:
`);
        ui.write(`    macOS:   ${import_picocolors9.default.dim("brew install gh")}`);
        ui.write(`    Linux:   ${import_picocolors9.default.dim("https://github.com/cli/cli/blob/trunk/docs/install_linux.md")}`);
        ui.write(`    Windows: ${import_picocolors9.default.dim("winget install --id GitHub.cli")}
`);
        ui.write(`  Then authenticate: ${import_picocolors9.default.dim("gh auth login")}
`);
        process.exit(1);
      }
      const journalRepo = config.journal.repo;
      const pendingDir = getPendingProjectDir(project);
      ui.write(`
  ${import_picocolors9.default.bold(import_picocolors9.default.white("dora journal sync"))} \u2014 ${import_picocolors9.default.white(project)}
`);
      ui.write(`  Journal repo: ${import_picocolors9.default.dim(import_picocolors9.default.gray(journalRepo))}`);
      ensureDoravalDirs();
      const journalsDir = getJournalsDir();
      const remoteProjectPath = `projects/${project}.md`;
      const localProjectPath = join6(journalsDir, `${project}.md`);
      ui.write(`  ${import_picocolors9.default.dim(import_picocolors9.default.gray("Refreshing local cache from remote..."))}`);
      const refreshGlobalRes = await refreshLocalJournalFile(journalRepo, "global.md", join6(journalsDir, "global.md"));
      if (!refreshGlobalRes.ok) {
        if (!refreshGlobalRes.isNotFound) {
          ui.write(import_picocolors9.default.red(`Failed to fetch global.md from ${journalRepo}:`));
          ui.write(refreshGlobalRes.error);
          process.exit(1);
        }
      }
      const gotGlobal = refreshGlobalRes.ok && refreshGlobalRes.value;
      if (gotGlobal) {
        ui.write(`  ${import_picocolors9.default.dim(import_picocolors9.default.gray("\u2713 global.md"))}`);
      }
      const refreshProjectCacheRes = await refreshLocalJournalFile(journalRepo, remoteProjectPath, localProjectPath);
      if (!refreshProjectCacheRes.ok) {
        if (!refreshProjectCacheRes.isNotFound) {
          ui.write(import_picocolors9.default.red(`Failed to fetch ${remoteProjectPath} from ${journalRepo}:`));
          ui.write(refreshProjectCacheRes.error);
          process.exit(1);
        }
      }
      const gotProjectCache = refreshProjectCacheRes.ok && refreshProjectCacheRes.value;
      if (gotProjectCache) {
        ui.write(`  ${import_picocolors9.default.dim(import_picocolors9.default.gray(`\u2713 ${remoteProjectPath}`))}`);
      }
      const pendingFiles = existsSync7(pendingDir) ? readdirSync2(pendingDir).filter((f) => f.endsWith(".md") && f !== ".gitkeep").sort() : [];
      if (pendingFiles.length === 0) {
        ui.write(`
  ${import_picocolors9.default.yellow("\u26A0")} No pending entries. Local cache is now up to date.
`);
        process.exit(0);
      }
      ui.write(`  Found ${pendingFiles.length} pending entr${pendingFiles.length === 1 ? "y" : "ies"}
`);
      const remotePath = `projects/${project}.md`;
      const metaRes = getRemoteJournalFileMeta(journalRepo, remotePath);
      let existingContent = "";
      let currentSha;
      let currentFile = null;
      if (!metaRes.ok) {
        if (!metaRes.isNotFound) {
          ui.write(import_picocolors9.default.red(`Failed to fetch ${remotePath} from ${journalRepo}:`));
          ui.write(metaRes.error);
          process.exit(1);
        }
      } else {
        currentFile = metaRes.value;
      }
      if (currentFile) {
        existingContent = Buffer.from(currentFile.content, "base64").toString("utf8");
        currentSha = currentFile.sha;
        if (args.verbose)
          ui.write(`  ${import_picocolors9.default.dim(import_picocolors9.default.gray("Found existing remote file (sha: " + (currentSha?.slice(0, 7) ?? "") + "...)"))}`);
      } else {
        if (args.verbose)
          ui.write(`  ${import_picocolors9.default.dim(import_picocolors9.default.gray("No existing file on remote \u2014 will create it"))}`);
      }
      let newEntries = "";
      for (const file of pendingFiles) {
        const fullPath = join6(pendingDir, file);
        const entryContent = await Bun.file(fullPath).text();
        newEntries += `
` + entryContent.trim() + `
`;
      }
      let newContent;
      if (existingContent.trim().length === 0) {
        newContent = `# ${project} Journal

` + `Project-specific decisions for **${project}**.

` + newEntries.trim();
      } else {
        newContent = existingContent.trimEnd() + `
` + newEntries;
      }
      const commitMessage = args.message || `journal: add ${pendingFiles.length} entr${pendingFiles.length === 1 ? "y" : "ies"} for ${project}`;
      if (args.verbose)
        ui.write(`
  ${import_picocolors9.default.dim(import_picocolors9.default.gray("Pushing to remote..."))}`);
      try {
        updateGitHubFile(journalRepo, remotePath, newContent, commitMessage, currentSha);
        ui.write(`  ${import_picocolors9.default.green("\u2713")} ${import_picocolors9.default.white("Successfully pushed to")} ${import_picocolors9.default.white(remotePath)}`);
      } catch (err) {
        ui.write(`${import_picocolors9.default.red("\u2717")} ${import_picocolors9.default.white("Failed to push to GitHub.")}`);
        process.exit(1);
      }
      for (const file of pendingFiles) {
        const fullPath = join6(pendingDir, file);
        try {
          await Bun.file(fullPath).unlink();
        } catch {}
      }
      ui.write(`  ${import_picocolors9.default.green("\u2713")} ${import_picocolors9.default.white("Cleared local pending entries")}`);
      try {
        const refreshRes = await refreshLocalJournalFile(journalRepo, remotePath, localProjectPath);
        if (!refreshRes.ok) {
          if (!refreshRes.isNotFound) {
            ui.write(`  ${import_picocolors9.default.yellow("\u26A0")} Could not re-fetch updated file (you can run sync again later)`);
          }
        } else if (refreshRes.value) {
          if (args.verbose)
            ui.write(`  ${import_picocolors9.default.green("\u2713")} ${import_picocolors9.default.white("Re-fetched")} ${import_picocolors9.default.white(project)}.md ${import_picocolors9.default.white("into local cache")}`);
        }
      } catch {
        ui.write(`  ${import_picocolors9.default.yellow("\u26A0")} Could not re-fetch updated file (you can run sync again later)`);
      }
      ui.write(`
  ${import_picocolors9.default.green("Done!")} ${import_picocolors9.default.white(pendingFiles.length + " entr" + (pendingFiles.length === 1 ? "y" : "ies") + " published.")}
`);
      process.exit(0);
    }
  });
});

// src/cli/commands/claude/context.ts
import { existsSync as existsSync8, readdirSync as readdirSync3 } from "fs";
import { join as join7 } from "path";
function detectContext(cwd = process.cwd()) {
  const hasClaudeDir = existsSync8(join7(cwd, ".claude"));
  const hasPluginManifest = existsSync8(join7(cwd, ".claude-plugin", "plugin.json"));
  let looseSkillFiles = [];
  try {
    const files = readdirSync3(cwd);
    looseSkillFiles = files.filter((f) => {
      if (!f.endsWith(".md") || f.startsWith("."))
        return false;
      const lower = f.toLowerCase();
      if (lower === "readme.md" || lower === "changelog.md" || lower === "license.md" || lower.includes("contributing"))
        return false;
      return lower.includes("skill") || lower === "skill.md";
    });
  } catch {}
  const isEmpty = !hasClaudeDir && !hasPluginManifest && looseSkillFiles.length === 0;
  return {
    cwd,
    hasClaudeDir,
    hasPluginManifest,
    looseSkillFiles,
    isEmpty
  };
}
var init_context = () => {};

// src/cli/commands/claude/new.ts
var exports_new = {};
__export(exports_new, {
  scaffold: () => scaffold,
  default: () => new_default,
  decidePath: () => decidePath
});
import { join as join8, basename as basename2 } from "path";
import { mkdirSync as mkdirSync2, writeFileSync, existsSync as existsSync9 } from "fs";
function decidePath(ctx, intent, providedName) {
  const rawName = providedName || "";
  let decisionPath = "standalone";
  let targetDir = ctx.cwd;
  let shouldCreateDir = false;
  let migrateExisting = false;
  const useCurrentDirAsRoot = rawName === "." || rawName === basename2(ctx.cwd) || !rawName;
  if (intent === "distribute" || intent === "self-later" && ctx.looseSkillFiles.length > 0 && !ctx.hasClaudeDir) {
    decisionPath = "plugin";
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join8(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
    migrateExisting = ctx.looseSkillFiles.length > 0;
  } else if (intent === "self-later" && !ctx.hasClaudeDir) {
    decisionPath = "plugin";
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join8(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
  } else if (decisionPath === "standalone") {
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join8(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
  }
  return { path: decisionPath, targetDir, shouldCreateDir, migrateExisting };
}
function scaffold(decision, ctx, migrateContent) {
  const { targetDir, path, shouldCreateDir } = decision;
  if (existsSync9(targetDir) && shouldCreateDir) {
    ui.fail("Target already exists");
    process.exit(1);
  }
  if (shouldCreateDir) {
    mkdirSync2(targetDir, { recursive: true });
  }
  if (path === "plugin") {
    const pluginName = basename2(targetDir);
    const pluginJson = {
      name: pluginName,
      description: "Scaffolded by doraval claude new",
      version: "0.1.0"
    };
    mkdirSync2(join8(targetDir, ".claude-plugin"), { recursive: true });
    writeFileSync(join8(targetDir, ".claude-plugin", "plugin.json"), JSON.stringify(pluginJson, null, 2));
    const marketplaceJson = {
      name: pluginName,
      version: "0.1.0",
      description: "Scaffolded by doraval claude new",
      author: { name: "" },
      homepage: "",
      repository: "",
      license: "MIT",
      keywords: ["claude-code", "skills", "plugin"]
    };
    writeFileSync(join8(targetDir, "marketplace.json"), JSON.stringify(marketplaceJson, null, 2));
    const demoSkillName = "doraval";
    mkdirSync2(join8(targetDir, "skills", demoSkillName), { recursive: true });
    let skillContent;
    if (migrateContent) {
      skillContent = migrateContent;
    } else {
      skillContent = `---
name: ${demoSkillName}
description: Use doraval to validate, measure drift, and judge skills and plugins. Use when authoring or reviewing context engineering artifacts for AI coding agents.
---

# Use Doraval

Doraval is the context engineering toolkit.

When you need to check a skill or plugin:

- Validate the current directory: \`doraval validate .\`
- Validate a specific plugin: \`doraval validate . --for claude:plugin\`
- Validate one skill: \`doraval skill validate ./skills/${demoSkillName}/\`
- Check for rubric drift: \`doraval skill drift ./skills/${demoSkillName}/\`
- Get an AI quality judgment: \`doraval skill judge ./skills/${demoSkillName}/\`

Always run \`doraval validate\` before sharing or publishing a plugin. This skill demonstrates a complete, self-referential example of using doraval inside a generated plugin.`;
    }
    writeFileSync(join8(targetDir, "skills", demoSkillName, "SKILL.md"), skillContent);
    const readmePath = join8(targetDir, "README.md");
    if (!existsSync9(readmePath)) {
      writeFileSync(readmePath, "# " + pluginName + `

Claude Code plugin scaffolded by doraval.`);
    }
  } else {
    mkdirSync2(join8(targetDir, ".claude", "skills", "my-skill"), { recursive: true });
    const skillBody = migrateContent || `# My Skill

Basic starter.`;
    writeFileSync(join8(targetDir, ".claude", "skills", "my-skill", "SKILL.md"), `---
name: my-skill
description: Starter
---

${skillBody}`);
  }
}
var import_picocolors10, new_default;
var init_new = __esm(() => {
  init_dist();
  init_out();
  init_context();
  init_prompt();
  import_picocolors10 = __toESM(require_picocolors(), 1);
  new_default = defineCommand({
    meta: {
      name: "new",
      description: "Create a new skill or plugin following Claude Code packaging rules"
    },
    args: {
      name: {
        type: "positional",
        description: "Optional name for the skill or plugin",
        required: false
      },
      yes: {
        type: "boolean",
        description: "Skip interactive prompts (use defaults and flags)",
        default: false
      },
      intent: {
        type: "string",
        description: 'Intent: "self" | "self-later" | "distribute"',
        required: false
      }
    },
    run({ args }) {
      ui.heading("doraval claude new \u2014 Context-aware scaffolding");
      const ctx = detectContext();
      let intent = args.intent || "self-later";
      if (!args.yes) {
        const ans = prompt("  Intent (self | self-later | distribute)", intent);
        intent = ans || intent;
      }
      const decision = decidePath(ctx, intent, args.name);
      ui.info(`  Decision: path=${decision.path}, target=${decision.targetDir}`);
      let migrateContent;
      if (decision.migrateExisting && !args.yes) {
        migrateContent = "Content from your existing SKILL.md (user-confirmed).";
      }
      scaffold(decision, ctx, migrateContent);
      ui.write(`
  ${import_picocolors10.default.green("\u2713")} Created ${decision.path} at ${import_picocolors10.default.bold(decision.targetDir)}`);
      const cmdName = decision.path === "plugin" ? `/${basename2(decision.targetDir)}:doraval` : "/my-skill";
      ui.info(`  Command: ${cmdName}`);
      if (decision.path === "plugin") {
        ui.info(`  Claude: .claude-plugin/plugin.json`);
        ui.info(`  Marketplace: marketplace.json (unified / cross-provider listings)`);
      }
      ui.info(`  Test: claude --plugin-dir ${decision.targetDir}   (or use normally for standalone)`);
      ui.info(`  Validate: doraval validate ${decision.targetDir}`);
      if (decision.path === "plugin" && decision.migrateExisting) {
        ui.info("  (Existing content migrated where confirmed.)");
      }
      process.exit(0);
    }
  });
});

// src/cli/commands/bump.ts
var exports_bump = {};
__export(exports_bump, {
  default: () => bump_default
});
import { resolve as resolve3, join as join9, dirname, relative } from "path";
import { existsSync as existsSync10, readFileSync, writeFileSync as writeFileSync2, readdirSync as readdirSync4, statSync } from "fs";
function bumpVersion(current, type) {
  if (/^\d+\.\d+\.\d+$/.test(type))
    return type;
  const curr = current || "0.0.0";
  const parts = curr.split(".").map((n) => parseInt(n, 10) || 0);
  const [major = 0, minor = 0, patch = 0] = parts;
  switch (type) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "major":
      return `${major + 1}.0.0`;
    default:
      throw new Error(`Invalid bump type "${type}". Use patch, minor, major, or an exact version like 1.2.3`);
  }
}
function readJson(p) {
  try {
    const content = readFileSync(p, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
function writeJson(p, data) {
  writeFileSync2(p, JSON.stringify(data, null, 2) + `
`, "utf8");
}
function getVersion(obj) {
  if (!obj || typeof obj !== "object")
    return;
  if (typeof obj.version === "string")
    return obj.version;
  if (obj.metadata && typeof obj.metadata.version === "string")
    return obj.metadata.version;
  return;
}
function setVersion(obj, newVersion) {
  if (!obj || typeof obj !== "object")
    return false;
  if (typeof obj.version === "string") {
    obj.version = newVersion;
    return true;
  }
  if (obj.metadata && typeof obj.metadata.version === "string") {
    obj.metadata.version = newVersion;
    return true;
  }
  return false;
}
function walkForTargets(dir, maxDepth = 6, currentDepth = 0) {
  const results = [];
  if (currentDepth > maxDepth)
    return results;
  let entries;
  try {
    entries = readdirSync4(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join9(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      const sub = walkForTargets(full, maxDepth, currentDepth + 1);
      results.push(...sub);
    } else if (st.isFile()) {
      if (entry === "plugin.json") {
        const parentDir = dirname(full);
        const parentName = parentDir.split(/[/\\]/).pop();
        if (parentName === ".claude-plugin" || parentName === ".codex-plugin" || parentName === ".cursor-plugin") {
          results.push({
            file: full,
            kind: "plugin",
            label: `plugin manifest (${parentName.replace(".", "")})`
          });
        }
      } else if (entry === "marketplace.json") {
        const json = readJson(full);
        if (json && getVersion(json)) {
          results.push({
            file: full,
            kind: "marketplace",
            label: "marketplace.json"
          });
        }
      }
    }
  }
  return results;
}
var import_picocolors11, bump_default;
var init_bump = __esm(() => {
  init_dist();
  init_out();
  import_picocolors11 = __toESM(require_picocolors(), 1);
  bump_default = defineCommand({
    meta: {
      name: "bump",
      description: "Bump semver versions in plugin.json (manifests) and marketplace.json files (supports Claude, Codex, Cursor)"
    },
    args: {
      type: {
        type: "positional",
        description: "patch | minor | major | x.y.z (exact version)",
        required: false
      },
      path: {
        type: "positional",
        description: "Directory to scan from (defaults to current dir). Supports single plugin or marketplace root with many plugins/",
        required: false
      },
      only: {
        type: "string",
        description: 'Scope to "all" (default), "plugin" (only plugin.json manifests), or "marketplace" (only marketplace.json files that carry a top-level version)',
        default: "all"
      }
    },
    run({ args }) {
      let rawType = args.type || "patch";
      let targetPath = args.path || ".";
      const scopeInput = (args.only || "all").toLowerCase();
      const scope = scopeInput === "plugin" || scopeInput === "marketplace" ? scopeInput : "all";
      if (!["all", "plugin", "marketplace"].includes(scopeInput)) {
        ui.fail(`Invalid --only "${args.only}". Allowed: all, plugin, marketplace.`);
        process.exit(1);
      }
      const isKnownType = ["patch", "minor", "major"].includes(rawType) || /^\d+\.\d+\.\d+$/.test(rawType);
      const maybePath = resolve3(rawType);
      const looksLikeDir = existsSync10(maybePath) || rawType === "." || rawType.startsWith("./") || rawType.startsWith("../");
      if (!isKnownType && looksLikeDir) {
        targetPath = rawType;
        rawType = "patch";
      } else if (!isKnownType) {
        ui.fail(`Unknown bump type "${rawType}". Use patch | minor | major | 1.2.3`);
        process.exit(1);
      }
      const root = resolve3(targetPath);
      if (!existsSync10(root)) {
        ui.fail(`Path does not exist: ${root}`);
        process.exit(1);
      }
      ui.heading("doraval bump");
      ui.info(`  scanning: ${root}`);
      ui.info(`  scope: ${scope}   (use --only plugin or --only marketplace to narrow; Cursor metadata.version supported)`);
      const discovered = walkForTargets(root);
      let targets = discovered;
      if (scope === "plugin") {
        targets = discovered.filter((t) => t.kind === "plugin");
      } else if (scope === "marketplace") {
        targets = discovered.filter((t) => t.kind === "marketplace");
      }
      if (targets.length === 0) {
        ui.fail("No matching files found under the scope.");
        ui.info("");
        ui.info("  Looked for (recursively):");
        ui.info("    \u2022 **/.claude-plugin/plugin.json");
        ui.info("    \u2022 **/.codex-plugin/plugin.json");
        ui.info("    \u2022 **/.cursor-plugin/plugin.json (or marketplace.json)");
        ui.info("    \u2022 **/marketplace.json (top-level version or metadata.version for Cursor)");
        ui.info("");
        ui.info("  Tip: run from inside a plugin directory, or pass a path that contains plugins/.");
        ui.info("  Examples:");
        ui.info("    dora bump minor");
        ui.info("    dora bump minor ./my-claude-plugin");
        ui.info("    dora bump --only plugin .          # only the manifests");
        ui.info("    dora bump --only marketplace ./marketplaces-root   # includes Cursor metadata.version");
        process.exit(1);
      }
      ui.info(`  matched ${targets.length} file(s)`);
      let bumpedCount = 0;
      for (const t of targets) {
        const json = readJson(t.file);
        if (!json || typeof json !== "object") {
          ui.warnItem(`skipped (invalid JSON): ${relative(root, t.file)}`);
          continue;
        }
        const current = getVersion(json);
        let next;
        try {
          next = bumpVersion(current, rawType);
        } catch (err) {
          ui.fail(err.message || String(err));
          process.exit(1);
        }
        const relPath = relative(root, t.file);
        if (current === next) {
          ui.dim(`  \u2022 ${t.label}  ${current || "(no version)"}  (no change)  [${relPath}]`);
          continue;
        }
        const didUpdate = setVersion(json, next);
        if (!didUpdate) {
          ui.warnItem(`skipped (could not locate version field to update): ${relPath}`);
          continue;
        }
        writeJson(t.file, json);
        ui.success(`${t.label}: ${import_picocolors11.default.dim(current || "(none)")} \u2192 ${import_picocolors11.default.green(next)}`);
        ui.info(`    ${relPath}`);
        bumpedCount++;
      }
      ui.blank();
      if (bumpedCount === 0) {
        ui.info("All matched files were already at the target version.");
      } else {
        ui.info(`Done. Bumped ${bumpedCount} file(s).`);
        ui.dim("  Next: doraval validate " + (targetPath === "." ? "." : targetPath));
      }
      process.exit(0);
    }
  });
});

// src/cli/commands/codex/context.ts
import { existsSync as existsSync11, readdirSync as readdirSync5 } from "fs";
import { join as join10 } from "path";
function detectContext2(cwd = process.cwd()) {
  const hasCodexDir = existsSync11(join10(cwd, ".codex"));
  const hasPluginManifest = existsSync11(join10(cwd, ".codex-plugin", "plugin.json"));
  const hasMarketplace = existsSync11(join10(cwd, ".agents", "plugins", "marketplace.json")) || existsSync11(join10(cwd, ".codex-plugin", "marketplace.json"));
  let looseSkillFiles = [];
  try {
    const files = readdirSync5(cwd);
    looseSkillFiles = files.filter((f) => {
      if (!f.endsWith(".md") || f.startsWith("."))
        return false;
      const lower = f.toLowerCase();
      if (lower === "readme.md" || lower === "changelog.md" || lower === "license.md" || lower.includes("contributing"))
        return false;
      return lower.includes("skill") || lower === "skill.md";
    });
  } catch {}
  const isEmpty = !hasPluginManifest && looseSkillFiles.length === 0;
  return {
    cwd,
    hasCodexDir,
    hasPluginManifest,
    hasMarketplace,
    looseSkillFiles,
    isEmpty
  };
}
var init_context2 = () => {};

// src/cli/commands/codex/new.ts
var exports_new2 = {};
__export(exports_new2, {
  scaffold: () => scaffold2,
  default: () => new_default2,
  decidePath: () => decidePath2
});
import { join as join11, basename as basename3 } from "path";
import { mkdirSync as mkdirSync3, writeFileSync as writeFileSync3, existsSync as existsSync12 } from "fs";
function decidePath2(ctx, intent, providedName) {
  const rawName = providedName || "";
  let decisionPath = "standalone";
  let targetDir = ctx.cwd;
  let shouldCreateDir = false;
  let migrateExisting = false;
  const useCurrentDirAsRoot = rawName === "." || rawName === basename3(ctx.cwd) || !rawName;
  if (intent === "distribute" || intent === "self-later" && ctx.looseSkillFiles.length > 0 && !ctx.hasPluginManifest) {
    decisionPath = "plugin";
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join11(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
    migrateExisting = ctx.looseSkillFiles.length > 0;
  } else if (intent === "self-later" && !ctx.hasPluginManifest) {
    decisionPath = "plugin";
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join11(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
  } else if (decisionPath === "standalone") {
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join11(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
  }
  return { path: decisionPath, targetDir, shouldCreateDir, migrateExisting };
}
function scaffold2(decision, ctx, migrateContent) {
  const { targetDir, path, shouldCreateDir } = decision;
  if (existsSync12(targetDir) && shouldCreateDir) {
    ui.fail("Target already exists");
    process.exit(1);
  }
  if (shouldCreateDir) {
    mkdirSync3(targetDir, { recursive: true });
  }
  if (path === "plugin") {
    const pluginName = basename3(targetDir);
    const pluginJson = {
      name: pluginName,
      version: "0.1.0",
      description: "Scaffolded by doraval codex new",
      skills: "./skills/",
      interface: {
        displayName: pluginName,
        shortDescription: "Scaffolded starter plugin",
        category: "Productivity"
      }
    };
    mkdirSync3(join11(targetDir, ".codex-plugin"), { recursive: true });
    writeFileSync3(join11(targetDir, ".codex-plugin", "plugin.json"), JSON.stringify(pluginJson, null, 2));
    mkdirSync3(join11(targetDir, ".agents", "plugins"), { recursive: true });
    const marketplaceJson = {
      name: "local",
      interface: {
        displayName: "Local (doraval scaffold)"
      },
      plugins: [
        {
          name: pluginName,
          source: {
            source: "local",
            path: "../.."
          },
          policy: {
            installation: "AVAILABLE",
            authentication: "ON_INSTALL"
          },
          category: "Productivity"
        }
      ]
    };
    writeFileSync3(join11(targetDir, ".agents", "plugins", "marketplace.json"), JSON.stringify(marketplaceJson, null, 2));
    const demoSkillName = "doraval";
    mkdirSync3(join11(targetDir, "skills", demoSkillName), { recursive: true });
    let skillContent;
    if (migrateContent) {
      skillContent = migrateContent;
    } else {
      skillContent = `---
name: ${demoSkillName}
description: Use doraval to validate, measure drift, and judge skills and plugins. Use when authoring or reviewing context engineering artifacts for AI coding agents (works for Codex too).
---

# Use Doraval (Codex edition)

Doraval is the context engineering toolkit.

When you need to check a skill or Codex plugin:

- Validate the current directory: \`doraval validate .\`
- Validate one skill: \`doraval skill validate ./skills/${demoSkillName}/\`
- Check for rubric drift: \`doraval skill drift ./skills/${demoSkillName}/\`
- Get an AI quality judgment: \`doraval skill judge ./skills/${demoSkillName}/\`

Always run \`doraval validate\` before sharing or publishing a plugin.

This skill demonstrates a complete, self-referential example of using doraval inside a generated Codex plugin.

To test in Codex:
1. Make sure this plugin is listed in a marketplace (we created .agents/plugins/marketplace.json for you).
2. Restart Codex.
3. Open the plugin directory, select your local marketplace, and enable the plugin.
4. Invoke the demo with /${pluginName}:doraval`;
    }
    writeFileSync3(join11(targetDir, "skills", demoSkillName, "SKILL.md"), skillContent);
    const readmePath = join11(targetDir, "README.md");
    if (!existsSync12(readmePath)) {
      writeFileSync3(readmePath, "# " + pluginName + `

Codex plugin scaffolded by doraval.`);
    }
  } else {
    mkdirSync3(join11(targetDir, "skills", "doraval"), { recursive: true });
    const skillBody = migrateContent || `# My Skill

Basic starter for Codex.`;
    writeFileSync3(join11(targetDir, "skills", "doraval", "SKILL.md"), `---
name: doraval
description: Starter (local skill)
---

${skillBody}`);
  }
}
var import_picocolors12, new_default2;
var init_new2 = __esm(() => {
  init_dist();
  init_out();
  init_context2();
  init_prompt();
  import_picocolors12 = __toESM(require_picocolors(), 1);
  new_default2 = defineCommand({
    meta: {
      name: "new",
      description: "Create a new skill or plugin following Codex packaging rules"
    },
    args: {
      name: {
        type: "positional",
        description: "Optional name for the skill or plugin",
        required: false
      },
      yes: {
        type: "boolean",
        description: "Skip interactive prompts (use defaults and flags)",
        default: false
      },
      intent: {
        type: "string",
        description: 'Intent: "self" | "self-later" | "distribute"',
        required: false
      }
    },
    run({ args }) {
      ui.heading("doraval codex new \u2014 Context-aware scaffolding");
      const ctx = detectContext2();
      let intent = args.intent || "self-later";
      if (!args.yes) {
        const ans = prompt("  Intent (self | self-later | distribute)", intent);
        intent = ans || intent;
      }
      const decision = decidePath2(ctx, intent, args.name);
      ui.info(`  Decision: path=${decision.path}, target=${decision.targetDir}`);
      let migrateContent;
      if (decision.migrateExisting && !args.yes) {
        migrateContent = "Content from your existing SKILL.md (user-confirmed).";
      }
      scaffold2(decision, ctx, migrateContent);
      ui.write(`
  ${import_picocolors12.default.green("\u2713")} Created ${decision.path} at ${import_picocolors12.default.bold(decision.targetDir)}`);
      const cmdName = decision.path === "plugin" ? `/${basename3(decision.targetDir)}:doraval` : "/doraval (local skill)";
      ui.info(`  Command: ${cmdName}`);
      if (decision.path === "plugin") {
        ui.info(`  Codex manifest: .codex-plugin/plugin.json`);
        ui.info(`  Marketplace catalog: .agents/plugins/marketplace.json (starter for local testing)`);
        ui.info(`  (Move/expand the marketplace.json to $REPO_ROOT/.agents/plugins/ or ~/.agents/plugins/ as needed)`);
      }
      ui.info(`  Test (local): restart Codex, select your marketplace in the plugin directory`);
      ui.info(`  Validate: doraval validate ${decision.targetDir}`);
      if (decision.path === "plugin" && decision.migrateExisting) {
        ui.info("  (Existing content migrated where confirmed.)");
      }
      process.exit(0);
    }
  });
});

// src/validators/claude/skill.ts
import { existsSync as existsSync13 } from "fs";
import { resolve as resolve4 } from "path";
var OPTIONAL_DIRS2, claudeSkillValidator;
var init_skill = __esm(() => {
  init_frontmatter();
  init_skill_validate();
  OPTIONAL_DIRS2 = ["references", "scripts", "assets"];
  claudeSkillValidator = {
    id: "claude:skill",
    provider: "claude",
    name: "Claude Skill",
    description: "Validates SKILL.md per current Claude Code spec: frontmatter (name/description relaxed to recommended; directory name usually provides the /command), body, supporting files, dynamic injection (!`cmd`), substitutions ($ARGUMENTS, ${CLAUDE_*}), and advanced fields (allowed-tools, context, disable-model-invocation, when_to_use, etc.)",
    detect(dir) {
      return existsSync13(resolve4(dir, "SKILL.md"));
    },
    async validate(dir, _opts) {
      const skillMd = resolve4(dir, "SKILL.md");
      const raw = await Bun.file(skillMd).text();
      let parsed;
      try {
        parsed = parseFrontmatter(raw);
      } catch {
        return {
          errors: ["Failed to parse YAML frontmatter in SKILL.md"],
          warnings: [],
          passes: []
        };
      }
      const existingDirs = OPTIONAL_DIRS2.filter((d) => existsSync13(resolve4(dir, d)));
      return validateSkillModel(parsed, { existingDirs: [...existingDirs] });
    }
  };
});

// src/validators/claude/plugin.ts
import { existsSync as existsSync14, readdirSync as readdirSync6 } from "fs";
import { resolve as resolve5, join as join12 } from "path";
function levenshtein(a, b) {
  if (a === b)
    return 0;
  const m = a.length, n = b.length;
  if (m === 0)
    return n;
  if (n === 0)
    return m;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0;i <= m; i++)
    dp[i][0] = i;
  for (let j = 0;j <= n; j++)
    dp[0][j] = j;
  for (let i = 1;i <= m; i++) {
    for (let j = 1;j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}
function suggestField(unknown) {
  const lower = unknown.toLowerCase();
  for (const k of KNOWN_FIELDS2) {
    if (k.toLowerCase() === lower)
      return k;
    if (levenshtein(k.toLowerCase(), lower) <= 1)
      return k;
    if (k.toLowerCase().startsWith(lower.slice(0, 3)) && lower.length > 3)
      return k;
  }
  if (lower === "licence")
    return "license";
  if (lower === "dependancies" || lower === "deps")
    return "dependencies";
  if (lower === "mcp" || lower === "mcpservers")
    return "mcpServers";
  if (lower === "lsp")
    return "lspServers";
  if (lower === "outputstyles" || lower === "styles")
    return "outputStyles";
  if (lower === "userconfig")
    return "userConfig";
  return null;
}
function isRelativePathLike(v) {
  if (typeof v !== "string")
    return false;
  return RELATIVE_PATH_REGEX.test(v) && !v.includes("..");
}
var NAME_REGEX2, RELATIVE_PATH_REGEX, KNOWN_FIELDS2, REPLACES_DEFAULT, claudePluginValidator;
var init_plugin = __esm(() => {
  NAME_REGEX2 = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
  RELATIVE_PATH_REGEX = /^\.\//;
  KNOWN_FIELDS2 = new Set([
    "$schema",
    "name",
    "displayName",
    "version",
    "description",
    "author",
    "homepage",
    "repository",
    "license",
    "keywords",
    "defaultEnabled",
    "skills",
    "commands",
    "agents",
    "hooks",
    "mcpServers",
    "outputStyles",
    "lspServers",
    "experimental",
    "userConfig",
    "channels",
    "dependencies"
  ]);
  REPLACES_DEFAULT = new Set(["commands", "agents", "outputStyles", "lspServers"]);
  claudePluginValidator = {
    id: "claude:plugin",
    provider: "claude",
    name: "Claude Plugin",
    description: "Validates .claude-plugin/plugin.json manifest (complete schema per Plugins reference), component path rules (replace vs augment), .claude-plugin/ purity, default dirs, single-root-skill layout, unrecognized fields + suggestions, and structure",
    detect(dir) {
      return existsSync14(resolve5(dir, ".claude-plugin", "plugin.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const manifestPath = resolve5(dir, ".claude-plugin", "plugin.json");
      const dotClaudePluginDir = resolve5(dir, ".claude-plugin");
      let manifest;
      try {
        const raw = await Bun.file(manifestPath).text();
        manifest = JSON.parse(raw);
        passes.push(".claude-plugin/plugin.json is valid JSON");
      } catch {
        errors.push(".claude-plugin/plugin.json is missing or invalid JSON");
        return { errors, warnings, passes };
      }
      try {
        const entries = readdirSync6(dotClaudePluginDir);
        const unexpected = entries.filter((e) => e !== "plugin.json");
        if (unexpected.length > 0) {
          for (const e of unexpected) {
            warnings.push(`Unexpected item "${e}" inside .claude-plugin/ \u2014 only plugin.json belongs here. Move component directories and files (skills/, commands/, agents/, hooks/, .mcp.json etc.) to the plugin root.`);
          }
        } else if (entries.length === 1) {
          passes.push(".claude-plugin/ contains only plugin.json (correct layout)");
        }
      } catch {}
      if (!manifest.name) {
        errors.push('Missing required field: "name"');
      } else {
        const name = String(manifest.name);
        if (!NAME_REGEX2.test(name)) {
          errors.push(`Invalid name format: "${name}" \u2014 must be kebab-case (a-z, 0-9, hyphens)`);
        } else {
          passes.push(`name: "${name}"`);
        }
      }
      if (manifest.version !== undefined) {
        const v = String(manifest.version);
        if (!/^\d+\.\d+\.\d+/.test(v)) {
          errors.push(`Invalid version format: "${v}" \u2014 must look like semver (MAJOR.MINOR.PATCH) when using explicit versioning`);
        } else {
          passes.push(`version: "${v}" (explicit \u2014 bump on every release to publish updates)`);
        }
      } else {
        passes.push("version omitted (git commit SHA used as version key \u2014 every commit becomes an available update)");
      }
      if (manifest.description !== undefined) {
        const desc = String(manifest.description);
        if (desc.length < 10) {
          warnings.push(`Description is very short (${desc.length} chars) \u2014 50-200 chars recommended`);
        } else {
          passes.push("description field present");
        }
      } else {
        warnings.push('Missing "description" (recommended for UI, marketplace listings, and auto-discovery)');
      }
      if (manifest.displayName !== undefined) {
        passes.push(`displayName: "${manifest.displayName}" (human UI label; falls back to name)`);
      }
      if (manifest.author !== undefined) {
        const a = manifest.author;
        if (a && typeof a === "object" && a.name) {
          passes.push("author present");
        } else {
          warnings.push('author should be an object like {"name": "...", "email?": "..."}');
        }
      }
      if (manifest.license !== undefined) {
        passes.push(`license: "${manifest.license}"`);
      }
      if (manifest.keywords !== undefined) {
        if (Array.isArray(manifest.keywords)) {
          passes.push(`keywords: [${manifest.keywords.join(", ")}]`);
        } else {
          errors.push("keywords must be an array of strings");
        }
      }
      if (manifest.defaultEnabled !== undefined) {
        passes.push(`defaultEnabled: ${manifest.defaultEnabled}`);
      }
      if (manifest.homepage)
        passes.push("homepage present");
      if (manifest.repository)
        passes.push("repository present");
      const unknown = Object.keys(manifest).filter((k) => !KNOWN_FIELDS2.has(k));
      for (const k of unknown) {
        const sug = suggestField(k);
        const hint = sug ? ` (did you mean "${sug}"?)` : "";
        warnings.push(`Unrecognized top-level field "${k}"${hint} \u2014 will be ignored at runtime (allowed for cross-tool manifest compatibility).`);
      }
      const handleField = (field, val) => {
        if (val === undefined || val === null)
          return;
        if (isRelativePathLike(val) || Array.isArray(val) && val.every(isRelativePathLike)) {
          const arr = Array.isArray(val) ? val : [val];
          for (const p of arr) {
            const s = String(p);
            if (!RELATIVE_PATH_REGEX.test(s)) {
              errors.push(`${field}: path "${s}" must start with "./"`);
            } else if (s.includes("..")) {
              errors.push(`${field}: path "${s}" must not use ".." (paths are confined to the plugin tree after cache copy)`);
            } else if (existsSync14(resolve5(dir, s))) {
              passes.push(`${field}: path "${s}" exists`);
            } else {
              warnings.push(`${field}: path "${s}" does not exist on disk`);
            }
          }
          if (field === "skills") {
            passes.push(`${field}: augments the default skills/ (both are scanned)`);
          } else if (REPLACES_DEFAULT.has(field)) {
            passes.push(`${field}: custom path replaces default ${field}/ scan`);
          } else {
            passes.push(`${field}: custom path or config (merge rules apply)`);
          }
        } else if (typeof val === "object") {
          passes.push(`${field}: inline ${field} config present`);
        }
      };
      ["skills", "commands", "agents", "hooks", "mcpServers", "outputStyles", "lspServers"].forEach((f) => {
        if (manifest[f] !== undefined)
          handleField(f, manifest[f]);
      });
      if (manifest.experimental && typeof manifest.experimental === "object") {
        const exp = manifest.experimental;
        if (exp.themes !== undefined)
          handleField("experimental.themes", exp.themes);
        if (exp.monitors !== undefined)
          handleField("experimental.monitors", exp.monitors);
        passes.push("experimental section present (themes and monitors are experimental components)");
      }
      if (manifest.userConfig && typeof manifest.userConfig === "object") {
        const keys = Object.keys(manifest.userConfig);
        passes.push(`userConfig: ${keys.length} user-configurable value(s) declared`);
        for (const k of keys) {
          const opt = manifest.userConfig[k];
          if (!opt || !opt.type || !opt.title) {
            warnings.push(`userConfig.${k} is missing required "type" and/or "title"`);
          }
        }
      }
      if (Array.isArray(manifest.channels)) {
        passes.push(`channels: ${manifest.channels.length} channel(s) (each binds to an mcpServer)`);
        manifest.channels.forEach((ch, i) => {
          if (!ch?.server)
            warnings.push(`channels[${i}]: "server" is required and must match an mcpServers key`);
        });
      }
      if (Array.isArray(manifest.dependencies)) {
        passes.push(`dependencies: declares ${manifest.dependencies.length} plugin dependency/ies`);
      }
      const skillsDir = resolve5(dir, "skills");
      if (existsSync14(skillsDir)) {
        const entries = readdirSync6(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
        for (const e of entries) {
          const md = join12(skillsDir, e.name, "SKILL.md");
          if (existsSync14(md)) {
            passes.push(`skills/${e.name}/SKILL.md exists`);
          } else {
            errors.push(`skills/${e.name}/ is missing SKILL.md`);
          }
        }
        if (manifest.skills !== undefined) {
          warnings.push('Default skills/ dir co-exists with manifest "skills" \u2014 manifest path is authoritative; default folder ignored for loading');
        }
      }
      const commandsDir = resolve5(dir, "commands");
      if (existsSync14(commandsDir)) {
        const mds = readdirSync6(commandsDir).filter((f) => f.endsWith(".md"));
        if (mds.length) {
          passes.push(`commands/ has ${mds.length} .md file(s)`);
        }
        if (manifest.commands !== undefined) {
          warnings.push('commands/ co-exists with manifest "commands" \u2014 manifest replaces default (dir ignored)');
        }
      }
      const agentsDir = resolve5(dir, "agents");
      if (existsSync14(agentsDir)) {
        const mds = readdirSync6(agentsDir).filter((f) => f.endsWith(".md"));
        if (mds.length) {
          passes.push(`agents/ has ${mds.length} .md file(s)`);
        }
        if (manifest.agents !== undefined) {
          warnings.push('agents/ co-exists with manifest "agents" \u2014 manifest replaces default (dir ignored)');
        }
      }
      if (existsSync14(resolve5(dir, "output-styles"))) {
        passes.push("output-styles/ directory present");
        if (manifest.outputStyles)
          warnings.push("output-styles/ co-exists with manifest outputStyles \u2014 manifest wins");
      }
      if (existsSync14(resolve5(dir, "themes")))
        passes.push("themes/ present (experimental)");
      if (existsSync14(resolve5(dir, "monitors")) || manifest.experimental?.monitors) {
        passes.push("monitors config present (experimental)");
      }
      if (existsSync14(resolve5(dir, "bin")))
        passes.push("bin/ present (adds executables to Bash tool $PATH)");
      if (existsSync14(resolve5(dir, "settings.json")))
        passes.push("settings.json present (plugin defaults for agent/statusline)");
      if (existsSync14(resolve5(dir, "README.md")))
        passes.push("README.md present");
      if (existsSync14(resolve5(dir, ".mcp.json")))
        passes.push(".mcp.json present (validated by claude:mcp)");
      if (existsSync14(resolve5(dir, ".lsp.json")))
        passes.push(".lsp.json present (validated by claude:lsp when registered)");
      if (existsSync14(resolve5(dir, "hooks/hooks.json")) || existsSync14(resolve5(dir, "hooks.json"))) {
        passes.push("hooks config present (validated by claude:hooks)");
      }
      if (existsSync14(resolve5(dir, "SKILL.md")) && !existsSync14(skillsDir) && manifest.skills === undefined) {
        passes.push('Root SKILL.md detected \u2014 plugin will be treated as a single-skill plugin (prefer frontmatter "name" for stable /command)');
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/claude/marketplace.ts
import { existsSync as existsSync15, readdirSync as readdirSync7 } from "fs";
import { resolve as resolve6, join as join13 } from "path";
var claudeMarketplaceValidator;
var init_marketplace = __esm(() => {
  claudeMarketplaceValidator = {
    id: "claude:marketplace",
    provider: "claude",
    name: "Claude Plugin Marketplace",
    description: "Validates marketplace structure: plugins/ directory with valid plugin subdirectories",
    detect(dir) {
      const pluginsDir = resolve6(dir, "plugins");
      if (!existsSync15(pluginsDir))
        return false;
      try {
        const entries = readdirSync7(pluginsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory())
            continue;
          const hasSkills = existsSync15(join13(pluginsDir, entry.name, "skills"));
          const hasManifest = existsSync15(join13(pluginsDir, entry.name, ".claude-plugin", "plugin.json"));
          if (hasSkills || hasManifest)
            return true;
        }
      } catch {}
      return false;
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const pluginsDir = resolve6(dir, "plugins");
      if (!existsSync15(pluginsDir)) {
        errors.push("Missing plugins/ directory");
        return { errors, warnings, passes };
      }
      passes.push("plugins/ directory exists");
      const pluginEntries = readdirSync7(pluginsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
      if (pluginEntries.length === 0) {
        errors.push("plugins/ directory is empty \u2014 expected at least one plugin");
        return { errors, warnings, passes };
      }
      passes.push(`${pluginEntries.length} plugin(s) found`);
      if (existsSync15(resolve6(dir, "README.md"))) {
        passes.push("README.md exists at marketplace root");
      } else {
        warnings.push("No README.md at marketplace root \u2014 recommended for discoverability");
      }
      if (existsSync15(resolve6(dir, "LICENSE"))) {
        passes.push("LICENSE exists at marketplace root");
      } else {
        warnings.push("No LICENSE at marketplace root \u2014 recommended");
      }
      for (const plugin of pluginEntries) {
        const pluginPath = join13(pluginsDir, plugin.name);
        const hasSkills = existsSync15(join13(pluginPath, "skills"));
        const hasManifest = existsSync15(join13(pluginPath, ".claude-plugin", "plugin.json"));
        const hasReadme = existsSync15(join13(pluginPath, "README.md"));
        if (hasManifest || hasSkills) {
          passes.push(`Plugin "${plugin.name}" has ${hasManifest ? "manifest" : "skills/"}`);
        } else {
          warnings.push(`Plugin "${plugin.name}" has neither .claude-plugin/plugin.json nor skills/`);
        }
        if (!hasReadme) {
          warnings.push(`Plugin "${plugin.name}" has no README.md`);
        }
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/claude/hooks.ts
import { existsSync as existsSync16 } from "fs";
import { resolve as resolve7 } from "path";
var KNOWN_EVENTS, claudeHooksValidator;
var init_hooks = __esm(() => {
  KNOWN_EVENTS = [
    "SessionStart",
    "Setup",
    "UserPromptSubmit",
    "UserPromptExpansion",
    "PreToolUse",
    "PermissionRequest",
    "PermissionDenied",
    "PostToolUse",
    "PostToolUseFailure",
    "PostToolBatch",
    "Notification",
    "MessageDisplay",
    "SubagentStart",
    "SubagentStop",
    "TaskCreated",
    "TaskCompleted",
    "Stop",
    "StopFailure",
    "TeammateIdle",
    "InstructionsLoaded",
    "ConfigChange",
    "CwdChanged",
    "FileChanged",
    "WorktreeCreate",
    "WorktreeRemove",
    "PreCompact",
    "PostCompact",
    "Elicitation",
    "ElicitationResult",
    "SessionEnd"
  ];
  claudeHooksValidator = {
    id: "claude:hooks",
    provider: "claude",
    name: "Claude Hooks",
    description: "Validates hooks/hooks.json (or root hooks.json): all lifecycle events per Plugins reference, hook group structure (matcher + hooks[]), supported hook types (command, http, mcp_tool, prompt, agent)",
    detect(dir) {
      return existsSync16(resolve7(dir, "hooks", "hooks.json")) || existsSync16(resolve7(dir, "hooks.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const hooksPath = existsSync16(resolve7(dir, "hooks", "hooks.json")) ? resolve7(dir, "hooks", "hooks.json") : resolve7(dir, "hooks.json");
      let config;
      try {
        const raw = await Bun.file(hooksPath).text();
        config = JSON.parse(raw);
        passes.push("hooks.json is valid JSON");
      } catch {
        errors.push("hooks.json is missing or invalid JSON");
        return { errors, warnings, passes };
      }
      const eventNames = Object.keys(config);
      for (const name of eventNames) {
        if (KNOWN_EVENTS.includes(name)) {
          passes.push(`Event "${name}" is a known lifecycle event`);
        } else {
          warnings.push(`Unknown event name: "${name}" \u2014 see full list in Plugins reference (SessionStart, PreToolUse, PostToolUse, Stop, ...)`);
        }
      }
      for (const [event, groups] of Object.entries(config)) {
        if (!Array.isArray(groups)) {
          errors.push(`Event "${event}": value must be an array of hook groups`);
          continue;
        }
        groups.forEach((group, gi) => {
          if (!group || typeof group !== "object") {
            errors.push(`${event}[${gi}]: hook group must be an object`);
            return;
          }
          if (group.matcher !== undefined && typeof group.matcher !== "string") {
            warnings.push(`${event}[${gi}]: "matcher" should be a string (e.g. "Write|Edit" or glob)`);
          }
          const hooksArr = group.hooks;
          if (!Array.isArray(hooksArr)) {
            errors.push(`${event}[${gi}]: missing or invalid "hooks" array`);
            return;
          }
          hooksArr.forEach((h, hi) => {
            if (!h || typeof h !== "object" || !h.type) {
              errors.push(`${event}[${gi}].hooks[${hi}]: must have "type"`);
              return;
            }
            const t = String(h.type);
            if (!["command", "http", "mcp_tool", "prompt", "agent"].includes(t)) {
              warnings.push(`${event}[${gi}].hooks[${hi}]: unknown type "${t}" (valid: command, http, mcp_tool, prompt, agent)`);
            }
            if (t === "command" && !h.command) {
              errors.push(`${event}[${gi}].hooks[${hi}]: type=command requires "command"`);
            }
            if (t === "http" && !h.url) {
              errors.push(`${event}[${gi}].hooks[${hi}]: type=http requires "url"`);
            }
            if (h.command && typeof h.command === "string" && /\$\{CLAUDE_/.test(h.command)) {
              passes.push(`${event}[${gi}].hooks[${hi}]: uses plugin env substitution`);
            }
          });
          if (hooksArr.length > 0) {
            passes.push(`Event "${event}" has ${hooksArr.length} hook action(s)`);
          }
        });
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/claude/mcp.ts
import { existsSync as existsSync17 } from "fs";
import { resolve as resolve8 } from "path";
var claudeMcpValidator;
var init_mcp = __esm(() => {
  claudeMcpValidator = {
    id: "claude:mcp",
    provider: "claude",
    name: "Claude MCP Config",
    description: "Validates .mcp.json (or inline via plugin.json mcpServers): server entries (stdio: command+args, or url), env, cwd, ${CLAUDE_PLUGIN_ROOT} etc. substitutions per Plugins reference",
    detect(dir) {
      return existsSync17(resolve8(dir, ".mcp.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const mcpPath = resolve8(dir, ".mcp.json");
      let config;
      try {
        const raw = await Bun.file(mcpPath).text();
        config = JSON.parse(raw);
        passes.push(".mcp.json is valid JSON");
      } catch {
        errors.push(".mcp.json is missing or invalid JSON");
        return { errors, warnings, passes };
      }
      if (typeof config !== "object" || Array.isArray(config)) {
        errors.push(".mcp.json must be a JSON object with server name keys");
        return { errors, warnings, passes };
      }
      const serverNames = Object.keys(config);
      if (serverNames.length === 0) {
        warnings.push(".mcp.json is empty \u2014 no servers defined");
        return { errors, warnings, passes };
      }
      passes.push(`${serverNames.length} server(s) defined`);
      for (const [name, entry] of Object.entries(config)) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          errors.push(`mcp server "${name}": definition must be an object`);
          continue;
        }
        const e = entry;
        const hasCommand = typeof e.command === "string";
        const hasUrl = typeof e.url === "string";
        if (!hasCommand && !hasUrl) {
          errors.push(`mcp server "${name}": must have either "command" (for stdio) or "url" (for SSE/HTTP)`);
        }
        if (hasCommand && !Array.isArray(e.args)) {
          warnings.push(`mcp server "${name}": "command" present but no "args" array (ok for some servers)`);
        }
        if (hasUrl && hasCommand) {
          warnings.push(`mcp server "${name}": both "command" and "url" present \u2014 usually one or the other`);
        }
        if (e.env && typeof e.env === "object") {
          passes.push(`mcp server "${name}": has env`);
        }
        if (typeof e.cwd === "string") {
          passes.push(`mcp server "${name}": has cwd`);
        }
        const hasSubs = JSON.stringify(e).match(/\$\{CLAUDE_PLUGIN_(ROOT|DATA)|CLAUDE_PROJECT_DIR|user_config\.|ENV_VAR\}/);
        if (hasSubs) {
          passes.push(`mcp server "${name}": uses \${CLAUDE_PLUGIN_*} / user_config / env substitution`);
        }
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/claude/subagent.ts
import { existsSync as existsSync18, readdirSync as readdirSync8 } from "fs";
import { resolve as resolve9, join as join14 } from "path";
var claudeSubagentValidator;
var init_subagent = __esm(() => {
  init_frontmatter();
  claudeSubagentValidator = {
    id: "claude:subagent",
    provider: "claude",
    name: "Claude Subagents",
    description: "Validates agents/*.md (plugin subagents): frontmatter per spec (name, description, model, effort, maxTurns, tools, disallowedTools, skills, memory, background, isolation=worktree), body; warns on disallowed fields (hooks, mcpServers, permissionMode) for security",
    detect(dir) {
      const agentsDir = resolve9(dir, "agents");
      if (!existsSync18(agentsDir))
        return false;
      try {
        return readdirSync8(agentsDir).some((f) => f.endsWith(".md"));
      } catch {
        return false;
      }
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const agentsDir = resolve9(dir, "agents");
      const mdFiles = readdirSync8(agentsDir).filter((f) => f.endsWith(".md"));
      if (mdFiles.length === 0) {
        errors.push("agents/ directory has no .md files");
        return { errors, warnings, passes };
      }
      passes.push(`${mdFiles.length} agent definition(s) found`);
      const SUPPORTED = new Set([
        "name",
        "description",
        "model",
        "effort",
        "maxTurns",
        "tools",
        "disallowedTools",
        "skills",
        "memory",
        "background",
        "isolation"
      ]);
      const DISALLOWED = new Set(["hooks", "mcpServers", "permissionMode"]);
      for (const file of mdFiles) {
        const filePath = join14(agentsDir, file);
        const raw = await Bun.file(filePath).text();
        try {
          const parsed = parseFrontmatter(raw);
          const fm = parsed.data;
          if (Object.keys(fm).length === 0) {
            warnings.push(`${file}: no YAML frontmatter (description recommended so Claude knows when to invoke)`);
          } else {
            if (fm.description) {
              passes.push(`${file}: has frontmatter with description`);
            } else {
              warnings.push(`${file}: missing "description" in frontmatter`);
            }
            const usedSupported = [];
            Object.keys(fm).forEach((k) => {
              if (SUPPORTED.has(k))
                usedSupported.push(k);
              if (DISALLOWED.has(k)) {
                errors.push(`${file}: frontmatter "${k}" is not supported for plugin-shipped agents (security restriction)`);
              }
            });
            if (usedSupported.length) {
              passes.push(`${file}: frontmatter fields: ${usedSupported.join(", ")}`);
            }
            if (fm.isolation !== undefined && fm.isolation !== "worktree") {
              errors.push(`${file}: "isolation" must be "worktree" if present (only supported value for plugin agents)`);
            }
            if (fm.name && typeof fm.name === "string") {
              passes.push(`${file}: name: "${fm.name}"`);
            }
          }
          if (!parsed.content.trim()) {
            errors.push(`${file}: body is empty`);
          } else {
            passes.push(`${file}: has agent system prompt body`);
          }
        } catch {
          errors.push(`${file}: failed to parse`);
        }
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/claude/command.ts
import { existsSync as existsSync19, readdirSync as readdirSync9 } from "fs";
import { resolve as resolve10, join as join15 } from "path";
var claudeCommandValidator;
var init_command = __esm(() => {
  init_frontmatter();
  claudeCommandValidator = {
    id: "claude:command",
    provider: "claude",
    name: "Claude Commands",
    description: "Validates commands/ (or legacy .claude/commands/) .md files: frontmatter (including rich skill fields), description, body",
    detect(dir) {
      const commandsDir = resolve10(dir, "commands");
      if (!existsSync19(commandsDir))
        return false;
      try {
        return readdirSync9(commandsDir).some((f) => f.endsWith(".md"));
      } catch {
        return false;
      }
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const commandsDir = resolve10(dir, "commands");
      const mdFiles = readdirSync9(commandsDir).filter((f) => f.endsWith(".md"));
      if (mdFiles.length === 0) {
        errors.push("commands/ directory has no .md files");
        return { errors, warnings, passes };
      }
      passes.push(`${mdFiles.length} command definition(s) found`);
      for (const file of mdFiles) {
        const filePath = join15(commandsDir, file);
        const raw = await Bun.file(filePath).text();
        try {
          const parsed = parseFrontmatter(raw);
          if (Object.keys(parsed.data).length === 0) {
            warnings.push(`${file}: no YAML frontmatter`);
          } else if (!parsed.data.description) {
            warnings.push(`${file}: missing "description" in frontmatter`);
          } else {
            passes.push(`${file}: has frontmatter with description`);
          }
          if (!parsed.content.trim()) {
            errors.push(`${file}: body is empty`);
          }
          const advancedKeys = ["allowed-tools", "disallowed-tools", "context", "when_to_use", "disable-model-invocation", "user-invocable", "arguments", "argument-hint", "shell", "paths", "hooks"];
          const foundAdvanced = advancedKeys.filter((k) => parsed.data[k] !== undefined);
          if (foundAdvanced.length > 0) {
            passes.push(`${file}: advanced frontmatter: ${foundAdvanced.join(", ")}`);
          }
        } catch {
          errors.push(`${file}: failed to parse`);
        }
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/claude/memory.ts
import { existsSync as existsSync20 } from "fs";
import { resolve as resolve11 } from "path";
var claudeMemoryValidator;
var init_memory = __esm(() => {
  claudeMemoryValidator = {
    id: "claude:memory",
    provider: "claude",
    name: "Claude CLAUDE.md",
    description: "Validates CLAUDE.md: non-empty, length recommendations, @path imports",
    detect(dir) {
      return existsSync20(resolve11(dir, "CLAUDE.md"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const filePath = resolve11(dir, "CLAUDE.md");
      const raw = await Bun.file(filePath).text();
      if (!raw.trim()) {
        errors.push("CLAUDE.md is empty");
        return { errors, warnings, passes };
      }
      passes.push("CLAUDE.md is non-empty");
      const lines = raw.split(`
`);
      if (lines.length > 200) {
        warnings.push(`CLAUDE.md is ${lines.length} lines \u2014 official recommendation is under 200. Move reference content to skills.`);
      } else {
        passes.push(`CLAUDE.md is ${lines.length} lines (under 200 recommended limit)`);
      }
      const importRegex = /^@([^\s]+)\s*$/gm;
      let match;
      while ((match = importRegex.exec(raw)) !== null) {
        const importPath = match[1];
        const resolvedImport = resolve11(dir, importPath);
        if (existsSync20(resolvedImport)) {
          passes.push(`@import "${importPath}" exists`);
        } else {
          warnings.push(`@import "${importPath}" \u2014 file not found at ${resolvedImport}`);
        }
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/claude/lsp.ts
import { existsSync as existsSync21 } from "fs";
import { resolve as resolve12 } from "path";
var claudeLspValidator;
var init_lsp = __esm(() => {
  claudeLspValidator = {
    id: "claude:lsp",
    provider: "claude",
    name: "Claude LSP Servers",
    description: "Validates .lsp.json (or plugin.json lspServers): language server configs with required command + extensionToLanguage; optional transport, env, settings, diagnostics etc. (binaries installed separately)",
    detect(dir) {
      return existsSync21(resolve12(dir, ".lsp.json")) || existsSync21(resolve12(dir, ".claude-plugin", "plugin.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      let cfg = null;
      const lspPath = resolve12(dir, ".lsp.json");
      if (existsSync21(lspPath)) {
        try {
          cfg = JSON.parse(await Bun.file(lspPath).text());
          passes.push(".lsp.json is valid JSON");
        } catch {
          errors.push(".lsp.json is invalid JSON");
          return { errors, warnings, passes };
        }
      } else {
        const manifestPath = resolve12(dir, ".claude-plugin", "plugin.json");
        if (existsSync21(manifestPath)) {
          try {
            const m = JSON.parse(await Bun.file(manifestPath).text());
            if (m && m.lspServers && typeof m.lspServers === "object") {
              cfg = m.lspServers;
              passes.push("lspServers present inline in plugin.json");
            }
          } catch {}
        }
      }
      if (!cfg) {
        if (!existsSync21(lspPath)) {
          return { errors, warnings, passes };
        }
      }
      if (cfg && typeof cfg === "object") {
        const langs = Object.keys(cfg);
        passes.push(`${langs.length} language server(s) configured`);
        for (const lang of langs) {
          const entry = cfg[lang];
          if (!entry || !entry.command) {
            errors.push(`lsp "${lang}": "command" (the LSP binary) is required`);
          }
          if (!entry.extensionToLanguage || typeof entry.extensionToLanguage !== "object") {
            errors.push(`lsp "${lang}": "extensionToLanguage" map is required (e.g. { ".ts": "typescript" })`);
          } else {
            passes.push(`lsp "${lang}": has extensionToLanguage mapping`);
          }
          if (entry.diagnostics === false) {
            passes.push(`lsp "${lang}": diagnostics disabled (navigation only)`);
          }
        }
      }
      warnings.push('Reminder: the actual language server binary (gopls, pyright, etc.) must be installed separately on PATH. See /plugin errors tab if "Executable not found".');
      return { errors, warnings, passes };
    }
  };
});

// src/validators/claude/monitors.ts
import { existsSync as existsSync22 } from "fs";
import { resolve as resolve13 } from "path";
var claudeMonitorsValidator;
var init_monitors = __esm(() => {
  claudeMonitorsValidator = {
    id: "claude:monitors",
    provider: "claude",
    name: "Claude Monitors (experimental)",
    description: "Validates monitors/monitors.json (or experimental.monitors): array of {name, command, description, when?}; commands support ${CLAUDE_PLUGIN_*} subs. Monitors run only in interactive CLI sessions.",
    detect(dir) {
      return existsSync22(resolve13(dir, "monitors", "monitors.json")) || existsSync22(resolve13(dir, "monitors.json")) || existsSync22(resolve13(dir, ".claude-plugin", "plugin.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      let arr = null;
      const candidates = [
        resolve13(dir, "monitors", "monitors.json"),
        resolve13(dir, "monitors.json")
      ];
      for (const p of candidates) {
        if (existsSync22(p)) {
          try {
            const parsed = JSON.parse(await Bun.file(p).text());
            if (Array.isArray(parsed)) {
              arr = parsed;
              passes.push("monitors config is valid JSON array");
            }
            break;
          } catch {
            errors.push("monitors config is invalid JSON");
            return { errors, warnings, passes };
          }
        }
      }
      if (!arr) {
        const mp = resolve13(dir, ".claude-plugin", "plugin.json");
        if (existsSync22(mp)) {
          try {
            const m = JSON.parse(await Bun.file(mp).text());
            const exp = m?.experimental;
            const inline = typeof exp === "string" ? null : exp?.monitors;
            if (Array.isArray(inline))
              arr = inline;
            else if (typeof inline === "string") {
              passes.push("experimental.monitors declared as path in manifest (content not validated here)");
            }
          } catch {}
        }
      }
      if (!arr) {
        return { errors, warnings, passes };
      }
      if (!Array.isArray(arr)) {
        errors.push("monitors config must be a JSON array");
        return { errors, warnings, passes };
      }
      const seen = new Set;
      arr.forEach((mon, i) => {
        if (!mon || typeof mon !== "object") {
          errors.push(`monitors[${i}]: entry must be an object`);
          return;
        }
        if (!mon.name || typeof mon.name !== "string") {
          errors.push(`monitors[${i}]: "name" (unique id) is required`);
        } else {
          if (seen.has(mon.name))
            errors.push(`monitors: duplicate name "${mon.name}"`);
          seen.add(mon.name);
        }
        if (!mon.command || typeof mon.command !== "string") {
          errors.push(`monitors[${i}]: "command" (shell command) is required`);
        } else if (/\$\{CLAUDE_/.test(mon.command)) {
          passes.push(`monitors[${i}] "${mon.name || i}": uses CLAUDE_PLUGIN_* substitution`);
        }
        if (!mon.description) {
          warnings.push(`monitors[${i}]: "description" recommended (shown in task panel)`);
        }
        if (mon.when && !/^always$|^on-skill-invoke:/.test(String(mon.when))) {
          warnings.push(`monitors[${i}]: "when" should be "always" (default) or "on-skill-invoke:<skill>"`);
        }
      });
      passes.push(`${arr.length} monitor(s) declared`);
      warnings.push("Note: monitors are experimental, run only for interactive CLI sessions, and are skipped on some hosts. They do not stop automatically if the plugin is disabled mid-session.");
      return { errors, warnings, passes };
    }
  };
});

// src/validators/index.ts
function resolveFor(forFlag, allValidators = validators) {
  if (!forFlag) {
    return { matched: allValidators };
  }
  if (forFlag.includes(":")) {
    const exact = allValidators.filter((v) => v.id === forFlag);
    if (exact.length === 0) {
      const available = allValidators.map((v) => v.id).join(", ");
      return { matched: [], error: `Unknown validator: "${forFlag}"

Available: ${available}` };
    }
    return { matched: exact };
  }
  const byProvider = allValidators.filter((v) => v.provider === forFlag);
  if (byProvider.length === 0) {
    const providers = [...new Set(allValidators.map((v) => v.provider))];
    return { matched: [], error: `Unknown provider: "${forFlag}"

Available providers: ${providers.join(", ")}` };
  }
  return { matched: byProvider };
}
var validators;
var init_validators = __esm(() => {
  init_skill();
  init_plugin();
  init_marketplace();
  init_hooks();
  init_mcp();
  init_subagent();
  init_command();
  init_memory();
  init_lsp();
  init_monitors();
  validators = [
    claudeSkillValidator,
    claudePluginValidator,
    claudeMarketplaceValidator,
    claudeHooksValidator,
    claudeMcpValidator,
    claudeSubagentValidator,
    claudeCommandValidator,
    claudeMemoryValidator,
    claudeLspValidator,
    claudeMonitorsValidator
  ];
});

// src/core/remote.ts
import { spawnSync as spawnSync4 } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { join as join16 } from "path";
import { tmpdir } from "os";
function parseRemoteUrl(input) {
  if (input.startsWith(".") || input.startsWith("/") || input.startsWith("~")) {
    return null;
  }
  const ghMatch = input.match(GITHUB_RE);
  if (ghMatch) {
    const [, ownerRepo, ref, subpath] = ghMatch;
    return {
      original: input,
      ghRepo: ownerRepo,
      gitUrl: `https://github.com/${ownerRepo}.git`,
      ref,
      subpath
    };
  }
  if (GENERIC_GIT_RE.test(input)) {
    const gitUrl = input.endsWith(".git") ? input : `${input}.git`;
    return {
      original: input,
      gitUrl
    };
  }
  return null;
}
function isGhAvailable() {
  if (ghAvailable !== null)
    return ghAvailable;
  const result = spawnSync4("gh", ["auth", "status"], {
    stdio: "pipe",
    timeout: 5000
  });
  ghAvailable = result.status === 0;
  return ghAvailable;
}
async function cloneToTemp(parsed) {
  const tmpDir = mkdtempSync(join16(tmpdir(), "dora-"));
  const cleanup = () => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  };
  const exitHandler = () => cleanup();
  process.on("exit", exitHandler);
  const removeExitHandler = () => {
    process.removeListener("exit", exitHandler);
  };
  const wrappedCleanup = () => {
    removeExitHandler();
    cleanup();
  };
  if (parsed.ghRepo && isGhAvailable()) {
    const ghArgs = ["repo", "clone", parsed.ghRepo, tmpDir, "--"];
    ghArgs.push("--depth", "1");
    if (parsed.ref)
      ghArgs.push("--branch", parsed.ref);
    const gh = spawnSync4("gh", ghArgs, { stdio: "pipe", timeout: 60000 });
    if (gh.status === 0) {
      return { dir: tmpDir, cleanup: wrappedCleanup };
    }
  }
  const gitArgs = ["clone", "--depth", "1"];
  if (parsed.ref)
    gitArgs.push("--branch", parsed.ref);
  gitArgs.push(parsed.gitUrl, tmpDir);
  const git = spawnSync4("git", gitArgs, { stdio: "pipe", timeout: 60000 });
  if (git.status !== 0) {
    wrappedCleanup();
    const stderr = git.stderr?.toString().trim() || "unknown error";
    throw new Error(`Failed to clone ${parsed.original}: ${stderr}`);
  }
  return { dir: tmpDir, cleanup: wrappedCleanup };
}
var GITHUB_RE, GENERIC_GIT_RE, ghAvailable = null;
var init_remote = __esm(() => {
  GITHUB_RE = /^(?:https?:\/\/)?github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/]+)(?:\/(.+))?)?$/;
  GENERIC_GIT_RE = /^https?:\/\/[^/]+\/[^/]+\/[^/]+/;
});

// src/cli/commands/validate-top.ts
var exports_validate_top = {};
__export(exports_validate_top, {
  default: () => validate_top_default
});
import { existsSync as existsSync24 } from "fs";
import { resolve as resolve14 } from "path";
var import_picocolors13, validate_top_default;
var init_validate_top = __esm(() => {
  init_dist();
  init_out();
  init_validators();
  init_remote();
  import_picocolors13 = __toESM(require_picocolors(), 1);
  validate_top_default = defineCommand({
    meta: {
      name: "validate",
      description: "Auto-detect project type and run matching validators. Accepts a local path or a Git URL (e.g. https://github.com/owner/repo)"
    },
    args: {
      path: {
        type: "positional",
        description: "Path or Git URL to validate",
        required: true
      },
      for: {
        type: "string",
        description: 'Target a provider ("claude") or specific validator ("claude:plugin")'
      },
      format: {
        type: "string",
        alias: "f",
        description: "Output format (json or table)",
        default: "table"
      },
      verbose: {
        type: "boolean",
        alias: "v",
        description: "Show detailed diagnostics",
        default: false
      },
      ci: {
        type: "boolean",
        description: "Machine-friendly output, non-zero exit on issues",
        default: false
      }
    },
    async run({ args }) {
      const remote = parseRemoteUrl(args.path);
      let fullPath;
      let cleanup;
      if (remote) {
        ui.info(`
  Cloning ${import_picocolors13.default.dim(args.path)}...`);
        try {
          const result = await cloneToTemp(remote);
          fullPath = remote.subpath ? resolve14(result.dir, remote.subpath) : result.dir;
          cleanup = result.cleanup;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ui.fail(msg);
          process.exit(1);
        }
        if (!existsSync24(fullPath)) {
          cleanup();
          ui.fail(`Subdirectory not found in repo: ${remote.subpath}`);
          process.exit(1);
        }
      } else {
        fullPath = resolve14(args.path);
        if (!existsSync24(fullPath)) {
          ui.fail(`Path not found: ${args.path}

Check that the path is correct and the directory exists.`);
          process.exit(1);
        }
      }
      try {
        const opts = {
          format: args.format ?? "table",
          verbose: !!args.verbose,
          ci: !!args.ci
        };
        const { matched: candidates, error } = resolveFor(args.for);
        if (error) {
          ui.fail(error);
          process.exit(1);
        }
        let matched;
        if (args.for && args.for.includes(":")) {
          matched = candidates;
        } else {
          matched = candidates.filter((v) => v.detect(fullPath));
        }
        if (matched.length === 0) {
          const providers = [...new Set(validators.map((v) => v.provider))];
          ui.fail(`No validator matched this directory: ${args.path}

` + `Available providers:
` + providers.map((p) => {
            const pvs = validators.filter((v) => v.provider === p);
            return `  ${import_picocolors13.default.bold(p)}
` + pvs.map((v) => `    \u2022 ${import_picocolors13.default.dim(v.id)} \u2014 ${v.description}`).join(`
`);
          }).join(`
`) + `

Use ${import_picocolors13.default.dim("--for <provider>")} or ${import_picocolors13.default.dim("--for <provider:type>")} to target explicitly.`);
          process.exit(1);
        }
        const allResults = [];
        let totalErrors = 0;
        for (const v of matched) {
          const result = await v.validate(fullPath, opts);
          allResults.push({ id: v.id, name: v.name, result });
          totalErrors += result.errors.length;
        }
        if (opts.format === "json") {
          const output = allResults.map((r) => ({
            validator: r.id,
            name: r.name,
            path: args.path,
            ...r.result
          }));
          console.log(JSON.stringify(output, null, 2));
        } else {
          for (const { id, name, result } of allResults) {
            ui.write(`
  ${import_picocolors13.default.bold("dora validate")} \u2014 ${import_picocolors13.default.white(name)} ${import_picocolors13.default.dim(`(${id})`)}
`);
            ui.info(`  Path:  ${args.path}
`);
            for (const p of result.passes) {
              ui.pass(p);
            }
            for (const w of result.warnings) {
              ui.warnItem(w);
            }
            for (const e of result.errors) {
              ui.failItem(e);
            }
            if (result.errors.length === 0 && result.warnings.length === 0) {
              ui.write(`
  ${import_picocolors13.default.green("\u2713")} ${import_picocolors13.default.white("All checks passed.")}
`);
            } else {
              ui.info(`
  Result: ${result.errors.length} error(s), ${result.warnings.length} warning(s)
`);
            }
          }
        }
        process.exit(totalErrors > 0 ? 1 : 0);
      } finally {
        cleanup?.();
      }
    }
  });
});

// src/cli/commands/init.ts
var exports_init2 = {};
__export(exports_init2, {
  default: () => init_default2
});
import { basename as basename4, join as join17 } from "path";
var {spawnSync: spawnSync5 } = globalThis.Bun;
var import_picocolors14, init_default2;
var init_init2 = __esm(() => {
  init_dist();
  init_out();
  init_journal_config();
  init_journal_remote();
  init_prompt();
  import_picocolors14 = __toESM(require_picocolors(), 1);
  init_default2 = defineCommand({
    meta: {
      name: "init",
      description: "One-time setup for doraval + journal (decisions + notes) + your coding agent (recommended starting point)"
    },
    args: {
      repo: {
        type: "string",
        alias: "r",
        description: "Journal repo (owner/name). Smart default from git remote or gh account. Env: DORAVAL_JOURNAL_REPO"
      },
      project: {
        type: "string",
        alias: "p",
        description: "Project name (default: basename of current directory)"
      },
      refresh: {
        type: "boolean",
        description: "Re-fetch journal files even if the project is already registered",
        default: false
      }
    },
    async run({ args }) {
      ui.heading("dora init \u2014 Set up doraval, your journal, and the coding agent dora should use on the fly");
      const ghCheck = ensureGhCli();
      if (!ghCheck.ok) {
        ui.write(`  ${import_picocolors14.default.red("\u2717")} ${import_picocolors14.default.white("The GitHub CLI (")}${import_picocolors14.default.bold("gh")}${import_picocolors14.default.white(") is not installed.")}
`);
        ui.info(`  doraval uses ${import_picocolors14.default.bold("gh")} to fetch and sync journal files with GitHub.
`);
        ui.info(`  Install it:
`);
        ui.info(`    macOS:   ${import_picocolors14.default.dim("brew install gh")}`);
        ui.info(`    Linux:   ${import_picocolors14.default.dim("https://github.com/cli/cli/blob/trunk/docs/install_linux.md")}`);
        ui.info(`    Windows: ${import_picocolors14.default.dim("winget install --id GitHub.cli")}
`);
        ui.info(`  Then authenticate: ${import_picocolors14.default.dim("gh auth login")}
`);
        process.exit(1);
      }
      let repo = args.repo || process.env.DORAVAL_JOURNAL_REPO;
      if (!repo) {
        const gitOwner = getGitRemoteOwner();
        const ghLogin = ghUser();
        let defaultRepo;
        let sourceNote = "";
        if (gitOwner) {
          defaultRepo = `${gitOwner}/${gitOwner}.md`;
          if (ghLogin && ghLogin !== gitOwner) {
            sourceNote = `  ${import_picocolors14.default.dim("(from git remote; your active gh account is " + ghLogin + ")")}
`;
          } else {
            sourceNote = `  ${import_picocolors14.default.dim("(from git remote)")}
`;
          }
        } else if (ghLogin) {
          defaultRepo = `${ghLogin}/${ghLogin}.md`;
          sourceNote = `  ${import_picocolors14.default.dim("(from your active gh account)")}
`;
        } else {
          ui.warn(`Not logged in to GitHub. Run ${import_picocolors14.default.dim("gh auth login")} first.
`);
          process.exit(1);
        }
        const existingConfig = await readConfig();
        if (existingConfig?.journal.repo) {
          defaultRepo = existingConfig.journal.repo;
          sourceNote = `  ${import_picocolors14.default.dim("(from your previous journal setup)")}
`;
        }
        ui.info(`  Journal repo ${import_picocolors14.default.dim("(owner/name)")}`);
        if (sourceNote)
          ui.write(sourceNote);
        repo = prompt("  >", defaultRepo);
      }
      let project = args.project || process.env.DORAVAL_PROJECT;
      if (!project) {
        const defaultProject = basename4(process.cwd());
        project = prompt("  Project name", defaultProject);
      }
      project = sanitizeProjectName(project);
      if (!repoExists(repo)) {
        ui.write(`  ${import_picocolors14.default.red("\u2717")} ${import_picocolors14.default.white("Repository")} ${import_picocolors14.default.bold(repo)} ${import_picocolors14.default.white("not found on GitHub.")}
`);
        ui.info(`  Create it first:
`);
        ui.info(`    ${import_picocolors14.default.dim(`gh repo create ${repo} --private --description "Personal journal for agent decisions"`)}
`);
        process.exit(1);
      }
      const existing = await readConfig();
      const alreadyRegistered = existing?.journal.projects[project];
      const isRefresh = alreadyRegistered && args.refresh;
      if (alreadyRegistered && !isRefresh) {
        ui.write(`  ${import_picocolors14.default.yellow("\u26A0")} ${import_picocolors14.default.white("Project")} ${import_picocolors14.default.bold(project)} ${import_picocolors14.default.white("is already registered.")}
`);
        ui.info(`  Repo:   ${existing.journal.repo}
`);
        ui.info(`  To refresh journal files, use ${import_picocolors14.default.dim("dora journal update")} (or ${import_picocolors14.default.dim("dora init --refresh")}).
`);
      }
      const journalsDir = getJournalsDir();
      const remotePath = `projects/${project}.md`;
      const localPath = join17(journalsDir, `${project}.md`);
      const effectiveRepo = isRefresh && !args.repo ? existing.journal.repo : repo;
      const config = existing ?? {
        journal: { repo: effectiveRepo, projects: {} }
      };
      config.journal.repo = effectiveRepo;
      config.journal.projects[project] = {
        remote_path: remotePath,
        local_path: localPath
      };
      ensureDoravalDirs();
      ui.write(`  ${import_picocolors14.default.dim(import_picocolors14.default.gray("Fetching journal files from"))} ${import_picocolors14.default.gray(effectiveRepo)}${import_picocolors14.default.dim(import_picocolors14.default.gray("..."))}
`);
      const globalDest = join17(journalsDir, "global.md");
      const refreshGlobalRes = await refreshLocalJournalFile(effectiveRepo, "global.md", globalDest);
      let wroteGlobal;
      if (!refreshGlobalRes.ok) {
        if (refreshGlobalRes.isNotFound) {
          wroteGlobal = false;
        } else {
          ui.fail(`Failed to fetch global.md from ${effectiveRepo}:`);
          ui.info(refreshGlobalRes.error);
          process.exit(1);
        }
      } else {
        wroteGlobal = refreshGlobalRes.value;
      }
      if (wroteGlobal) {
        ui.success("global.md");
      } else {
        ui.write(`  ${import_picocolors14.default.dim("\xB7")} global.md ${import_picocolors14.default.dim("(not found \u2014 will be created on first sync)")}`);
        await Bun.write(globalDest, `# Global Journal

Cross-project principles.
`);
      }
      const refreshProjectRes = await refreshLocalJournalFile(effectiveRepo, remotePath, localPath);
      let wroteProject;
      if (!refreshProjectRes.ok) {
        if (refreshProjectRes.isNotFound) {
          wroteProject = false;
        } else {
          ui.fail(`Failed to fetch ${remotePath} from ${effectiveRepo}:`);
          ui.info(refreshProjectRes.error);
          process.exit(1);
        }
      } else {
        wroteProject = refreshProjectRes.value;
      }
      if (wroteProject) {
        ui.success(remotePath);
      } else {
        ui.write(`  ${import_picocolors14.default.dim("\xB7")} ${remotePath} ${import_picocolors14.default.dim("(not found \u2014 will be created on first sync)")}`);
        await Bun.write(localPath, `# ${project} Journal

Project-specific decisions.
`);
      }
      await writeConfig(config);
      ui.write(`
  ${import_picocolors14.default.green("\u2713")} ${import_picocolors14.default.white("Journal ready for project")} ${import_picocolors14.default.bold(import_picocolors14.default.white(project))}.
`);
      const existingAgent = (await readConfig())?.agent;
      if (existingAgent?.command) {
        ui.write(`  ${import_picocolors14.default.bold(import_picocolors14.default.white("Coding agent (already configured)"))}
`);
        ui.write(`    Current: ${import_picocolors14.default.dim(import_picocolors14.default.gray(existingAgent.command))}  template: ${import_picocolors14.default.dim(import_picocolors14.default.gray(existingAgent.prompt_template || "(default)"))}
`);
        const change = prompt("  Reconfigure / change the coding agent for on-the-fly enrichment? (y/N)", "n");
        if (!/^y/i.test(String(change))) {
          ui.dim(`  Keeping existing agent config. You can re-run dora init later to change it.
`);
          const cfg = await readConfig() || { journal: { repo: effectiveRepo, projects: {} } };
          if (existingAgent)
            cfg.agent = existingAgent;
          await writeConfig(cfg);
          ui.write(`  ${import_picocolors14.default.green("\u2713")} ${import_picocolors14.default.white("Try:")} ${import_picocolors14.default.dim(import_picocolors14.default.gray('dora journal add "short decision"'))}
`);
          process.exit(0);
          return;
        }
        ui.blank();
      } else {
        ui.write(`  ${import_picocolors14.default.bold(import_picocolors14.default.white("Coding agent for journal add"))}
`);
        ui.info(`  When configured, ${import_picocolors14.default.dim(import_picocolors14.default.gray('dora journal add ".."'))} will use your agent to enrich entries with tags and rationale automatically.
`);
      }
      const common = [
        { name: "claude", template: '-p "{{prompt}}" --output-format json' },
        { name: "cursor", template: "" }
      ];
      let detected = "";
      for (const c of common) {
        let probe = spawnSync5(["command", "-v", c.name], { stdout: "pipe", stderr: "pipe" });
        if (probe.exitCode !== 0) {
          probe = spawnSync5(["which", c.name], { stdout: "pipe", stderr: "pipe" });
        }
        if (probe.exitCode === 0) {
          detected = c.name;
          break;
        }
      }
      let agentCmd = detected || "claude";
      ui.write(`  Detected / default agent command: ${import_picocolors14.default.dim(import_picocolors14.default.gray(agentCmd))}`);
      agentCmd = prompt("  Agent command (the binary you run for prompts)", agentCmd);
      let template = detected ? common.find((c) => c.name === detected)?.template || '-p "{{prompt}}" --output-format json' : '-p "{{prompt}}" --output-format json';
      ui.info(`  Prompt template (use {{prompt}} placeholder):`);
      template = prompt("  ", template);
      const finalConfig = await readConfig() || { journal: { repo: effectiveRepo, projects: {} } };
      finalConfig.agent = {
        command: agentCmd,
        prompt_template: template
      };
      await writeConfig(finalConfig);
      ui.write(`
  ${import_picocolors14.default.green("\u2713")} ${import_picocolors14.default.white("Agent configured.")}
`);
      ui.info(`  Re-run ${import_picocolors14.default.dim(import_picocolors14.default.gray("dora init"))} anytime to change it.
`);
      ui.info(`  Next: ${import_picocolors14.default.dim(import_picocolors14.default.gray('dora journal add ".."'))}, ${import_picocolors14.default.dim(import_picocolors14.default.gray("dora journal list"))}, or ${import_picocolors14.default.dim(import_picocolors14.default.gray("dora journal update"))}.
`);
      process.exit(0);
    }
  });
});

// src/core/update.ts
import { execSync } from "child_process";
import { existsSync as existsSync25 } from "fs";
import { resolve as resolve15 } from "path";
import { homedir as homedir2 } from "os";
function isInPath(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
async function autoDetect() {
  const execPath = process.execPath;
  const argv0 = process.argv[0] || "";
  if (execPath.includes("/Cellar/") || execPath.includes("/homebrew/") || execPath.includes("/opt/homebrew/")) {
    if (isInPath("brew"))
      return { type: "homebrew" };
  }
  if (execPath.includes("/.npm/") || argv0.includes("npm")) {
    return { type: "npm" };
  }
  if (execPath.includes("/.bun/") || argv0.includes("bun")) {
    return { type: "bun" };
  }
  const home = homedir2();
  const possibleGlobals = [
    resolve15(home, ".npm-global/bin/doraval"),
    resolve15(home, ".bun/bin/doraval")
  ];
  for (const p of possibleGlobals) {
    if (existsSync25(p)) {
      if (p.includes(".npm"))
        return { type: "npm" };
      if (p.includes(".bun"))
        return { type: "bun" };
    }
  }
  return null;
}
async function detectInstallMethod(options) {
  if (options?.force) {
    if (["homebrew", "npm", "bun"].includes(options.force)) {
      return { type: options.force };
    }
    if (options.force === "npx" || options.force === "bunx") {
      return { type: "transient", via: options.force };
    }
  }
  const auto = await autoDetect();
  if (auto)
    return auto;
  const marker = await readInstallMarker();
  if (marker)
    return marker;
  return { type: "transient", via: "npx" };
}
async function fetchLatestVersionInfo() {
  const npmRes = await fetch("https://registry.npmjs.org/@hacksmith/doraval/latest");
  if (!npmRes.ok)
    throw new Error("Failed to fetch from npm");
  const npmData = await npmRes.json();
  const version = npmData.version;
  let summary = "New release available.";
  try {
    const ghRes = await fetch("https://api.github.com/repos/saif-shines/doraval/releases/latest", {
      headers: { "User-Agent": "doraval-update" }
    });
    if (ghRes.ok) {
      const ghData = await ghRes.json();
      const body = (ghData.body || "").trim();
      const lines = body.split(`
`).filter((l) => l.trim().startsWith("-") || l.trim().startsWith("*")).slice(0, 2);
      if (lines.length)
        summary = lines.join(" ").slice(0, 200);
      else if (body)
        summary = body.split(`
`)[0].slice(0, 150);
    }
  } catch {}
  return { version, summary };
}
function buildUpgradeCommand(method) {
  switch (method.type) {
    case "homebrew":
      return ["brew", "upgrade", "doraval"];
    case "npm":
      return ["npm", "install", "-g", "@hacksmith/doraval@latest"];
    case "bun":
      return ["bun", "add", "-g", "@hacksmith/doraval@latest"];
    default:
      throw new Error("Cannot build upgrade command for transient installs");
  }
}
function shouldUpdate(current, latest) {
  if (current === latest)
    return false;
  const c = current.split(".").map(Number);
  const l = latest.split(".").map(Number);
  for (let i = 0;i < 3; i++) {
    if ((l[i] || 0) > (c[i] || 0))
      return true;
    if ((l[i] || 0) < (c[i] || 0))
      return false;
  }
  return false;
}
async function readInstallMarker() {
  try {
    const { readFile } = await import("fs/promises");
    const data = await readFile(MARKER_PATH, "utf8");
    const parsed = JSON.parse(data);
    if (parsed && parsed.type)
      return parsed;
  } catch {}
  return null;
}
async function writeInstallMarker(method) {
  try {
    const { mkdir, writeFile } = await import("fs/promises");
    const { dirname: dirname2 } = await import("path");
    await mkdir(dirname2(MARKER_PATH), { recursive: true });
    await writeFile(MARKER_PATH, JSON.stringify(method, null, 2));
  } catch {}
}
var MARKER_PATH;
var init_update2 = __esm(() => {
  MARKER_PATH = resolve15(homedir2(), ".doraval", "install.json");
});

// src/cli/commands/update.ts
var exports_update2 = {};
__export(exports_update2, {
  default: () => update_default2
});
import { spawnSync as spawnSync6 } from "child_process";
async function confirmUpdate() {
  const { createInterface } = await import("readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve16) => {
    rl.question("Update now? (y/N) ", (answer) => {
      rl.close();
      resolve16(answer.toLowerCase().startsWith("y"));
    });
  });
}
var update_default2;
var init_update3 = __esm(() => {
  init_dist();
  init_out();
  init_update2();
  update_default2 = defineCommand({
    meta: {
      name: "update",
      description: "Update doraval to the latest version"
    },
    args: {
      check: {
        type: "boolean",
        description: "Only check for updates, do not install",
        default: false
      },
      yes: {
        type: "boolean",
        description: "Skip confirmation prompt",
        default: false
      }
    },
    async run({ args }) {
      const currentVersion = require_package().version;
      const argv1 = process.argv[1] || "";
      const isNpx = process.env.npm_execpath?.includes("npx") || argv1.includes("/.npm/") || process.env.npm_lifecycle_script?.includes("npx");
      const isBunx = process.env.BUN_INSTALL || argv1.includes(".bun/bin/bunx") || argv1.includes("bunx");
      if (isNpx || isBunx) {
        ui.info("It looks like you're using doraval via npx or bunx.");
        ui.info("These always fetch the latest version on the next run.");
        ui.info("");
        ui.info("For easier updates, install globally:");
        ui.info("  brew install saif-shines/tap/doraval");
        ui.info("  npm install -g @hacksmith/doraval");
        ui.info("  bun add -g @hacksmith/doraval");
        process.exit(0);
      }
      const method = await detectInstallMethod();
      if (method.type === "transient") {
        ui.info("Transient usage detected. Install globally for update support.");
        process.exit(0);
      }
      const latestInfo = await fetchLatestVersionInfo();
      if (!shouldUpdate(currentVersion, latestInfo.version)) {
        ui.success(`doraval is up to date (${currentVersion}).`);
        process.exit(0);
      }
      if (args.check) {
        ui.info(`Update available: ${currentVersion} \u2192 ${latestInfo.version}`);
        process.exit(1);
      }
      ui.heading("doraval update");
      ui.info(`  Current: ${currentVersion}`);
      ui.info(`  Latest:  ${latestInfo.version}
`);
      ui.info(`  ${latestInfo.summary}
`);
      if (!args.yes) {
        const confirmed = await confirmUpdate();
        if (!confirmed) {
          ui.info("Update cancelled.");
          process.exit(0);
        }
      }
      const cmd = buildUpgradeCommand(method);
      ui.info(`Running: ${cmd.join(" ")}
`);
      const result = spawnSync6(cmd[0], cmd.slice(1), { stdio: "inherit" });
      if (result.status === 0) {
        ui.success(`Successfully updated to ${latestInfo.version}.`);
        ui.info("You may need to restart your shell to pick up the new version.");
        await writeInstallMarker(method);
      } else {
        ui.fail("Update failed.");
        ui.info("Common fixes:");
        if (cmd[0] === "brew")
          ui.info("  \u2022 Try: sudo brew upgrade doraval  or  ensure you are in the admin group");
        if (cmd[0] === "npm" || cmd[0] === "bun")
          ui.info("  \u2022 Try running with appropriate permissions or check network.");
        ui.info(`
Raw output above.`);
        process.exit(result.status ?? 1);
      }
    }
  });
});

// src/cli/index.ts
init_dist();
var import__package = __toESM(require_package(), 1);
var import_picocolors15 = __toESM(require_picocolors(), 1);
var skill = defineCommand({
  meta: {
    name: "skill",
    description: "Validate, measure drift, and judge AI agent skills"
  },
  subCommands: {
    validate: () => Promise.resolve().then(() => (init_validate(), exports_validate)).then((m) => m.default),
    drift: () => Promise.resolve().then(() => (init_drift(), exports_drift)).then((m) => m.default),
    judge: () => Promise.resolve().then(() => (init_judge(), exports_judge)).then((m) => m.default)
  },
  run() {
    showUsage(skill);
  }
});
var journal = defineCommand({
  meta: {
    name: "journal",
    description: "Decision & note memory (with optional pushback/tags) \u2014 record, view, and sync project principles and useful notes"
  },
  subCommands: {
    init: () => Promise.resolve().then(() => (init_init(), exports_init)).then((m) => m.default),
    list: () => Promise.resolve().then(() => (init_list(), exports_list)).then((m) => m.default),
    update: () => Promise.resolve().then(() => (init_update(), exports_update)).then((m) => m.default),
    add: () => Promise.resolve().then(() => (init_add(), exports_add)).then((m) => m.default),
    sync: () => Promise.resolve().then(() => (init_sync(), exports_sync)).then((m) => m.default)
  },
  run() {
    showUsage(journal);
  }
});
var claude = defineCommand({
  meta: {
    name: "claude",
    description: "Claude Code-specific commands (packaging, scaffolding, distribution)"
  },
  subCommands: {
    new: () => Promise.resolve().then(() => (init_new(), exports_new)).then((m) => m.default),
    bump: () => Promise.resolve().then(() => (init_bump(), exports_bump)).then((m) => m.default)
  },
  run() {
    showUsage(claude);
  }
});
var codex = defineCommand({
  meta: {
    name: "codex",
    description: "Codex (OpenAI)-specific commands (packaging, scaffolding, distribution)"
  },
  subCommands: {
    new: () => Promise.resolve().then(() => (init_new2(), exports_new2)).then((m) => m.default),
    bump: () => Promise.resolve().then(() => (init_bump(), exports_bump)).then((m) => m.default)
  },
  run() {
    showUsage(codex);
  }
});
var doraemonArt = `
\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2880\u28E0\u28E4\u28F4\u28F6\u28F6\u28F6\u28F6\u28F6\u2836\u28F6\u28E4\u28E4\u28C0\u2800\u2800\u2800\u2800\u2800\u2800 
\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2880\u28E4\u28FE\u28FF\u28FF\u28FF\u2801\u2800\u2880\u2808\u28BF\u2880\u28C0\u2800\u2839\u28FF\u28FF\u28FF\u28E6\u28C4\u2800\u2800\u2800 
\u2800\u2800\u2800\u2800\u2800\u2800\u28F4\u28FF\u28FF\u28FF\u28FF\u28FF\u283F\u2800\u2800\u28DF\u2847\u2898\u28FE\u28FD\u2800\u2800\u284F\u2809\u2819\u289B\u28FF\u28F7\u2856\u2800 
\u2800\u2800\u2800\u2800\u2800\u28FE\u28FF\u28FF\u287F\u283F\u2837\u2836\u2824\u2819\u2812\u2800\u2812\u28BB\u28FF\u28FF\u2877\u280B\u2800\u2834\u281E\u280B\u2801\u2899\u28FF\u28C4 
\u2800\u2800\u2800\u2800\u28B8\u28FF\u28FF\u28EF\u28E4\u28E4\u28E4\u28E4\u28E4\u2844\u2800\u2800\u2800\u2800\u2809\u28B9\u2844\u2800\u2800\u2800\u281B\u281B\u280B\u2809\u2839\u2847 
\u2800\u2800\u2800\u2800\u28B8\u28FF\u28FF\u2800\u2800\u2800\u28C0\u28E0\u28E4\u28E4\u28E4\u28E4\u28E4\u28E4\u28E4\u28FC\u28C7\u28C0\u28C0\u28C0\u28DB\u28DB\u28D2\u28F2\u28BE\u2877 
\u2880\u2824\u2812\u2812\u28BC\u28FF\u28FF\u2836\u281E\u28BB\u28FF\u28FF\u28FF\u28FF\u28FF\u28FF\u28FF\u28FF\u28FF\u28FF\u28FF\u28FF\u28FF\u28FF\u28FF\u287F\u2801\u2800\u28FC\u2803 
\u28AE\u2800\u2800\u2800\u2800\u28FF\u28FF\u28C6\u2800\u2800\u283B\u28FF\u287F\u281B\u2809\u2809\u2801\u2800\u2809\u2809\u281B\u283F\u28FF\u28FF\u281F\u2801\u2800\u28FC\u2803\u2800 
\u2808\u2813\u2836\u28F6\u28FE\u28FF\u28FF\u28FF\u28E7\u2840\u2800\u2808\u2812\u28A4\u28C0\u28C0\u2840\u2800\u2800\u28C0\u28C0\u2860\u281A\u2801\u2800\u2880\u287C\u2803\u2800\u2800 
\u2800\u2800\u2800\u2808\u28BF\u28FF\u28FF\u28FF\u28FF\u28FF\u28F7\u28E4\u28E4\u28E4\u28E4\u28ED\u28ED\u28ED\u28ED\u28ED\u28E5\u28E4\u28E4\u28E4\u28F4\u28DF\u2801
`.trim();
var main = defineCommand({
  meta: {
    name: "doraval",
    version: import__package.default.version,
    description: "The context engineering toolkit for coding agents"
  },
  subCommands: {
    validate: () => Promise.resolve().then(() => (init_validate_top(), exports_validate_top)).then((m) => m.default),
    init: () => Promise.resolve().then(() => (init_init2(), exports_init2)).then((m) => m.default),
    bump: () => Promise.resolve().then(() => (init_bump(), exports_bump)).then((m) => m.default),
    update: () => Promise.resolve().then(() => (init_update3(), exports_update2)).then((m) => m.default),
    skill: () => Promise.resolve(skill),
    journal: () => Promise.resolve(journal),
    claude: () => Promise.resolve(claude),
    codex: () => Promise.resolve(codex)
  },
  run() {
    console.log(`
` + import_picocolors15.default.blue(doraemonArt) + `
`);
    showUsage(main);
  }
});
runMain(main);
