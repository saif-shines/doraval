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
  if (Object.keys(model.data).length === 0) {
    errors.push("YAML frontmatter is empty or missing");
  } else {
    passes.push("YAML frontmatter present and parseable");
  }
  if (!model.data.name) {
    errors.push('Missing required field: "name"');
  } else {
    const name = String(model.data.name);
    if (!NAME_REGEX.test(name)) {
      errors.push(`Invalid name format: "${name}" \u2014 must be kebab-case (a-z, 0-9, hyphens)`);
    } else if (name.length < 2 || name.length > 64) {
      errors.push(`Name length out of range: ${name.length} chars (must be 2-64)`);
    } else {
      passes.push(`name: "${name}"`);
    }
  }
  if (!model.data.description) {
    errors.push('Missing required field: "description"');
  } else {
    passes.push("description field present");
  }
  if (!model.content.trim()) {
    errors.push("Markdown body is empty");
  } else {
    passes.push("Markdown body is non-empty");
  }
  for (const dir of OPTIONAL_DIRS) {
    if (context.existingDirs.includes(dir)) {
      passes.push(`${dir}/ directory exists`);
    }
  }
  return { errors, warnings, passes };
}
var NAME_REGEX, OPTIONAL_DIRS;
var init_skill_validate = __esm(() => {
  NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
  OPTIONAL_DIRS = ["references", "scripts", "assets"];
});

// src/cli/commands/validate.ts
var exports_validate = {};
__export(exports_validate, {
  default: () => validate_default
});
import { existsSync } from "fs";
import { resolve } from "path";
var import_picocolors, OPTIONAL_DIRS2, validate_default;
var init_validate = __esm(() => {
  init_dist();
  init_frontmatter();
  init_skill_validate();
  import_picocolors = __toESM(require_picocolors(), 1);
  OPTIONAL_DIRS2 = ["references", "scripts", "assets"];
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
      agent: {
        type: "string",
        alias: "a",
        description: "Force a specific agent adapter"
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
  \u2022 Use --agent to force a specific adapter`);
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
      const existingDirs = OPTIONAL_DIRS2.filter((dir) => existsSync(resolve(fullPath, dir)));
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
      agent: {
        type: "string",
        alias: "a",
        description: "Force a specific agent adapter"
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
      const { drifts, driftCount, total } = analyzeDrift({
        description: desc,
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
      agent: {
        type: "string",
        alias: "a",
        description: "Force a specific agent adapter"
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
  let out = `journal:
  repo: ${config.journal.repo}
  projects:
`;
  for (const [name, mapping] of Object.entries(config.journal.projects)) {
    out += `    ${name}:
`;
    out += `      remote_path: ${mapping.remote_path}
`;
    out += `      local_path: ${mapping.local_path}
`;
  }
  return out;
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
var import_picocolors4;
var init_journal_remote = __esm(() => {
  import_picocolors4 = __toESM(require_picocolors(), 1);
});

// src/cli/commands/journal/init.ts
var exports_init = {};
__export(exports_init, {
  getGitRemoteOwner: () => getGitRemoteOwner,
  default: () => init_default
});
import { basename, join as join2 } from "path";
var {spawnSync: spawnSync2 } = globalThis.Bun;
function ghUser() {
  const result = spawnSync2(["gh", "api", "user", "--jq", ".login"], {
    stdout: "pipe",
    stderr: "pipe"
  });
  if (result.exitCode !== 0)
    return null;
  return result.stdout.toString().trim() || null;
}
function getGitRemoteOwner() {
  const result = spawnSync2(["git", "config", "--get", "remote.origin.url"], {
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
function repoExists(repo) {
  const result = spawnSync2(["gh", "api", `repos/${repo}`, "--jq", ".full_name"], { stdout: "pipe", stderr: "pipe" });
  return result.exitCode === 0 && result.stdout.toString().trim().length > 0;
}
function prompt(label, fallback) {
  process.stderr.write(`${label} ${import_picocolors5.default.dim(`(${fallback})`)} `);
  const buf = new Uint8Array(1024);
  const n = __require("fs").readSync(0, buf);
  const input = new TextDecoder().decode(buf.subarray(0, n)).trim();
  return input || fallback;
}
var import_picocolors5, init_default;
var init_init = __esm(() => {
  init_dist();
  init_journal_config();
  init_journal_remote();
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
      console.error(`
  ${import_picocolors5.default.bold("doraval journal init")} \u2014 Set up your journal
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
          console.error(`  ${import_picocolors5.default.yellow("\u26A0")} Not logged in to GitHub. Run ${import_picocolors5.default.dim("gh auth login")} first.
`);
          process.exit(1);
        }
        const existingConfig = await readConfig();
        if (existingConfig?.journal.repo) {
          defaultRepo = existingConfig.journal.repo;
          sourceNote = `  ${import_picocolors5.default.dim("(from your previous journal setup)")}
`;
        }
        console.error(`  Journal repo ${import_picocolors5.default.dim("(owner/name)")}`);
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
        console.error(`  ${import_picocolors5.default.red("\u2717")} Repository ${import_picocolors5.default.bold(repo)} not found on GitHub.
`);
        console.error(`  Create it first:
`);
        console.error(`    ${import_picocolors5.default.dim(`gh repo create ${repo} --private --description "Personal journal for agent decisions"`)}
`);
        console.error(`  The repo should be private. doraval will populate it on first ${import_picocolors5.default.dim("doraval journal sync")}.
`);
        process.exit(1);
      }
      const existing = await readConfig();
      const alreadyRegistered = existing?.journal.projects[project];
      const isRefresh = alreadyRegistered && args.refresh;
      if (alreadyRegistered && !isRefresh) {
        console.error(`  ${import_picocolors5.default.yellow("\u26A0")} Project ${import_picocolors5.default.bold(project)} is already registered.
`);
        console.error(`  Repo:   ${existing.journal.repo}`);
        console.error(`  Remote: ${existing.journal.projects[project].remote_path}
`);
        console.error(`  To refresh local files, run: ${import_picocolors5.default.dim(`doraval journal update`)}
` + `  (init --refresh still works for compatibility.)
` + `  Or remove the project from ${import_picocolors5.default.dim("~/.doraval/config.yml")} to fully re-initialize.
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
      console.error(`  ${import_picocolors5.default.dim(`${actionLabel} journal files from`)} ${effectiveRepo}${import_picocolors5.default.dim("...")}
`);
      const globalDest = join2(journalsDir, "global.md");
      const wroteGlobal = await refreshLocalJournalFile(effectiveRepo, "global.md", globalDest);
      if (wroteGlobal) {
        console.error(`  ${import_picocolors5.default.green("\u2713")} global.md`);
      } else {
        console.error(`  ${import_picocolors5.default.dim("\xB7")} global.md ${import_picocolors5.default.dim("(not found \u2014 will be created on first sync)")}`);
        await Bun.write(globalDest, `# Global Journal

Cross-project principles.
`);
      }
      const wroteProject = await refreshLocalJournalFile(effectiveRepo, remotePath, localPath);
      if (wroteProject) {
        console.error(`  ${import_picocolors5.default.green("\u2713")} ${remotePath}`);
      } else {
        console.error(`  ${import_picocolors5.default.dim("\xB7")} ${remotePath} ${import_picocolors5.default.dim("(not found \u2014 will be created on first sync)")}`);
        await Bun.write(localPath, `# ${project} Journal

Project-specific decisions.
`);
      }
      await writeConfig(config);
      console.error(`
  ${import_picocolors5.default.green("\u2713")} Project ${import_picocolors5.default.bold(project)} registered to ${import_picocolors5.default.bold(repo)}.
`);
      console.error(`  Config:   ${import_picocolors5.default.dim("~/.doraval/config.yml")}`);
      console.error(`  Journals: ${import_picocolors5.default.dim("~/.doraval/journals/")}`);
      console.error(`  Pending:  ${import_picocolors5.default.dim("~/.doraval/pending/")}
`);
      console.error(`  Use ${import_picocolors5.default.dim("doraval journal add")} to propose decisions and ${import_picocolors5.default.dim("doraval journal list")} to view them.
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
    const scope = Array.isArray(meta.scope) ? meta.scope : [];
    const author = typeof meta.author === "string" ? meta.author : "human";
    const date = typeof meta.date === "string" ? meta.date : "";
    const status = meta.status || "active";
    const superseded_by = typeof meta.superseded_by === "string" ? meta.superseded_by : undefined;
    entries.push({
      title,
      pushback: isNaN(pushback) ? 0 : pushback,
      scope,
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
import { join as join3 } from "path";
var import_picocolors6, list_default;
var init_list = __esm(() => {
  init_dist();
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
        console.error(`${import_picocolors6.default.yellow("\u26A0")} No project mapping found.

` + `Run ${import_picocolors6.default.dim("doraval journal init")} first, or pass ${import_picocolors6.default.dim("--project <name>")}.`);
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
        console.error(`${import_picocolors6.default.yellow("\u26A0")} Could not find journal file for project "${project}".
` + `Expected: ${import_picocolors6.default.dim(projectFile)}
` + `Journal repo: ${import_picocolors6.default.dim(journalRepo)}

` + `Run ${import_picocolors6.default.dim("doraval journal update")} (or ${import_picocolors6.default.dim("doraval journal init --refresh")}) to fetch it.`);
        process.exit(1);
      }
      let allEntries = parseJournalEntries(raw);
      if (!args.all) {
        allEntries = allEntries.filter((e) => e.status === "active");
      }
      if (args.format === "json") {
        console.log(JSON.stringify({ project, entries: allEntries }, null, 2));
        return;
      }
      console.error(`
  ${import_picocolors6.default.bold("doraval journal list")} \u2014 ${project}  ${import_picocolors6.default.dim(`(from ${journalRepo})`)}
`);
      if (allEntries.length === 0) {
        console.error(`  ${import_picocolors6.default.dim("No active entries found for")} ${import_picocolors6.default.bold(project)}.
`);
        console.error(`  Journal repo: ${import_picocolors6.default.dim(journalRepo)}`);
        console.error(`  Local file:   ${import_picocolors6.default.dim(projectFile)}
`);
        console.error(`  ${import_picocolors6.default.dim("This is normal for a freshly initialized project.")}
` + `  Use ${import_picocolors6.default.dim("doraval journal add")} to propose decisions.
` + `  They will be staged locally until you run ${import_picocolors6.default.dim("doraval journal sync")}.
`);
        console.error(`  If you expect content, try: ${import_picocolors6.default.dim(`doraval journal update`)}
`);
        return;
      }
      for (const entry of allEntries) {
        const pb = entry.pushback;
        let pbColor = import_picocolors6.default.green;
        if (pb >= 7)
          pbColor = import_picocolors6.default.red;
        else if (pb >= 4)
          pbColor = import_picocolors6.default.yellow;
        const scopeStr = entry.scope.join(", ");
        const statusNote = entry.status !== "active" ? import_picocolors6.default.dim(` [${entry.status}]`) : "";
        console.error(`  ${pbColor(String(pb).padStart(2))}  ${import_picocolors6.default.bold(entry.title)}${statusNote}`);
        console.error(`      ${import_picocolors6.default.dim("scope:")} ${scopeStr}`);
        console.error(`      ${import_picocolors6.default.dim("by:")} ${entry.author}  ${import_picocolors6.default.dim("on")} ${entry.date}
`);
      }
      console.error(`  ${import_picocolors6.default.dim(`${allEntries.length} entries shown from ${journalRepo}.`)}
`);
    }
  });
});

// src/cli/commands/journal/update.ts
var exports_update = {};
__export(exports_update, {
  default: () => update_default
});
import { existsSync as existsSync4 } from "fs";
import { join as join4 } from "path";
var import_picocolors7, update_default;
var init_update = __esm(() => {
  init_dist();
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
      ensureGhCliOrExit();
      const config = await readConfig();
      if (!config?.journal.repo) {
        console.error(`${import_picocolors7.default.red("\u2717")} No journal repo configured. Run ${import_picocolors7.default.dim("doraval journal init")} first.`);
        process.exit(1);
      }
      const journalRepo = config.journal.repo;
      ensureDoravalDirs();
      const journalsDir = getJournalsDir();
      console.error(`
  ${import_picocolors7.default.bold("doraval journal update")} \u2014 ${import_picocolors7.default.dim(journalRepo)}
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
            console.error(`${import_picocolors7.default.red("\u2717")} Invalid project name: ${project}`);
            process.exit(1);
          }
        }
      }
      const globalLocal = join4(journalsDir, "global.md");
      const gotGlobal = await refreshLocalJournalFile(journalRepo, "global.md", globalLocal);
      if (gotGlobal) {
        console.error(`  ${import_picocolors7.default.green("\u2713")} global.md`);
      } else {
        console.error(`  ${import_picocolors7.default.dim("\xB7")} global.md ${import_picocolors7.default.dim("(not present on remote)")}`);
      }
      if (projectsToUpdate.length === 0) {
        if (args.all) {
          console.error(`
  ${import_picocolors7.default.dim("No projects registered.")}
`);
        } else {
          console.error(`
  ${import_picocolors7.default.yellow("\u26A0")} No project mapping found.
` + `  Run ${import_picocolors7.default.dim("doraval journal init")} or pass ${import_picocolors7.default.dim("--project <name>")} / ${import_picocolors7.default.dim("--all")}.
`);
        }
        return;
      }
      for (const project of projectsToUpdate) {
        const remotePath = `projects/${project}.md`;
        const localPath = join4(journalsDir, `${project}.md`);
        const got = await refreshLocalJournalFile(journalRepo, remotePath, localPath);
        if (got) {
          console.error(`  ${import_picocolors7.default.green("\u2713")} ${remotePath}`);
        } else {
          console.error(`  ${import_picocolors7.default.dim("\xB7")} ${remotePath} ${import_picocolors7.default.dim("(not present on remote \u2014 will be created on first sync)")}`);
          if (!existsSync4(localPath)) {
            await Bun.write(localPath, `# ${project} Journal

Project-specific decisions.
`);
          }
        }
      }
      const summary = args.all && projectsToUpdate.length > 1 ? `${projectsToUpdate.length} projects + global` : projectsToUpdate.length === 1 ? projectsToUpdate[0] : "journals";
      console.error(`
  ${import_picocolors7.default.dim("Local cache refreshed for")} ${import_picocolors7.default.bold(summary)}.
`);
    }
  });
});

// src/core/journal-validate.ts
function validateEntry(entry) {
  const errors = [];
  const warnings = [];
  if (entry.pushback === undefined || entry.pushback === null) {
    errors.push("pushback is required");
  } else {
    const pb = Number(entry.pushback);
    if (!Number.isInteger(pb) || pb < 1 || pb > 10) {
      errors.push("pushback must be an integer between 1 and 10");
    }
  }
  if (!entry.scope || !Array.isArray(entry.scope) || entry.scope.length === 0) {
    errors.push("scope is required and must be a non-empty array");
  } else {
    const invalidScopes = entry.scope.filter((s) => !CANONICAL_SCOPES.includes(s));
    if (invalidScopes.length > 0) {
      warnings.push(`scope contains non-canonical tags: ${invalidScopes.join(", ")} (valid: ${CANONICAL_SCOPES.join(", ")})`);
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
var CANONICAL_SCOPES, VALID_STATUSES;
var init_journal_validate = __esm(() => {
  CANONICAL_SCOPES = [
    "naming",
    "cli",
    "architecture",
    "testing",
    "ux",
    "api",
    "docs"
  ];
  VALID_STATUSES = ["active", "superseded", "retired"];
});

// src/cli/commands/journal/add.ts
var exports_add = {};
__export(exports_add, {
  default: () => add_default
});
import { existsSync as existsSync5 } from "fs";
import { join as join5 } from "path";
var {spawnSync: spawnSync3 } = globalThis.Bun;
function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "untitled";
}
async function openEditor(initialContent) {
  const editor = process.env.EDITOR || process.env.VISUAL || "vi";
  const tmpDir = process.env.TMPDIR || "/tmp";
  const tmpFile = join5(tmpDir, `doraval-journal-${Date.now()}.md`);
  await Bun.write(tmpFile, initialContent);
  const result = spawnSync3([editor, tmpFile], {
    stdio: ["inherit", "inherit", "inherit"]
  });
  if (result.exitCode !== 0) {
    console.error(import_picocolors8.default.red("Editor exited with error. Aborting."));
    process.exit(1);
  }
  const content = await Bun.file(tmpFile).text();
  try {
    await Bun.file(tmpFile).unlink();
  } catch {}
  return content;
}
var import_picocolors8, add_default;
var init_add = __esm(() => {
  init_dist();
  init_journal_config();
  init_journal_validate();
  import_picocolors8 = __toESM(require_picocolors(), 1);
  add_default = defineCommand({
    meta: {
      name: "add",
      description: "Propose a new decision / principle for the journal"
    },
    args: {
      title: {
        type: "positional",
        description: "Title of the decision or principle",
        required: true
      },
      pushback: {
        type: "number",
        alias: "b",
        description: "Pushback intensity (1-10)",
        required: true
      },
      scope: {
        type: "string",
        alias: "s",
        description: "Comma-separated scope tags (e.g. naming,cli,architecture)",
        required: true
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
        description: "Rationale / explanation. If omitted, opens $EDITOR."
      },
      project: {
        type: "string",
        alias: "p",
        description: "Project name (defaults to directory mapping)"
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
        console.error(`${import_picocolors8.default.yellow("\u26A0")} No project mapping found.

` + `Run ${import_picocolors8.default.dim("doraval journal init")} first, or pass ${import_picocolors8.default.dim("--project <name>")}.`);
        process.exit(1);
      }
      const title = args.title.trim();
      const pushback = Number(args.pushback);
      const scope = args.scope.split(",").map((s) => s.trim()).filter(Boolean);
      const author = args.author;
      const status = args.status;
      const entry = {
        title,
        pushback,
        scope,
        author,
        date: new Date().toISOString().split("T")[0],
        status
      };
      const validation = validateEntry(entry);
      if (!validation.valid) {
        console.error(`${import_picocolors8.default.red("\u2717")} Invalid entry:
`);
        for (const err of validation.errors) {
          console.error(`  ${import_picocolors8.default.red("\u2022")} ${err}`);
        }
        process.exit(1);
      }
      for (const warn of validation.warnings) {
        console.error(`${import_picocolors8.default.yellow("\u26A0")} ${warn}`);
      }
      let rationale = args.rationale?.trim();
      if (!rationale) {
        const skeleton = `# ${title}

\`\`\`yaml
pushback: ${pushback}
scope: [${scope.join(", ")}]
author: ${author}
date: ${entry.date}
status: ${status}
\`\`\`

# Write your rationale / explanation below this line.
# You can use multiple paragraphs, lists, code blocks, etc.
`;
        if (process.stdout.isTTY) {
          console.error(`
  Opening editor for rationale... (save & exit when done)
`);
          const full = await openEditor(skeleton);
          rationale = full.replace(skeleton, "").trim();
        } else {
          console.error(`${import_picocolors8.default.red("\u2717")} --rationale is required when not running interactively.
` + `You can also pipe rationale via stdin in a future version.`);
          process.exit(1);
        }
      }
      if (!rationale) {
        console.error(`${import_picocolors8.default.red("\u2717")} Rationale cannot be empty.`);
        process.exit(1);
      }
      const content = `## ${title}

\`\`\`yaml
pushback: ${pushback}
scope: [${scope.join(", ")}]
author: ${author}
date: ${entry.date}
status: ${status}
\`\`\`

${rationale}
`;
      ensureDoravalDirs();
      const pendingDir = getPendingProjectDir(project);
      if (!existsSync5(pendingDir)) {
        Bun.write(join5(pendingDir, ".gitkeep"), "");
      }
      const date = entry.date;
      const slug = slugify(title);
      const filename = `${date}-${slug}.md`;
      const filePath = join5(pendingDir, filename);
      await Bun.write(filePath, content);
      console.error(`
  ${import_picocolors8.default.green("\u2713")} Entry staged successfully.
`);
      console.error(`  Project:  ${import_picocolors8.default.bold(project)}`);
      console.error(`  Title:    ${import_picocolors8.default.bold(title)}`);
      console.error(`  Pushback: ${pushback}`);
      console.error(`  Scope:    ${scope.join(", ")}`);
      console.error(`  File:     ${import_picocolors8.default.dim(filePath)}
`);
      console.error(`  Run ${import_picocolors8.default.dim("doraval journal sync")} to publish it to your journal repo.
`);
    }
  });
});

// src/cli/commands/journal/sync.ts
var exports_sync = {};
__export(exports_sync, {
  default: () => sync_default
});
import { readdirSync, existsSync as existsSync6 } from "fs";
import { join as join6 } from "path";
var {spawnSync: spawnSync4 } = globalThis.Bun;
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
  const result = spawnSync4(args, {
    stdout: "pipe",
    stderr: "pipe"
  });
  if (result.exitCode !== 0) {
    console.error(import_picocolors9.default.red(`Failed to update ${path} on ${repo}:`));
    console.error(result.stderr.toString());
    process.exit(1);
  }
}
var import_picocolors9, sync_default;
var init_sync = __esm(() => {
  init_dist();
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

` + `Run ${import_picocolors9.default.dim("doraval journal init")} first, or pass ${import_picocolors9.default.dim("--project <name>")}.`);
        process.exit(1);
      }
      if (!config?.journal.repo) {
        console.error(`${import_picocolors9.default.red("\u2717")} No journal repo configured. Run ${import_picocolors9.default.dim("doraval journal init")} first.`);
        process.exit(1);
      }
      ensureGhCliOrExit();
      const journalRepo = config.journal.repo;
      const pendingDir = getPendingProjectDir(project);
      console.error(`
  ${import_picocolors9.default.bold("doraval journal sync")} \u2014 ${project}
`);
      console.error(`  Journal repo: ${import_picocolors9.default.dim(journalRepo)}`);
      ensureDoravalDirs();
      const journalsDir = getJournalsDir();
      const remoteProjectPath = `projects/${project}.md`;
      const localProjectPath = join6(journalsDir, `${project}.md`);
      console.error(`  ${import_picocolors9.default.dim("Refreshing local cache from remote...")}`);
      const gotGlobal = await refreshLocalJournalFile(journalRepo, "global.md", join6(journalsDir, "global.md"));
      if (gotGlobal) {
        console.error(`  ${import_picocolors9.default.dim("\u2713 global.md")}`);
      }
      const gotProjectCache = await refreshLocalJournalFile(journalRepo, remoteProjectPath, localProjectPath);
      if (gotProjectCache) {
        console.error(`  ${import_picocolors9.default.dim(`\u2713 ${remoteProjectPath}`)}`);
      }
      const pendingFiles = existsSync6(pendingDir) ? readdirSync(pendingDir).filter((f) => f.endsWith(".md") && f !== ".gitkeep").sort() : [];
      if (pendingFiles.length === 0) {
        console.error(`
  ${import_picocolors9.default.yellow("\u26A0")} No pending entries. Local cache is now up to date.
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
        console.error(`  ${import_picocolors9.default.dim("Found existing remote file (sha: " + currentSha.slice(0, 7) + "...)")}`);
      } else {
        console.error(`  ${import_picocolors9.default.dim("No existing file on remote \u2014 will create it")}`);
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
  ${import_picocolors9.default.dim("Pushing to remote...")}`);
      try {
        updateGitHubFile(journalRepo, remotePath, newContent, commitMessage, currentSha);
        console.error(`  ${import_picocolors9.default.green("\u2713")} Successfully pushed to ${remotePath}`);
      } catch (err) {
        console.error(`${import_picocolors9.default.red("\u2717")} Failed to push to GitHub.`);
        process.exit(1);
      }
      for (const file of pendingFiles) {
        const fullPath = join6(pendingDir, file);
        try {
          await Bun.file(fullPath).unlink();
        } catch {}
      }
      console.error(`  ${import_picocolors9.default.green("\u2713")} Cleared local pending entries`);
      try {
        const wrote = await refreshLocalJournalFile(journalRepo, remotePath, localProjectPath);
        if (wrote) {
          console.error(`  ${import_picocolors9.default.green("\u2713")} Re-fetched ${project}.md into local cache`);
        }
      } catch {
        console.error(`  ${import_picocolors9.default.yellow("\u26A0")} Could not re-fetch updated file (you can run sync again later)`);
      }
      console.error(`
  ${import_picocolors9.default.green("Done!")} ${pendingFiles.length} entr${pendingFiles.length === 1 ? "y" : "ies"} published.
`);
    }
  });
});

// src/cli/index.ts
init_dist();
// package.json
var package_default = {
  name: "doraval",
  version: "0.1.10",
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
  description: "Validate, score, and test skills and plugins for AI coding agents",
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
    publish: "bun run build && bunx jsr publish",
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
var import_picocolors10 = __toESM(require_picocolors(), 1);
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
    description: "Decision memory with pushback \u2014 record, view, and sync project principles"
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
    description: "Validate, score, and test skills and plugins for AI coding agents"
  },
  subCommands: {
    skill: () => Promise.resolve(skill),
    journal: () => Promise.resolve(journal)
  },
  run() {
    console.log(`
` + import_picocolors10.default.blue(doraemonArt) + `
`);
    showUsage(main);
  }
});
runMain(main);
