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

// src/core/frontmatter.ts
var {YAML } = globalThis.Bun;
function parseFrontmatter(raw) {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { data: {}, content: raw };
  }
  const data = YAML.parse(match[1]);
  return { data: data ?? {}, content: match[2] };
}
var FRONTMATTER_RE;
var init_frontmatter = __esm(() => {
  FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
});

// src/core/skill-validate.ts
function validateSkillModel(model, context = { existingDirs: [] }) {
  const errors = [];
  const warnings = [];
  const passes = [];
  const frontmatterKeys = Object.keys(model.data);
  if (frontmatterKeys.length === 0) {
    warnings.push("YAML frontmatter is empty (description recommended for discoverability)");
  } else {
    passes.push("YAML frontmatter present and parseable");
  }
  if (!model.data.name) {
    warnings.push('No "name" in frontmatter \u2014 directory name provides the /command (name is optional except for plugin-root skills)');
  } else {
    const name = String(model.data.name);
    if (!NAME_REGEX.test(name)) {
      errors.push(`Invalid name format: "${name}" \u2014 should be kebab-case (a-z, 0-9, hyphens) for best compatibility`);
    } else if (name.length < 2 || name.length > 64) {
      errors.push(`Name length out of range: ${name.length} chars (recommended 2-64)`);
    } else {
      passes.push(`name: "${name}"`);
    }
  }
  if (!model.data.description) {
    warnings.push('Missing "description" (recommended) \u2014 helps Claude decide when to load the skill automatically');
  } else {
    passes.push("description field present");
  }
  if (!model.content.trim()) {
    errors.push("Markdown body is empty");
  } else {
    passes.push("Markdown body is non-empty");
  }
  const advanced = [];
  for (const key of frontmatterKeys) {
    if (KNOWN_FIELDS.has(key) && key !== "name" && key !== "description") {
      advanced.push(key);
    }
  }
  if (advanced.length > 0) {
    passes.push(`advanced frontmatter: ${advanced.join(", ")}`);
  }
  for (const key of frontmatterKeys) {
    if (!KNOWN_FIELDS.has(key)) {
      warnings.push(`Unknown frontmatter field: "${key}" (may be a typo or newer spec addition)`);
    }
  }
  for (const dir of SUPPORTING_DIRS) {
    if (context.existingDirs.includes(dir)) {
      passes.push(`${dir}/ directory exists`);
    }
  }
  const hasInlineInjection = /!\s*`[^`]+`/.test(model.content);
  const hasFencedInjection = /```\s*!/.test(model.content);
  if (hasInlineInjection || hasFencedInjection) {
    passes.push("uses dynamic context injection (!`...` or ```! blocks)");
  }
  const hasArgSubst = /\$ARGUMENTS|\$[0-9]|\$\{CLAUDE_/.test(model.content);
  if (hasArgSubst) {
    passes.push("uses argument / session substitutions ($ARGUMENTS, $0, ${CLAUDE_*})");
  }
  return { errors, warnings, passes };
}
var NAME_REGEX, KNOWN_FIELDS, SUPPORTING_DIRS;
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
});

// src/cli/commands/validate.ts
var exports_validate = {};
__export(exports_validate, {
  default: () => validate_default
});
import { existsSync } from "fs";
import { resolve } from "path";
var import_picocolors, OPTIONAL_DIRS, validate_default;
var init_validate = __esm(() => {
  init_dist();
  init_frontmatter();
  init_skill_validate();
  import_picocolors = __toESM(require_picocolors(), 1);
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
        console.error(`${import_picocolors.default.red("\u2717")} Path not found: ${targetPath}

Check that the path is correct and the directory exists.`);
        process.exit(1);
      }
      const skillMd = resolve(fullPath, "SKILL.md");
      if (!existsSync(skillMd)) {
        console.error(`${import_picocolors.default.red("\u2717")} No skill or plugin found at ${targetPath}

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
        console.error(`${import_picocolors.default.red("\u2717")} Failed to parse YAML frontmatter in SKILL.md

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
        console.error(`
  ${import_picocolors.default.bold("doraval skill validate")} \u2014 Structural validation
`);
        console.error(`  Path:  ${targetPath}
`);
        for (const p of passes) {
          console.error(`  ${import_picocolors.default.green("\u2713")} ${p}`);
        }
        for (const w of warnings) {
          console.error(`  ${import_picocolors.default.yellow("\u26A0")} ${w}`);
        }
        for (const e of errors) {
          console.error(`  ${import_picocolors.default.red("\u2717")} ${e}`);
        }
        console.error(`
  Result: ${errors.length} error(s), ${warnings.length} warning(s)
`);
      }
      if (errors.length > 0) {
        process.exit(1);
      }
      process.exit(0);
    }
  });
});

// src/core/skill-drift.ts
function analyzeDrift(input) {
  const drifts = [];
  const desc = input.description;
  const body = input.content;
  const hasTriggers = desc.includes("use when") || desc.includes("Use when") || desc.includes("trigger") || desc.includes("invoke");
  drifts.push({
    drifted: !hasTriggers,
    category: "Trigger",
    detail: hasTriggers ? "Description includes activation phrases" : 'No trigger phrases found \u2014 add "Use when..." to description'
  });
  const hasSteps = /^\s*\d+\.\s/m.test(body) || /^\s*[-*]\s/m.test(body);
  drifts.push({
    drifted: !hasSteps,
    category: "Structure",
    detail: hasSteps ? "Has step-by-step instructions" : "No ordered steps or checklists \u2014 agent needs a clear sequence to follow"
  });
  const hasImperative = /\b(Create|Add|Run|Install|Configure|Set|Build|Use|Check|Verify|Ensure)\b/.test(body);
  drifts.push({
    drifted: !hasImperative,
    category: "Voice",
    detail: hasImperative ? 'Uses imperative voice ("Do X" not "You might X")' : "Passive or suggestive phrasing \u2014 use direct imperatives"
  });
  const hasCode = body.includes("```");
  drifts.push({
    drifted: !hasCode,
    category: "Example",
    detail: hasCode ? "Has code examples" : "No code blocks found \u2014 add examples if the skill involves code"
  });
  const hasConstraints = /\bMUST\b/.test(body) || /\bMUST NOT\b/.test(body);
  drifts.push({
    drifted: !hasConstraints,
    category: "Guardrail",
    detail: hasConstraints ? "Has MUST/MUST NOT constraints" : "No explicit constraints \u2014 add MUST / MUST NOT guardrails"
  });
  const ambiguous = body.match(/\b(maybe|possibly|consider|you might want to|perhaps)\b/gi);
  const hasDriftedClarity = ambiguous && ambiguous.length > 0;
  drifts.push({
    drifted: !!hasDriftedClarity,
    category: "Clarity",
    detail: hasDriftedClarity ? `Ambiguous phrasing detected: ${ambiguous.slice(0, 3).join(", ")}` : "No ambiguous language found"
  });
  const driftCount = drifts.filter((d) => d.drifted).length;
  return { drifts, driftCount, total: drifts.length };
}

// src/cli/commands/drift.ts
var exports_drift = {};
__export(exports_drift, {
  default: () => drift_default
});
import { existsSync as existsSync2 } from "fs";
import { resolve as resolve2 } from "path";
var import_picocolors2, drift_default;
var init_drift = __esm(() => {
  init_dist();
  init_frontmatter();
  import_picocolors2 = __toESM(require_picocolors(), 1);
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
        console.error(`${import_picocolors2.default.red("\u2717")} No SKILL.md found at ${targetPath}`);
        process.exit(1);
      }
      const raw = await Bun.file(skillMd).text();
      let parsed;
      try {
        parsed = parseFrontmatter(raw);
      } catch {
        console.error(`${import_picocolors2.default.red("\u2717")} Failed to parse YAML frontmatter in SKILL.md`);
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
        console.error(`
  ${import_picocolors2.default.bold("doraval skill drift")} \u2014 Measuring rubric drift
`);
        console.error(`  Path:  ${targetPath}
`);
        for (const d of drifts) {
          const icon = d.drifted ? import_picocolors2.default.yellow("\u2197") : import_picocolors2.default.green("\xB7");
          const cat = d.drifted ? import_picocolors2.default.yellow(d.category.padEnd(10)) : import_picocolors2.default.dim(d.category.padEnd(10));
          console.error(`  ${icon} ${cat} ${d.detail}`);
        }
        if (driftCount === 0) {
          console.error(`
  ${import_picocolors2.default.green("No drift detected.")} Skill aligns with rubric standards.
`);
        } else {
          console.error(`
  ${import_picocolors2.default.yellow(`${driftCount}/${total}`)} rubric areas have drifted.
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
var import_picocolors3, judge_default;
var init_judge = __esm(() => {
  init_dist();
  import_picocolors3 = __toESM(require_picocolors(), 1);
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
      console.error(`
  ${import_picocolors3.default.bold("doraval skill judge")} \u2014 AI-driven assessment
`);
      console.error(`  Path:  ${args.path}
`);
      console.log(`  ${import_picocolors3.default.yellow("\u26A0")} Not yet implemented. This command will send the skill to an LLM`);
      console.log(`    for qualitative review (clarity, completeness, effectiveness).
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
function ensureGhCliOrExit() {
  if (hasGhCli())
    return;
  console.error(`  ${import_picocolors4.default.red("\u2717")} The GitHub CLI (${import_picocolors4.default.bold("gh")}) is not installed.
`);
  console.error(`  doraval uses ${import_picocolors4.default.bold("gh")} to fetch and sync journal files with GitHub.
`);
  console.error(`  Install it:
`);
  console.error(`    macOS:   ${import_picocolors4.default.dim("brew install gh")}`);
  console.error(`    Linux:   ${import_picocolors4.default.dim("https://github.com/cli/cli/blob/trunk/docs/install_linux.md")}`);
  console.error(`    Windows: ${import_picocolors4.default.dim("winget install --id GitHub.cli")}
`);
  console.error(`  Then authenticate: ${import_picocolors4.default.dim("gh auth login")}
`);
  process.exit(1);
}
function fetchRemoteJournalFile(repo, path) {
  const result = spawnSync(["gh", "api", `repos/${repo}/contents/${path}`, "--jq", "{sha, content, encoding}"], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    if (stderr.includes("404") || stderr.includes("Not Found")) {
      return null;
    }
    console.error(`Failed to fetch ${path} from ${repo}:`);
    console.error(stderr);
    process.exit(1);
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
      content: decoded,
      sha: parsed.sha
    };
  } catch {
    console.error(`Unexpected response when fetching ${path} from ${repo}`);
    process.exit(1);
  }
}
async function refreshLocalJournalFile(repo, remotePath, localPath) {
  const remote = fetchRemoteJournalFile(repo, remotePath);
  if (!remote) {
    return false;
  }
  await Bun.write(localPath, remote.content);
  return true;
}
function getRemoteJournalFileMeta(repo, path) {
  const result = spawnSync(["gh", "api", `repos/${repo}/contents/${path}`, "--jq", "{sha, content, encoding}"], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    if (stderr.includes("404") || stderr.includes("Not Found")) {
      return null;
    }
    console.error(`Failed to fetch ${path} from ${repo}:`);
    console.error(stderr);
    process.exit(1);
  }
  try {
    return JSON.parse(result.stdout.toString());
  } catch {
    console.error(`Unexpected response when fetching ${path} from ${repo}`);
    process.exit(1);
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
var import_picocolors4;
var init_journal_remote = __esm(() => {
  import_picocolors4 = __toESM(require_picocolors(), 1);
});

// src/cli/prompt.ts
function prompt(label, fallback) {
  process.stderr.write(`${label} ${import_picocolors5.default.dim(`(${fallback})`)} `);
  const buf = new Uint8Array(1024);
  const n = __require("fs").readSync(0, buf);
  const input = new TextDecoder().decode(buf.subarray(0, n)).trim();
  return input || fallback;
}
var import_picocolors5;
var init_prompt = __esm(() => {
  import_picocolors5 = __toESM(require_picocolors(), 1);
});

// src/cli/commands/journal/init.ts
var exports_init = {};
__export(exports_init, {
  default: () => init_default
});
import { basename, join as join2 } from "path";
var import_picocolors6, init_default;
var init_init = __esm(() => {
  init_dist();
  init_journal_config();
  init_journal_remote();
  init_prompt();
  import_picocolors6 = __toESM(require_picocolors(), 1);
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
      console.error(`
  ${import_picocolors6.default.bold(import_picocolors6.default.white("dora journal init"))} (or top-level ${import_picocolors6.default.dim(import_picocolors6.default.gray("dora init"))}) \u2014 Set up your journal
`);
      ensureGhCliOrExit();
      let repo = args.repo || process.env.DORAVAL_JOURNAL_REPO;
      if (!repo) {
        const gitOwner = getGitRemoteOwner();
        const ghLogin = ghUser();
        let defaultRepo;
        let sourceNote = "";
        if (gitOwner) {
          defaultRepo = `${gitOwner}/${gitOwner}.md`;
          if (ghLogin && ghLogin !== gitOwner) {
            sourceNote = `  ${import_picocolors6.default.dim("(from git remote; your active gh account is " + ghLogin + ")")}
`;
          } else {
            sourceNote = `  ${import_picocolors6.default.dim("(from git remote)")}
`;
          }
        } else if (ghLogin) {
          defaultRepo = `${ghLogin}/${ghLogin}.md`;
          sourceNote = `  ${import_picocolors6.default.dim("(from your active gh account)")}
`;
        } else {
          console.error(`  ${import_picocolors6.default.yellow("\u26A0")} Not logged in to GitHub. Run ${import_picocolors6.default.dim("gh auth login")} first.
`);
          process.exit(1);
        }
        const existingConfig = await readConfig();
        if (existingConfig?.journal.repo) {
          defaultRepo = existingConfig.journal.repo;
          sourceNote = `  ${import_picocolors6.default.dim("(from your previous journal setup)")}
`;
        }
        console.error(`  Journal repo ${import_picocolors6.default.dim(import_picocolors6.default.gray("(owner/name)"))}`);
        if (sourceNote)
          console.error(sourceNote);
        repo = prompt("  >", defaultRepo);
      }
      let project = args.project || process.env.DORAVAL_PROJECT;
      if (!project) {
        const defaultProject = basename(process.cwd());
        project = prompt("  Project name", defaultProject);
      }
      project = sanitizeProjectName(project);
      if (!repoExists(repo)) {
        console.error(`  ${import_picocolors6.default.red("\u2717")} Repository ${import_picocolors6.default.bold(import_picocolors6.default.white(repo))} not found on GitHub.
`);
        console.error(`  Create it first:
`);
        console.error(`    ${import_picocolors6.default.dim(`gh repo create ${repo} --private --description "Personal journal for agent decisions"`)}
`);
        console.error(`  The repo should be private. doraval will populate it on first ${import_picocolors6.default.dim("dora journal sync")}.
`);
        process.exit(1);
      }
      const existing = await readConfig();
      const alreadyRegistered = existing?.journal.projects[project];
      const isRefresh = alreadyRegistered && args.refresh;
      if (alreadyRegistered && !isRefresh) {
        console.error(`  ${import_picocolors6.default.yellow("\u26A0")} Project ${import_picocolors6.default.bold(import_picocolors6.default.white(project))} is already registered.
`);
        console.error(`  Repo:   ${import_picocolors6.default.gray(existing.journal.repo)}`);
        console.error(`  Remote: ${existing.journal.projects[project].remote_path}
`);
        console.error(`  To refresh local files, run: ${import_picocolors6.default.dim(import_picocolors6.default.gray(`dora journal update`))}
` + `  (init --refresh still works for compatibility.)
` + `  Or remove the project from ${import_picocolors6.default.dim(import_picocolors6.default.gray("~/.doraval/config.yml"))} to fully re-initialize.
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
      console.error(`  ${import_picocolors6.default.dim(import_picocolors6.default.gray(`${actionLabel} journal files from`))} ${import_picocolors6.default.gray(effectiveRepo)}${import_picocolors6.default.dim(import_picocolors6.default.gray("..."))}
`);
      const globalDest = join2(journalsDir, "global.md");
      const wroteGlobal = await refreshLocalJournalFile(effectiveRepo, "global.md", globalDest);
      if (wroteGlobal) {
        console.error(`  ${import_picocolors6.default.green("\u2713")} global.md`);
      } else {
        console.error(`  ${import_picocolors6.default.dim("\xB7")} global.md ${import_picocolors6.default.dim("(not found \u2014 will be created on first sync)")}`);
        await Bun.write(globalDest, `# Global Journal

Cross-project principles.
`);
      }
      const wroteProject = await refreshLocalJournalFile(effectiveRepo, remotePath, localPath);
      if (wroteProject) {
        console.error(`  ${import_picocolors6.default.green("\u2713")} ${remotePath}`);
      } else {
        console.error(`  ${import_picocolors6.default.dim("\xB7")} ${remotePath} ${import_picocolors6.default.dim("(not found \u2014 will be created on first sync)")}`);
        await Bun.write(localPath, `# ${project} Journal

Project-specific decisions.
`);
      }
      await writeConfig(config);
      console.error(`
  ${import_picocolors6.default.green("\u2713")} Project ${import_picocolors6.default.bold(import_picocolors6.default.white(project))} registered to ${import_picocolors6.default.bold(import_picocolors6.default.white(repo))}.
`);
      console.error(`  Config:   ${import_picocolors6.default.dim(import_picocolors6.default.gray("~/.doraval/config.yml"))}`);
      console.error(`  Journals: ${import_picocolors6.default.dim(import_picocolors6.default.gray("~/.doraval/journals/"))}`);
      console.error(`  Pending:  ${import_picocolors6.default.dim(import_picocolors6.default.gray("~/.doraval/pending/"))}
`);
      console.error(`  Use ${import_picocolors6.default.dim(import_picocolors6.default.gray("dora journal add"))} to propose decisions and ${import_picocolors6.default.dim(import_picocolors6.default.gray("dora journal list"))} to view them.
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
    const date = typeof meta.date === "string" ? meta.date : "";
    const status = meta.status || "active";
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
var import_picocolors7, list_default;
var init_list = __esm(() => {
  init_dist();
  init_journal_config();
  init_journal_parse();
  import_picocolors7 = __toESM(require_picocolors(), 1);
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
        console.error(`${import_picocolors7.default.yellow("\u26A0")} ${import_picocolors7.default.yellow("No project mapping found.")}

` + `Run ${import_picocolors7.default.dim(import_picocolors7.default.gray("dora init"))} (or ${import_picocolors7.default.dim(import_picocolors7.default.gray("doraval journal init"))}) first, or pass ${import_picocolors7.default.dim(import_picocolors7.default.gray("--project <name>"))}.`);
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
      console.error(`
  ${import_picocolors7.default.bold(import_picocolors7.default.white("dora journal list"))} \u2014 ${import_picocolors7.default.white(project)}  ${import_picocolors7.default.dim(import_picocolors7.default.gray(`(from ${journalRepo})`))}
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
        console.error(`  ${import_picocolors7.default.yellow("\u26A0")} ${import_picocolors7.default.yellow("Duplicate titles in this view (clean in your journal repo + update):")} ${uniqueDups.map((t) => import_picocolors7.default.yellow(`"${t}"`)).join(", ")}
`);
      }
      if (!hasStaged && !hasCommitted) {
        console.error(`  ${import_picocolors7.default.dim(import_picocolors7.default.gray("No active entries found for"))} ${import_picocolors7.default.bold(import_picocolors7.default.white(project))}.
`);
        console.error(`  Journal repo: ${import_picocolors7.default.dim(import_picocolors7.default.gray(journalRepo))}`);
        console.error(`  Local file:   ${import_picocolors7.default.dim(import_picocolors7.default.gray(projectFile))}
`);
        console.error(`  ${import_picocolors7.default.dim(import_picocolors7.default.gray("This is normal for a freshly initialized project."))}
` + `  Use ${import_picocolors7.default.dim(import_picocolors7.default.gray("dora journal add"))} to propose decisions.
` + `  They will be staged locally until you run ${import_picocolors7.default.dim(import_picocolors7.default.gray("dora journal sync"))}.
`);
        console.error(`  If you expect content, try: ${import_picocolors7.default.dim(import_picocolors7.default.gray(`dora journal update`))}
`);
        return;
      }
      function printEntry(entry) {
        const pb = entry.pushback ?? 0;
        let pbColor = import_picocolors7.default.green;
        if (pb >= 7)
          pbColor = import_picocolors7.default.red;
        else if (pb >= 4)
          pbColor = import_picocolors7.default.yellow;
        const tagsStr = (entry.tags || []).join(", ") || import_picocolors7.default.dim("(none)");
        const statusNote = entry.status !== "active" ? import_picocolors7.default.dim(` [${entry.status}]`) : "";
        const stagedNote = entry._staged ? import_picocolors7.default.dim(" (staged)") : "";
        console.error(`  ${pbColor(String(pb).padStart(2))}  ${import_picocolors7.default.bold(import_picocolors7.default.white(entry.title))}${statusNote}${stagedNote}`);
        console.error(`      ${import_picocolors7.default.dim(import_picocolors7.default.gray("tags:"))} ${import_picocolors7.default.gray(tagsStr)}`);
        const by = entry.author?.startsWith("agent:") ? import_picocolors7.default.cyan(entry.author) : entry.author || "human";
        console.error(`      ${import_picocolors7.default.dim(import_picocolors7.default.gray("by:"))} ${import_picocolors7.default.gray(by)}  ${import_picocolors7.default.dim(import_picocolors7.default.gray("on"))} ${import_picocolors7.default.gray(entry.date)}`);
        const rat = (entry.rationale || "").replace(/\s+/g, " ").trim();
        if (rat) {
          const preview = rat.length > 88 ? rat.slice(0, 85) + import_picocolors7.default.dim(import_picocolors7.default.gray("\u2026")) : rat;
          console.error(`      ${import_picocolors7.default.dim(import_picocolors7.default.gray(preview))}`);
        }
        console.error("");
      }
      if (hasStaged) {
        console.error(`  ${import_picocolors7.default.yellow("\u25CF")} ${import_picocolors7.default.bold(import_picocolors7.default.white("Staged / pending"))} (not yet in remote; run ${import_picocolors7.default.dim(import_picocolors7.default.gray("dora journal sync"))} to publish):
`);
        for (const entry of staged) {
          printEntry(entry);
        }
        if (hasCommitted)
          console.error("");
      }
      if (hasCommitted) {
        if (hasStaged) {
          console.error(`  ${import_picocolors7.default.dim(import_picocolors7.default.gray("Committed (from local cache):"))}
`);
        }
        for (const entry of allEntries) {
          printEntry(entry);
        }
      }
      const totalShown = staged.length + allEntries.length;
      console.error(`  ${import_picocolors7.default.dim(import_picocolors7.default.gray(`${totalShown} entries shown from ${journalRepo}.`))}
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
var import_picocolors8, update_default;
var init_update = __esm(() => {
  init_dist();
  init_journal_config();
  init_journal_remote();
  import_picocolors8 = __toESM(require_picocolors(), 1);
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
      ensureGhCliOrExit();
      const config = await readConfig();
      if (!config?.journal.repo) {
        console.error(`${import_picocolors8.default.red("\u2717")} No journal repo configured. Run ${import_picocolors8.default.dim("dora init")} (or ${import_picocolors8.default.dim("doraval journal init")}) first.`);
        process.exit(1);
      }
      const journalRepo = config.journal.repo;
      ensureDoravalDirs();
      const journalsDir = getJournalsDir();
      console.error(`
  ${import_picocolors8.default.bold(import_picocolors8.default.white("dora journal update"))} \u2014 ${import_picocolors8.default.dim(import_picocolors8.default.gray(journalRepo))}
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
            console.error(`${import_picocolors8.default.red("\u2717")} Invalid project name: ${project}`);
            process.exit(1);
          }
        }
      }
      const globalLocal = join4(journalsDir, "global.md");
      const gotGlobal = await refreshLocalJournalFile(journalRepo, "global.md", globalLocal);
      if (gotGlobal) {
        console.error(`  ${import_picocolors8.default.green("\u2713")} global.md`);
      } else {
        console.error(`  ${import_picocolors8.default.dim("\xB7")} global.md ${import_picocolors8.default.dim("(not present on remote)")}`);
      }
      if (projectsToUpdate.length === 0) {
        if (args.all) {
          console.error(`
  ${import_picocolors8.default.dim(import_picocolors8.default.gray("No projects registered."))}
`);
        } else {
          console.error(`
  ${import_picocolors8.default.yellow("\u26A0")} No project mapping found.
` + `  Run ${import_picocolors8.default.dim("dora init")} or pass ${import_picocolors8.default.dim("--project <name>")} / ${import_picocolors8.default.dim("--all")}.
`);
        }
        return;
      }
      for (const project of projectsToUpdate) {
        const remotePath = `projects/${project}.md`;
        const localPath = join4(journalsDir, `${project}.md`);
        const got = await refreshLocalJournalFile(journalRepo, remotePath, localPath);
        if (got) {
          console.error(`  ${import_picocolors8.default.green("\u2713")} ${remotePath}`);
        } else {
          console.error(`  ${import_picocolors8.default.dim("\xB7")} ${remotePath} ${import_picocolors8.default.dim("(not present on remote \u2014 will be created on first sync)")}`);
          if (!existsSync5(localPath)) {
            await Bun.write(localPath, `# ${project} Journal

Project-specific decisions.
`);
          }
        }
      }
      const summary = args.all && projectsToUpdate.length > 1 ? `${projectsToUpdate.length} projects + global` : projectsToUpdate.length === 1 ? projectsToUpdate[0] : "journals";
      console.error(`
  ${import_picocolors8.default.dim(import_picocolors8.default.gray("Local cache refreshed for"))} ${import_picocolors8.default.bold(import_picocolors8.default.white(summary))}.
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
  console.error(`  ${import_picocolors9.default.dim(`\u2192 ${agentCfg.command} ${shortTemplate}...`)}`);
  try {
    const result = spawnSync2([agentCfg.command, ...extraArgs], {
      stdout: "pipe",
      stderr: "pipe"
    });
    const stdout = result.stdout.toString().trim();
    const stderr = result.stderr.toString().trim();
    if (result.exitCode !== 0) {
      console.error(`${import_picocolors9.default.yellow("\u26A0")} Configured agent (${agentCfg.command}) exited with code ${result.exitCode}. Falling back to defaults.`);
      if (stderr)
        console.error(`  ${import_picocolors9.default.dim("stderr from agent:")}
${stderr.slice(0, 800)}`);
      if (stdout)
        console.error(`  ${import_picocolors9.default.dim("stdout from agent:")}
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
      console.error(`${import_picocolors9.default.yellow("\u26A0")} Agent produced output but no usable JSON object was found. Falling back.`);
      console.error(`  ${import_picocolors9.default.dim("stdout (first 700 chars):")}
${stdout.slice(0, 700)}`);
      if (stderr)
        console.error(`  ${import_picocolors9.default.dim("stderr:")}
${stderr.slice(0, 500)}`);
      return null;
    }
    if (!parsed.title && !parsed.rationale) {
      console.error(`${import_picocolors9.default.yellow("\u26A0")} Agent returned JSON, but it did not contain expected fields (title/rationale). Using defaults.`);
      console.error(`  ${import_picocolors9.default.dim("parsed top-level keys:")} ${Object.keys(parsed).join(", ")}`);
      console.error(`  ${import_picocolors9.default.dim("raw stdout (truncated):")}
${stdout.slice(0, 600)}`);
      return null;
    }
    return parsed;
  } catch (e) {
    console.error(`${import_picocolors9.default.yellow("\u26A0")} Failed to invoke configured agent (${agentCfg.command}): ${e.message}. Using defaults.`);
    return null;
  }
}
function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "untitled";
}
var import_picocolors9, add_default;
var init_add = __esm(() => {
  init_dist();
  init_journal_config();
  init_journal_validate();
  import_picocolors9 = __toESM(require_picocolors(), 1);
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
        type: "number",
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
        console.error(`${import_picocolors9.default.yellow("\u26A0")} No project mapping found.

` + `Run ${import_picocolors9.default.dim("dora init")} (or ${import_picocolors9.default.dim("doraval journal init")}) first, or pass ${import_picocolors9.default.dim("--project <name>")}.`);
        process.exit(1);
      }
      let title;
      let pushback;
      let tags = [];
      let author = args.author || "human";
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
          console.error(`${import_picocolors9.default.red("\u2717")} Failed to parse --json input: ${e.message}`);
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
          title = headingMatch[1].trim();
          rawBody = rawBody.replace(/^#+\s+(.+?)(?:\r?\n|$)/m, "").trimStart();
        } else {
          console.error(`${import_picocolors9.default.red("\u2717")} --raw-markdown provided without a TITLE and without a leading '# Heading' in the markdown.`);
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
          console.error(`  ${import_picocolors9.default.dim(import_picocolors9.default.gray("(querying your configured coding agent...)"))}`);
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
        console.error(`${import_picocolors9.default.red("\u2717")} Invalid entry:
`);
        for (const err of validation.errors) {
          console.error(`  ${import_picocolors9.default.red("\u2022")} ${err}`);
        }
        process.exit(1);
      }
      for (const warn of validation.warnings) {
        if ((warn.includes("not supplied") || warn.includes("empty")) && attemptedAgent) {} else if (warn.includes("not supplied") || warn.includes("empty")) {
          console.error(`${import_picocolors9.default.dim("\xB7")} ${warn}`);
        } else {
          console.error(`${import_picocolors9.default.yellow("\u26A0")} ${warn}`);
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
      console.error(`
  ${import_picocolors9.default.green("\u2713")} ${import_picocolors9.default.white("Entry staged successfully.")}
`);
      console.error(`  Project:  ${import_picocolors9.default.bold(import_picocolors9.default.white(project))}`);
      console.error(`  Title:    ${import_picocolors9.default.bold(import_picocolors9.default.white(title))}`);
      console.error(`  Pushback: ${import_picocolors9.default.white(String(pushback))}`);
      console.error(`  Tags:     ${import_picocolors9.default.gray(tags.join(", ") || import_picocolors9.default.dim("(none)"))}`);
      const authorDisplay = author.startsWith("agent:") ? import_picocolors9.default.cyan(author) : author;
      console.error(`  Author:   ${authorDisplay}`);
      if (author.startsWith("agent:")) {
        console.error(`            ${import_picocolors9.default.dim(import_picocolors9.default.gray("(enriched on the fly by your configured coding agent)"))}`);
      }
      console.error(`  File:     ${import_picocolors9.default.dim(import_picocolors9.default.gray(filePath))}
`);
      if (isThinInput && !author.startsWith("agent:")) {
        if (attemptedAgent) {
          console.error(`  ${import_picocolors9.default.dim(import_picocolors9.default.gray("Note:"))} Your configured agent was called but did not return a usable enrichment this time (see warning above).
` + `        The raw title + defaults were used. Edit the pending file or tweak the agent template with dora init.
`);
        } else {
          console.error(`  ${import_picocolors9.default.dim(import_picocolors9.default.gray("Tip:"))} run ${import_picocolors9.default.dim(import_picocolors9.default.gray("dora init"))} to configure a coding agent (Claude, Cursor, etc.)
` + `        so minimal adds like this get rich titles, tags, and rationales automatically.
`);
        }
      }
      console.error(`  Run ${import_picocolors9.default.dim(import_picocolors9.default.gray("dora journal sync"))} (or ${import_picocolors9.default.dim(import_picocolors9.default.gray("doraval journal sync"))}) to publish it to your journal repo.
`);
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
    console.error(import_picocolors10.default.red(`Failed to update ${path} on ${repo}:`));
    console.error(result.stderr.toString());
    process.exit(1);
  }
}
var import_picocolors10, sync_default;
var init_sync = __esm(() => {
  init_dist();
  init_journal_config();
  init_journal_remote();
  import_picocolors10 = __toESM(require_picocolors(), 1);
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
        console.error(`${import_picocolors10.default.yellow("\u26A0")} No project mapping found.

` + `Run ${import_picocolors10.default.dim("dora init")} (or ${import_picocolors10.default.dim("doraval journal init")}) first, or pass ${import_picocolors10.default.dim("--project <name>")}.`);
        process.exit(1);
      }
      if (!config?.journal.repo) {
        console.error(`${import_picocolors10.default.red("\u2717")} No journal repo configured. Run ${import_picocolors10.default.dim("dora init")} (or ${import_picocolors10.default.dim("doraval journal init")}) first.`);
        process.exit(1);
      }
      ensureGhCliOrExit();
      const journalRepo = config.journal.repo;
      const pendingDir = getPendingProjectDir(project);
      console.error(`
  ${import_picocolors10.default.bold(import_picocolors10.default.white("dora journal sync"))} \u2014 ${import_picocolors10.default.white(project)}
`);
      console.error(`  Journal repo: ${import_picocolors10.default.dim(import_picocolors10.default.gray(journalRepo))}`);
      ensureDoravalDirs();
      const journalsDir = getJournalsDir();
      const remoteProjectPath = `projects/${project}.md`;
      const localProjectPath = join6(journalsDir, `${project}.md`);
      console.error(`  ${import_picocolors10.default.dim(import_picocolors10.default.gray("Refreshing local cache from remote..."))}`);
      const gotGlobal = await refreshLocalJournalFile(journalRepo, "global.md", join6(journalsDir, "global.md"));
      if (gotGlobal) {
        console.error(`  ${import_picocolors10.default.dim(import_picocolors10.default.gray("\u2713 global.md"))}`);
      }
      const gotProjectCache = await refreshLocalJournalFile(journalRepo, remoteProjectPath, localProjectPath);
      if (gotProjectCache) {
        console.error(`  ${import_picocolors10.default.dim(import_picocolors10.default.gray(`\u2713 ${remoteProjectPath}`))}`);
      }
      const pendingFiles = existsSync7(pendingDir) ? readdirSync2(pendingDir).filter((f) => f.endsWith(".md") && f !== ".gitkeep").sort() : [];
      if (pendingFiles.length === 0) {
        console.error(`
  ${import_picocolors10.default.yellow("\u26A0")} No pending entries. Local cache is now up to date.
`);
        process.exit(0);
      }
      console.error(`  Found ${pendingFiles.length} pending entr${pendingFiles.length === 1 ? "y" : "ies"}
`);
      const remotePath = `projects/${project}.md`;
      const currentFile = getRemoteJournalFileMeta(journalRepo, remotePath);
      let existingContent = "";
      let currentSha;
      if (currentFile) {
        existingContent = Buffer.from(currentFile.content, "base64").toString("utf8");
        currentSha = currentFile.sha;
        console.error(`  ${import_picocolors10.default.dim(import_picocolors10.default.gray("Found existing remote file (sha: " + currentSha.slice(0, 7) + "...)"))}`);
      } else {
        console.error(`  ${import_picocolors10.default.dim(import_picocolors10.default.gray("No existing file on remote \u2014 will create it"))}`);
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
      console.error(`
  ${import_picocolors10.default.dim(import_picocolors10.default.gray("Pushing to remote..."))}`);
      try {
        updateGitHubFile(journalRepo, remotePath, newContent, commitMessage, currentSha);
        console.error(`  ${import_picocolors10.default.green("\u2713")} ${import_picocolors10.default.white("Successfully pushed to")} ${import_picocolors10.default.white(remotePath)}`);
      } catch (err) {
        console.error(`${import_picocolors10.default.red("\u2717")} ${import_picocolors10.default.white("Failed to push to GitHub.")}`);
        process.exit(1);
      }
      for (const file of pendingFiles) {
        const fullPath = join6(pendingDir, file);
        try {
          await Bun.file(fullPath).unlink();
        } catch {}
      }
      console.error(`  ${import_picocolors10.default.green("\u2713")} ${import_picocolors10.default.white("Cleared local pending entries")}`);
      try {
        const wrote = await refreshLocalJournalFile(journalRepo, remotePath, localProjectPath);
        if (wrote) {
          console.error(`  ${import_picocolors10.default.green("\u2713")} ${import_picocolors10.default.white("Re-fetched")} ${import_picocolors10.default.white(project)}.md ${import_picocolors10.default.white("into local cache")}`);
        }
      } catch {
        console.error(`  ${import_picocolors10.default.yellow("\u26A0")} Could not re-fetch updated file (you can run sync again later)`);
      }
      console.error(`
  ${import_picocolors10.default.green("Done!")} ${import_picocolors10.default.white(pendingFiles.length + " entr" + (pendingFiles.length === 1 ? "y" : "ies") + " published.")}
`);
      process.exit(0);
    }
  });
});

// src/validators/claude/skill.ts
import { existsSync as existsSync8 } from "fs";
import { resolve as resolve3 } from "path";
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
      return existsSync8(resolve3(dir, "SKILL.md"));
    },
    async validate(dir, _opts) {
      const skillMd = resolve3(dir, "SKILL.md");
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
      const existingDirs = OPTIONAL_DIRS2.filter((d) => existsSync8(resolve3(dir, d)));
      return validateSkillModel(parsed, { existingDirs: [...existingDirs] });
    }
  };
});

// src/validators/claude/plugin.ts
import { existsSync as existsSync9, readdirSync as readdirSync3 } from "fs";
import { resolve as resolve4, join as join7 } from "path";
var NAME_REGEX2, RELATIVE_PATH_REGEX, claudePluginValidator;
var init_plugin = __esm(() => {
  NAME_REGEX2 = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
  RELATIVE_PATH_REGEX = /^\.\//;
  claudePluginValidator = {
    id: "claude:plugin",
    provider: "claude",
    name: "Claude Plugin",
    description: "Validates .claude-plugin/plugin.json manifest, component directories, and structure",
    detect(dir) {
      return existsSync9(resolve4(dir, ".claude-plugin", "plugin.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const manifestPath = resolve4(dir, ".claude-plugin", "plugin.json");
      let manifest;
      try {
        const raw = await Bun.file(manifestPath).text();
        manifest = JSON.parse(raw);
        passes.push(".claude-plugin/plugin.json is valid JSON");
      } catch {
        errors.push(".claude-plugin/plugin.json is missing or invalid JSON");
        return { errors, warnings, passes };
      }
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
          errors.push(`Invalid version format: "${v}" \u2014 must be semver (MAJOR.MINOR.PATCH)`);
        } else {
          passes.push(`version: "${v}"`);
        }
      }
      if (manifest.description !== undefined) {
        const desc = String(manifest.description);
        if (desc.length < 10) {
          warnings.push(`Description is very short (${desc.length} chars) \u2014 50-200 chars recommended`);
        } else {
          passes.push("description field present");
        }
      }
      const checkPaths = (field, value) => {
        const paths = Array.isArray(value) ? value : [value];
        for (const p of paths) {
          const s = String(p);
          if (!RELATIVE_PATH_REGEX.test(s)) {
            errors.push(`${field}: path "${s}" must start with "./" (relative)`);
          } else if (s.includes("..")) {
            errors.push(`${field}: path "${s}" must not use ".." (no parent traversal)`);
          } else if (existsSync9(resolve4(dir, s))) {
            passes.push(`${field}: path "${s}" exists`);
          } else {
            warnings.push(`${field}: path "${s}" does not exist on disk`);
          }
        }
      };
      for (const field of ["commands", "agents", "hooks", "mcpServers"]) {
        if (manifest[field] !== undefined) {
          checkPaths(field, manifest[field]);
        }
      }
      const skillsDir = resolve4(dir, "skills");
      if (existsSync9(skillsDir)) {
        const skillEntries = readdirSync3(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
        for (const skill of skillEntries) {
          const skillMd = join7(skillsDir, skill.name, "SKILL.md");
          if (existsSync9(skillMd)) {
            passes.push(`skills/${skill.name}/SKILL.md exists`);
          } else {
            errors.push(`skills/${skill.name}/ missing SKILL.md`);
          }
        }
      }
      const commandsDir = resolve4(dir, "commands");
      if (existsSync9(commandsDir)) {
        const mdFiles = readdirSync3(commandsDir).filter((f) => f.endsWith(".md"));
        if (mdFiles.length > 0) {
          passes.push(`commands/ has ${mdFiles.length} .md file(s)`);
        } else {
          warnings.push("commands/ directory exists but has no .md files");
        }
      }
      const agentsDir = resolve4(dir, "agents");
      if (existsSync9(agentsDir)) {
        const mdFiles = readdirSync3(agentsDir).filter((f) => f.endsWith(".md"));
        if (mdFiles.length > 0) {
          passes.push(`agents/ has ${mdFiles.length} .md file(s)`);
        } else {
          warnings.push("agents/ directory exists but has no .md files");
        }
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/claude/marketplace.ts
import { existsSync as existsSync10, readdirSync as readdirSync4 } from "fs";
import { resolve as resolve5, join as join8 } from "path";
var claudeMarketplaceValidator;
var init_marketplace = __esm(() => {
  claudeMarketplaceValidator = {
    id: "claude:marketplace",
    provider: "claude",
    name: "Claude Plugin Marketplace",
    description: "Validates marketplace structure: plugins/ directory with valid plugin subdirectories",
    detect(dir) {
      const pluginsDir = resolve5(dir, "plugins");
      if (!existsSync10(pluginsDir))
        return false;
      try {
        const entries = readdirSync4(pluginsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory())
            continue;
          const hasSkills = existsSync10(join8(pluginsDir, entry.name, "skills"));
          const hasManifest = existsSync10(join8(pluginsDir, entry.name, ".claude-plugin", "plugin.json"));
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
      const pluginsDir = resolve5(dir, "plugins");
      if (!existsSync10(pluginsDir)) {
        errors.push("Missing plugins/ directory");
        return { errors, warnings, passes };
      }
      passes.push("plugins/ directory exists");
      const pluginEntries = readdirSync4(pluginsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
      if (pluginEntries.length === 0) {
        errors.push("plugins/ directory is empty \u2014 expected at least one plugin");
        return { errors, warnings, passes };
      }
      passes.push(`${pluginEntries.length} plugin(s) found`);
      if (existsSync10(resolve5(dir, "README.md"))) {
        passes.push("README.md exists at marketplace root");
      } else {
        warnings.push("No README.md at marketplace root \u2014 recommended for discoverability");
      }
      if (existsSync10(resolve5(dir, "LICENSE"))) {
        passes.push("LICENSE exists at marketplace root");
      } else {
        warnings.push("No LICENSE at marketplace root \u2014 recommended");
      }
      for (const plugin of pluginEntries) {
        const pluginPath = join8(pluginsDir, plugin.name);
        const hasSkills = existsSync10(join8(pluginPath, "skills"));
        const hasManifest = existsSync10(join8(pluginPath, ".claude-plugin", "plugin.json"));
        const hasReadme = existsSync10(join8(pluginPath, "README.md"));
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
import { existsSync as existsSync11 } from "fs";
import { resolve as resolve6 } from "path";
var KNOWN_EVENTS, claudeHooksValidator;
var init_hooks = __esm(() => {
  KNOWN_EVENTS = [
    "PreToolUse",
    "PostToolUse",
    "Stop",
    "SubagentStop",
    "SessionStart",
    "SessionEnd",
    "UserPromptSubmit",
    "PreCompact",
    "Notification",
    "PermissionRequest"
  ];
  claudeHooksValidator = {
    id: "claude:hooks",
    provider: "claude",
    name: "Claude Hooks",
    description: "Validates hooks/hooks.json: event names, matcher structure, hook types",
    detect(dir) {
      return existsSync11(resolve6(dir, "hooks", "hooks.json")) || existsSync11(resolve6(dir, "hooks.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const hooksPath = existsSync11(resolve6(dir, "hooks", "hooks.json")) ? resolve6(dir, "hooks", "hooks.json") : resolve6(dir, "hooks.json");
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
          warnings.push(`Unknown event name: "${name}" \u2014 expected one of: ${KNOWN_EVENTS.join(", ")}`);
        }
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/claude/mcp.ts
import { existsSync as existsSync12 } from "fs";
import { resolve as resolve7 } from "path";
var claudeMcpValidator;
var init_mcp = __esm(() => {
  claudeMcpValidator = {
    id: "claude:mcp",
    provider: "claude",
    name: "Claude MCP Config",
    description: "Validates .mcp.json: server definitions, required fields, path portability",
    detect(dir) {
      return existsSync12(resolve7(dir, ".mcp.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const mcpPath = resolve7(dir, ".mcp.json");
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
      return { errors, warnings, passes };
    }
  };
});

// src/validators/claude/subagent.ts
import { existsSync as existsSync13, readdirSync as readdirSync5 } from "fs";
import { resolve as resolve8, join as join9 } from "path";
var claudeSubagentValidator;
var init_subagent = __esm(() => {
  init_frontmatter();
  claudeSubagentValidator = {
    id: "claude:subagent",
    provider: "claude",
    name: "Claude Subagents",
    description: "Validates agents/ directory: .md files with frontmatter and description",
    detect(dir) {
      const agentsDir = resolve8(dir, "agents");
      if (!existsSync13(agentsDir))
        return false;
      try {
        return readdirSync5(agentsDir).some((f) => f.endsWith(".md"));
      } catch {
        return false;
      }
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const agentsDir = resolve8(dir, "agents");
      const mdFiles = readdirSync5(agentsDir).filter((f) => f.endsWith(".md"));
      if (mdFiles.length === 0) {
        errors.push("agents/ directory has no .md files");
        return { errors, warnings, passes };
      }
      passes.push(`${mdFiles.length} agent definition(s) found`);
      for (const file of mdFiles) {
        const filePath = join9(agentsDir, file);
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
        } catch {
          errors.push(`${file}: failed to parse`);
        }
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/claude/command.ts
import { existsSync as existsSync14, readdirSync as readdirSync6 } from "fs";
import { resolve as resolve9, join as join10 } from "path";
var claudeCommandValidator;
var init_command = __esm(() => {
  init_frontmatter();
  claudeCommandValidator = {
    id: "claude:command",
    provider: "claude",
    name: "Claude Commands",
    description: "Validates commands/ (or legacy .claude/commands/) .md files: frontmatter (including rich skill fields), description, body",
    detect(dir) {
      const commandsDir = resolve9(dir, "commands");
      if (!existsSync14(commandsDir))
        return false;
      try {
        return readdirSync6(commandsDir).some((f) => f.endsWith(".md"));
      } catch {
        return false;
      }
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const commandsDir = resolve9(dir, "commands");
      const mdFiles = readdirSync6(commandsDir).filter((f) => f.endsWith(".md"));
      if (mdFiles.length === 0) {
        errors.push("commands/ directory has no .md files");
        return { errors, warnings, passes };
      }
      passes.push(`${mdFiles.length} command definition(s) found`);
      for (const file of mdFiles) {
        const filePath = join10(commandsDir, file);
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
import { existsSync as existsSync15 } from "fs";
import { resolve as resolve10 } from "path";
var claudeMemoryValidator;
var init_memory = __esm(() => {
  claudeMemoryValidator = {
    id: "claude:memory",
    provider: "claude",
    name: "Claude CLAUDE.md",
    description: "Validates CLAUDE.md: non-empty, length recommendations, @path imports",
    detect(dir) {
      return existsSync15(resolve10(dir, "CLAUDE.md"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const filePath = resolve10(dir, "CLAUDE.md");
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
        const resolvedImport = resolve10(dir, importPath);
        if (existsSync15(resolvedImport)) {
          passes.push(`@import "${importPath}" exists`);
        } else {
          warnings.push(`@import "${importPath}" \u2014 file not found at ${resolvedImport}`);
        }
      }
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
  validators = [
    claudeSkillValidator,
    claudePluginValidator,
    claudeMarketplaceValidator,
    claudeHooksValidator,
    claudeMcpValidator,
    claudeSubagentValidator,
    claudeCommandValidator,
    claudeMemoryValidator
  ];
});

// src/core/remote.ts
import { spawnSync as spawnSync4 } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { join as join11 } from "path";
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
  const tmpDir = mkdtempSync(join11(tmpdir(), "dora-"));
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
import { existsSync as existsSync17 } from "fs";
import { resolve as resolve11 } from "path";
var import_picocolors11, validate_top_default;
var init_validate_top = __esm(() => {
  init_dist();
  init_validators();
  init_remote();
  import_picocolors11 = __toESM(require_picocolors(), 1);
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
        console.error(`
  Cloning ${import_picocolors11.default.dim(args.path)}...`);
        try {
          const result = await cloneToTemp(remote);
          fullPath = remote.subpath ? resolve11(result.dir, remote.subpath) : result.dir;
          cleanup = result.cleanup;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`${import_picocolors11.default.red("\u2717")} ${msg}`);
          process.exit(1);
        }
        if (!existsSync17(fullPath)) {
          cleanup();
          console.error(`${import_picocolors11.default.red("\u2717")} Subdirectory not found in repo: ${remote.subpath}`);
          process.exit(1);
        }
      } else {
        fullPath = resolve11(args.path);
        if (!existsSync17(fullPath)) {
          console.error(`${import_picocolors11.default.red("\u2717")} Path not found: ${args.path}

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
          console.error(`${import_picocolors11.default.red("\u2717")} ${error}`);
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
          console.error(`${import_picocolors11.default.red("\u2717")} No validator matched this directory: ${args.path}

` + `Available providers:
` + providers.map((p) => {
            const pvs = validators.filter((v) => v.provider === p);
            return `  ${import_picocolors11.default.bold(p)}
` + pvs.map((v) => `    \u2022 ${import_picocolors11.default.dim(v.id)} \u2014 ${v.description}`).join(`
`);
          }).join(`
`) + `

Use ${import_picocolors11.default.dim("--for <provider>")} or ${import_picocolors11.default.dim("--for <provider:type>")} to target explicitly.`);
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
            console.error(`
  ${import_picocolors11.default.bold("dora validate")} \u2014 ${name} ${import_picocolors11.default.dim(`(${id})`)}
`);
            console.error(`  Path:  ${args.path}
`);
            for (const p of result.passes) {
              console.error(`  ${import_picocolors11.default.green("\u2713")} ${p}`);
            }
            for (const w of result.warnings) {
              console.error(`  ${import_picocolors11.default.yellow("\u26A0")} ${w}`);
            }
            for (const e of result.errors) {
              console.error(`  ${import_picocolors11.default.red("\u2717")} ${e}`);
            }
            console.error(`
  Result: ${result.errors.length} error(s), ${result.warnings.length} warning(s)
`);
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
import { basename as basename2, join as join12 } from "path";
var {spawnSync: spawnSync5 } = globalThis.Bun;
var import_picocolors12, init_default2;
var init_init2 = __esm(() => {
  init_dist();
  init_journal_config();
  init_journal_remote();
  init_prompt();
  import_picocolors12 = __toESM(require_picocolors(), 1);
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
      console.error(`
  ${import_picocolors12.default.bold("dora init")} \u2014 Set up doraval, your journal, and the coding agent dora should use on the fly
`);
      ensureGhCliOrExit();
      let repo = args.repo || process.env.DORAVAL_JOURNAL_REPO;
      if (!repo) {
        const gitOwner = getGitRemoteOwner();
        const ghLogin = ghUser();
        let defaultRepo;
        let sourceNote = "";
        if (gitOwner) {
          defaultRepo = `${gitOwner}/${gitOwner}.md`;
          if (ghLogin && ghLogin !== gitOwner) {
            sourceNote = `  ${import_picocolors12.default.dim("(from git remote; your active gh account is " + ghLogin + ")")}
`;
          } else {
            sourceNote = `  ${import_picocolors12.default.dim("(from git remote)")}
`;
          }
        } else if (ghLogin) {
          defaultRepo = `${ghLogin}/${ghLogin}.md`;
          sourceNote = `  ${import_picocolors12.default.dim("(from your active gh account)")}
`;
        } else {
          console.error(`  ${import_picocolors12.default.yellow("\u26A0")} Not logged in to GitHub. Run ${import_picocolors12.default.dim("gh auth login")} first.
`);
          process.exit(1);
        }
        const existingConfig = await readConfig();
        if (existingConfig?.journal.repo) {
          defaultRepo = existingConfig.journal.repo;
          sourceNote = `  ${import_picocolors12.default.dim("(from your previous journal setup)")}
`;
        }
        console.error(`  Journal repo ${import_picocolors12.default.dim("(owner/name)")}`);
        if (sourceNote)
          console.error(sourceNote);
        repo = prompt("  >", defaultRepo);
      }
      let project = args.project || process.env.DORAVAL_PROJECT;
      if (!project) {
        const defaultProject = basename2(process.cwd());
        project = prompt("  Project name", defaultProject);
      }
      project = sanitizeProjectName(project);
      if (!repoExists(repo)) {
        console.error(`  ${import_picocolors12.default.red("\u2717")} Repository ${import_picocolors12.default.bold(repo)} not found on GitHub.
`);
        console.error(`  Create it first:
`);
        console.error(`    ${import_picocolors12.default.dim(`gh repo create ${repo} --private --description "Personal journal for agent decisions"`)}
`);
        process.exit(1);
      }
      const existing = await readConfig();
      const alreadyRegistered = existing?.journal.projects[project];
      const isRefresh = alreadyRegistered && args.refresh;
      if (alreadyRegistered && !isRefresh) {
        console.error(`  ${import_picocolors12.default.yellow("\u26A0")} Project ${import_picocolors12.default.bold(project)} is already registered.
`);
        console.error(`  Repo:   ${existing.journal.repo}
`);
        console.error(`  To refresh journal files, use ${import_picocolors12.default.dim("dora journal update")} (or ${import_picocolors12.default.dim("dora init --refresh")}).
`);
      }
      const journalsDir = getJournalsDir();
      const remotePath = `projects/${project}.md`;
      const localPath = join12(journalsDir, `${project}.md`);
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
      console.error(`  ${import_picocolors12.default.dim(import_picocolors12.default.gray("Fetching journal files from"))} ${import_picocolors12.default.gray(effectiveRepo)}${import_picocolors12.default.dim(import_picocolors12.default.gray("..."))}
`);
      const globalDest = join12(journalsDir, "global.md");
      const wroteGlobal = await refreshLocalJournalFile(effectiveRepo, "global.md", globalDest);
      if (wroteGlobal) {
        console.error(`  ${import_picocolors12.default.green("\u2713")} global.md`);
      } else {
        console.error(`  ${import_picocolors12.default.dim("\xB7")} global.md ${import_picocolors12.default.dim("(not found \u2014 will be created on first sync)")}`);
        await Bun.write(globalDest, `# Global Journal

Cross-project principles.
`);
      }
      const wroteProject = await refreshLocalJournalFile(effectiveRepo, remotePath, localPath);
      if (wroteProject) {
        console.error(`  ${import_picocolors12.default.green("\u2713")} ${remotePath}`);
      } else {
        console.error(`  ${import_picocolors12.default.dim("\xB7")} ${remotePath} ${import_picocolors12.default.dim("(not found \u2014 will be created on first sync)")}`);
        await Bun.write(localPath, `# ${project} Journal

Project-specific decisions.
`);
      }
      await writeConfig(config);
      console.error(`
  ${import_picocolors12.default.green("\u2713")} ${import_picocolors12.default.white("Journal ready for project")} ${import_picocolors12.default.bold(import_picocolors12.default.white(project))}.
`);
      const existingAgent = (await readConfig())?.agent;
      if (existingAgent?.command) {
        console.error(`  ${import_picocolors12.default.bold(import_picocolors12.default.white("Coding agent (already configured)"))}
`);
        console.error(`    Current: ${import_picocolors12.default.dim(import_picocolors12.default.gray(existingAgent.command))}  template: ${import_picocolors12.default.dim(import_picocolors12.default.gray(existingAgent.prompt_template || "(default)"))}
`);
        const change = prompt("  Reconfigure / change the coding agent for on-the-fly enrichment? (y/N)", "n");
        if (!/^y/i.test(String(change))) {
          console.error(`  ${import_picocolors12.default.dim(import_picocolors12.default.gray("Keeping existing agent config. You can re-run dora init later to change it."))}
`);
          const cfg = await readConfig() || { journal: { repo: effectiveRepo, projects: {} } };
          if (existingAgent)
            cfg.agent = existingAgent;
          await writeConfig(cfg);
          console.error(`  ${import_picocolors12.default.green("All set!")} ${import_picocolors12.default.white("Try:")} ${import_picocolors12.default.dim(import_picocolors12.default.gray('dora journal add "short decision"'))} ${import_picocolors12.default.white("(it will use the agent when input is minimal).")}
`);
          process.exit(0);
          return;
        }
        console.error("");
      } else {
        console.error(`  ${import_picocolors12.default.bold(import_picocolors12.default.white("Coding agent for on-the-fly use in journal add"))}
`);
        console.error(`  dora can use your existing coding agent (Claude Code, Cursor, etc.) behind the scenes
`);
        console.error(`  when you run ${import_picocolors12.default.dim(import_picocolors12.default.gray('dora journal add "short decision"'))} so you get rich pushback/tags/rationale (tags for decisions or notes)
`);
        console.error(`  with almost no extra typing.
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
      console.error(`  Detected / default agent command: ${import_picocolors12.default.dim(import_picocolors12.default.gray(agentCmd))}`);
      agentCmd = prompt("  Agent command (the binary you run for prompts)", agentCmd);
      let template = detected ? common.find((c) => c.name === detected)?.template || '-p "{{prompt}}" --output-format json' : '-p "{{prompt}}" --output-format json';
      console.error(`  Prompt template (use {{prompt}} placeholder):`);
      template = prompt("  ", template);
      const finalConfig = await readConfig() || { journal: { repo: effectiveRepo, projects: {} } };
      finalConfig.agent = {
        command: agentCmd,
        prompt_template: template
      };
      await writeConfig(finalConfig);
      console.error(`
  ${import_picocolors12.default.green("\u2713")} ${import_picocolors12.default.white("Agent configured. Future")} ${import_picocolors12.default.dim(import_picocolors12.default.gray('dora journal add "..."'))} ${import_picocolors12.default.white("calls will try to use it on the fly (when input is minimal).")}
`);
      console.error(`  You can re-run ${import_picocolors12.default.dim(import_picocolors12.default.gray("dora init"))} anytime to change the agent.
`);
      console.error(`  Example one-liner that will now feel magical:
`);
      console.error(`    ${import_picocolors12.default.dim(import_picocolors12.default.gray('dora journal add "We decided to use the new cache command name"'))}
`);
      console.error(`  ${import_picocolors12.default.green("All set!")} ${import_picocolors12.default.white("Next steps:")} ${import_picocolors12.default.dim(import_picocolors12.default.gray("dora journal list"))}, ${import_picocolors12.default.dim(import_picocolors12.default.gray('dora journal add "..."'))}, or ${import_picocolors12.default.dim(import_picocolors12.default.gray("dora journal update"))}.
`);
      process.exit(0);
    }
  });
});

// src/cli/index.ts
init_dist();
// package.json
var package_default = {
  name: "doraval",
  version: "0.2.6",
  author: "Saif",
  repository: {
    type: "git",
    url: "https://github.com/saif-shines/doraval.git"
  },
  devDependencies: {
    "@types/bun": "latest"
  },
  bin: {
    doraval: "./bin/doraval.js",
    dora: "./bin/doraval.js"
  },
  description: "The context engineering toolkit for coding agents",
  engines: {
    bun: ">=1.2.0"
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
    prepublish: `node -e "const p=require('./package.json'),j=require('./jsr.json');if(p.version!==j.version){console.error('Version mismatch: package.json='+p.version+' jsr.json='+j.version);process.exit(1)}"`,
    bump: "bun run scripts/bump.ts",
    publish: "bunx jsr publish",
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

// src/cli/index.ts
var import_picocolors13 = __toESM(require_picocolors(), 1);
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
    version: package_default.version,
    description: "The context engineering toolkit for coding agents"
  },
  subCommands: {
    validate: () => Promise.resolve().then(() => (init_validate_top(), exports_validate_top)).then((m) => m.default),
    init: () => Promise.resolve().then(() => (init_init2(), exports_init2)).then((m) => m.default),
    skill: () => Promise.resolve(skill),
    journal: () => Promise.resolve(journal)
  },
  run() {
    console.log(`
` + import_picocolors13.default.blue(doraemonArt) + `
`);
    showUsage(main);
  }
});
runMain(main);
