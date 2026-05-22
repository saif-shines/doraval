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

// src/cli/index.ts
init_dist();
// package.json
var package_default = {
  name: "doraval",
  version: "0.1.0",
  author: "Saif",
  repository: {
    type: "git",
    url: "https://github.com/saif-shines/doraval.git"
  },
  devDependencies: {
    "@types/bun": "latest"
  },
  bin: {
    doraval: "./bin/doraval.js"
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
var main = defineCommand({
  meta: {
    name: "doraval",
    version: package_default.version,
    description: "Validate, score, and test skills and plugins for AI coding agents"
  },
  subCommands: {
    skill: () => Promise.resolve(skill)
  },
  run() {
    showUsage(main);
  }
});
runMain(main);
