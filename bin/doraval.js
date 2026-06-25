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
    version: "0.2.74",
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
    description: "Scale your AI context for coding agents. Make your next context work (skills, plugins & more) for your team, community, or self. Context engineering toolkit for AI coding agents.",
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
      build: "bun build ./src/cli/index.ts --outfile ./bin/doraval.js --target bun && rm -rf bin/ui && cp -r src/ui bin/ui",
      dev: "bun run ./src/cli/index.ts",
      test: "bun test",
      typecheck: "bunx tsc --noEmit --skipLibCheck",
      prepublishOnly: `bun run build && node -e "const p=require('./package.json'),j=require('./jsr.json');if(p.version!==j.version){console.error('Version mismatch: package.json='+p.version+' jsr.json='+j.version);process.exit(1)}"`,
      bump: "bun run scripts/bump.ts",
      release: "bun run scripts/release.ts",
      "test:judge-api": "bun run scripts/test-judge-api.ts",
      "test:invoke-judge": "bun run scripts/test-invoke-judge.ts",
      "jsr:publish": "bunx jsr publish",
      "site:dev": "cd apps/website && bun run dev",
      "site:build": "cd apps/website && bun run build",
      "site:preview": "cd apps/website && bun run preview"
    },
    type: "module",
    dependencies: {
      citty: "^0.2.2",
      openai: "^6.44.0",
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
function renderCheck(status, text) {
  return `  ${statusIcon(status)}  ${text}`;
}
function renderChecksTable(checks, opts = {}) {
  if (opts.header && checks.length > 0) {
    write(`  ${import_picocolors.default.dim("Status")}  ${import_picocolors.default.dim("Check")}`);
  }
  for (const c of checks) {
    const t = typeof c.text === "string" ? c.text : c.text.text;
    write(renderCheck(c.status, t));
  }
}
function nextAction2(s) {
  write(`
  ${import_picocolors.default.white("Next:")} ${import_picocolors.default.dim(s)}`);
}
function guidedError(opts) {
  ui.fail(`Error: ${opts.problem}`);
  ui.info(`  Context: ${opts.context}`);
  ui.info(`  Solutions:`);
  for (const s of opts.solutions) {
    ui.info(`    \u2022 ${s}`);
  }
  if (opts.next) {
    nextAction2(opts.next);
  } else {
    write("");
  }
}
function summaryLine(s) {
  write(`  ${import_picocolors.default.dim(s)}`);
}
function renderValidationReport(allResults, opts) {
  const totalErrors = allResults.reduce((n, r) => n + r.result.errors.length, 0);
  const totalWarnings = allResults.reduce((n, r) => n + r.result.warnings.length, 0);
  const totalPasses = allResults.reduce((n, r) => n + r.result.passes.length, 0);
  ui.heading(`dora validate \u2014 ${allResults.length} validator(s)`);
  ui.info(`  Path:  ${opts.path}`);
  summaryLine(`${allResults.length} validators \u2022 ${totalErrors} errors \u2022 ${totalWarnings} warnings
`);
  for (const { id, name, result } of allResults) {
    ui.write(`  ${import_picocolors.default.bold(name)} ${import_picocolors.default.dim(`(${id})`)}`);
    const checks = [];
    for (const e of result.errors) {
      const item = typeof e === "string" ? { text: e } : e;
      const txt = item.code ? `${item.text} (${item.code})` : item.text;
      const full = item.hint ? `${txt} \u2014 ${item.hint}` : txt;
      checks.push({ status: "fail", text: full });
    }
    for (const w of result.warnings) {
      const item = typeof w === "string" ? { text: w } : w;
      const full = item.hint ? `${item.text} \u2014 ${item.hint}` : item.text;
      checks.push({ status: "warn", text: full });
    }
    for (const p of result.passes) {
      const item = typeof p === "string" ? { text: p } : p;
      checks.push({ status: "pass", text: item.text });
    }
    const useHeader = checks.length > 2 || !!opts.verbose;
    renderChecksTable(checks, { header: useHeader });
    if (result.errors.length === 0 && result.warnings.length === 0) {
      ui.write(`  ${import_picocolors.default.green("\u2713")} ${import_picocolors.default.white("All checks passed.")}
`);
    } else {
      ui.info(`  Result: ${result.errors.length} error(s), ${result.warnings.length} warning(s)
`);
    }
  }
  if (totalErrors === 0 && totalWarnings === 0) {
    nextAction2(`dora skill drift ${opts.path}   or   dora journal add "..."`);
  } else if (totalErrors > 0) {
    nextAction2(`dora validate ${opts.path} --verbose`);
  } else {
    nextAction2(`dora validate ${opts.path} --for claude`);
  }
}
var import_picocolors, ui, statusIcon = (s) => s === "pass" || s === "ok" ? import_picocolors.default.green("\u2713") : s === "warn" ? import_picocolors.default.yellow("\u26A0") : import_picocolors.default.red("\u2717");
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
import { existsSync } from "fs";
import { resolve } from "path";
async function loadSkill(dir) {
  const skillMd = resolve(dir, "SKILL.md");
  if (!existsSync(skillMd)) {
    return { ok: false, error: "No SKILL.md found" };
  }
  const raw = await Bun.file(skillMd).text();
  let parsed;
  try {
    parsed = parseFrontmatter(raw);
  } catch {
    return { ok: false, error: "Failed to parse YAML frontmatter in SKILL.md" };
  }
  const existingDirs = OPTIONAL_DIRS.filter((d) => existsSync(resolve(dir, d)));
  return { ok: true, model: parsed, existingDirs };
}
function checkFrontmatterPresence(model, _ctx) {
  const keys = Object.keys(model.data);
  if (keys.length === 0) {
    return { warnings: [{ text: "YAML frontmatter is empty (description recommended for discoverability)" }] };
  }
  return { passes: [{ text: "YAML frontmatter present and parseable" }] };
}
function checkName(model, _ctx) {
  if (!model.data.name) {
    return { warnings: [{ text: 'No "name" in frontmatter \u2014 directory name provides the /command (name is optional except for plugin-root skills)' }] };
  }
  const name = String(model.data.name);
  if (!NAME_REGEX.test(name)) {
    return { errors: [{ text: `Invalid name format: "${name}" \u2014 should be kebab-case (a-z, 0-9, hyphens) for best compatibility` }] };
  }
  if (name.length < 2 || name.length > 64) {
    return { errors: [{ text: `Name length out of range: ${name.length} chars (recommended 2-64)` }] };
  }
  return { passes: [{ text: `name: "${name}"` }] };
}
function checkDescription(model, _ctx) {
  if (!model.data.description) {
    return { warnings: [{ text: 'Missing "description" (recommended) \u2014 helps Claude decide when to load the skill automatically' }] };
  }
  return { passes: [{ text: "description field present" }] };
}
function checkBody(model, _ctx) {
  if (!model.content.trim()) {
    return { errors: [{ text: "Markdown body is empty" }] };
  }
  return { passes: [{ text: "Markdown body is non-empty" }] };
}
function checkAdvancedFields(model, _ctx) {
  const advanced = Object.keys(model.data).filter((k) => KNOWN_FIELDS.has(k) && k !== "name" && k !== "description");
  if (advanced.length > 0) {
    return { passes: [{ text: `advanced frontmatter: ${advanced.join(", ")}` }] };
  }
  return {};
}
function checkUnknownFields(model, _ctx) {
  const warnings = Object.keys(model.data).filter((k) => !KNOWN_FIELDS.has(k)).map((k) => ({ text: `Unknown frontmatter field: "${k}" (may be a typo or newer spec addition)` }));
  return { warnings };
}
function checkSupportingDirs(_model, ctx) {
  const passes = SUPPORTING_DIRS.filter((dir) => ctx.existingDirs.includes(dir)).map((dir) => ({ text: `${dir}/ directory exists` }));
  return { passes };
}
function checkDynamicInjection(model, _ctx) {
  const passes = [];
  if (/!\s*`[^`]+`/.test(model.content) || /```\s*!/.test(model.content)) {
    passes.push({ text: "uses dynamic context injection (!`...` or ```! blocks)" });
  }
  if (/\$ARGUMENTS|\$[0-9]|\$\{CLAUDE_/.test(model.content)) {
    passes.push({ text: "uses argument / session substitutions ($ARGUMENTS, $0, ${CLAUDE_*})" });
  }
  return { passes };
}
function validateSkillModel(model, context = { existingDirs: [] }) {
  return checks.reduce((acc, check) => merge(acc, check(model, context)), EMPTY);
}
async function loadSkillFromDir(dir) {
  const skillMd = resolve(dir, "SKILL.md");
  if (!existsSync(skillMd)) {
    return { ok: false, error: "No SKILL.md found" };
  }
  const raw = await Bun.file(skillMd).text();
  let parsed;
  try {
    parsed = parseFrontmatter(raw);
  } catch {
    return { ok: false, error: "frontmatter-parse-error" };
  }
  const existingDirs = SUPPORTING_DIRS.filter((d) => existsSync(resolve(dir, d)));
  return { ok: true, model: { data: parsed.data, content: parsed.content }, existingDirs };
}
var merge = (a, b) => ({
  errors: [...a.errors, ...b.errors ?? []],
  warnings: [...a.warnings, ...b.warnings ?? []],
  passes: [...a.passes, ...b.passes ?? []]
}), NAME_REGEX, KNOWN_FIELDS, SUPPORTING_DIRS, OPTIONAL_DIRS, EMPTY, checks;
var init_skill_validate = __esm(() => {
  init_frontmatter();
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
    "shell",
    "expected-eval"
  ]);
  SUPPORTING_DIRS = ["references", "scripts", "assets", "examples"];
  OPTIONAL_DIRS = ["references", "scripts", "assets"];
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
import { existsSync as existsSync2 } from "fs";
import { resolve as resolve2 } from "path";
var validate_default;
var init_validate = __esm(() => {
  init_dist();
  init_out();
  init_skill_validate();
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
      const fullPath = resolve2(targetPath);
      if (!existsSync2(fullPath)) {
        ui.fail(`Error (E-VAL-001): Path not found: ${targetPath}`);
        ui.info("  Check that the path is correct and the directory exists.");
        nextAction("dora skill validate .");
        process.exit(1);
      }
      const loaded = await loadSkillFromDir(fullPath);
      if (!loaded.ok) {
        if (loaded.error === "No SKILL.md found") {
          ui.fail(`Error (E-VAL-002): No skill or plugin found at ${targetPath}`);
          ui.info(`  Searched for:
` + `    \u2022 SKILL.md (Agent Skills spec)
` + "    \u2022 .claude-plugin/plugin.json (Claude Code plugin)");
          ui.info(`  Solutions:
` + `    \u2022 dora skill validate <correct-path>
` + "    \u2022 Use --for to target a specific validator");
        } else {
          guidedError({
            context: "SKILL.md must start with valid YAML frontmatter (--- ... ---).",
            problem: "Failed to parse YAML frontmatter in SKILL.md",
            solutions: [
              "Fix the YAML syntax at the top of SKILL.md",
              "dora skill validate <path> --verbose for details"
            ]
          });
        }
        process.exit(1);
      }
      const { model: parsed, existingDirs } = loaded;
      const { errors, warnings, passes } = validateSkillModel(parsed, {
        existingDirs: [...existingDirs]
      });
      if (args.format === "json") {
        const result = { path: targetPath, errors, warnings, passes };
        console.log(JSON.stringify(result, null, 2));
      } else {
        const wrappedResult = {
          id: "skill",
          name: "Structural validation",
          result: { errors, warnings, passes }
        };
        renderValidationReport([wrappedResult], { path: targetPath, verbose: !!args.verbose });
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
import { resolve as resolve3 } from "path";
var import_picocolors2, drift_default;
var init_drift = __esm(() => {
  init_dist();
  init_out();
  init_skill_validate();
  init_skill_drift();
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
      const fullPath = resolve3(targetPath);
      const loaded = await loadSkillFromDir(fullPath);
      if (!loaded.ok) {
        if (loaded.error === "No SKILL.md found") {
          ui.fail(`No SKILL.md found at ${targetPath}

Check that the path points to a skill directory containing SKILL.md.`);
        } else {
          ui.fail("Failed to parse YAML frontmatter in SKILL.md");
        }
        process.exit(1);
      }
      const { model: parsed } = loaded;
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
          const icon = d.drifted ? import_picocolors2.default.yellow("\u2197") : import_picocolors2.default.green("\xB7");
          const cat = d.drifted ? import_picocolors2.default.yellow(d.category.padEnd(10)) : import_picocolors2.default.dim(d.category.padEnd(10));
          ui.write(`  ${icon} ${cat} ${import_picocolors2.default.white(d.detail)}`);
        }
        if (driftCount === 0) {
          ui.write(`
  ${import_picocolors2.default.green("No drift detected.")} ${import_picocolors2.default.white("Skill aligns with rubric standards.")}
`);
        } else {
          ui.write(`
  ${import_picocolors2.default.yellow(`${driftCount}/${total}`)} ${import_picocolors2.default.white("rubric areas have drifted.")}
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

// src/core/session-parse.ts
function extractUserText(message) {
  if (typeof message === "string")
    return message.trim() || null;
  if (Array.isArray(message)) {
    for (const block of message) {
      if (block && typeof block === "object" && block.type === "text") {
        const text = block.text;
        if (typeof text === "string" && text.trim())
          return text.trim();
      }
    }
  }
  return null;
}
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
function parseSession(jsonlText) {
  const lines = jsonlText.split(`
`).filter((l) => l.trim());
  const messages = [];
  for (const line of lines) {
    const parsed = safeJsonParse(line);
    if (parsed)
      messages.push(parsed);
  }
  let sessionId = "";
  let sessionTitle;
  let model = "unknown";
  let agent = "claude-code";
  let cwd = "";
  let gitBranch;
  let durationMs;
  const toolCalls = [];
  const userMessages = [];
  let toolIndex = 0;
  const skillsFromTranscript = new Set;
  for (const msg of messages) {
    if (!sessionId && typeof msg.sessionId === "string")
      sessionId = msg.sessionId;
    if (!cwd && typeof msg.cwd === "string")
      cwd = msg.cwd;
    if (!gitBranch && typeof msg.gitBranch === "string")
      gitBranch = msg.gitBranch;
    if (typeof msg.attributionSkill === "string" && msg.attributionSkill.trim()) {
      skillsFromTranscript.add(msg.attributionSkill.trim());
    }
    const raw = JSON.stringify(msg);
    const cmdMatch = raw.match(/<command-name>([^<]+)<\/command-name>/i);
    if (cmdMatch) {
      let name = cmdMatch[1].trim();
      if (name.startsWith("/"))
        name = name.slice(1);
      if (name)
        skillsFromTranscript.add(name);
    }
    if (msg.type === "attachment") {
      const att = msg.attachment;
      if (att && att.type === "hook_additional_context") {
        const content = Array.isArray(att.content) ? att.content.join(`
`) : typeof att.content === "string" ? att.content : "";
        const hookSkillMatch = content.match(/full content of your '([^']+)' skill/i);
        if (hookSkillMatch) {
          skillsFromTranscript.add(hookSkillMatch[1].trim());
        }
      }
    }
    if (msg.type === "ai-title") {
      sessionTitle = typeof msg.aiTitle === "string" ? msg.aiTitle : undefined;
    }
    if (msg.type === "system") {
      if (typeof msg.durationMs === "number")
        durationMs = msg.durationMs;
    }
    if (msg.type === "assistant") {
      const message = msg.message;
      if (!message)
        continue;
      if (typeof message.model === "string" && message.model !== "<synthetic>") {
        model = message.model;
        agent = typeof msg.entrypoint === "string" ? msg.entrypoint === "cli" ? "claude-code" : msg.entrypoint : "claude-code";
      }
      const content = Array.isArray(message.content) ? message.content : [];
      for (const block of content) {
        if (!block || typeof block !== "object")
          continue;
        const b = block;
        if (b.type === "tool_use" && typeof b.name === "string") {
          const input = b.input ?? {};
          toolCalls.push({
            name: b.name,
            input,
            timestamp: typeof msg.timestamp === "string" ? msg.timestamp : "",
            index: toolIndex++
          });
        }
      }
    }
    if (msg.type === "user") {
      const isAttachment = typeof msg.attachment !== "undefined";
      if (isAttachment)
        continue;
      const message = msg.message;
      if (!message)
        continue;
      const text = extractUserText(message.content);
      if (text)
        userMessages.push(text);
    }
  }
  const legacySkills = toolCalls.filter((t) => t.name === "Skill").map((t) => typeof t.input.skill === "string" ? t.input.skill : "").filter(Boolean);
  const modernSkills = Array.from(skillsFromTranscript);
  const skillsInvoked = [...new Set([...legacySkills, ...modernSkills])];
  const toolCallCounts = {};
  for (const t of toolCalls) {
    toolCallCounts[t.name] = (toolCallCounts[t.name] ?? 0) + 1;
  }
  return {
    sessionId,
    sessionTitle,
    model,
    agent,
    cwd,
    gitBranch,
    toolCalls,
    toolCallCounts,
    skillsInvoked,
    userMessages,
    userTurnCount: userMessages.length,
    durationMs
  };
}
function truncateToolCalls(calls, maxCalls) {
  if (calls.length <= maxCalls)
    return calls;
  const skillCalls = calls.filter((c) => c.name === "Skill");
  const nonSkillCalls = calls.filter((c) => c.name !== "Skill");
  const budget = Math.max(0, maxCalls - skillCalls.length);
  if (budget === 0)
    return skillCalls;
  const head = nonSkillCalls.slice(0, Math.ceil(budget / 2));
  const tail = nonSkillCalls.slice(-Math.floor(budget / 2));
  const headSet = new Set(head.map((c) => c.index));
  const tailSet = new Set(tail.map((c) => c.index));
  const selected = new Set([...headSet, ...tailSet, ...skillCalls.map((c) => c.index)]);
  return calls.filter((c) => selected.has(c.index));
}
function sanitizeSessionId(raw) {
  if (!raw || typeof raw !== "string") {
    return `unknown-${Date.now()}`;
  }
  let sanitized = raw.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^[-_]+|[-_]+$/g, "").slice(0, 64);
  if (!sanitized || sanitized === "." || sanitized === ".." || sanitized.includes("..")) {
    return `unknown-${Date.now()}`;
  }
  return sanitized;
}

// src/core/session-adapters.ts
import { existsSync as existsSync3, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
function cwdToProjectHash(cwd) {
  return cwd.replace(/\//g, "-");
}
function getAdapter() {
  return ADAPTERS.find((a) => a.detect()) ?? null;
}
var claudeCodeAdapter, grokAdapter, ADAPTERS;
var init_session_adapters = __esm(() => {
  claudeCodeAdapter = {
    agent: "claude-code",
    detect() {
      return existsSync3(join(homedir(), ".claude"));
    },
    findLatestSession(cwd) {
      const hash = cwdToProjectHash(cwd);
      const dir = join(homedir(), ".claude", "projects", hash);
      if (!existsSync3(dir))
        return null;
      const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => ({ name: f, path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.mtime - a.mtime);
      for (const file of files) {
        const content = readFileSync(file.path, "utf8");
        if (content.includes('"type":"assistant"') || content.includes('"type": "assistant"')) {
          return file.path;
        }
      }
      return files[0]?.path ?? null;
    },
    listRecentSessions(cwd, limit = 10) {
      const hash = cwdToProjectHash(cwd);
      const dir = join(homedir(), ".claude", "projects", hash);
      if (!existsSync3(dir))
        return [];
      const allFiles = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => ({ name: f, path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.mtime - a.mtime);
      const results = [];
      for (const file of allFiles) {
        try {
          const text = readFileSync(file.path, "utf8");
          if (!text.includes('"type":"assistant"') && !text.includes('"type": "assistant"')) {
            continue;
          }
          const prim = parseSession(text);
          results.push({
            path: file.path,
            mtime: file.mtime,
            title: prim.sessionTitle,
            skillCount: prim.skillsInvoked.length
          });
          if (results.length >= limit)
            break;
        } catch {}
      }
      return results;
    },
    parse(path) {
      const text = readFileSync(path, "utf8");
      return parseSession(text);
    }
  };
  grokAdapter = {
    agent: "grok",
    detect() {
      try {
        const { homedir: homedir2 } = __require("os");
        const { existsSync: existsSync4 } = __require("fs");
        const { join: join2 } = __require("path");
        return existsSync4(join2(homedir2(), ".grok", "sessions"));
      } catch {
        return false;
      }
    },
    findLatestSession(cwd) {
      try {
        const { homedir: homedir2 } = __require("os");
        const { existsSync: existsSync4, readdirSync: readdirSync2, statSync: statSync2 } = __require("fs");
        const { join: join2 } = __require("path");
        const encoded = cwd.replace(/\//g, "%2F");
        const base = join2(homedir2(), ".grok", "sessions", encoded);
        if (!existsSync4(base))
          return null;
        const subs = readdirSync2(base).filter((d) => !d.startsWith("."));
        if (subs.length === 0)
          return null;
        subs.sort((a, b) => {
          const ma = statSync2(join2(base, a)).mtimeMs;
          const mb = statSync2(join2(base, b)).mtimeMs;
          return mb - ma;
        });
        const latest = subs[0];
        const updates = join2(base, latest, "updates.jsonl");
        if (existsSync4(updates))
          return updates;
        const termDir = join2(base, latest, "terminal");
        if (existsSync4(termDir)) {
          const logs = readdirSync2(termDir).filter((f) => f.endsWith(".log"));
          if (logs.length)
            return join2(termDir, logs[0]);
        }
        return null;
      } catch {
        return null;
      }
    },
    listRecentSessions(cwd, limit = 10) {
      const res = [];
      try {
        const { homedir: homedir2 } = __require("os");
        const { existsSync: existsSync4, readdirSync: readdirSync2, statSync: statSync2 } = __require("fs");
        const { join: join2 } = __require("path");
        const encoded = cwd.replace(/\//g, "%2F");
        const base = join2(homedir2(), ".grok", "sessions", encoded);
        if (!existsSync4(base))
          return [];
        const subs = readdirSync2(base).filter((d) => !d.startsWith("."));
        subs.sort((a, b) => {
          const ma = statSync2(join2(base, a)).mtimeMs;
          const mb = statSync2(join2(base, b)).mtimeMs;
          return mb - ma;
        });
        for (const sub of subs.slice(0, limit)) {
          const updates = join2(base, sub, "updates.jsonl");
          if (existsSync4(updates)) {
            res.push({ path: updates, mtime: statSync2(updates).mtimeMs, title: sub, skillCount: 0 });
          }
        }
      } catch {}
      return res;
    },
    parse(path) {
      const text = readFileSync(path, "utf8");
      if (path.endsWith("updates.jsonl")) {
        const lines = text.split(`
`).filter((l) => l.trim());
        const toolCalls = [];
        const userMessages = [];
        let idx = 0;
        for (const line of lines) {
          const j = safeJsonParse(line);
          if (!j)
            continue;
          const u = j.params?.update || {};
          if (u.sessionUpdate === "user_message_chunk" && u.content?.text) {
            userMessages.push(u.content.text);
          }
          if (u.sessionUpdate === "tool_call" && u.title) {
            toolCalls.push({
              name: u.title,
              input: u.input || u.args || {},
              timestamp: new Date((j.timestamp || 0) * 1000).toISOString(),
              index: idx++
            });
          }
        }
        const counts = {};
        for (const t of toolCalls)
          counts[t.name] = (counts[t.name] || 0) + 1;
        return {
          sessionId: path.split("/").pop()?.replace(".jsonl", "") || "grok",
          model: "grok",
          agent: "grok",
          cwd: process.cwd(),
          toolCalls,
          toolCallCounts: counts,
          skillsInvoked: [],
          userMessages: userMessages.slice(0, 5),
          userTurnCount: userMessages.length
        };
      }
      return {
        sessionId: "grok-" + Date.now(),
        model: "grok",
        agent: "grok",
        cwd: process.cwd(),
        toolCalls: [{ name: "GrokResponse", input: { content: text.slice(0, 3000) }, timestamp: "", index: 0 }],
        toolCallCounts: { GrokResponse: 1 },
        skillsInvoked: [],
        userMessages: [text.slice(0, 200)],
        userTurnCount: 1
      };
    }
  };
  ADAPTERS = [claudeCodeAdapter, grokAdapter];
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/tslib.mjs
function __classPrivateFieldSet(receiver, state, value, kind, f) {
  if (kind === "m")
    throw new TypeError("Private method is not writable");
  if (kind === "a" && !f)
    throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
    throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
function __classPrivateFieldGet(receiver, state, kind, f) {
  if (kind === "a" && !f)
    throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
    throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}
var init_tslib = () => {};

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/utils/uuid.mjs
var uuid4 = function() {
  const { crypto: crypto2 } = globalThis;
  if (crypto2?.randomUUID) {
    uuid4 = crypto2.randomUUID.bind(crypto2);
    return crypto2.randomUUID();
  }
  const u8 = new Uint8Array(1);
  const randomByte = crypto2 ? () => crypto2.getRandomValues(u8)[0] : () => Math.random() * 255 & 255;
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ randomByte() & 15 >> +c / 4).toString(16));
};

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/errors.mjs
function isAbortError(err) {
  return typeof err === "object" && err !== null && (("name" in err) && err.name === "AbortError" || ("message" in err) && String(err.message).includes("FetchRequestCanceledException"));
}
var castToError = (err) => {
  if (err instanceof Error)
    return err;
  if (typeof err === "object" && err !== null) {
    try {
      if (Object.prototype.toString.call(err) === "[object Error]") {
        const error = new Error(err.message, err.cause ? { cause: err.cause } : {});
        if (err.stack)
          error.stack = err.stack;
        if (err.cause && !error.cause)
          error.cause = err.cause;
        if (err.name)
          error.name = err.name;
        return error;
      }
    } catch {}
    try {
      return new Error(JSON.stringify(err));
    } catch {}
  }
  return new Error(err);
};

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/core/error.mjs
var OpenAIError, APIError, APIUserAbortError, APIConnectionError, APIConnectionTimeoutError, BadRequestError, AuthenticationError, PermissionDeniedError, NotFoundError, ConflictError, UnprocessableEntityError, RateLimitError, InternalServerError, LengthFinishReasonError, ContentFilterFinishReasonError, InvalidWebhookSignatureError, OAuthError, SubjectTokenProviderError;
var init_error = __esm(() => {
  OpenAIError = class OpenAIError extends Error {
  };
  APIError = class APIError extends OpenAIError {
    constructor(status, error, message, headers) {
      super(`${APIError.makeMessage(status, error, message)}`);
      this.status = status;
      this.headers = headers;
      this.requestID = headers?.get("x-request-id");
      this.error = error;
      const data = error;
      this.code = data?.["code"];
      this.param = data?.["param"];
      this.type = data?.["type"];
    }
    static makeMessage(status, error, message) {
      const msg = error?.message ? typeof error.message === "string" ? error.message : JSON.stringify(error.message) : error ? JSON.stringify(error) : message;
      if (status && msg) {
        return `${status} ${msg}`;
      }
      if (status) {
        return `${status} status code (no body)`;
      }
      if (msg) {
        return msg;
      }
      return "(no status code or body)";
    }
    static generate(status, errorResponse, message, headers) {
      if (!status || !headers) {
        return new APIConnectionError({ message, cause: castToError(errorResponse) });
      }
      const error = errorResponse?.["error"];
      if (status === 400) {
        return new BadRequestError(status, error, message, headers);
      }
      if (status === 401) {
        return new AuthenticationError(status, error, message, headers);
      }
      if (status === 403) {
        return new PermissionDeniedError(status, error, message, headers);
      }
      if (status === 404) {
        return new NotFoundError(status, error, message, headers);
      }
      if (status === 409) {
        return new ConflictError(status, error, message, headers);
      }
      if (status === 422) {
        return new UnprocessableEntityError(status, error, message, headers);
      }
      if (status === 429) {
        return new RateLimitError(status, error, message, headers);
      }
      if (status >= 500) {
        return new InternalServerError(status, error, message, headers);
      }
      return new APIError(status, error, message, headers);
    }
  };
  APIUserAbortError = class APIUserAbortError extends APIError {
    constructor({ message } = {}) {
      super(undefined, undefined, message || "Request was aborted.", undefined);
    }
  };
  APIConnectionError = class APIConnectionError extends APIError {
    constructor({ message, cause }) {
      super(undefined, undefined, message || "Connection error.", undefined);
      if (cause)
        this.cause = cause;
    }
  };
  APIConnectionTimeoutError = class APIConnectionTimeoutError extends APIConnectionError {
    constructor({ message } = {}) {
      super({ message: message ?? "Request timed out." });
    }
  };
  BadRequestError = class BadRequestError extends APIError {
  };
  AuthenticationError = class AuthenticationError extends APIError {
  };
  PermissionDeniedError = class PermissionDeniedError extends APIError {
  };
  NotFoundError = class NotFoundError extends APIError {
  };
  ConflictError = class ConflictError extends APIError {
  };
  UnprocessableEntityError = class UnprocessableEntityError extends APIError {
  };
  RateLimitError = class RateLimitError extends APIError {
  };
  InternalServerError = class InternalServerError extends APIError {
  };
  LengthFinishReasonError = class LengthFinishReasonError extends OpenAIError {
    constructor() {
      super(`Could not parse response content as the length limit was reached`);
    }
  };
  ContentFilterFinishReasonError = class ContentFilterFinishReasonError extends OpenAIError {
    constructor() {
      super(`Could not parse response content as the request was rejected by the content filter`);
    }
  };
  InvalidWebhookSignatureError = class InvalidWebhookSignatureError extends Error {
    constructor(message) {
      super(message);
    }
  };
  OAuthError = class OAuthError extends APIError {
    constructor(status, error, headers) {
      let finalMessage = "OAuth2 authentication error";
      let error_code = undefined;
      if (error && typeof error === "object") {
        const errorData = error;
        error_code = errorData["error"];
        const description = errorData["error_description"];
        if (description && typeof description === "string") {
          finalMessage = description;
        } else if (error_code) {
          finalMessage = error_code;
        }
      }
      super(status, error, finalMessage, headers);
      this.error_code = error_code;
    }
  };
  SubjectTokenProviderError = class SubjectTokenProviderError extends OpenAIError {
    constructor(message, provider, cause) {
      super(message);
      this.provider = provider;
      this.cause = cause;
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/utils/values.mjs
function maybeObj(x) {
  if (typeof x !== "object") {
    return {};
  }
  return x ?? {};
}
function isEmptyObj(obj) {
  if (!obj)
    return true;
  for (const _k in obj)
    return false;
  return true;
}
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
function isObj(obj) {
  return obj != null && typeof obj === "object" && !Array.isArray(obj);
}
var startsWithSchemeRegexp, isAbsoluteURL = (url) => {
  return startsWithSchemeRegexp.test(url);
}, isArray = (val) => (isArray = Array.isArray, isArray(val)), isReadonlyArray, validatePositiveInteger = (name, n) => {
  if (typeof n !== "number" || !Number.isInteger(n)) {
    throw new OpenAIError(`${name} must be an integer`);
  }
  if (n < 0) {
    throw new OpenAIError(`${name} must be a positive integer`);
  }
  return n;
}, safeJSON = (text) => {
  try {
    return JSON.parse(text);
  } catch (err) {
    return;
  }
};
var init_values = __esm(() => {
  init_error();
  startsWithSchemeRegexp = /^[a-z][a-z0-9+.-]*:/i;
  isReadonlyArray = isArray;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/utils/sleep.mjs
var sleep = (ms) => new Promise((resolve4) => setTimeout(resolve4, ms));

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/version.mjs
var VERSION = "6.44.0";

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/detect-platform.mjs
function getDetectedPlatform() {
  if (typeof Deno !== "undefined" && Deno.build != null) {
    return "deno";
  }
  if (typeof EdgeRuntime !== "undefined") {
    return "edge";
  }
  if (Object.prototype.toString.call(typeof globalThis.process !== "undefined" ? globalThis.process : 0) === "[object process]") {
    return "node";
  }
  return "unknown";
}
function getBrowserInfo() {
  if (typeof navigator === "undefined" || !navigator) {
    return null;
  }
  const browserPatterns = [
    { key: "edge", pattern: /Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "chrome", pattern: /Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "firefox", pattern: /Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "safari", pattern: /(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/ }
  ];
  for (const { key, pattern } of browserPatterns) {
    const match = pattern.exec(navigator.userAgent);
    if (match) {
      const major = match[1] || 0;
      const minor = match[2] || 0;
      const patch = match[3] || 0;
      return { browser: key, version: `${major}.${minor}.${patch}` };
    }
  }
  return null;
}
var isRunningInBrowser = () => {
  return typeof window !== "undefined" && typeof window.document !== "undefined" && typeof navigator !== "undefined";
}, getPlatformProperties = () => {
  const detectedPlatform = getDetectedPlatform();
  if (detectedPlatform === "deno") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": normalizePlatform(Deno.build.os),
      "X-Stainless-Arch": normalizeArch(Deno.build.arch),
      "X-Stainless-Runtime": "deno",
      "X-Stainless-Runtime-Version": typeof Deno.version === "string" ? Deno.version : Deno.version?.deno ?? "unknown"
    };
  }
  if (typeof EdgeRuntime !== "undefined") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": `other:${EdgeRuntime}`,
      "X-Stainless-Runtime": "edge",
      "X-Stainless-Runtime-Version": globalThis.process.version
    };
  }
  if (detectedPlatform === "node") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": normalizePlatform(globalThis.process.platform ?? "unknown"),
      "X-Stainless-Arch": normalizeArch(globalThis.process.arch ?? "unknown"),
      "X-Stainless-Runtime": "node",
      "X-Stainless-Runtime-Version": globalThis.process.version ?? "unknown"
    };
  }
  const browserInfo = getBrowserInfo();
  if (browserInfo) {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": "unknown",
      "X-Stainless-Runtime": `browser:${browserInfo.browser}`,
      "X-Stainless-Runtime-Version": browserInfo.version
    };
  }
  return {
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": VERSION,
    "X-Stainless-OS": "Unknown",
    "X-Stainless-Arch": "unknown",
    "X-Stainless-Runtime": "unknown",
    "X-Stainless-Runtime-Version": "unknown"
  };
}, normalizeArch = (arch) => {
  if (arch === "x32")
    return "x32";
  if (arch === "x86_64" || arch === "x64")
    return "x64";
  if (arch === "arm")
    return "arm";
  if (arch === "aarch64" || arch === "arm64")
    return "arm64";
  if (arch)
    return `other:${arch}`;
  return "unknown";
}, normalizePlatform = (platform) => {
  platform = platform.toLowerCase();
  if (platform.includes("ios"))
    return "iOS";
  if (platform === "android")
    return "Android";
  if (platform === "darwin")
    return "MacOS";
  if (platform === "win32")
    return "Windows";
  if (platform === "freebsd")
    return "FreeBSD";
  if (platform === "openbsd")
    return "OpenBSD";
  if (platform === "linux")
    return "Linux";
  if (platform)
    return `Other:${platform}`;
  return "Unknown";
}, _platformHeaders, getPlatformHeaders = () => {
  return _platformHeaders ?? (_platformHeaders = getPlatformProperties());
};
var init_detect_platform = () => {};

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/shims.mjs
function getDefaultFetch() {
  if (typeof fetch !== "undefined") {
    return fetch;
  }
  throw new Error("`fetch` is not defined as a global; Either pass `fetch` to the client, `new OpenAI({ fetch })` or polyfill the global, `globalThis.fetch = fetch`");
}
function makeReadableStream(...args) {
  const ReadableStream = globalThis.ReadableStream;
  if (typeof ReadableStream === "undefined") {
    throw new Error("`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`");
  }
  return new ReadableStream(...args);
}
function ReadableStreamFrom(iterable) {
  let iter = Symbol.asyncIterator in iterable ? iterable[Symbol.asyncIterator]() : iterable[Symbol.iterator]();
  return makeReadableStream({
    start() {},
    async pull(controller) {
      const { done, value } = await iter.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    async cancel() {
      await iter.return?.();
    }
  });
}
function ReadableStreamToAsyncIterable(stream) {
  if (stream[Symbol.asyncIterator])
    return stream;
  const reader = stream.getReader();
  return {
    async next() {
      try {
        const result = await reader.read();
        if (result?.done)
          reader.releaseLock();
        return result;
      } catch (e) {
        reader.releaseLock();
        throw e;
      }
    },
    async return() {
      const cancelPromise = reader.cancel();
      reader.releaseLock();
      await cancelPromise;
      return { done: true, value: undefined };
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
async function CancelReadableStream(stream) {
  if (stream === null || typeof stream !== "object")
    return;
  if (stream[Symbol.asyncIterator]) {
    await stream[Symbol.asyncIterator]().return?.();
    return;
  }
  const reader = stream.getReader();
  const cancelPromise = reader.cancel();
  reader.releaseLock();
  await cancelPromise;
}

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/request-options.mjs
var FallbackEncoder = ({ headers, body }) => {
  return {
    bodyHeaders: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
};

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/qs/formats.mjs
var default_format = "RFC3986", default_formatter = (v) => String(v), formatters, RFC1738 = "RFC1738";
var init_formats = __esm(() => {
  formatters = {
    RFC1738: (v) => String(v).replace(/%20/g, "+"),
    RFC3986: default_formatter
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/qs/utils.mjs
function is_buffer(obj) {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  return !!(obj.constructor && obj.constructor.isBuffer && obj.constructor.isBuffer(obj));
}
function maybe_map(val, fn) {
  if (isArray(val)) {
    const mapped = [];
    for (let i = 0;i < val.length; i += 1) {
      mapped.push(fn(val[i]));
    }
    return mapped;
  }
  return fn(val);
}
var has = (obj, key) => (has = Object.hasOwn ?? Function.prototype.call.bind(Object.prototype.hasOwnProperty), has(obj, key)), hex_table, limit = 1024, encode = (str, _defaultEncoder, charset, _kind, format) => {
  if (str.length === 0) {
    return str;
  }
  let string = str;
  if (typeof str === "symbol") {
    string = Symbol.prototype.toString.call(str);
  } else if (typeof str !== "string") {
    string = String(str);
  }
  if (charset === "iso-8859-1") {
    return escape(string).replace(/%u[0-9a-f]{4}/gi, function($0) {
      return "%26%23" + parseInt($0.slice(2), 16) + "%3B";
    });
  }
  let out = "";
  for (let j = 0;j < string.length; j += limit) {
    const segment = string.length >= limit ? string.slice(j, j + limit) : string;
    const arr = [];
    for (let i = 0;i < segment.length; ++i) {
      let c = segment.charCodeAt(i);
      if (c === 45 || c === 46 || c === 95 || c === 126 || c >= 48 && c <= 57 || c >= 65 && c <= 90 || c >= 97 && c <= 122 || format === RFC1738 && (c === 40 || c === 41)) {
        arr[arr.length] = segment.charAt(i);
        continue;
      }
      if (c < 128) {
        arr[arr.length] = hex_table[c];
        continue;
      }
      if (c < 2048) {
        arr[arr.length] = hex_table[192 | c >> 6] + hex_table[128 | c & 63];
        continue;
      }
      if (c < 55296 || c >= 57344) {
        arr[arr.length] = hex_table[224 | c >> 12] + hex_table[128 | c >> 6 & 63] + hex_table[128 | c & 63];
        continue;
      }
      i += 1;
      c = 65536 + ((c & 1023) << 10 | segment.charCodeAt(i) & 1023);
      arr[arr.length] = hex_table[240 | c >> 18] + hex_table[128 | c >> 12 & 63] + hex_table[128 | c >> 6 & 63] + hex_table[128 | c & 63];
    }
    out += arr.join("");
  }
  return out;
};
var init_utils = __esm(() => {
  init_formats();
  init_values();
  hex_table = /* @__PURE__ */ (() => {
    const array = [];
    for (let i = 0;i < 256; ++i) {
      array.push("%" + ((i < 16 ? "0" : "") + i.toString(16)).toUpperCase());
    }
    return array;
  })();
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/qs/stringify.mjs
function is_non_nullish_primitive(v) {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean" || typeof v === "symbol" || typeof v === "bigint";
}
function inner_stringify(object, prefix, generateArrayPrefix, commaRoundTrip, allowEmptyArrays, strictNullHandling, skipNulls, encodeDotInKeys, encoder, filter, sort, allowDots, serializeDate, format, formatter, encodeValuesOnly, charset, sideChannel) {
  let obj = object;
  let tmp_sc = sideChannel;
  let step = 0;
  let find_flag = false;
  while ((tmp_sc = tmp_sc.get(sentinel)) !== undefined && !find_flag) {
    const pos = tmp_sc.get(object);
    step += 1;
    if (typeof pos !== "undefined") {
      if (pos === step) {
        throw new RangeError("Cyclic object value");
      } else {
        find_flag = true;
      }
    }
    if (typeof tmp_sc.get(sentinel) === "undefined") {
      step = 0;
    }
  }
  if (typeof filter === "function") {
    obj = filter(prefix, obj);
  } else if (obj instanceof Date) {
    obj = serializeDate?.(obj);
  } else if (generateArrayPrefix === "comma" && isArray(obj)) {
    obj = maybe_map(obj, function(value) {
      if (value instanceof Date) {
        return serializeDate?.(value);
      }
      return value;
    });
  }
  if (obj === null) {
    if (strictNullHandling) {
      return encoder && !encodeValuesOnly ? encoder(prefix, defaults.encoder, charset, "key", format) : prefix;
    }
    obj = "";
  }
  if (is_non_nullish_primitive(obj) || is_buffer(obj)) {
    if (encoder) {
      const key_value = encodeValuesOnly ? prefix : encoder(prefix, defaults.encoder, charset, "key", format);
      return [
        formatter?.(key_value) + "=" + formatter?.(encoder(obj, defaults.encoder, charset, "value", format))
      ];
    }
    return [formatter?.(prefix) + "=" + formatter?.(String(obj))];
  }
  const values = [];
  if (typeof obj === "undefined") {
    return values;
  }
  let obj_keys;
  if (generateArrayPrefix === "comma" && isArray(obj)) {
    if (encodeValuesOnly && encoder) {
      obj = maybe_map(obj, encoder);
    }
    obj_keys = [{ value: obj.length > 0 ? obj.join(",") || null : undefined }];
  } else if (isArray(filter)) {
    obj_keys = filter;
  } else {
    const keys = Object.keys(obj);
    obj_keys = sort ? keys.sort(sort) : keys;
  }
  const encoded_prefix = encodeDotInKeys ? String(prefix).replace(/\./g, "%2E") : String(prefix);
  const adjusted_prefix = commaRoundTrip && isArray(obj) && obj.length === 1 ? encoded_prefix + "[]" : encoded_prefix;
  if (allowEmptyArrays && isArray(obj) && obj.length === 0) {
    return adjusted_prefix + "[]";
  }
  for (let j = 0;j < obj_keys.length; ++j) {
    const key = obj_keys[j];
    const value = typeof key === "object" && typeof key.value !== "undefined" ? key.value : obj[key];
    if (skipNulls && value === null) {
      continue;
    }
    const encoded_key = allowDots && encodeDotInKeys ? key.replace(/\./g, "%2E") : key;
    const key_prefix = isArray(obj) ? typeof generateArrayPrefix === "function" ? generateArrayPrefix(adjusted_prefix, encoded_key) : adjusted_prefix : adjusted_prefix + (allowDots ? "." + encoded_key : "[" + encoded_key + "]");
    sideChannel.set(object, step);
    const valueSideChannel = new WeakMap;
    valueSideChannel.set(sentinel, sideChannel);
    push_to_array(values, inner_stringify(value, key_prefix, generateArrayPrefix, commaRoundTrip, allowEmptyArrays, strictNullHandling, skipNulls, encodeDotInKeys, generateArrayPrefix === "comma" && encodeValuesOnly && isArray(obj) ? null : encoder, filter, sort, allowDots, serializeDate, format, formatter, encodeValuesOnly, charset, valueSideChannel));
  }
  return values;
}
function normalize_stringify_options(opts = defaults) {
  if (typeof opts.allowEmptyArrays !== "undefined" && typeof opts.allowEmptyArrays !== "boolean") {
    throw new TypeError("`allowEmptyArrays` option can only be `true` or `false`, when provided");
  }
  if (typeof opts.encodeDotInKeys !== "undefined" && typeof opts.encodeDotInKeys !== "boolean") {
    throw new TypeError("`encodeDotInKeys` option can only be `true` or `false`, when provided");
  }
  if (opts.encoder !== null && typeof opts.encoder !== "undefined" && typeof opts.encoder !== "function") {
    throw new TypeError("Encoder has to be a function.");
  }
  const charset = opts.charset || defaults.charset;
  if (typeof opts.charset !== "undefined" && opts.charset !== "utf-8" && opts.charset !== "iso-8859-1") {
    throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");
  }
  let format = default_format;
  if (typeof opts.format !== "undefined") {
    if (!has(formatters, opts.format)) {
      throw new TypeError("Unknown format option provided.");
    }
    format = opts.format;
  }
  const formatter = formatters[format];
  let filter = defaults.filter;
  if (typeof opts.filter === "function" || isArray(opts.filter)) {
    filter = opts.filter;
  }
  let arrayFormat;
  if (opts.arrayFormat && opts.arrayFormat in array_prefix_generators) {
    arrayFormat = opts.arrayFormat;
  } else if ("indices" in opts) {
    arrayFormat = opts.indices ? "indices" : "repeat";
  } else {
    arrayFormat = defaults.arrayFormat;
  }
  if ("commaRoundTrip" in opts && typeof opts.commaRoundTrip !== "boolean") {
    throw new TypeError("`commaRoundTrip` must be a boolean, or absent");
  }
  const allowDots = typeof opts.allowDots === "undefined" ? !!opts.encodeDotInKeys === true ? true : defaults.allowDots : !!opts.allowDots;
  return {
    addQueryPrefix: typeof opts.addQueryPrefix === "boolean" ? opts.addQueryPrefix : defaults.addQueryPrefix,
    allowDots,
    allowEmptyArrays: typeof opts.allowEmptyArrays === "boolean" ? !!opts.allowEmptyArrays : defaults.allowEmptyArrays,
    arrayFormat,
    charset,
    charsetSentinel: typeof opts.charsetSentinel === "boolean" ? opts.charsetSentinel : defaults.charsetSentinel,
    commaRoundTrip: !!opts.commaRoundTrip,
    delimiter: typeof opts.delimiter === "undefined" ? defaults.delimiter : opts.delimiter,
    encode: typeof opts.encode === "boolean" ? opts.encode : defaults.encode,
    encodeDotInKeys: typeof opts.encodeDotInKeys === "boolean" ? opts.encodeDotInKeys : defaults.encodeDotInKeys,
    encoder: typeof opts.encoder === "function" ? opts.encoder : defaults.encoder,
    encodeValuesOnly: typeof opts.encodeValuesOnly === "boolean" ? opts.encodeValuesOnly : defaults.encodeValuesOnly,
    filter,
    format,
    formatter,
    serializeDate: typeof opts.serializeDate === "function" ? opts.serializeDate : defaults.serializeDate,
    skipNulls: typeof opts.skipNulls === "boolean" ? opts.skipNulls : defaults.skipNulls,
    sort: typeof opts.sort === "function" ? opts.sort : null,
    strictNullHandling: typeof opts.strictNullHandling === "boolean" ? opts.strictNullHandling : defaults.strictNullHandling
  };
}
function stringify(object, opts = {}) {
  let obj = object;
  const options = normalize_stringify_options(opts);
  let obj_keys;
  let filter;
  if (typeof options.filter === "function") {
    filter = options.filter;
    obj = filter("", obj);
  } else if (isArray(options.filter)) {
    filter = options.filter;
    obj_keys = filter;
  }
  const keys = [];
  if (typeof obj !== "object" || obj === null) {
    return "";
  }
  const generateArrayPrefix = array_prefix_generators[options.arrayFormat];
  const commaRoundTrip = generateArrayPrefix === "comma" && options.commaRoundTrip;
  if (!obj_keys) {
    obj_keys = Object.keys(obj);
  }
  if (options.sort) {
    obj_keys.sort(options.sort);
  }
  const sideChannel = new WeakMap;
  for (let i = 0;i < obj_keys.length; ++i) {
    const key = obj_keys[i];
    if (options.skipNulls && obj[key] === null) {
      continue;
    }
    push_to_array(keys, inner_stringify(obj[key], key, generateArrayPrefix, commaRoundTrip, options.allowEmptyArrays, options.strictNullHandling, options.skipNulls, options.encodeDotInKeys, options.encode ? options.encoder : null, options.filter, options.sort, options.allowDots, options.serializeDate, options.format, options.formatter, options.encodeValuesOnly, options.charset, sideChannel));
  }
  const joined = keys.join(options.delimiter);
  let prefix = options.addQueryPrefix === true ? "?" : "";
  if (options.charsetSentinel) {
    if (options.charset === "iso-8859-1") {
      prefix += "utf8=%26%2310003%3B&";
    } else {
      prefix += "utf8=%E2%9C%93&";
    }
  }
  return joined.length > 0 ? prefix + joined : "";
}
var array_prefix_generators, push_to_array = function(arr, value_or_array) {
  Array.prototype.push.apply(arr, isArray(value_or_array) ? value_or_array : [value_or_array]);
}, toISOString, defaults, sentinel;
var init_stringify = __esm(() => {
  init_utils();
  init_formats();
  init_values();
  array_prefix_generators = {
    brackets(prefix) {
      return String(prefix) + "[]";
    },
    comma: "comma",
    indices(prefix, key) {
      return String(prefix) + "[" + key + "]";
    },
    repeat(prefix) {
      return String(prefix);
    }
  };
  defaults = {
    addQueryPrefix: false,
    allowDots: false,
    allowEmptyArrays: false,
    arrayFormat: "indices",
    charset: "utf-8",
    charsetSentinel: false,
    delimiter: "&",
    encode: true,
    encodeDotInKeys: false,
    encoder: encode,
    encodeValuesOnly: false,
    format: default_format,
    formatter: default_formatter,
    indices: false,
    serializeDate(date) {
      return (toISOString ?? (toISOString = Function.prototype.call.bind(Date.prototype.toISOString)))(date);
    },
    skipNulls: false,
    strictNullHandling: false
  };
  sentinel = {};
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/utils/query.mjs
function stringifyQuery(query) {
  return stringify(query, { arrayFormat: "brackets" });
}
var init_query = __esm(() => {
  init_stringify();
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/utils/bytes.mjs
function concatBytes(buffers) {
  let length = 0;
  for (const buffer of buffers) {
    length += buffer.length;
  }
  const output = new Uint8Array(length);
  let index = 0;
  for (const buffer of buffers) {
    output.set(buffer, index);
    index += buffer.length;
  }
  return output;
}
function encodeUTF8(str) {
  let encoder;
  return (encodeUTF8_ ?? (encoder = new globalThis.TextEncoder, encodeUTF8_ = encoder.encode.bind(encoder)))(str);
}
function decodeUTF8(bytes) {
  let decoder;
  return (decodeUTF8_ ?? (decoder = new globalThis.TextDecoder, decodeUTF8_ = decoder.decode.bind(decoder)))(bytes);
}
var encodeUTF8_, decodeUTF8_;

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/decoders/line.mjs
class LineDecoder {
  constructor() {
    _LineDecoder_buffer.set(this, undefined);
    _LineDecoder_carriageReturnIndex.set(this, undefined);
    __classPrivateFieldSet(this, _LineDecoder_buffer, new Uint8Array, "f");
    __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
  }
  decode(chunk) {
    if (chunk == null) {
      return [];
    }
    const binaryChunk = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : typeof chunk === "string" ? encodeUTF8(chunk) : chunk;
    __classPrivateFieldSet(this, _LineDecoder_buffer, concatBytes([__classPrivateFieldGet(this, _LineDecoder_buffer, "f"), binaryChunk]), "f");
    const lines = [];
    let patternIndex;
    while ((patternIndex = findNewlineIndex(__classPrivateFieldGet(this, _LineDecoder_buffer, "f"), __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f"))) != null) {
      if (patternIndex.carriage && __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") == null) {
        __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, patternIndex.index, "f");
        continue;
      }
      if (__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") != null && (patternIndex.index !== __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") + 1 || patternIndex.carriage)) {
        lines.push(decodeUTF8(__classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(0, __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") - 1)));
        __classPrivateFieldSet(this, _LineDecoder_buffer, __classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f")), "f");
        __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
        continue;
      }
      const endIndex = __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") !== null ? patternIndex.preceding - 1 : patternIndex.preceding;
      const line = decodeUTF8(__classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(0, endIndex));
      lines.push(line);
      __classPrivateFieldSet(this, _LineDecoder_buffer, __classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(patternIndex.index), "f");
      __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
    }
    return lines;
  }
  flush() {
    if (!__classPrivateFieldGet(this, _LineDecoder_buffer, "f").length) {
      return [];
    }
    return this.decode(`
`);
  }
}
function findNewlineIndex(buffer, startIndex) {
  const newline = 10;
  const carriage = 13;
  for (let i = startIndex ?? 0;i < buffer.length; i++) {
    if (buffer[i] === newline) {
      return { preceding: i, index: i + 1, carriage: false };
    }
    if (buffer[i] === carriage) {
      return { preceding: i, index: i + 1, carriage: true };
    }
  }
  return null;
}
function findDoubleNewlineIndex(buffer) {
  const newline = 10;
  const carriage = 13;
  for (let i = 0;i < buffer.length - 1; i++) {
    if (buffer[i] === newline && buffer[i + 1] === newline) {
      return i + 2;
    }
    if (buffer[i] === carriage && buffer[i + 1] === carriage) {
      return i + 2;
    }
    if (buffer[i] === carriage && buffer[i + 1] === newline && i + 3 < buffer.length && buffer[i + 2] === carriage && buffer[i + 3] === newline) {
      return i + 4;
    }
  }
  return -1;
}
var _LineDecoder_buffer, _LineDecoder_carriageReturnIndex;
var init_line = __esm(() => {
  init_tslib();
  _LineDecoder_buffer = new WeakMap, _LineDecoder_carriageReturnIndex = new WeakMap;
  LineDecoder.NEWLINE_CHARS = new Set([`
`, "\r"]);
  LineDecoder.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/utils/log.mjs
function noop() {}
function makeLogFn(fnLevel, logger, logLevel) {
  if (!logger || levelNumbers[fnLevel] > levelNumbers[logLevel]) {
    return noop;
  } else {
    return logger[fnLevel].bind(logger);
  }
}
function loggerFor(client) {
  const logger = client.logger;
  const logLevel = client.logLevel ?? "off";
  if (!logger) {
    return noopLogger;
  }
  const cachedLogger = cachedLoggers.get(logger);
  if (cachedLogger && cachedLogger[0] === logLevel) {
    return cachedLogger[1];
  }
  const levelLogger = {
    error: makeLogFn("error", logger, logLevel),
    warn: makeLogFn("warn", logger, logLevel),
    info: makeLogFn("info", logger, logLevel),
    debug: makeLogFn("debug", logger, logLevel)
  };
  cachedLoggers.set(logger, [logLevel, levelLogger]);
  return levelLogger;
}
var levelNumbers, parseLogLevel = (maybeLevel, sourceName, client) => {
  if (!maybeLevel) {
    return;
  }
  if (hasOwn(levelNumbers, maybeLevel)) {
    return maybeLevel;
  }
  loggerFor(client).warn(`${sourceName} was set to ${JSON.stringify(maybeLevel)}, expected one of ${JSON.stringify(Object.keys(levelNumbers))}`);
  return;
}, noopLogger, cachedLoggers, formatRequestDetails = (details) => {
  if (details.options) {
    details.options = { ...details.options };
    delete details.options["headers"];
  }
  if (details.headers) {
    details.headers = Object.fromEntries((details.headers instanceof Headers ? [...details.headers] : Object.entries(details.headers)).map(([name, value]) => [
      name,
      name.toLowerCase() === "authorization" || name.toLowerCase() === "api-key" || name.toLowerCase() === "x-api-key" || name.toLowerCase() === "cookie" || name.toLowerCase() === "set-cookie" ? "***" : value
    ]));
  }
  if ("retryOfRequestLogID" in details) {
    if (details.retryOfRequestLogID) {
      details.retryOf = details.retryOfRequestLogID;
    }
    delete details.retryOfRequestLogID;
  }
  return details;
};
var init_log = __esm(() => {
  init_values();
  levelNumbers = {
    off: 0,
    error: 200,
    warn: 300,
    info: 400,
    debug: 500
  };
  noopLogger = {
    error: noop,
    warn: noop,
    info: noop,
    debug: noop
  };
  cachedLoggers = /* @__PURE__ */ new WeakMap;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/core/streaming.mjs
async function* _iterSSEMessages(response, controller) {
  if (!response.body) {
    controller.abort();
    if (typeof globalThis.navigator !== "undefined" && globalThis.navigator.product === "ReactNative") {
      throw new OpenAIError(`The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api`);
    }
    throw new OpenAIError(`Attempted to iterate over a response with no body`);
  }
  const sseDecoder = new SSEDecoder;
  const lineDecoder = new LineDecoder;
  const iter = ReadableStreamToAsyncIterable(response.body);
  for await (const sseChunk of iterSSEChunks(iter)) {
    for (const line of lineDecoder.decode(sseChunk)) {
      const sse = sseDecoder.decode(line);
      if (sse)
        yield sse;
    }
  }
  for (const line of lineDecoder.flush()) {
    const sse = sseDecoder.decode(line);
    if (sse)
      yield sse;
  }
}
async function* iterSSEChunks(iterator) {
  let data = new Uint8Array;
  for await (const chunk of iterator) {
    if (chunk == null) {
      continue;
    }
    const binaryChunk = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : typeof chunk === "string" ? encodeUTF8(chunk) : chunk;
    let newData = new Uint8Array(data.length + binaryChunk.length);
    newData.set(data);
    newData.set(binaryChunk, data.length);
    data = newData;
    let patternIndex;
    while ((patternIndex = findDoubleNewlineIndex(data)) !== -1) {
      yield data.slice(0, patternIndex);
      data = data.slice(patternIndex);
    }
  }
  if (data.length > 0) {
    yield data;
  }
}

class SSEDecoder {
  constructor() {
    this.event = null;
    this.data = [];
    this.chunks = [];
  }
  decode(line) {
    if (line.endsWith("\r")) {
      line = line.substring(0, line.length - 1);
    }
    if (!line) {
      if (!this.event && !this.data.length)
        return null;
      const sse = {
        event: this.event,
        data: this.data.join(`
`),
        raw: this.chunks
      };
      this.event = null;
      this.data = [];
      this.chunks = [];
      return sse;
    }
    this.chunks.push(line);
    if (line.startsWith(":")) {
      return null;
    }
    let [fieldname, _, value] = partition(line, ":");
    if (value.startsWith(" ")) {
      value = value.substring(1);
    }
    if (fieldname === "event") {
      this.event = value;
    } else if (fieldname === "data") {
      this.data.push(value);
    }
    return null;
  }
}
function partition(str, delimiter) {
  const index = str.indexOf(delimiter);
  if (index !== -1) {
    return [str.substring(0, index), delimiter, str.substring(index + delimiter.length)];
  }
  return [str, "", ""];
}
var _Stream_client, Stream;
var init_streaming = __esm(() => {
  init_tslib();
  init_error();
  init_line();
  init_log();
  init_error();
  Stream = class Stream {
    constructor(iterator, controller, client) {
      this.iterator = iterator;
      _Stream_client.set(this, undefined);
      this.controller = controller;
      __classPrivateFieldSet(this, _Stream_client, client, "f");
    }
    static fromSSEResponse(response, controller, client, synthesizeEventData) {
      let consumed = false;
      const logger = client ? loggerFor(client) : console;
      async function* iterator() {
        if (consumed) {
          throw new OpenAIError("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
        }
        consumed = true;
        let done = false;
        try {
          for await (const sse of _iterSSEMessages(response, controller)) {
            if (done)
              continue;
            if (sse.data.startsWith("[DONE]")) {
              done = true;
              continue;
            }
            if (sse.event === null || !sse.event.startsWith("thread.")) {
              let data;
              try {
                data = JSON.parse(sse.data);
              } catch (e) {
                logger.error(`Could not parse message into JSON:`, sse.data);
                logger.error(`From chunk:`, sse.raw);
                throw e;
              }
              if (data && data.error) {
                throw new APIError(undefined, data.error, undefined, response.headers);
              }
              yield synthesizeEventData ? { event: sse.event, data } : data;
            } else {
              let data;
              try {
                data = JSON.parse(sse.data);
              } catch (e) {
                console.error(`Could not parse message into JSON:`, sse.data);
                console.error(`From chunk:`, sse.raw);
                throw e;
              }
              if (sse.event == "error") {
                throw new APIError(undefined, data.error, data.message, undefined);
              }
              yield { event: sse.event, data };
            }
          }
          done = true;
        } catch (e) {
          if (isAbortError(e))
            return;
          throw e;
        } finally {
          if (!done)
            controller.abort();
        }
      }
      return new Stream(iterator, controller, client);
    }
    static fromReadableStream(readableStream, controller, client) {
      let consumed = false;
      async function* iterLines() {
        const lineDecoder = new LineDecoder;
        const iter = ReadableStreamToAsyncIterable(readableStream);
        for await (const chunk of iter) {
          for (const line of lineDecoder.decode(chunk)) {
            yield line;
          }
        }
        for (const line of lineDecoder.flush()) {
          yield line;
        }
      }
      async function* iterator() {
        if (consumed) {
          throw new OpenAIError("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
        }
        consumed = true;
        let done = false;
        try {
          for await (const line of iterLines()) {
            if (done)
              continue;
            if (line)
              yield JSON.parse(line);
          }
          done = true;
        } catch (e) {
          if (isAbortError(e))
            return;
          throw e;
        } finally {
          if (!done)
            controller.abort();
        }
      }
      return new Stream(iterator, controller, client);
    }
    [(_Stream_client = new WeakMap, Symbol.asyncIterator)]() {
      return this.iterator();
    }
    tee() {
      const left = [];
      const right = [];
      const iterator = this.iterator();
      const teeIterator = (queue) => {
        return {
          next: () => {
            if (queue.length === 0) {
              const result = iterator.next();
              left.push(result);
              right.push(result);
            }
            return queue.shift();
          }
        };
      };
      return [
        new Stream(() => teeIterator(left), this.controller, __classPrivateFieldGet(this, _Stream_client, "f")),
        new Stream(() => teeIterator(right), this.controller, __classPrivateFieldGet(this, _Stream_client, "f"))
      ];
    }
    toReadableStream() {
      const self = this;
      let iter;
      return makeReadableStream({
        async start() {
          iter = self[Symbol.asyncIterator]();
        },
        async pull(ctrl) {
          try {
            const { value, done } = await iter.next();
            if (done)
              return ctrl.close();
            const bytes = encodeUTF8(JSON.stringify(value) + `
`);
            ctrl.enqueue(bytes);
          } catch (err) {
            ctrl.error(err);
          }
        },
        async cancel() {
          await iter.return?.();
        }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/parse.mjs
async function defaultParseResponse(client, props) {
  const { response, requestLogID, retryOfRequestLogID, startTime } = props;
  const body = await (async () => {
    if (props.options.stream) {
      loggerFor(client).debug("response", response.status, response.url, response.headers, response.body);
      if (props.options.__streamClass) {
        return props.options.__streamClass.fromSSEResponse(response, props.controller, client, props.options.__synthesizeEventData);
      }
      return Stream.fromSSEResponse(response, props.controller, client, props.options.__synthesizeEventData);
    }
    if (response.status === 204) {
      return null;
    }
    if (props.options.__binaryResponse) {
      return response;
    }
    const contentType = response.headers.get("content-type");
    const mediaType = contentType?.split(";")[0]?.trim();
    const isJSON = mediaType?.includes("application/json") || mediaType?.endsWith("+json");
    if (isJSON) {
      const contentLength = response.headers.get("content-length");
      if (contentLength === "0") {
        return;
      }
      const json = await response.json();
      return addRequestID(json, response);
    }
    const text = await response.text();
    return text;
  })();
  loggerFor(client).debug(`[${requestLogID}] response parsed`, formatRequestDetails({
    retryOfRequestLogID,
    url: response.url,
    status: response.status,
    body,
    durationMs: Date.now() - startTime
  }));
  return body;
}
function addRequestID(value, response) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  return Object.defineProperty(value, "_request_id", {
    value: response.headers.get("x-request-id"),
    enumerable: false
  });
}
var init_parse = __esm(() => {
  init_streaming();
  init_log();
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/core/api-promise.mjs
var _APIPromise_client, APIPromise;
var init_api_promise = __esm(() => {
  init_tslib();
  init_parse();
  APIPromise = class APIPromise extends Promise {
    constructor(client, responsePromise, parseResponse = defaultParseResponse) {
      super((resolve4) => {
        resolve4(null);
      });
      this.responsePromise = responsePromise;
      this.parseResponse = parseResponse;
      _APIPromise_client.set(this, undefined);
      __classPrivateFieldSet(this, _APIPromise_client, client, "f");
    }
    _thenUnwrap(transform) {
      return new APIPromise(__classPrivateFieldGet(this, _APIPromise_client, "f"), this.responsePromise, async (client, props) => addRequestID(transform(await this.parseResponse(client, props), props), props.response));
    }
    asResponse() {
      return this.responsePromise.then((p) => p.response);
    }
    async withResponse() {
      const [data, response] = await Promise.all([this.parse(), this.asResponse()]);
      return { data, response, request_id: response.headers.get("x-request-id") };
    }
    parse() {
      if (!this.parsedPromise) {
        this.parsedPromise = this.responsePromise.then((data) => this.parseResponse(__classPrivateFieldGet(this, _APIPromise_client, "f"), data));
      }
      return this.parsedPromise;
    }
    then(onfulfilled, onrejected) {
      return this.parse().then(onfulfilled, onrejected);
    }
    catch(onrejected) {
      return this.parse().catch(onrejected);
    }
    finally(onfinally) {
      return this.parse().finally(onfinally);
    }
  };
  _APIPromise_client = new WeakMap;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/core/pagination.mjs
var _AbstractPage_client, AbstractPage, PagePromise, Page, CursorPage, ConversationCursorPage, NextCursorPage;
var init_pagination = __esm(() => {
  init_tslib();
  init_error();
  init_parse();
  init_api_promise();
  init_values();
  AbstractPage = class AbstractPage {
    constructor(client, response, body, options) {
      _AbstractPage_client.set(this, undefined);
      __classPrivateFieldSet(this, _AbstractPage_client, client, "f");
      this.options = options;
      this.response = response;
      this.body = body;
    }
    hasNextPage() {
      const items = this.getPaginatedItems();
      if (!items.length)
        return false;
      return this.nextPageRequestOptions() != null;
    }
    async getNextPage() {
      const nextOptions = this.nextPageRequestOptions();
      if (!nextOptions) {
        throw new OpenAIError("No next page expected; please check `.hasNextPage()` before calling `.getNextPage()`.");
      }
      return await __classPrivateFieldGet(this, _AbstractPage_client, "f").requestAPIList(this.constructor, nextOptions);
    }
    async* iterPages() {
      let page = this;
      yield page;
      while (page.hasNextPage()) {
        page = await page.getNextPage();
        yield page;
      }
    }
    async* [(_AbstractPage_client = new WeakMap, Symbol.asyncIterator)]() {
      for await (const page of this.iterPages()) {
        for (const item of page.getPaginatedItems()) {
          yield item;
        }
      }
    }
  };
  PagePromise = class PagePromise extends APIPromise {
    constructor(client, request, Page) {
      super(client, request, async (client2, props) => new Page(client2, props.response, await defaultParseResponse(client2, props), props.options));
    }
    async* [Symbol.asyncIterator]() {
      const page = await this;
      for await (const item of page) {
        yield item;
      }
    }
  };
  Page = class Page extends AbstractPage {
    constructor(client, response, body, options) {
      super(client, response, body, options);
      this.data = body.data || [];
      this.object = body.object;
    }
    getPaginatedItems() {
      return this.data ?? [];
    }
    nextPageRequestOptions() {
      return null;
    }
  };
  CursorPage = class CursorPage extends AbstractPage {
    constructor(client, response, body, options) {
      super(client, response, body, options);
      this.data = body.data || [];
      this.has_more = body.has_more || false;
    }
    getPaginatedItems() {
      return this.data ?? [];
    }
    hasNextPage() {
      if (this.has_more === false) {
        return false;
      }
      return super.hasNextPage();
    }
    nextPageRequestOptions() {
      const data = this.getPaginatedItems();
      const id = data[data.length - 1]?.id;
      if (!id) {
        return null;
      }
      return {
        ...this.options,
        query: {
          ...maybeObj(this.options.query),
          after: id
        }
      };
    }
  };
  ConversationCursorPage = class ConversationCursorPage extends AbstractPage {
    constructor(client, response, body, options) {
      super(client, response, body, options);
      this.data = body.data || [];
      this.has_more = body.has_more || false;
      this.last_id = body.last_id || "";
    }
    getPaginatedItems() {
      return this.data ?? [];
    }
    hasNextPage() {
      if (this.has_more === false) {
        return false;
      }
      return super.hasNextPage();
    }
    nextPageRequestOptions() {
      const cursor = this.last_id;
      if (!cursor) {
        return null;
      }
      return {
        ...this.options,
        query: {
          ...maybeObj(this.options.query),
          after: cursor
        }
      };
    }
  };
  NextCursorPage = class NextCursorPage extends AbstractPage {
    constructor(client, response, body, options) {
      super(client, response, body, options);
      this.data = body.data || [];
      this.has_more = body.has_more || false;
      this.next = body.next || null;
    }
    getPaginatedItems() {
      return this.data ?? [];
    }
    hasNextPage() {
      if (this.has_more === false) {
        return false;
      }
      return super.hasNextPage();
    }
    nextPageRequestOptions() {
      const cursor = this.next;
      if (!cursor) {
        return null;
      }
      return {
        ...this.options,
        query: {
          ...maybeObj(this.options.query),
          after: cursor
        }
      };
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/auth/workload-identity-auth.mjs
class WorkloadIdentityAuth {
  constructor(config, fetch2) {
    this.cachedToken = null;
    this.refreshPromise = null;
    this.tokenExchangeUrl = "https://auth.openai.com/oauth/token";
    this.config = config;
    this.fetch = fetch2 ?? getDefaultFetch();
  }
  async getToken() {
    if (!this.cachedToken || this.isTokenExpired(this.cachedToken)) {
      if (this.refreshPromise) {
        return await this.refreshPromise;
      }
      this.refreshPromise = this.refreshToken();
      try {
        const token = await this.refreshPromise;
        return token;
      } finally {
        this.refreshPromise = null;
      }
    }
    if (this.needsRefresh(this.cachedToken) && !this.refreshPromise) {
      this.refreshPromise = this.refreshToken().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.cachedToken.token;
  }
  async refreshToken() {
    const subjectToken = await this.config.provider.getToken();
    const body = {
      grant_type: TOKEN_EXCHANGE_GRANT_TYPE,
      subject_token: subjectToken,
      subject_token_type: SUBJECT_TOKEN_TYPES[this.config.provider.tokenType],
      identity_provider_id: this.config.identityProviderId,
      service_account_id: this.config.serviceAccountId
    };
    if (this.config.clientId) {
      body["client_id"] = this.config.clientId;
    }
    const response = await this.fetch(this.tokenExchangeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorText = await response.text();
      let body2 = undefined;
      try {
        body2 = JSON.parse(errorText);
      } catch {}
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        throw new OAuthError(response.status, body2, response.headers);
      }
      throw APIError.generate(response.status, body2, `Token exchange failed with status ${response.status}`, response.headers);
    }
    const tokenResponse = await response.json();
    const expiresIn = tokenResponse.expires_in || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;
    this.cachedToken = {
      token: tokenResponse.access_token,
      expiresAt
    };
    return tokenResponse.access_token;
  }
  isTokenExpired(cachedToken) {
    return Date.now() >= cachedToken.expiresAt;
  }
  needsRefresh(cachedToken) {
    const bufferSeconds = this.config.refreshBufferSeconds ?? 1200;
    const bufferMs = bufferSeconds * 1000;
    return Date.now() >= cachedToken.expiresAt - bufferMs;
  }
  invalidateToken() {
    this.cachedToken = null;
    this.refreshPromise = null;
  }
}
var SUBJECT_TOKEN_TYPES, TOKEN_EXCHANGE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:token-exchange";
var init_workload_identity_auth = __esm(() => {
  init_error();
  SUBJECT_TOKEN_TYPES = {
    jwt: "urn:ietf:params:oauth:token-type:jwt",
    id: "urn:ietf:params:oauth:token-type:id_token"
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/uploads.mjs
function makeFile(fileBits, fileName, options) {
  checkFileSupport();
  return new File(fileBits, fileName ?? "unknown_file", options);
}
function getName(value) {
  return (typeof value === "object" && value !== null && (("name" in value) && value.name && String(value.name) || ("url" in value) && value.url && String(value.url) || ("filename" in value) && value.filename && String(value.filename) || ("path" in value) && value.path && String(value.path)) || "").split(/[\\/]/).pop() || undefined;
}
function supportsFormData(fetchObject) {
  const fetch2 = typeof fetchObject === "function" ? fetchObject : fetchObject.fetch;
  const cached = supportsFormDataMap.get(fetch2);
  if (cached)
    return cached;
  const promise = (async () => {
    try {
      const FetchResponse = "Response" in fetch2 ? fetch2.Response : (await fetch2("data:,")).constructor;
      const data = new FormData;
      if (data.toString() === await new FetchResponse(data).text()) {
        return false;
      }
      return true;
    } catch {
      return true;
    }
  })();
  supportsFormDataMap.set(fetch2, promise);
  return promise;
}
var checkFileSupport = () => {
  if (typeof File === "undefined") {
    const { process: process2 } = globalThis;
    const isOldNode = typeof process2?.versions?.node === "string" && parseInt(process2.versions.node.split(".")) < 20;
    throw new Error("`File` is not defined as a global, which is required for file uploads." + (isOldNode ? " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`." : ""));
  }
}, isAsyncIterable = (value) => value != null && typeof value === "object" && typeof value[Symbol.asyncIterator] === "function", maybeMultipartFormRequestOptions = async (opts, fetch2) => {
  if (!hasUploadableValue(opts.body))
    return opts;
  return { ...opts, body: await createForm(opts.body, fetch2) };
}, multipartFormRequestOptions = async (opts, fetch2) => {
  return { ...opts, body: await createForm(opts.body, fetch2) };
}, supportsFormDataMap, createForm = async (body, fetch2) => {
  if (!await supportsFormData(fetch2)) {
    throw new TypeError("The provided fetch function does not support file uploads with the current global FormData class.");
  }
  const form = new FormData;
  await Promise.all(Object.entries(body || {}).map(([key, value]) => addFormValue(form, key, value)));
  return form;
}, isNamedBlob = (value) => value instanceof Blob && ("name" in value), isUploadable = (value) => typeof value === "object" && value !== null && (value instanceof Response || isAsyncIterable(value) || isNamedBlob(value)), hasUploadableValue = (value) => {
  if (isUploadable(value))
    return true;
  if (Array.isArray(value))
    return value.some(hasUploadableValue);
  if (value && typeof value === "object") {
    for (const k in value) {
      if (hasUploadableValue(value[k]))
        return true;
    }
  }
  return false;
}, addFormValue = async (form, key, value) => {
  if (value === undefined)
    return;
  if (value == null) {
    throw new TypeError(`Received null for "${key}"; to pass null in FormData, you must use the string 'null'`);
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    form.append(key, String(value));
  } else if (value instanceof Response) {
    form.append(key, makeFile([await value.blob()], getName(value)));
  } else if (isAsyncIterable(value)) {
    form.append(key, makeFile([await new Response(ReadableStreamFrom(value)).blob()], getName(value)));
  } else if (isNamedBlob(value)) {
    form.append(key, value, getName(value));
  } else if (Array.isArray(value)) {
    await Promise.all(value.map((entry) => addFormValue(form, key + "[]", entry)));
  } else if (typeof value === "object") {
    await Promise.all(Object.entries(value).map(([name, prop]) => addFormValue(form, `${key}[${name}]`, prop)));
  } else {
    throw new TypeError(`Invalid value given to form, expected a string, number, boolean, object, Array, File or Blob but got ${value} instead`);
  }
};
var init_uploads = __esm(() => {
  supportsFormDataMap = /* @__PURE__ */ new WeakMap;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/to-file.mjs
async function toFile(value, name, options) {
  checkFileSupport();
  value = await value;
  if (isFileLike(value)) {
    if (value instanceof File) {
      return value;
    }
    return makeFile([await value.arrayBuffer()], value.name);
  }
  if (isResponseLike(value)) {
    const blob = await value.blob();
    name || (name = new URL(value.url).pathname.split(/[\\/]/).pop());
    return makeFile(await getBytes(blob), name, options);
  }
  const parts = await getBytes(value);
  name || (name = getName(value));
  if (!options?.type) {
    const type = parts.find((part) => typeof part === "object" && ("type" in part) && part.type);
    if (typeof type === "string") {
      options = { ...options, type };
    }
  }
  return makeFile(parts, name, options);
}
async function getBytes(value) {
  let parts = [];
  if (typeof value === "string" || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    parts.push(value);
  } else if (isBlobLike(value)) {
    parts.push(value instanceof Blob ? value : await value.arrayBuffer());
  } else if (isAsyncIterable(value)) {
    for await (const chunk of value) {
      parts.push(...await getBytes(chunk));
    }
  } else {
    const constructor = value?.constructor?.name;
    throw new Error(`Unexpected data type: ${typeof value}${constructor ? `; constructor: ${constructor}` : ""}${propsForError(value)}`);
  }
  return parts;
}
function propsForError(value) {
  if (typeof value !== "object" || value === null)
    return "";
  const props = Object.getOwnPropertyNames(value);
  return `; props: [${props.map((p) => `"${p}"`).join(", ")}]`;
}
var isBlobLike = (value) => value != null && typeof value === "object" && typeof value.size === "number" && typeof value.type === "string" && typeof value.text === "function" && typeof value.slice === "function" && typeof value.arrayBuffer === "function", isFileLike = (value) => value != null && typeof value === "object" && typeof value.name === "string" && typeof value.lastModified === "number" && isBlobLike(value), isResponseLike = (value) => value != null && typeof value === "object" && typeof value.url === "string" && typeof value.blob === "function";
var init_to_file = __esm(() => {
  init_uploads();
  init_uploads();
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/core/uploads.mjs
var init_uploads2 = __esm(() => {
  init_to_file();
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/core/resource.mjs
class APIResource {
  constructor(client) {
    this._client = client;
  }
}

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/utils/path.mjs
function encodeURIPath(str) {
  return str.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]+/g, encodeURIComponent);
}
var EMPTY2, createPathTagFunction = (pathEncoder = encodeURIPath) => function path(statics, ...params) {
  if (statics.length === 1)
    return statics[0];
  let postPath = false;
  const invalidSegments = [];
  const path2 = statics.reduce((previousValue, currentValue, index) => {
    if (/[?#]/.test(currentValue)) {
      postPath = true;
    }
    const value = params[index];
    let encoded = (postPath ? encodeURIComponent : pathEncoder)("" + value);
    if (index !== params.length && (value == null || typeof value === "object" && value.toString === Object.getPrototypeOf(Object.getPrototypeOf(value.hasOwnProperty ?? EMPTY2) ?? EMPTY2)?.toString)) {
      encoded = value + "";
      invalidSegments.push({
        start: previousValue.length + currentValue.length,
        length: encoded.length,
        error: `Value of type ${Object.prototype.toString.call(value).slice(8, -1)} is not a valid path parameter`
      });
    }
    return previousValue + currentValue + (index === params.length ? "" : encoded);
  }, "");
  const pathOnly = path2.split(/[?#]/, 1)[0];
  const invalidSegmentPattern = /(?<=^|\/)(?:\.|%2e){1,2}(?=\/|$)/gi;
  let match;
  while ((match = invalidSegmentPattern.exec(pathOnly)) !== null) {
    invalidSegments.push({
      start: match.index,
      length: match[0].length,
      error: `Value "${match[0]}" can't be safely passed as a path parameter`
    });
  }
  invalidSegments.sort((a, b) => a.start - b.start);
  if (invalidSegments.length > 0) {
    let lastEnd = 0;
    const underline2 = invalidSegments.reduce((acc, segment) => {
      const spaces = " ".repeat(segment.start - lastEnd);
      const arrows = "^".repeat(segment.length);
      lastEnd = segment.start + segment.length;
      return acc + spaces + arrows;
    }, "");
    throw new OpenAIError(`Path parameters result in path with invalid segments:
${invalidSegments.map((e) => e.error).join(`
`)}
${path2}
${underline2}`);
  }
  return path2;
}, path;
var init_path = __esm(() => {
  init_error();
  EMPTY2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.create(null));
  path = /* @__PURE__ */ createPathTagFunction(encodeURIPath);
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/chat/completions/messages.mjs
var Messages;
var init_messages = __esm(() => {
  init_pagination();
  init_path();
  Messages = class Messages extends APIResource {
    list(completionID, query = {}, options) {
      return this._client.getAPIList(path`/chat/completions/${completionID}/messages`, CursorPage, { query, ...options, __security: { bearerAuth: true } });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/error.mjs
var init_error2 = __esm(() => {
  init_error();
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/lib/parser.mjs
function isChatCompletionFunctionTool(tool) {
  return tool !== undefined && "function" in tool && tool.function !== undefined;
}
function isAutoParsableResponseFormat(response_format) {
  return response_format?.["$brand"] === "auto-parseable-response-format";
}
function isAutoParsableTool(tool) {
  return tool?.["$brand"] === "auto-parseable-tool";
}
function maybeParseChatCompletion(completion, params) {
  if (!params || !hasAutoParseableInput(params)) {
    return {
      ...completion,
      choices: completion.choices.map((choice) => {
        assertToolCallsAreChatCompletionFunctionToolCalls(choice.message.tool_calls);
        return {
          ...choice,
          message: {
            ...choice.message,
            parsed: null,
            ...choice.message.tool_calls ? {
              tool_calls: choice.message.tool_calls
            } : undefined
          }
        };
      })
    };
  }
  return parseChatCompletion(completion, params);
}
function parseChatCompletion(completion, params) {
  const choices = completion.choices.map((choice) => {
    if (choice.finish_reason === "length") {
      throw new LengthFinishReasonError;
    }
    if (choice.finish_reason === "content_filter") {
      throw new ContentFilterFinishReasonError;
    }
    assertToolCallsAreChatCompletionFunctionToolCalls(choice.message.tool_calls);
    return {
      ...choice,
      message: {
        ...choice.message,
        ...choice.message.tool_calls ? {
          tool_calls: choice.message.tool_calls?.map((toolCall) => parseToolCall(params, toolCall)) ?? undefined
        } : undefined,
        parsed: choice.message.content && !choice.message.refusal ? parseResponseFormat(params, choice.message.content) : null
      }
    };
  });
  return { ...completion, choices };
}
function parseResponseFormat(params, content) {
  if (params.response_format?.type !== "json_schema") {
    return null;
  }
  if (params.response_format?.type === "json_schema") {
    if ("$parseRaw" in params.response_format) {
      const response_format = params.response_format;
      return response_format.$parseRaw(content);
    }
    return JSON.parse(content);
  }
  return null;
}
function parseToolCall(params, toolCall) {
  const inputTool = params.tools?.find((inputTool2) => isChatCompletionFunctionTool(inputTool2) && inputTool2.function?.name === toolCall.function.name);
  return {
    ...toolCall,
    function: {
      ...toolCall.function,
      parsed_arguments: isAutoParsableTool(inputTool) ? inputTool.$parseRaw(toolCall.function.arguments) : inputTool?.function.strict ? JSON.parse(toolCall.function.arguments) : null
    }
  };
}
function shouldParseToolCall(params, toolCall) {
  if (!params || !("tools" in params) || !params.tools) {
    return false;
  }
  const inputTool = params.tools?.find((inputTool2) => isChatCompletionFunctionTool(inputTool2) && inputTool2.function?.name === toolCall.function.name);
  return isChatCompletionFunctionTool(inputTool) && (isAutoParsableTool(inputTool) || inputTool?.function.strict || false);
}
function hasAutoParseableInput(params) {
  if (isAutoParsableResponseFormat(params.response_format)) {
    return true;
  }
  return params.tools?.some((t) => isAutoParsableTool(t) || t.type === "function" && t.function.strict === true) ?? false;
}
function assertToolCallsAreChatCompletionFunctionToolCalls(toolCalls) {
  for (const toolCall of toolCalls || []) {
    if (toolCall.type !== "function") {
      throw new OpenAIError(`Currently only \`function\` tool calls are supported; Received \`${toolCall.type}\``);
    }
  }
}
function validateInputTools(tools) {
  for (const tool of tools ?? []) {
    if (tool.type !== "function") {
      throw new OpenAIError(`Currently only \`function\` tool types support auto-parsing; Received \`${tool.type}\``);
    }
    if (tool.function.strict !== true) {
      throw new OpenAIError(`The \`${tool.function.name}\` tool is not marked with \`strict: true\`. Only strict function tools can be auto-parsed`);
    }
  }
}
var init_parser = __esm(() => {
  init_error2();
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/lib/chatCompletionUtils.mjs
var isAssistantMessage = (message) => {
  return message?.role === "assistant";
}, isToolMessage = (message) => {
  return message?.role === "tool";
};

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/lib/EventStream.mjs
class EventStream {
  constructor() {
    _EventStream_instances.add(this);
    this.controller = new AbortController;
    _EventStream_connectedPromise.set(this, undefined);
    _EventStream_resolveConnectedPromise.set(this, () => {});
    _EventStream_rejectConnectedPromise.set(this, () => {});
    _EventStream_endPromise.set(this, undefined);
    _EventStream_resolveEndPromise.set(this, () => {});
    _EventStream_rejectEndPromise.set(this, () => {});
    _EventStream_listeners.set(this, {});
    _EventStream_ended.set(this, false);
    _EventStream_errored.set(this, false);
    _EventStream_aborted.set(this, false);
    _EventStream_catchingPromiseCreated.set(this, false);
    __classPrivateFieldSet(this, _EventStream_connectedPromise, new Promise((resolve4, reject) => {
      __classPrivateFieldSet(this, _EventStream_resolveConnectedPromise, resolve4, "f");
      __classPrivateFieldSet(this, _EventStream_rejectConnectedPromise, reject, "f");
    }), "f");
    __classPrivateFieldSet(this, _EventStream_endPromise, new Promise((resolve4, reject) => {
      __classPrivateFieldSet(this, _EventStream_resolveEndPromise, resolve4, "f");
      __classPrivateFieldSet(this, _EventStream_rejectEndPromise, reject, "f");
    }), "f");
    __classPrivateFieldGet(this, _EventStream_connectedPromise, "f").catch(() => {});
    __classPrivateFieldGet(this, _EventStream_endPromise, "f").catch(() => {});
  }
  _run(executor) {
    setTimeout(() => {
      executor().then(() => {
        this._emitFinal();
        this._emit("end");
      }, __classPrivateFieldGet(this, _EventStream_instances, "m", _EventStream_handleError).bind(this));
    }, 0);
  }
  _connected() {
    if (this.ended)
      return;
    __classPrivateFieldGet(this, _EventStream_resolveConnectedPromise, "f").call(this);
    this._emit("connect");
  }
  get ended() {
    return __classPrivateFieldGet(this, _EventStream_ended, "f");
  }
  get errored() {
    return __classPrivateFieldGet(this, _EventStream_errored, "f");
  }
  get aborted() {
    return __classPrivateFieldGet(this, _EventStream_aborted, "f");
  }
  abort() {
    this.controller.abort();
  }
  on(event, listener) {
    const listeners = __classPrivateFieldGet(this, _EventStream_listeners, "f")[event] || (__classPrivateFieldGet(this, _EventStream_listeners, "f")[event] = []);
    listeners.push({ listener });
    return this;
  }
  off(event, listener) {
    const listeners = __classPrivateFieldGet(this, _EventStream_listeners, "f")[event];
    if (!listeners)
      return this;
    const index = listeners.findIndex((l) => l.listener === listener);
    if (index >= 0)
      listeners.splice(index, 1);
    return this;
  }
  once(event, listener) {
    const listeners = __classPrivateFieldGet(this, _EventStream_listeners, "f")[event] || (__classPrivateFieldGet(this, _EventStream_listeners, "f")[event] = []);
    listeners.push({ listener, once: true });
    return this;
  }
  emitted(event) {
    return new Promise((resolve4, reject) => {
      __classPrivateFieldSet(this, _EventStream_catchingPromiseCreated, true, "f");
      if (event !== "error")
        this.once("error", reject);
      this.once(event, resolve4);
    });
  }
  async done() {
    __classPrivateFieldSet(this, _EventStream_catchingPromiseCreated, true, "f");
    await __classPrivateFieldGet(this, _EventStream_endPromise, "f");
  }
  _emit(event, ...args) {
    if (__classPrivateFieldGet(this, _EventStream_ended, "f")) {
      return;
    }
    if (event === "end") {
      __classPrivateFieldSet(this, _EventStream_ended, true, "f");
      __classPrivateFieldGet(this, _EventStream_resolveEndPromise, "f").call(this);
    }
    const listeners = __classPrivateFieldGet(this, _EventStream_listeners, "f")[event];
    if (listeners) {
      __classPrivateFieldGet(this, _EventStream_listeners, "f")[event] = listeners.filter((l) => !l.once);
      listeners.forEach(({ listener }) => listener(...args));
    }
    if (event === "abort") {
      const error2 = args[0];
      if (!__classPrivateFieldGet(this, _EventStream_catchingPromiseCreated, "f") && !listeners?.length) {
        Promise.reject(error2);
      }
      __classPrivateFieldGet(this, _EventStream_rejectConnectedPromise, "f").call(this, error2);
      __classPrivateFieldGet(this, _EventStream_rejectEndPromise, "f").call(this, error2);
      this._emit("end");
      return;
    }
    if (event === "error") {
      const error2 = args[0];
      if (!__classPrivateFieldGet(this, _EventStream_catchingPromiseCreated, "f") && !listeners?.length) {
        Promise.reject(error2);
      }
      __classPrivateFieldGet(this, _EventStream_rejectConnectedPromise, "f").call(this, error2);
      __classPrivateFieldGet(this, _EventStream_rejectEndPromise, "f").call(this, error2);
      this._emit("end");
    }
  }
  _emitFinal() {}
}
var _EventStream_instances, _EventStream_connectedPromise, _EventStream_resolveConnectedPromise, _EventStream_rejectConnectedPromise, _EventStream_endPromise, _EventStream_resolveEndPromise, _EventStream_rejectEndPromise, _EventStream_listeners, _EventStream_ended, _EventStream_errored, _EventStream_aborted, _EventStream_catchingPromiseCreated, _EventStream_handleError;
var init_EventStream = __esm(() => {
  init_tslib();
  init_error2();
  _EventStream_connectedPromise = new WeakMap, _EventStream_resolveConnectedPromise = new WeakMap, _EventStream_rejectConnectedPromise = new WeakMap, _EventStream_endPromise = new WeakMap, _EventStream_resolveEndPromise = new WeakMap, _EventStream_rejectEndPromise = new WeakMap, _EventStream_listeners = new WeakMap, _EventStream_ended = new WeakMap, _EventStream_errored = new WeakMap, _EventStream_aborted = new WeakMap, _EventStream_catchingPromiseCreated = new WeakMap, _EventStream_instances = new WeakSet, _EventStream_handleError = function _EventStream_handleError2(error2) {
    __classPrivateFieldSet(this, _EventStream_errored, true, "f");
    if (error2 instanceof Error && error2.name === "AbortError") {
      error2 = new APIUserAbortError;
    }
    if (error2 instanceof APIUserAbortError) {
      __classPrivateFieldSet(this, _EventStream_aborted, true, "f");
      return this._emit("abort", error2);
    }
    if (error2 instanceof OpenAIError) {
      return this._emit("error", error2);
    }
    if (error2 instanceof Error) {
      const openAIError = new OpenAIError(error2.message);
      openAIError.cause = error2;
      return this._emit("error", openAIError);
    }
    return this._emit("error", new OpenAIError(String(error2)));
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/lib/RunnableFunction.mjs
function isRunnableFunctionWithParse(fn) {
  return typeof fn.parse === "function";
}

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/lib/AbstractChatCompletionRunner.mjs
var _AbstractChatCompletionRunner_instances, _AbstractChatCompletionRunner_getFinalContent, _AbstractChatCompletionRunner_getFinalMessage, _AbstractChatCompletionRunner_getFinalFunctionToolCall, _AbstractChatCompletionRunner_getFinalFunctionToolCallResult, _AbstractChatCompletionRunner_calculateTotalUsage, _AbstractChatCompletionRunner_validateParams, _AbstractChatCompletionRunner_stringifyFunctionCallResult, DEFAULT_MAX_CHAT_COMPLETIONS = 10, AbstractChatCompletionRunner;
var init_AbstractChatCompletionRunner = __esm(() => {
  init_tslib();
  init_error2();
  init_parser();
  init_EventStream();
  AbstractChatCompletionRunner = class AbstractChatCompletionRunner extends EventStream {
    constructor() {
      super(...arguments);
      _AbstractChatCompletionRunner_instances.add(this);
      this._chatCompletions = [];
      this.messages = [];
    }
    _addChatCompletion(chatCompletion) {
      this._chatCompletions.push(chatCompletion);
      this._emit("chatCompletion", chatCompletion);
      const message = chatCompletion.choices[0]?.message;
      if (message)
        this._addMessage(message);
      return chatCompletion;
    }
    _addMessage(message, emit = true) {
      if (!("content" in message))
        message.content = null;
      this.messages.push(message);
      if (emit) {
        this._emit("message", message);
        if (isToolMessage(message) && message.content) {
          this._emit("functionToolCallResult", message.content);
        } else if (isAssistantMessage(message) && message.tool_calls) {
          for (const tool_call of message.tool_calls) {
            if (tool_call.type === "function") {
              this._emit("functionToolCall", tool_call.function);
            }
          }
        }
      }
    }
    async finalChatCompletion() {
      await this.done();
      const completion = this._chatCompletions[this._chatCompletions.length - 1];
      if (!completion)
        throw new OpenAIError("stream ended without producing a ChatCompletion");
      return completion;
    }
    async finalContent() {
      await this.done();
      return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalContent).call(this);
    }
    async finalMessage() {
      await this.done();
      return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this);
    }
    async finalFunctionToolCall() {
      await this.done();
      return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionToolCall).call(this);
    }
    async finalFunctionToolCallResult() {
      await this.done();
      return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionToolCallResult).call(this);
    }
    async totalUsage() {
      await this.done();
      return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_calculateTotalUsage).call(this);
    }
    allChatCompletions() {
      return [...this._chatCompletions];
    }
    _emitFinal() {
      const completion = this._chatCompletions[this._chatCompletions.length - 1];
      if (completion)
        this._emit("finalChatCompletion", completion);
      const finalMessage = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this);
      if (finalMessage)
        this._emit("finalMessage", finalMessage);
      const finalContent = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalContent).call(this);
      if (finalContent)
        this._emit("finalContent", finalContent);
      const finalFunctionCall = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionToolCall).call(this);
      if (finalFunctionCall)
        this._emit("finalFunctionToolCall", finalFunctionCall);
      const finalFunctionCallResult = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionToolCallResult).call(this);
      if (finalFunctionCallResult != null)
        this._emit("finalFunctionToolCallResult", finalFunctionCallResult);
      if (this._chatCompletions.some((c) => c.usage)) {
        this._emit("totalUsage", __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_calculateTotalUsage).call(this));
      }
    }
    async _createChatCompletion(client, params, options) {
      const signal = options?.signal;
      if (signal) {
        if (signal.aborted)
          this.controller.abort();
        signal.addEventListener("abort", () => this.controller.abort());
      }
      __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_validateParams).call(this, params);
      const chatCompletion = await client.chat.completions.create({ ...params, stream: false }, { ...options, signal: this.controller.signal });
      this._connected();
      return this._addChatCompletion(parseChatCompletion(chatCompletion, params));
    }
    async _runChatCompletion(client, params, options) {
      for (const message of params.messages) {
        this._addMessage(message, false);
      }
      return await this._createChatCompletion(client, params, options);
    }
    async _runTools(client, params, options) {
      const role = "tool";
      const { tool_choice = "auto", stream, ...restParams } = params;
      const singleFunctionToCall = typeof tool_choice !== "string" && tool_choice.type === "function" && tool_choice?.function?.name;
      const { maxChatCompletions = DEFAULT_MAX_CHAT_COMPLETIONS } = options || {};
      const inputTools = params.tools.map((tool) => {
        if (isAutoParsableTool(tool)) {
          if (!tool.$callback) {
            throw new OpenAIError("Tool given to `.runTools()` that does not have an associated function");
          }
          return {
            type: "function",
            function: {
              function: tool.$callback,
              name: tool.function.name,
              description: tool.function.description || "",
              parameters: tool.function.parameters,
              parse: tool.$parseRaw,
              strict: true
            }
          };
        }
        return tool;
      });
      const functionsByName = {};
      for (const f of inputTools) {
        if (f.type === "function") {
          functionsByName[f.function.name || f.function.function.name] = f.function;
        }
      }
      const tools = "tools" in params ? inputTools.map((t) => t.type === "function" ? {
        type: "function",
        function: {
          name: t.function.name || t.function.function.name,
          parameters: t.function.parameters,
          description: t.function.description,
          strict: t.function.strict
        }
      } : t) : undefined;
      for (const message of params.messages) {
        this._addMessage(message, false);
      }
      for (let i = 0;i < maxChatCompletions; ++i) {
        const chatCompletion = await this._createChatCompletion(client, {
          ...restParams,
          tool_choice,
          tools,
          messages: [...this.messages]
        }, options);
        const message = chatCompletion.choices[0]?.message;
        if (!message) {
          throw new OpenAIError(`missing message in ChatCompletion response`);
        }
        if (!message.tool_calls?.length) {
          return;
        }
        for (const tool_call of message.tool_calls) {
          if (tool_call.type !== "function")
            continue;
          const tool_call_id = tool_call.id;
          const { name, arguments: args } = tool_call.function;
          const fn = functionsByName[name];
          if (!fn) {
            const content2 = `Invalid tool_call: ${JSON.stringify(name)}. Available options are: ${Object.keys(functionsByName).map((name2) => JSON.stringify(name2)).join(", ")}. Please try again`;
            this._addMessage({ role, tool_call_id, content: content2 });
            continue;
          } else if (singleFunctionToCall && singleFunctionToCall !== name) {
            const content2 = `Invalid tool_call: ${JSON.stringify(name)}. ${JSON.stringify(singleFunctionToCall)} requested. Please try again`;
            this._addMessage({ role, tool_call_id, content: content2 });
            continue;
          }
          let parsed;
          try {
            parsed = isRunnableFunctionWithParse(fn) ? await fn.parse(args) : args;
          } catch (error2) {
            const content2 = error2 instanceof Error ? error2.message : String(error2);
            this._addMessage({ role, tool_call_id, content: content2 });
            continue;
          }
          const rawContent = await fn.function(parsed, this);
          const content = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_stringifyFunctionCallResult).call(this, rawContent);
          this._addMessage({ role, tool_call_id, content });
          if (singleFunctionToCall) {
            return;
          }
        }
      }
      return;
    }
  };
  _AbstractChatCompletionRunner_instances = new WeakSet, _AbstractChatCompletionRunner_getFinalContent = function _AbstractChatCompletionRunner_getFinalContent2() {
    return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this).content ?? null;
  }, _AbstractChatCompletionRunner_getFinalMessage = function _AbstractChatCompletionRunner_getFinalMessage2() {
    let i = this.messages.length;
    while (i-- > 0) {
      const message = this.messages[i];
      if (isAssistantMessage(message)) {
        const ret = {
          ...message,
          content: message.content ?? null,
          refusal: message.refusal ?? null
        };
        return ret;
      }
    }
    throw new OpenAIError("stream ended without producing a ChatCompletionMessage with role=assistant");
  }, _AbstractChatCompletionRunner_getFinalFunctionToolCall = function _AbstractChatCompletionRunner_getFinalFunctionToolCall2() {
    for (let i = this.messages.length - 1;i >= 0; i--) {
      const message = this.messages[i];
      if (isAssistantMessage(message) && message?.tool_calls?.length) {
        for (let j = message.tool_calls.length - 1;j >= 0; j--) {
          const toolCall = message.tool_calls[j];
          if (toolCall?.type === "function") {
            return toolCall.function;
          }
        }
      }
    }
    return;
  }, _AbstractChatCompletionRunner_getFinalFunctionToolCallResult = function _AbstractChatCompletionRunner_getFinalFunctionToolCallResult2() {
    for (let i = this.messages.length - 1;i >= 0; i--) {
      const message = this.messages[i];
      if (isToolMessage(message) && message.content != null && typeof message.content === "string" && this.messages.some((x) => x.role === "assistant" && x.tool_calls?.some((y) => y.type === "function" && y.id === message.tool_call_id))) {
        return message.content;
      }
    }
    return;
  }, _AbstractChatCompletionRunner_calculateTotalUsage = function _AbstractChatCompletionRunner_calculateTotalUsage2() {
    const total = {
      completion_tokens: 0,
      prompt_tokens: 0,
      total_tokens: 0
    };
    for (const { usage } of this._chatCompletions) {
      if (usage) {
        total.completion_tokens += usage.completion_tokens;
        total.prompt_tokens += usage.prompt_tokens;
        total.total_tokens += usage.total_tokens;
      }
    }
    return total;
  }, _AbstractChatCompletionRunner_validateParams = function _AbstractChatCompletionRunner_validateParams2(params) {
    if (params.n != null && params.n > 1) {
      throw new OpenAIError("ChatCompletion convenience helpers only support n=1 at this time. To use n>1, please use chat.completions.create() directly.");
    }
  }, _AbstractChatCompletionRunner_stringifyFunctionCallResult = function _AbstractChatCompletionRunner_stringifyFunctionCallResult2(rawContent) {
    return typeof rawContent === "string" ? rawContent : rawContent === undefined ? "undefined" : JSON.stringify(rawContent);
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/lib/ChatCompletionRunner.mjs
var ChatCompletionRunner;
var init_ChatCompletionRunner = __esm(() => {
  init_AbstractChatCompletionRunner();
  ChatCompletionRunner = class ChatCompletionRunner extends AbstractChatCompletionRunner {
    static runTools(client, params, options) {
      const runner = new ChatCompletionRunner;
      const opts = {
        ...options,
        headers: { ...options?.headers, "X-Stainless-Helper-Method": "runTools" }
      };
      runner._run(() => runner._runTools(client, params, opts));
      return runner;
    }
    _addMessage(message, emit = true) {
      super._addMessage(message, emit);
      if (isAssistantMessage(message) && message.content) {
        this._emit("content", message.content);
      }
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/_vendor/partial-json-parser/parser.mjs
function parseJSON(jsonString, allowPartial = Allow.ALL) {
  if (typeof jsonString !== "string") {
    throw new TypeError(`expecting str, got ${typeof jsonString}`);
  }
  if (!jsonString.trim()) {
    throw new Error(`${jsonString} is empty`);
  }
  return _parseJSON(jsonString.trim(), allowPartial);
}
var STR = 1, NUM = 2, ARR = 4, OBJ = 8, NULL = 16, BOOL = 32, NAN = 64, INFINITY = 128, MINUS_INFINITY = 256, INF, SPECIAL, ATOM, COLLECTION, ALL, Allow, PartialJSON, MalformedJSON, _parseJSON = (jsonString, allow) => {
  const length = jsonString.length;
  let index = 0;
  const markPartialJSON = (msg) => {
    throw new PartialJSON(`${msg} at position ${index}`);
  };
  const throwMalformedError = (msg) => {
    throw new MalformedJSON(`${msg} at position ${index}`);
  };
  const parseAny = () => {
    skipBlank();
    if (index >= length)
      markPartialJSON("Unexpected end of input");
    if (jsonString[index] === '"')
      return parseStr();
    if (jsonString[index] === "{")
      return parseObj();
    if (jsonString[index] === "[")
      return parseArr();
    if (jsonString.substring(index, index + 4) === "null" || Allow.NULL & allow && length - index < 4 && "null".startsWith(jsonString.substring(index))) {
      index += 4;
      return null;
    }
    if (jsonString.substring(index, index + 4) === "true" || Allow.BOOL & allow && length - index < 4 && "true".startsWith(jsonString.substring(index))) {
      index += 4;
      return true;
    }
    if (jsonString.substring(index, index + 5) === "false" || Allow.BOOL & allow && length - index < 5 && "false".startsWith(jsonString.substring(index))) {
      index += 5;
      return false;
    }
    if (jsonString.substring(index, index + 8) === "Infinity" || Allow.INFINITY & allow && length - index < 8 && "Infinity".startsWith(jsonString.substring(index))) {
      index += 8;
      return Infinity;
    }
    if (jsonString.substring(index, index + 9) === "-Infinity" || Allow.MINUS_INFINITY & allow && 1 < length - index && length - index < 9 && "-Infinity".startsWith(jsonString.substring(index))) {
      index += 9;
      return -Infinity;
    }
    if (jsonString.substring(index, index + 3) === "NaN" || Allow.NAN & allow && length - index < 3 && "NaN".startsWith(jsonString.substring(index))) {
      index += 3;
      return NaN;
    }
    return parseNum();
  };
  const parseStr = () => {
    const start = index;
    let escape2 = false;
    index++;
    while (index < length && (jsonString[index] !== '"' || escape2 && jsonString[index - 1] === "\\")) {
      escape2 = jsonString[index] === "\\" ? !escape2 : false;
      index++;
    }
    if (jsonString.charAt(index) == '"') {
      try {
        return JSON.parse(jsonString.substring(start, ++index - Number(escape2)));
      } catch (e) {
        throwMalformedError(String(e));
      }
    } else if (Allow.STR & allow) {
      try {
        return JSON.parse(jsonString.substring(start, index - Number(escape2)) + '"');
      } catch (e) {
        return JSON.parse(jsonString.substring(start, jsonString.lastIndexOf("\\")) + '"');
      }
    }
    markPartialJSON("Unterminated string literal");
  };
  const parseObj = () => {
    index++;
    skipBlank();
    const obj = {};
    try {
      while (jsonString[index] !== "}") {
        skipBlank();
        if (index >= length && Allow.OBJ & allow)
          return obj;
        const key = parseStr();
        skipBlank();
        index++;
        try {
          const value = parseAny();
          Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
        } catch (e) {
          if (Allow.OBJ & allow)
            return obj;
          else
            throw e;
        }
        skipBlank();
        if (jsonString[index] === ",")
          index++;
      }
    } catch (e) {
      if (Allow.OBJ & allow)
        return obj;
      else
        markPartialJSON("Expected '}' at end of object");
    }
    index++;
    return obj;
  };
  const parseArr = () => {
    index++;
    const arr = [];
    try {
      while (jsonString[index] !== "]") {
        arr.push(parseAny());
        skipBlank();
        if (jsonString[index] === ",") {
          index++;
        }
      }
    } catch (e) {
      if (Allow.ARR & allow) {
        return arr;
      }
      markPartialJSON("Expected ']' at end of array");
    }
    index++;
    return arr;
  };
  const parseNum = () => {
    if (index === 0) {
      if (jsonString === "-" && Allow.NUM & allow)
        markPartialJSON("Not sure what '-' is");
      try {
        return JSON.parse(jsonString);
      } catch (e) {
        if (Allow.NUM & allow) {
          try {
            if (jsonString[jsonString.length - 1] === ".")
              return JSON.parse(jsonString.substring(0, jsonString.lastIndexOf(".")));
            return JSON.parse(jsonString.substring(0, jsonString.lastIndexOf("e")));
          } catch (e2) {}
        }
        throwMalformedError(String(e));
      }
    }
    const start = index;
    if (jsonString[index] === "-")
      index++;
    while (jsonString[index] && !",]}".includes(jsonString[index]))
      index++;
    if (index == length && !(Allow.NUM & allow))
      markPartialJSON("Unterminated number literal");
    try {
      return JSON.parse(jsonString.substring(start, index));
    } catch (e) {
      if (jsonString.substring(start, index) === "-" && Allow.NUM & allow)
        markPartialJSON("Not sure what '-' is");
      try {
        return JSON.parse(jsonString.substring(start, jsonString.lastIndexOf("e")));
      } catch (e2) {
        throwMalformedError(String(e2));
      }
    }
  };
  const skipBlank = () => {
    while (index < length && ` 
\r	`.includes(jsonString[index])) {
      index++;
    }
  };
  return parseAny();
}, partialParse = (input) => parseJSON(input, Allow.ALL ^ Allow.NUM);
var init_parser2 = __esm(() => {
  INF = INFINITY | MINUS_INFINITY;
  SPECIAL = NULL | BOOL | INF | NAN;
  ATOM = STR | NUM | SPECIAL;
  COLLECTION = ARR | OBJ;
  ALL = ATOM | COLLECTION;
  Allow = {
    STR,
    NUM,
    ARR,
    OBJ,
    NULL,
    BOOL,
    NAN,
    INFINITY,
    MINUS_INFINITY,
    INF,
    SPECIAL,
    ATOM,
    COLLECTION,
    ALL
  };
  PartialJSON = class PartialJSON extends Error {
  };
  MalformedJSON = class MalformedJSON extends Error {
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/streaming.mjs
var init_streaming2 = __esm(() => {
  init_streaming();
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/lib/ChatCompletionStream.mjs
function finalizeChatCompletion(snapshot, params) {
  const { id, choices, created, model, system_fingerprint, ...rest } = snapshot;
  const completion = {
    ...rest,
    id,
    choices: choices.map(({ message, finish_reason, index, logprobs, ...choiceRest }) => {
      if (!finish_reason) {
        throw new OpenAIError(`missing finish_reason for choice ${index}`);
      }
      const { content = null, function_call, tool_calls, ...messageRest } = message;
      const role = message.role;
      if (!role) {
        throw new OpenAIError(`missing role for choice ${index}`);
      }
      if (function_call) {
        const { arguments: args, name } = function_call;
        if (args == null) {
          throw new OpenAIError(`missing function_call.arguments for choice ${index}`);
        }
        if (!name) {
          throw new OpenAIError(`missing function_call.name for choice ${index}`);
        }
        return {
          ...choiceRest,
          message: {
            content,
            function_call: { arguments: args, name },
            role,
            refusal: message.refusal ?? null
          },
          finish_reason,
          index,
          logprobs
        };
      }
      if (tool_calls) {
        return {
          ...choiceRest,
          index,
          finish_reason,
          logprobs,
          message: {
            ...messageRest,
            role,
            content,
            refusal: message.refusal ?? null,
            tool_calls: tool_calls.map((tool_call, i) => {
              const { function: fn, type, id: id2, ...toolRest } = tool_call;
              const { arguments: args, name, ...fnRest } = fn || {};
              if (id2 == null) {
                throw new OpenAIError(`missing choices[${index}].tool_calls[${i}].id
${str(snapshot)}`);
              }
              if (type == null) {
                throw new OpenAIError(`missing choices[${index}].tool_calls[${i}].type
${str(snapshot)}`);
              }
              if (name == null) {
                throw new OpenAIError(`missing choices[${index}].tool_calls[${i}].function.name
${str(snapshot)}`);
              }
              if (args == null) {
                throw new OpenAIError(`missing choices[${index}].tool_calls[${i}].function.arguments
${str(snapshot)}`);
              }
              return { ...toolRest, id: id2, type, function: { ...fnRest, name, arguments: args } };
            })
          }
        };
      }
      return {
        ...choiceRest,
        message: { ...messageRest, content, role, refusal: message.refusal ?? null },
        finish_reason,
        index,
        logprobs
      };
    }),
    created,
    model,
    object: "chat.completion",
    ...system_fingerprint ? { system_fingerprint } : {}
  };
  return maybeParseChatCompletion(completion, params);
}
function str(x) {
  return JSON.stringify(x);
}
function assertIsEmpty(obj) {
  return;
}
function assertNever(_x) {}
var _ChatCompletionStream_instances, _ChatCompletionStream_params, _ChatCompletionStream_choiceEventStates, _ChatCompletionStream_currentChatCompletionSnapshot, _ChatCompletionStream_beginRequest, _ChatCompletionStream_getChoiceEventState, _ChatCompletionStream_addChunk, _ChatCompletionStream_emitToolCallDoneEvent, _ChatCompletionStream_emitContentDoneEvents, _ChatCompletionStream_endRequest, _ChatCompletionStream_getAutoParseableResponseFormat, _ChatCompletionStream_accumulateChatCompletion, ChatCompletionStream;
var init_ChatCompletionStream = __esm(() => {
  init_tslib();
  init_parser2();
  init_error2();
  init_parser();
  init_streaming2();
  init_AbstractChatCompletionRunner();
  ChatCompletionStream = class ChatCompletionStream extends AbstractChatCompletionRunner {
    constructor(params) {
      super();
      _ChatCompletionStream_instances.add(this);
      _ChatCompletionStream_params.set(this, undefined);
      _ChatCompletionStream_choiceEventStates.set(this, undefined);
      _ChatCompletionStream_currentChatCompletionSnapshot.set(this, undefined);
      __classPrivateFieldSet(this, _ChatCompletionStream_params, params, "f");
      __classPrivateFieldSet(this, _ChatCompletionStream_choiceEventStates, [], "f");
    }
    get currentChatCompletionSnapshot() {
      return __classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
    }
    static fromReadableStream(stream) {
      const runner = new ChatCompletionStream(null);
      runner._run(() => runner._fromReadableStream(stream));
      return runner;
    }
    static createChatCompletion(client, params, options) {
      const runner = new ChatCompletionStream(params);
      runner._run(() => runner._runChatCompletion(client, { ...params, stream: true }, { ...options, headers: { ...options?.headers, "X-Stainless-Helper-Method": "stream" } }));
      return runner;
    }
    async _createChatCompletion(client, params, options) {
      super._createChatCompletion;
      const signal = options?.signal;
      if (signal) {
        if (signal.aborted)
          this.controller.abort();
        signal.addEventListener("abort", () => this.controller.abort());
      }
      __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_beginRequest).call(this);
      const stream = await client.chat.completions.create({ ...params, stream: true }, { ...options, signal: this.controller.signal });
      this._connected();
      for await (const chunk of stream) {
        __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_addChunk).call(this, chunk);
      }
      if (stream.controller.signal?.aborted) {
        throw new APIUserAbortError;
      }
      return this._addChatCompletion(__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
    }
    async _fromReadableStream(readableStream, options) {
      const signal = options?.signal;
      if (signal) {
        if (signal.aborted)
          this.controller.abort();
        signal.addEventListener("abort", () => this.controller.abort());
      }
      __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_beginRequest).call(this);
      this._connected();
      const stream = Stream.fromReadableStream(readableStream, this.controller);
      let chatId;
      for await (const chunk of stream) {
        if (chatId && chatId !== chunk.id) {
          this._addChatCompletion(__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
        }
        __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_addChunk).call(this, chunk);
        chatId = chunk.id;
      }
      if (stream.controller.signal?.aborted) {
        throw new APIUserAbortError;
      }
      return this._addChatCompletion(__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
    }
    [(_ChatCompletionStream_params = new WeakMap, _ChatCompletionStream_choiceEventStates = new WeakMap, _ChatCompletionStream_currentChatCompletionSnapshot = new WeakMap, _ChatCompletionStream_instances = new WeakSet, _ChatCompletionStream_beginRequest = function _ChatCompletionStream_beginRequest2() {
      if (this.ended)
        return;
      __classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, undefined, "f");
    }, _ChatCompletionStream_getChoiceEventState = function _ChatCompletionStream_getChoiceEventState2(choice) {
      let state = __classPrivateFieldGet(this, _ChatCompletionStream_choiceEventStates, "f")[choice.index];
      if (state) {
        return state;
      }
      state = {
        content_done: false,
        refusal_done: false,
        logprobs_content_done: false,
        logprobs_refusal_done: false,
        done_tool_calls: new Set,
        current_tool_call_index: null
      };
      __classPrivateFieldGet(this, _ChatCompletionStream_choiceEventStates, "f")[choice.index] = state;
      return state;
    }, _ChatCompletionStream_addChunk = function _ChatCompletionStream_addChunk2(chunk) {
      if (this.ended)
        return;
      const completion = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_accumulateChatCompletion).call(this, chunk);
      this._emit("chunk", chunk, completion);
      for (const choice of chunk.choices) {
        const choiceSnapshot = completion.choices[choice.index];
        if (choice.delta.content != null && choiceSnapshot.message?.role === "assistant" && choiceSnapshot.message?.content) {
          this._emit("content", choice.delta.content, choiceSnapshot.message.content);
          this._emit("content.delta", {
            delta: choice.delta.content,
            snapshot: choiceSnapshot.message.content,
            parsed: choiceSnapshot.message.parsed
          });
        }
        if (choice.delta.refusal != null && choiceSnapshot.message?.role === "assistant" && choiceSnapshot.message?.refusal) {
          this._emit("refusal.delta", {
            delta: choice.delta.refusal,
            snapshot: choiceSnapshot.message.refusal
          });
        }
        if (choice.logprobs?.content != null && choiceSnapshot.message?.role === "assistant") {
          this._emit("logprobs.content.delta", {
            content: choice.logprobs?.content,
            snapshot: choiceSnapshot.logprobs?.content ?? []
          });
        }
        if (choice.logprobs?.refusal != null && choiceSnapshot.message?.role === "assistant") {
          this._emit("logprobs.refusal.delta", {
            refusal: choice.logprobs?.refusal,
            snapshot: choiceSnapshot.logprobs?.refusal ?? []
          });
        }
        const state = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
        if (choiceSnapshot.finish_reason) {
          __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitContentDoneEvents).call(this, choiceSnapshot);
          if (state.current_tool_call_index != null) {
            __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitToolCallDoneEvent).call(this, choiceSnapshot, state.current_tool_call_index);
          }
        }
        for (const toolCall of choice.delta.tool_calls ?? []) {
          if (state.current_tool_call_index !== toolCall.index) {
            __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitContentDoneEvents).call(this, choiceSnapshot);
            if (state.current_tool_call_index != null) {
              __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitToolCallDoneEvent).call(this, choiceSnapshot, state.current_tool_call_index);
            }
          }
          state.current_tool_call_index = toolCall.index;
        }
        for (const toolCallDelta of choice.delta.tool_calls ?? []) {
          const toolCallSnapshot = choiceSnapshot.message.tool_calls?.[toolCallDelta.index];
          if (!toolCallSnapshot?.type) {
            continue;
          }
          if (toolCallSnapshot?.type === "function") {
            this._emit("tool_calls.function.arguments.delta", {
              name: toolCallSnapshot.function?.name,
              index: toolCallDelta.index,
              arguments: toolCallSnapshot.function.arguments,
              parsed_arguments: toolCallSnapshot.function.parsed_arguments,
              arguments_delta: toolCallDelta.function?.arguments ?? ""
            });
          } else {
            assertNever(toolCallSnapshot?.type);
          }
        }
      }
    }, _ChatCompletionStream_emitToolCallDoneEvent = function _ChatCompletionStream_emitToolCallDoneEvent2(choiceSnapshot, toolCallIndex) {
      const state = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
      if (state.done_tool_calls.has(toolCallIndex)) {
        return;
      }
      const toolCallSnapshot = choiceSnapshot.message.tool_calls?.[toolCallIndex];
      if (!toolCallSnapshot) {
        throw new Error("no tool call snapshot");
      }
      if (!toolCallSnapshot.type) {
        throw new Error("tool call snapshot missing `type`");
      }
      if (toolCallSnapshot.type === "function") {
        const inputTool = __classPrivateFieldGet(this, _ChatCompletionStream_params, "f")?.tools?.find((tool) => isChatCompletionFunctionTool(tool) && tool.function.name === toolCallSnapshot.function.name);
        this._emit("tool_calls.function.arguments.done", {
          name: toolCallSnapshot.function.name,
          index: toolCallIndex,
          arguments: toolCallSnapshot.function.arguments,
          parsed_arguments: isAutoParsableTool(inputTool) ? inputTool.$parseRaw(toolCallSnapshot.function.arguments) : inputTool?.function.strict ? JSON.parse(toolCallSnapshot.function.arguments) : null
        });
      } else {
        assertNever(toolCallSnapshot.type);
      }
    }, _ChatCompletionStream_emitContentDoneEvents = function _ChatCompletionStream_emitContentDoneEvents2(choiceSnapshot) {
      const state = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
      if (choiceSnapshot.message.content && !state.content_done) {
        state.content_done = true;
        const responseFormat = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getAutoParseableResponseFormat).call(this);
        this._emit("content.done", {
          content: choiceSnapshot.message.content,
          parsed: responseFormat ? responseFormat.$parseRaw(choiceSnapshot.message.content) : null
        });
      }
      if (choiceSnapshot.message.refusal && !state.refusal_done) {
        state.refusal_done = true;
        this._emit("refusal.done", { refusal: choiceSnapshot.message.refusal });
      }
      if (choiceSnapshot.logprobs?.content && !state.logprobs_content_done) {
        state.logprobs_content_done = true;
        this._emit("logprobs.content.done", { content: choiceSnapshot.logprobs.content });
      }
      if (choiceSnapshot.logprobs?.refusal && !state.logprobs_refusal_done) {
        state.logprobs_refusal_done = true;
        this._emit("logprobs.refusal.done", { refusal: choiceSnapshot.logprobs.refusal });
      }
    }, _ChatCompletionStream_endRequest = function _ChatCompletionStream_endRequest2() {
      if (this.ended) {
        throw new OpenAIError(`stream has ended, this shouldn't happen`);
      }
      const snapshot = __classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
      if (!snapshot) {
        throw new OpenAIError(`request ended without sending any chunks`);
      }
      __classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, undefined, "f");
      __classPrivateFieldSet(this, _ChatCompletionStream_choiceEventStates, [], "f");
      return finalizeChatCompletion(snapshot, __classPrivateFieldGet(this, _ChatCompletionStream_params, "f"));
    }, _ChatCompletionStream_getAutoParseableResponseFormat = function _ChatCompletionStream_getAutoParseableResponseFormat2() {
      const responseFormat = __classPrivateFieldGet(this, _ChatCompletionStream_params, "f")?.response_format;
      if (isAutoParsableResponseFormat(responseFormat)) {
        return responseFormat;
      }
      return null;
    }, _ChatCompletionStream_accumulateChatCompletion = function _ChatCompletionStream_accumulateChatCompletion2(chunk) {
      var _a, _b, _c2, _d;
      let snapshot = __classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
      const { choices, ...rest } = chunk;
      if (!snapshot) {
        snapshot = __classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, {
          ...rest,
          choices: []
        }, "f");
      } else {
        Object.assign(snapshot, rest);
      }
      for (const { delta, finish_reason, index, logprobs = null, ...other } of chunk.choices) {
        let choice = snapshot.choices[index];
        if (!choice) {
          choice = snapshot.choices[index] = { finish_reason, index, message: {}, logprobs, ...other };
        }
        if (logprobs) {
          if (!choice.logprobs) {
            choice.logprobs = Object.assign({}, logprobs);
          } else {
            const { content: content2, refusal: refusal2, ...rest3 } = logprobs;
            assertIsEmpty(rest3);
            Object.assign(choice.logprobs, rest3);
            if (content2) {
              (_a = choice.logprobs).content ?? (_a.content = []);
              choice.logprobs.content.push(...content2);
            }
            if (refusal2) {
              (_b = choice.logprobs).refusal ?? (_b.refusal = []);
              choice.logprobs.refusal.push(...refusal2);
            }
          }
        }
        if (finish_reason) {
          choice.finish_reason = finish_reason;
          if (__classPrivateFieldGet(this, _ChatCompletionStream_params, "f") && hasAutoParseableInput(__classPrivateFieldGet(this, _ChatCompletionStream_params, "f"))) {
            if (finish_reason === "length") {
              throw new LengthFinishReasonError;
            }
            if (finish_reason === "content_filter") {
              throw new ContentFilterFinishReasonError;
            }
          }
        }
        Object.assign(choice, other);
        if (!delta)
          continue;
        const { content, refusal, function_call, role, tool_calls, ...rest2 } = delta;
        assertIsEmpty(rest2);
        Object.assign(choice.message, rest2);
        if (refusal) {
          choice.message.refusal = (choice.message.refusal || "") + refusal;
        }
        if (role)
          choice.message.role = role;
        if (function_call) {
          if (!choice.message.function_call) {
            choice.message.function_call = function_call;
          } else {
            if (function_call.name)
              choice.message.function_call.name = function_call.name;
            if (function_call.arguments) {
              (_c2 = choice.message.function_call).arguments ?? (_c2.arguments = "");
              choice.message.function_call.arguments += function_call.arguments;
            }
          }
        }
        if (content) {
          choice.message.content = (choice.message.content || "") + content;
          if (!choice.message.refusal && __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getAutoParseableResponseFormat).call(this)) {
            choice.message.parsed = partialParse(choice.message.content);
          }
        }
        if (tool_calls) {
          if (!choice.message.tool_calls)
            choice.message.tool_calls = [];
          for (const { index: index2, id, type, function: fn, ...rest3 } of tool_calls) {
            const tool_call = (_d = choice.message.tool_calls)[index2] ?? (_d[index2] = {});
            Object.assign(tool_call, rest3);
            if (id)
              tool_call.id = id;
            if (type)
              tool_call.type = type;
            if (fn)
              tool_call.function ?? (tool_call.function = { name: fn.name ?? "", arguments: "" });
            if (fn?.name)
              tool_call.function.name = fn.name;
            if (fn?.arguments) {
              tool_call.function.arguments += fn.arguments;
              if (shouldParseToolCall(__classPrivateFieldGet(this, _ChatCompletionStream_params, "f"), tool_call)) {
                tool_call.function.parsed_arguments = partialParse(tool_call.function.arguments);
              }
            }
          }
        }
      }
      return snapshot;
    }, Symbol.asyncIterator)]() {
      const pushQueue = [];
      const readQueue = [];
      let done = false;
      this.on("chunk", (chunk) => {
        const reader = readQueue.shift();
        if (reader) {
          reader.resolve(chunk);
        } else {
          pushQueue.push(chunk);
        }
      });
      this.on("end", () => {
        done = true;
        for (const reader of readQueue) {
          reader.resolve(undefined);
        }
        readQueue.length = 0;
      });
      this.on("abort", (err) => {
        done = true;
        for (const reader of readQueue) {
          reader.reject(err);
        }
        readQueue.length = 0;
      });
      this.on("error", (err) => {
        done = true;
        for (const reader of readQueue) {
          reader.reject(err);
        }
        readQueue.length = 0;
      });
      return {
        next: async () => {
          if (!pushQueue.length) {
            if (done) {
              return { value: undefined, done: true };
            }
            return new Promise((resolve4, reject) => readQueue.push({ resolve: resolve4, reject })).then((chunk2) => chunk2 ? { value: chunk2, done: false } : { value: undefined, done: true });
          }
          const chunk = pushQueue.shift();
          return { value: chunk, done: false };
        },
        return: async () => {
          this.abort();
          return { value: undefined, done: true };
        }
      };
    }
    toReadableStream() {
      const stream = new Stream(this[Symbol.asyncIterator].bind(this), this.controller);
      return stream.toReadableStream();
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/lib/ChatCompletionStreamingRunner.mjs
var ChatCompletionStreamingRunner;
var init_ChatCompletionStreamingRunner = __esm(() => {
  init_ChatCompletionStream();
  ChatCompletionStreamingRunner = class ChatCompletionStreamingRunner extends ChatCompletionStream {
    static fromReadableStream(stream) {
      const runner = new ChatCompletionStreamingRunner(null);
      runner._run(() => runner._fromReadableStream(stream));
      return runner;
    }
    static runTools(client, params, options) {
      const runner = new ChatCompletionStreamingRunner(params);
      const opts = {
        ...options,
        headers: { ...options?.headers, "X-Stainless-Helper-Method": "runTools" }
      };
      runner._run(() => runner._runTools(client, params, opts));
      return runner;
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/chat/completions/completions.mjs
var Completions;
var init_completions = __esm(() => {
  init_messages();
  init_messages();
  init_pagination();
  init_path();
  init_ChatCompletionRunner();
  init_ChatCompletionStreamingRunner();
  init_ChatCompletionStream();
  init_parser();
  init_ChatCompletionStreamingRunner();
  init_ChatCompletionStream();
  init_ChatCompletionRunner();
  Completions = class Completions extends APIResource {
    constructor() {
      super(...arguments);
      this.messages = new Messages(this._client);
    }
    create(body, options) {
      return this._client.post("/chat/completions", {
        body,
        ...options,
        stream: body.stream ?? false,
        __security: { bearerAuth: true }
      });
    }
    retrieve(completionID, options) {
      return this._client.get(path`/chat/completions/${completionID}`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
    update(completionID, body, options) {
      return this._client.post(path`/chat/completions/${completionID}`, {
        body,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    list(query = {}, options) {
      return this._client.getAPIList("/chat/completions", CursorPage, {
        query,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    delete(completionID, options) {
      return this._client.delete(path`/chat/completions/${completionID}`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
    parse(body, options) {
      validateInputTools(body.tools);
      return this._client.chat.completions.create(body, {
        ...options,
        headers: {
          ...options?.headers,
          "X-Stainless-Helper-Method": "chat.completions.parse"
        }
      })._thenUnwrap((completion) => parseChatCompletion(completion, body));
    }
    runTools(body, options) {
      if (body.stream) {
        return ChatCompletionStreamingRunner.runTools(this._client, body, options);
      }
      return ChatCompletionRunner.runTools(this._client, body, options);
    }
    stream(body, options) {
      return ChatCompletionStream.createChatCompletion(this._client, body, options);
    }
  };
  Completions.Messages = Messages;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/chat/chat.mjs
var Chat;
var init_chat = __esm(() => {
  init_completions();
  init_completions();
  Chat = class Chat extends APIResource {
    constructor() {
      super(...arguments);
      this.completions = new Completions(this._client);
    }
  };
  Chat.Completions = Completions;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/chat/completions/index.mjs
var init_completions2 = __esm(() => {
  init_completions();
  init_messages();
  init_completions();
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/chat/index.mjs
var init_chat2 = __esm(() => {
  init_chat();
  init_completions2();
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/shared.mjs
var init_shared = () => {};

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/admin-api-keys.mjs
var AdminAPIKeys;
var init_admin_api_keys = __esm(() => {
  init_pagination();
  init_path();
  AdminAPIKeys = class AdminAPIKeys extends APIResource {
    create(body, options) {
      return this._client.post("/organization/admin_api_keys", {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    retrieve(keyID, options) {
      return this._client.get(path`/organization/admin_api_keys/${keyID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(query = {}, options) {
      return this._client.getAPIList("/organization/admin_api_keys", CursorPage, {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    delete(keyID, options) {
      return this._client.delete(path`/organization/admin_api_keys/${keyID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/audit-logs.mjs
var AuditLogs;
var init_audit_logs = __esm(() => {
  init_pagination();
  AuditLogs = class AuditLogs extends APIResource {
    list(query = {}, options) {
      return this._client.getAPIList("/organization/audit_logs", ConversationCursorPage, {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/certificates.mjs
var Certificates;
var init_certificates = __esm(() => {
  init_pagination();
  init_path();
  Certificates = class Certificates extends APIResource {
    create(body, options) {
      return this._client.post("/organization/certificates", {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    retrieve(certificateID, query = {}, options) {
      return this._client.get(path`/organization/certificates/${certificateID}`, {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    update(certificateID, body, options) {
      return this._client.post(path`/organization/certificates/${certificateID}`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(query = {}, options) {
      return this._client.getAPIList("/organization/certificates", ConversationCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
    }
    delete(certificateID, options) {
      return this._client.delete(path`/organization/certificates/${certificateID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    activate(body, options) {
      return this._client.getAPIList("/organization/certificates/activate", Page, {
        body,
        method: "post",
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    deactivate(body, options) {
      return this._client.getAPIList("/organization/certificates/deactivate", Page, { body, method: "post", ...options, __security: { adminAPIKeyAuth: true } });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/data-retention.mjs
var DataRetention;
var init_data_retention = __esm(() => {
  DataRetention = class DataRetention extends APIResource {
    retrieve(options) {
      return this._client.get("/organization/data_retention", {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    update(body, options) {
      return this._client.post("/organization/data_retention", {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/invites.mjs
var Invites;
var init_invites = __esm(() => {
  init_pagination();
  init_path();
  Invites = class Invites extends APIResource {
    create(body, options) {
      return this._client.post("/organization/invites", {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    retrieve(inviteID, options) {
      return this._client.get(path`/organization/invites/${inviteID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(query = {}, options) {
      return this._client.getAPIList("/organization/invites", ConversationCursorPage, {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    delete(inviteID, options) {
      return this._client.delete(path`/organization/invites/${inviteID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/roles.mjs
var Roles;
var init_roles = __esm(() => {
  init_pagination();
  init_path();
  Roles = class Roles extends APIResource {
    create(body, options) {
      return this._client.post("/organization/roles", {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    retrieve(roleID, options) {
      return this._client.get(path`/organization/roles/${roleID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    update(roleID, body, options) {
      return this._client.post(path`/organization/roles/${roleID}`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(query = {}, options) {
      return this._client.getAPIList("/organization/roles", NextCursorPage, {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    delete(roleID, options) {
      return this._client.delete(path`/organization/roles/${roleID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/spend-alerts.mjs
var SpendAlerts;
var init_spend_alerts = __esm(() => {
  init_pagination();
  init_path();
  SpendAlerts = class SpendAlerts extends APIResource {
    create(body, options) {
      return this._client.post("/organization/spend_alerts", {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    retrieve(alertID, options) {
      return this._client.get(path`/organization/spend_alerts/${alertID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    update(alertID, body, options) {
      return this._client.post(path`/organization/spend_alerts/${alertID}`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(query = {}, options) {
      return this._client.getAPIList("/organization/spend_alerts", ConversationCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
    }
    delete(alertID, options) {
      return this._client.delete(path`/organization/spend_alerts/${alertID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/usage.mjs
var Usage;
var init_usage = __esm(() => {
  Usage = class Usage extends APIResource {
    audioSpeeches(query, options) {
      return this._client.get("/organization/usage/audio_speeches", {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    audioTranscriptions(query, options) {
      return this._client.get("/organization/usage/audio_transcriptions", {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    codeInterpreterSessions(query, options) {
      return this._client.get("/organization/usage/code_interpreter_sessions", {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    completions(query, options) {
      return this._client.get("/organization/usage/completions", {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    costs(query, options) {
      return this._client.get("/organization/costs", {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    embeddings(query, options) {
      return this._client.get("/organization/usage/embeddings", {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    fileSearchCalls(query, options) {
      return this._client.get("/organization/usage/file_search_calls", {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    images(query, options) {
      return this._client.get("/organization/usage/images", {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    moderations(query, options) {
      return this._client.get("/organization/usage/moderations", {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    vectorStores(query, options) {
      return this._client.get("/organization/usage/vector_stores", {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    webSearchCalls(query, options) {
      return this._client.get("/organization/usage/web_search_calls", {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/groups/roles.mjs
var Roles2;
var init_roles2 = __esm(() => {
  init_pagination();
  init_path();
  Roles2 = class Roles2 extends APIResource {
    create(groupID, body, options) {
      return this._client.post(path`/organization/groups/${groupID}/roles`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    retrieve(roleID, params, options) {
      const { group_id } = params;
      return this._client.get(path`/organization/groups/${group_id}/roles/${roleID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(groupID, query = {}, options) {
      return this._client.getAPIList(path`/organization/groups/${groupID}/roles`, NextCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
    }
    delete(roleID, params, options) {
      const { group_id } = params;
      return this._client.delete(path`/organization/groups/${group_id}/roles/${roleID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/groups/users.mjs
var Users;
var init_users = __esm(() => {
  init_pagination();
  init_path();
  Users = class Users extends APIResource {
    create(groupID, body, options) {
      return this._client.post(path`/organization/groups/${groupID}/users`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    retrieve(userID, params, options) {
      const { group_id } = params;
      return this._client.get(path`/organization/groups/${group_id}/users/${userID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(groupID, query = {}, options) {
      return this._client.getAPIList(path`/organization/groups/${groupID}/users`, NextCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
    }
    delete(userID, params, options) {
      const { group_id } = params;
      return this._client.delete(path`/organization/groups/${group_id}/users/${userID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/groups/groups.mjs
var Groups;
var init_groups = __esm(() => {
  init_roles2();
  init_roles2();
  init_users();
  init_users();
  init_pagination();
  init_path();
  Groups = class Groups extends APIResource {
    constructor() {
      super(...arguments);
      this.users = new Users(this._client);
      this.roles = new Roles2(this._client);
    }
    create(body, options) {
      return this._client.post("/organization/groups", {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    retrieve(groupID, options) {
      return this._client.get(path`/organization/groups/${groupID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    update(groupID, body, options) {
      return this._client.post(path`/organization/groups/${groupID}`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(query = {}, options) {
      return this._client.getAPIList("/organization/groups", NextCursorPage, {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    delete(groupID, options) {
      return this._client.delete(path`/organization/groups/${groupID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
  Groups.Users = Users;
  Groups.Roles = Roles2;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/projects/api-keys.mjs
var APIKeys;
var init_api_keys = __esm(() => {
  init_pagination();
  init_path();
  APIKeys = class APIKeys extends APIResource {
    retrieve(apiKeyID, params, options) {
      const { project_id } = params;
      return this._client.get(path`/organization/projects/${project_id}/api_keys/${apiKeyID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(projectID, query = {}, options) {
      return this._client.getAPIList(path`/organization/projects/${projectID}/api_keys`, ConversationCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
    }
    delete(apiKeyID, params, options) {
      const { project_id } = params;
      return this._client.delete(path`/organization/projects/${project_id}/api_keys/${apiKeyID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/projects/certificates.mjs
var Certificates2;
var init_certificates2 = __esm(() => {
  init_pagination();
  init_path();
  Certificates2 = class Certificates2 extends APIResource {
    list(projectID, query = {}, options) {
      return this._client.getAPIList(path`/organization/projects/${projectID}/certificates`, ConversationCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
    }
    activate(projectID, body, options) {
      return this._client.getAPIList(path`/organization/projects/${projectID}/certificates/activate`, Page, { body, method: "post", ...options, __security: { adminAPIKeyAuth: true } });
    }
    deactivate(projectID, body, options) {
      return this._client.getAPIList(path`/organization/projects/${projectID}/certificates/deactivate`, Page, { body, method: "post", ...options, __security: { adminAPIKeyAuth: true } });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/projects/data-retention.mjs
var DataRetention2;
var init_data_retention2 = __esm(() => {
  init_path();
  DataRetention2 = class DataRetention2 extends APIResource {
    retrieve(projectID, options) {
      return this._client.get(path`/organization/projects/${projectID}/data_retention`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    update(projectID, body, options) {
      return this._client.post(path`/organization/projects/${projectID}/data_retention`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/projects/hosted-tool-permissions.mjs
var HostedToolPermissions;
var init_hosted_tool_permissions = __esm(() => {
  init_path();
  HostedToolPermissions = class HostedToolPermissions extends APIResource {
    retrieve(projectID, options) {
      return this._client.get(path`/organization/projects/${projectID}/hosted_tool_permissions`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    update(projectID, body, options) {
      return this._client.post(path`/organization/projects/${projectID}/hosted_tool_permissions`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/projects/model-permissions.mjs
var ModelPermissions;
var init_model_permissions = __esm(() => {
  init_path();
  ModelPermissions = class ModelPermissions extends APIResource {
    retrieve(projectID, options) {
      return this._client.get(path`/organization/projects/${projectID}/model_permissions`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    update(projectID, body, options) {
      return this._client.post(path`/organization/projects/${projectID}/model_permissions`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    delete(projectID, options) {
      return this._client.delete(path`/organization/projects/${projectID}/model_permissions`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/projects/rate-limits.mjs
var RateLimits;
var init_rate_limits = __esm(() => {
  init_pagination();
  init_path();
  RateLimits = class RateLimits extends APIResource {
    listRateLimits(projectID, query = {}, options) {
      return this._client.getAPIList(path`/organization/projects/${projectID}/rate_limits`, ConversationCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
    }
    updateRateLimit(rateLimitID, params, options) {
      const { project_id, ...body } = params;
      return this._client.post(path`/organization/projects/${project_id}/rate_limits/${rateLimitID}`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/projects/roles.mjs
var Roles3;
var init_roles3 = __esm(() => {
  init_pagination();
  init_path();
  Roles3 = class Roles3 extends APIResource {
    create(projectID, body, options) {
      return this._client.post(path`/projects/${projectID}/roles`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    retrieve(roleID, params, options) {
      const { project_id } = params;
      return this._client.get(path`/projects/${project_id}/roles/${roleID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    update(roleID, params, options) {
      const { project_id, ...body } = params;
      return this._client.post(path`/projects/${project_id}/roles/${roleID}`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(projectID, query = {}, options) {
      return this._client.getAPIList(path`/projects/${projectID}/roles`, NextCursorPage, {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    delete(roleID, params, options) {
      const { project_id } = params;
      return this._client.delete(path`/projects/${project_id}/roles/${roleID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/projects/service-accounts.mjs
var ServiceAccounts;
var init_service_accounts = __esm(() => {
  init_pagination();
  init_path();
  ServiceAccounts = class ServiceAccounts extends APIResource {
    create(projectID, body, options) {
      return this._client.post(path`/organization/projects/${projectID}/service_accounts`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    retrieve(serviceAccountID, params, options) {
      const { project_id } = params;
      return this._client.get(path`/organization/projects/${project_id}/service_accounts/${serviceAccountID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    update(serviceAccountID, params, options) {
      const { project_id, ...body } = params;
      return this._client.post(path`/organization/projects/${project_id}/service_accounts/${serviceAccountID}`, { body, ...options, __security: { adminAPIKeyAuth: true } });
    }
    list(projectID, query = {}, options) {
      return this._client.getAPIList(path`/organization/projects/${projectID}/service_accounts`, ConversationCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
    }
    delete(serviceAccountID, params, options) {
      const { project_id } = params;
      return this._client.delete(path`/organization/projects/${project_id}/service_accounts/${serviceAccountID}`, { ...options, __security: { adminAPIKeyAuth: true } });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/projects/spend-alerts.mjs
var SpendAlerts2;
var init_spend_alerts2 = __esm(() => {
  init_pagination();
  init_path();
  SpendAlerts2 = class SpendAlerts2 extends APIResource {
    create(projectID, body, options) {
      return this._client.post(path`/organization/projects/${projectID}/spend_alerts`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    retrieve(alertID, params, options) {
      const { project_id } = params;
      return this._client.get(path`/organization/projects/${project_id}/spend_alerts/${alertID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    update(alertID, params, options) {
      const { project_id, ...body } = params;
      return this._client.post(path`/organization/projects/${project_id}/spend_alerts/${alertID}`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(projectID, query = {}, options) {
      return this._client.getAPIList(path`/organization/projects/${projectID}/spend_alerts`, ConversationCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
    }
    delete(alertID, params, options) {
      const { project_id } = params;
      return this._client.delete(path`/organization/projects/${project_id}/spend_alerts/${alertID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/projects/groups/roles.mjs
var Roles4;
var init_roles4 = __esm(() => {
  init_pagination();
  init_path();
  Roles4 = class Roles4 extends APIResource {
    create(groupID, params, options) {
      const { project_id, ...body } = params;
      return this._client.post(path`/projects/${project_id}/groups/${groupID}/roles`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    retrieve(roleID, params, options) {
      const { project_id, group_id } = params;
      return this._client.get(path`/projects/${project_id}/groups/${group_id}/roles/${roleID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(groupID, params, options) {
      const { project_id, ...query } = params;
      return this._client.getAPIList(path`/projects/${project_id}/groups/${groupID}/roles`, NextCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
    }
    delete(roleID, params, options) {
      const { project_id, group_id } = params;
      return this._client.delete(path`/projects/${project_id}/groups/${group_id}/roles/${roleID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/projects/groups/groups.mjs
var Groups2;
var init_groups2 = __esm(() => {
  init_roles4();
  init_roles4();
  init_pagination();
  init_path();
  Groups2 = class Groups2 extends APIResource {
    constructor() {
      super(...arguments);
      this.roles = new Roles4(this._client);
    }
    create(projectID, body, options) {
      return this._client.post(path`/organization/projects/${projectID}/groups`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    retrieve(groupID, params, options) {
      const { project_id, ...query } = params;
      return this._client.get(path`/organization/projects/${project_id}/groups/${groupID}`, {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(projectID, query = {}, options) {
      return this._client.getAPIList(path`/organization/projects/${projectID}/groups`, NextCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
    }
    delete(groupID, params, options) {
      const { project_id } = params;
      return this._client.delete(path`/organization/projects/${project_id}/groups/${groupID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
  Groups2.Roles = Roles4;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/projects/users/roles.mjs
var Roles5;
var init_roles5 = __esm(() => {
  init_pagination();
  init_path();
  Roles5 = class Roles5 extends APIResource {
    create(userID, params, options) {
      const { project_id, ...body } = params;
      return this._client.post(path`/projects/${project_id}/users/${userID}/roles`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    retrieve(roleID, params, options) {
      const { project_id, user_id } = params;
      return this._client.get(path`/projects/${project_id}/users/${user_id}/roles/${roleID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(userID, params, options) {
      const { project_id, ...query } = params;
      return this._client.getAPIList(path`/projects/${project_id}/users/${userID}/roles`, NextCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
    }
    delete(roleID, params, options) {
      const { project_id, user_id } = params;
      return this._client.delete(path`/projects/${project_id}/users/${user_id}/roles/${roleID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/projects/users/users.mjs
var Users2;
var init_users2 = __esm(() => {
  init_roles5();
  init_roles5();
  init_pagination();
  init_path();
  Users2 = class Users2 extends APIResource {
    constructor() {
      super(...arguments);
      this.roles = new Roles5(this._client);
    }
    create(projectID, body, options) {
      return this._client.post(path`/organization/projects/${projectID}/users`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    retrieve(userID, params, options) {
      const { project_id } = params;
      return this._client.get(path`/organization/projects/${project_id}/users/${userID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    update(userID, params, options) {
      const { project_id, ...body } = params;
      return this._client.post(path`/organization/projects/${project_id}/users/${userID}`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(projectID, query = {}, options) {
      return this._client.getAPIList(path`/organization/projects/${projectID}/users`, ConversationCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
    }
    delete(userID, params, options) {
      const { project_id } = params;
      return this._client.delete(path`/organization/projects/${project_id}/users/${userID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
  Users2.Roles = Roles5;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/projects/projects.mjs
var Projects;
var init_projects = __esm(() => {
  init_api_keys();
  init_api_keys();
  init_certificates2();
  init_certificates2();
  init_data_retention2();
  init_data_retention2();
  init_hosted_tool_permissions();
  init_hosted_tool_permissions();
  init_model_permissions();
  init_model_permissions();
  init_rate_limits();
  init_rate_limits();
  init_roles3();
  init_roles3();
  init_service_accounts();
  init_service_accounts();
  init_spend_alerts2();
  init_spend_alerts2();
  init_groups2();
  init_groups2();
  init_users2();
  init_users2();
  init_pagination();
  init_path();
  Projects = class Projects extends APIResource {
    constructor() {
      super(...arguments);
      this.users = new Users2(this._client);
      this.serviceAccounts = new ServiceAccounts(this._client);
      this.apiKeys = new APIKeys(this._client);
      this.rateLimits = new RateLimits(this._client);
      this.modelPermissions = new ModelPermissions(this._client);
      this.hostedToolPermissions = new HostedToolPermissions(this._client);
      this.groups = new Groups2(this._client);
      this.roles = new Roles3(this._client);
      this.dataRetention = new DataRetention2(this._client);
      this.spendAlerts = new SpendAlerts2(this._client);
      this.certificates = new Certificates2(this._client);
    }
    create(body, options) {
      return this._client.post("/organization/projects", {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    retrieve(projectID, options) {
      return this._client.get(path`/organization/projects/${projectID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    update(projectID, body, options) {
      return this._client.post(path`/organization/projects/${projectID}`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(query = {}, options) {
      return this._client.getAPIList("/organization/projects", ConversationCursorPage, {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    archive(projectID, options) {
      return this._client.post(path`/organization/projects/${projectID}/archive`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
  Projects.Users = Users2;
  Projects.ServiceAccounts = ServiceAccounts;
  Projects.APIKeys = APIKeys;
  Projects.RateLimits = RateLimits;
  Projects.ModelPermissions = ModelPermissions;
  Projects.HostedToolPermissions = HostedToolPermissions;
  Projects.Groups = Groups2;
  Projects.Roles = Roles3;
  Projects.DataRetention = DataRetention2;
  Projects.SpendAlerts = SpendAlerts2;
  Projects.Certificates = Certificates2;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/users/roles.mjs
var Roles6;
var init_roles6 = __esm(() => {
  init_pagination();
  init_path();
  Roles6 = class Roles6 extends APIResource {
    create(userID, body, options) {
      return this._client.post(path`/organization/users/${userID}/roles`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    retrieve(roleID, params, options) {
      const { user_id } = params;
      return this._client.get(path`/organization/users/${user_id}/roles/${roleID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(userID, query = {}, options) {
      return this._client.getAPIList(path`/organization/users/${userID}/roles`, NextCursorPage, { query, ...options, __security: { adminAPIKeyAuth: true } });
    }
    delete(roleID, params, options) {
      const { user_id } = params;
      return this._client.delete(path`/organization/users/${user_id}/roles/${roleID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/users/users.mjs
var Users3;
var init_users3 = __esm(() => {
  init_roles6();
  init_roles6();
  init_pagination();
  init_path();
  Users3 = class Users3 extends APIResource {
    constructor() {
      super(...arguments);
      this.roles = new Roles6(this._client);
    }
    retrieve(userID, options) {
      return this._client.get(path`/organization/users/${userID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    update(userID, body, options) {
      return this._client.post(path`/organization/users/${userID}`, {
        body,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(query = {}, options) {
      return this._client.getAPIList("/organization/users", ConversationCursorPage, {
        query,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    delete(userID, options) {
      return this._client.delete(path`/organization/users/${userID}`, {
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
  };
  Users3.Roles = Roles6;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/organization/organization.mjs
var Organization;
var init_organization = __esm(() => {
  init_admin_api_keys();
  init_admin_api_keys();
  init_audit_logs();
  init_audit_logs();
  init_certificates();
  init_certificates();
  init_data_retention();
  init_data_retention();
  init_invites();
  init_invites();
  init_roles();
  init_roles();
  init_spend_alerts();
  init_spend_alerts();
  init_usage();
  init_usage();
  init_groups();
  init_groups();
  init_projects();
  init_projects();
  init_users3();
  init_users3();
  Organization = class Organization extends APIResource {
    constructor() {
      super(...arguments);
      this.auditLogs = new AuditLogs(this._client);
      this.adminAPIKeys = new AdminAPIKeys(this._client);
      this.usage = new Usage(this._client);
      this.invites = new Invites(this._client);
      this.users = new Users3(this._client);
      this.groups = new Groups(this._client);
      this.roles = new Roles(this._client);
      this.dataRetention = new DataRetention(this._client);
      this.spendAlerts = new SpendAlerts(this._client);
      this.certificates = new Certificates(this._client);
      this.projects = new Projects(this._client);
    }
  };
  Organization.AuditLogs = AuditLogs;
  Organization.AdminAPIKeys = AdminAPIKeys;
  Organization.Usage = Usage;
  Organization.Invites = Invites;
  Organization.Users = Users3;
  Organization.Groups = Groups;
  Organization.Roles = Roles;
  Organization.DataRetention = DataRetention;
  Organization.SpendAlerts = SpendAlerts;
  Organization.Certificates = Certificates;
  Organization.Projects = Projects;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/admin/admin.mjs
var Admin;
var init_admin = __esm(() => {
  init_organization();
  init_organization();
  Admin = class Admin extends APIResource {
    constructor() {
      super(...arguments);
      this.organization = new Organization(this._client);
    }
  };
  Admin.Organization = Organization;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/headers.mjs
function* iterateHeaders(headers) {
  if (!headers)
    return;
  if (brand_privateNullableHeaders in headers) {
    const { values, nulls } = headers;
    yield* values.entries();
    for (const name of nulls) {
      yield [name, null];
    }
    return;
  }
  let shouldClear = false;
  let iter;
  if (headers instanceof Headers) {
    iter = headers.entries();
  } else if (isReadonlyArray(headers)) {
    iter = headers;
  } else {
    shouldClear = true;
    iter = Object.entries(headers ?? {});
  }
  for (let row of iter) {
    const name = row[0];
    if (typeof name !== "string")
      throw new TypeError("expected header name to be a string");
    const values = isReadonlyArray(row[1]) ? row[1] : [row[1]];
    let didClear = false;
    for (const value of values) {
      if (value === undefined)
        continue;
      if (shouldClear && !didClear) {
        didClear = true;
        yield [name, null];
      }
      yield [name, value];
    }
  }
}
var brand_privateNullableHeaders, buildHeaders = (newHeaders) => {
  const targetHeaders = new Headers;
  const nullHeaders = new Set;
  for (const headers of newHeaders) {
    const seenHeaders = new Set;
    for (const [name, value] of iterateHeaders(headers)) {
      const lowerName = name.toLowerCase();
      if (!seenHeaders.has(lowerName)) {
        targetHeaders.delete(name);
        seenHeaders.add(lowerName);
      }
      if (value === null) {
        targetHeaders.delete(name);
        nullHeaders.add(lowerName);
      } else {
        targetHeaders.append(name, value);
        nullHeaders.delete(lowerName);
      }
    }
  }
  return { [brand_privateNullableHeaders]: true, values: targetHeaders, nulls: nullHeaders };
};
var init_headers = __esm(() => {
  init_values();
  brand_privateNullableHeaders = /* @__PURE__ */ Symbol("brand.privateNullableHeaders");
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/audio/speech.mjs
var Speech;
var init_speech = __esm(() => {
  init_headers();
  Speech = class Speech extends APIResource {
    create(body, options) {
      return this._client.post("/audio/speech", {
        body,
        ...options,
        headers: buildHeaders([{ Accept: "application/octet-stream" }, options?.headers]),
        __security: { bearerAuth: true },
        __binaryResponse: true
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/audio/transcriptions.mjs
var Transcriptions;
var init_transcriptions = __esm(() => {
  init_uploads();
  Transcriptions = class Transcriptions extends APIResource {
    create(body, options) {
      return this._client.post("/audio/transcriptions", multipartFormRequestOptions({
        body,
        ...options,
        stream: body.stream ?? false,
        __metadata: { model: body.model },
        __security: { bearerAuth: true }
      }, this._client));
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/audio/translations.mjs
var Translations;
var init_translations = __esm(() => {
  init_uploads();
  Translations = class Translations extends APIResource {
    create(body, options) {
      return this._client.post("/audio/translations", multipartFormRequestOptions({ body, ...options, __metadata: { model: body.model }, __security: { bearerAuth: true } }, this._client));
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/audio/audio.mjs
var Audio;
var init_audio = __esm(() => {
  init_speech();
  init_speech();
  init_transcriptions();
  init_transcriptions();
  init_translations();
  init_translations();
  Audio = class Audio extends APIResource {
    constructor() {
      super(...arguments);
      this.transcriptions = new Transcriptions(this._client);
      this.translations = new Translations(this._client);
      this.speech = new Speech(this._client);
    }
  };
  Audio.Transcriptions = Transcriptions;
  Audio.Translations = Translations;
  Audio.Speech = Speech;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/batches.mjs
var Batches;
var init_batches = __esm(() => {
  init_pagination();
  init_path();
  Batches = class Batches extends APIResource {
    create(body, options) {
      return this._client.post("/batches", { body, ...options, __security: { bearerAuth: true } });
    }
    retrieve(batchID, options) {
      return this._client.get(path`/batches/${batchID}`, { ...options, __security: { bearerAuth: true } });
    }
    list(query = {}, options) {
      return this._client.getAPIList("/batches", CursorPage, {
        query,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    cancel(batchID, options) {
      return this._client.post(path`/batches/${batchID}/cancel`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/beta/assistants.mjs
var Assistants;
var init_assistants = __esm(() => {
  init_pagination();
  init_headers();
  init_path();
  Assistants = class Assistants extends APIResource {
    create(body, options) {
      return this._client.post("/assistants", {
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    retrieve(assistantID, options) {
      return this._client.get(path`/assistants/${assistantID}`, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    update(assistantID, body, options) {
      return this._client.post(path`/assistants/${assistantID}`, {
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    list(query = {}, options) {
      return this._client.getAPIList("/assistants", CursorPage, {
        query,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    delete(assistantID, options) {
      return this._client.delete(path`/assistants/${assistantID}`, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/beta/realtime/sessions.mjs
var Sessions;
var init_sessions = __esm(() => {
  init_headers();
  Sessions = class Sessions extends APIResource {
    create(body, options) {
      return this._client.post("/realtime/sessions", {
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/beta/realtime/transcription-sessions.mjs
var TranscriptionSessions;
var init_transcription_sessions = __esm(() => {
  init_headers();
  TranscriptionSessions = class TranscriptionSessions extends APIResource {
    create(body, options) {
      return this._client.post("/realtime/transcription_sessions", {
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/beta/realtime/realtime.mjs
var Realtime;
var init_realtime = __esm(() => {
  init_sessions();
  init_sessions();
  init_transcription_sessions();
  init_transcription_sessions();
  Realtime = class Realtime extends APIResource {
    constructor() {
      super(...arguments);
      this.sessions = new Sessions(this._client);
      this.transcriptionSessions = new TranscriptionSessions(this._client);
    }
  };
  Realtime.Sessions = Sessions;
  Realtime.TranscriptionSessions = TranscriptionSessions;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/beta/chatkit/sessions.mjs
var Sessions2;
var init_sessions2 = __esm(() => {
  init_headers();
  init_path();
  Sessions2 = class Sessions2 extends APIResource {
    create(body, options) {
      return this._client.post("/chatkit/sessions", {
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "chatkit_beta=v1" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    cancel(sessionID, options) {
      return this._client.post(path`/chatkit/sessions/${sessionID}/cancel`, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "chatkit_beta=v1" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/beta/chatkit/threads.mjs
var Threads;
var init_threads = __esm(() => {
  init_pagination();
  init_headers();
  init_path();
  Threads = class Threads extends APIResource {
    retrieve(threadID, options) {
      return this._client.get(path`/chatkit/threads/${threadID}`, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "chatkit_beta=v1" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    list(query = {}, options) {
      return this._client.getAPIList("/chatkit/threads", ConversationCursorPage, {
        query,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "chatkit_beta=v1" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    delete(threadID, options) {
      return this._client.delete(path`/chatkit/threads/${threadID}`, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "chatkit_beta=v1" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    listItems(threadID, query = {}, options) {
      return this._client.getAPIList(path`/chatkit/threads/${threadID}/items`, ConversationCursorPage, {
        query,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "chatkit_beta=v1" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/beta/chatkit/chatkit.mjs
var ChatKit;
var init_chatkit = __esm(() => {
  init_sessions2();
  init_sessions2();
  init_threads();
  init_threads();
  ChatKit = class ChatKit extends APIResource {
    constructor() {
      super(...arguments);
      this.sessions = new Sessions2(this._client);
      this.threads = new Threads(this._client);
    }
  };
  ChatKit.Sessions = Sessions2;
  ChatKit.Threads = Threads;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/beta/threads/messages.mjs
var Messages2;
var init_messages2 = __esm(() => {
  init_pagination();
  init_headers();
  init_path();
  Messages2 = class Messages2 extends APIResource {
    create(threadID, body, options) {
      return this._client.post(path`/threads/${threadID}/messages`, {
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    retrieve(messageID, params, options) {
      const { thread_id } = params;
      return this._client.get(path`/threads/${thread_id}/messages/${messageID}`, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    update(messageID, params, options) {
      const { thread_id, ...body } = params;
      return this._client.post(path`/threads/${thread_id}/messages/${messageID}`, {
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    list(threadID, query = {}, options) {
      return this._client.getAPIList(path`/threads/${threadID}/messages`, CursorPage, {
        query,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    delete(messageID, params, options) {
      const { thread_id } = params;
      return this._client.delete(path`/threads/${thread_id}/messages/${messageID}`, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/beta/threads/runs/steps.mjs
var Steps;
var init_steps = __esm(() => {
  init_pagination();
  init_headers();
  init_path();
  Steps = class Steps extends APIResource {
    retrieve(stepID, params, options) {
      const { thread_id, run_id, ...query } = params;
      return this._client.get(path`/threads/${thread_id}/runs/${run_id}/steps/${stepID}`, {
        query,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    list(runID, params, options) {
      const { thread_id, ...query } = params;
      return this._client.getAPIList(path`/threads/${thread_id}/runs/${runID}/steps`, CursorPage, {
        query,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/utils/base64.mjs
var toFloat32Array = (base64Str) => {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(base64Str, "base64");
    return Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.length / Float32Array.BYTES_PER_ELEMENT));
  } else {
    const binaryStr = atob(base64Str);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0;i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return Array.from(new Float32Array(bytes.buffer));
  }
};
var init_base64 = __esm(() => {
  init_error();
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/utils/env.mjs
var readEnv = (env) => {
  if (typeof globalThis.process !== "undefined") {
    return globalThis.process.env?.[env]?.trim() || undefined;
  }
  if (typeof globalThis.Deno !== "undefined") {
    return globalThis.Deno.env?.get?.(env)?.trim() || undefined;
  }
  return;
};

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/internal/utils.mjs
var init_utils2 = __esm(() => {
  init_values();
  init_base64();
  init_log();
  init_query();
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/lib/AssistantStream.mjs
function assertNever2(_x) {}
var _AssistantStream_instances, _a, _AssistantStream_events, _AssistantStream_runStepSnapshots, _AssistantStream_messageSnapshots, _AssistantStream_messageSnapshot, _AssistantStream_finalRun, _AssistantStream_currentContentIndex, _AssistantStream_currentContent, _AssistantStream_currentToolCallIndex, _AssistantStream_currentToolCall, _AssistantStream_currentEvent, _AssistantStream_currentRunSnapshot, _AssistantStream_currentRunStepSnapshot, _AssistantStream_addEvent, _AssistantStream_endRequest, _AssistantStream_handleMessage, _AssistantStream_handleRunStep, _AssistantStream_handleEvent, _AssistantStream_accumulateRunStep, _AssistantStream_accumulateMessage, _AssistantStream_accumulateContent, _AssistantStream_handleRun, AssistantStream;
var init_AssistantStream = __esm(() => {
  init_tslib();
  init_streaming2();
  init_error2();
  init_EventStream();
  init_utils2();
  AssistantStream = class AssistantStream extends EventStream {
    constructor() {
      super(...arguments);
      _AssistantStream_instances.add(this);
      _AssistantStream_events.set(this, []);
      _AssistantStream_runStepSnapshots.set(this, {});
      _AssistantStream_messageSnapshots.set(this, {});
      _AssistantStream_messageSnapshot.set(this, undefined);
      _AssistantStream_finalRun.set(this, undefined);
      _AssistantStream_currentContentIndex.set(this, undefined);
      _AssistantStream_currentContent.set(this, undefined);
      _AssistantStream_currentToolCallIndex.set(this, undefined);
      _AssistantStream_currentToolCall.set(this, undefined);
      _AssistantStream_currentEvent.set(this, undefined);
      _AssistantStream_currentRunSnapshot.set(this, undefined);
      _AssistantStream_currentRunStepSnapshot.set(this, undefined);
    }
    [(_AssistantStream_events = new WeakMap, _AssistantStream_runStepSnapshots = new WeakMap, _AssistantStream_messageSnapshots = new WeakMap, _AssistantStream_messageSnapshot = new WeakMap, _AssistantStream_finalRun = new WeakMap, _AssistantStream_currentContentIndex = new WeakMap, _AssistantStream_currentContent = new WeakMap, _AssistantStream_currentToolCallIndex = new WeakMap, _AssistantStream_currentToolCall = new WeakMap, _AssistantStream_currentEvent = new WeakMap, _AssistantStream_currentRunSnapshot = new WeakMap, _AssistantStream_currentRunStepSnapshot = new WeakMap, _AssistantStream_instances = new WeakSet, Symbol.asyncIterator)]() {
      const pushQueue = [];
      const readQueue = [];
      let done = false;
      this.on("event", (event) => {
        const reader = readQueue.shift();
        if (reader) {
          reader.resolve(event);
        } else {
          pushQueue.push(event);
        }
      });
      this.on("end", () => {
        done = true;
        for (const reader of readQueue) {
          reader.resolve(undefined);
        }
        readQueue.length = 0;
      });
      this.on("abort", (err) => {
        done = true;
        for (const reader of readQueue) {
          reader.reject(err);
        }
        readQueue.length = 0;
      });
      this.on("error", (err) => {
        done = true;
        for (const reader of readQueue) {
          reader.reject(err);
        }
        readQueue.length = 0;
      });
      return {
        next: async () => {
          if (!pushQueue.length) {
            if (done) {
              return { value: undefined, done: true };
            }
            return new Promise((resolve4, reject) => readQueue.push({ resolve: resolve4, reject })).then((chunk2) => chunk2 ? { value: chunk2, done: false } : { value: undefined, done: true });
          }
          const chunk = pushQueue.shift();
          return { value: chunk, done: false };
        },
        return: async () => {
          this.abort();
          return { value: undefined, done: true };
        }
      };
    }
    static fromReadableStream(stream) {
      const runner = new _a;
      runner._run(() => runner._fromReadableStream(stream));
      return runner;
    }
    async _fromReadableStream(readableStream, options) {
      const signal = options?.signal;
      if (signal) {
        if (signal.aborted)
          this.controller.abort();
        signal.addEventListener("abort", () => this.controller.abort());
      }
      this._connected();
      const stream = Stream.fromReadableStream(readableStream, this.controller);
      for await (const event of stream) {
        __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
      }
      if (stream.controller.signal?.aborted) {
        throw new APIUserAbortError;
      }
      return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
    }
    toReadableStream() {
      const stream = new Stream(this[Symbol.asyncIterator].bind(this), this.controller);
      return stream.toReadableStream();
    }
    static createToolAssistantStream(runId, runs, params, options) {
      const runner = new _a;
      runner._run(() => runner._runToolAssistantStream(runId, runs, params, {
        ...options,
        headers: { ...options?.headers, "X-Stainless-Helper-Method": "stream" }
      }));
      return runner;
    }
    async _createToolAssistantStream(run, runId, params, options) {
      const signal = options?.signal;
      if (signal) {
        if (signal.aborted)
          this.controller.abort();
        signal.addEventListener("abort", () => this.controller.abort());
      }
      const body = { ...params, stream: true };
      const stream = await run.submitToolOutputs(runId, body, {
        ...options,
        signal: this.controller.signal
      });
      this._connected();
      for await (const event of stream) {
        __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
      }
      if (stream.controller.signal?.aborted) {
        throw new APIUserAbortError;
      }
      return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
    }
    static createThreadAssistantStream(params, thread, options) {
      const runner = new _a;
      runner._run(() => runner._threadAssistantStream(params, thread, {
        ...options,
        headers: { ...options?.headers, "X-Stainless-Helper-Method": "stream" }
      }));
      return runner;
    }
    static createAssistantStream(threadId, runs, params, options) {
      const runner = new _a;
      runner._run(() => runner._runAssistantStream(threadId, runs, params, {
        ...options,
        headers: { ...options?.headers, "X-Stainless-Helper-Method": "stream" }
      }));
      return runner;
    }
    currentEvent() {
      return __classPrivateFieldGet(this, _AssistantStream_currentEvent, "f");
    }
    currentRun() {
      return __classPrivateFieldGet(this, _AssistantStream_currentRunSnapshot, "f");
    }
    currentMessageSnapshot() {
      return __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f");
    }
    currentRunStepSnapshot() {
      return __classPrivateFieldGet(this, _AssistantStream_currentRunStepSnapshot, "f");
    }
    async finalRunSteps() {
      await this.done();
      return Object.values(__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f"));
    }
    async finalMessages() {
      await this.done();
      return Object.values(__classPrivateFieldGet(this, _AssistantStream_messageSnapshots, "f"));
    }
    async finalRun() {
      await this.done();
      if (!__classPrivateFieldGet(this, _AssistantStream_finalRun, "f"))
        throw Error("Final run was not received.");
      return __classPrivateFieldGet(this, _AssistantStream_finalRun, "f");
    }
    async _createThreadAssistantStream(thread, params, options) {
      const signal = options?.signal;
      if (signal) {
        if (signal.aborted)
          this.controller.abort();
        signal.addEventListener("abort", () => this.controller.abort());
      }
      const body = { ...params, stream: true };
      const stream = await thread.createAndRun(body, { ...options, signal: this.controller.signal });
      this._connected();
      for await (const event of stream) {
        __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
      }
      if (stream.controller.signal?.aborted) {
        throw new APIUserAbortError;
      }
      return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
    }
    async _createAssistantStream(run, threadId, params, options) {
      const signal = options?.signal;
      if (signal) {
        if (signal.aborted)
          this.controller.abort();
        signal.addEventListener("abort", () => this.controller.abort());
      }
      const body = { ...params, stream: true };
      const stream = await run.create(threadId, body, { ...options, signal: this.controller.signal });
      this._connected();
      for await (const event of stream) {
        __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
      }
      if (stream.controller.signal?.aborted) {
        throw new APIUserAbortError;
      }
      return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
    }
    static accumulateDelta(acc, delta) {
      for (const [key, deltaValue] of Object.entries(delta)) {
        if (!acc.hasOwnProperty(key)) {
          acc[key] = deltaValue;
          continue;
        }
        let accValue = acc[key];
        if (accValue === null || accValue === undefined) {
          acc[key] = deltaValue;
          continue;
        }
        if (key === "index" || key === "type") {
          acc[key] = deltaValue;
          continue;
        }
        if (typeof accValue === "string" && typeof deltaValue === "string") {
          accValue += deltaValue;
        } else if (typeof accValue === "number" && typeof deltaValue === "number") {
          accValue += deltaValue;
        } else if (isObj(accValue) && isObj(deltaValue)) {
          accValue = this.accumulateDelta(accValue, deltaValue);
        } else if (Array.isArray(accValue) && Array.isArray(deltaValue)) {
          if (accValue.every((x) => typeof x === "string" || typeof x === "number")) {
            accValue.push(...deltaValue);
            continue;
          }
          for (const deltaEntry of deltaValue) {
            if (!isObj(deltaEntry)) {
              throw new Error(`Expected array delta entry to be an object but got: ${deltaEntry}`);
            }
            const index = deltaEntry["index"];
            if (index == null) {
              console.error(deltaEntry);
              throw new Error("Expected array delta entry to have an `index` property");
            }
            if (typeof index !== "number") {
              throw new Error(`Expected array delta entry \`index\` property to be a number but got ${index}`);
            }
            const accEntry = accValue[index];
            if (accEntry == null) {
              accValue.push(deltaEntry);
            } else {
              accValue[index] = this.accumulateDelta(accEntry, deltaEntry);
            }
          }
          continue;
        } else {
          throw Error(`Unhandled record type: ${key}, deltaValue: ${deltaValue}, accValue: ${accValue}`);
        }
        acc[key] = accValue;
      }
      return acc;
    }
    _addRun(run) {
      return run;
    }
    async _threadAssistantStream(params, thread, options) {
      return await this._createThreadAssistantStream(thread, params, options);
    }
    async _runAssistantStream(threadId, runs, params, options) {
      return await this._createAssistantStream(runs, threadId, params, options);
    }
    async _runToolAssistantStream(runId, runs, params, options) {
      return await this._createToolAssistantStream(runs, runId, params, options);
    }
  };
  _a = AssistantStream, _AssistantStream_addEvent = function _AssistantStream_addEvent2(event) {
    if (this.ended)
      return;
    __classPrivateFieldSet(this, _AssistantStream_currentEvent, event, "f");
    __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleEvent).call(this, event);
    switch (event.event) {
      case "thread.created":
        break;
      case "thread.run.created":
      case "thread.run.queued":
      case "thread.run.in_progress":
      case "thread.run.requires_action":
      case "thread.run.completed":
      case "thread.run.incomplete":
      case "thread.run.failed":
      case "thread.run.cancelling":
      case "thread.run.cancelled":
      case "thread.run.expired":
        __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleRun).call(this, event);
        break;
      case "thread.run.step.created":
      case "thread.run.step.in_progress":
      case "thread.run.step.delta":
      case "thread.run.step.completed":
      case "thread.run.step.failed":
      case "thread.run.step.cancelled":
      case "thread.run.step.expired":
        __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleRunStep).call(this, event);
        break;
      case "thread.message.created":
      case "thread.message.in_progress":
      case "thread.message.delta":
      case "thread.message.completed":
      case "thread.message.incomplete":
        __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleMessage).call(this, event);
        break;
      case "error":
        throw new Error("Encountered an error event in event processing - errors should be processed earlier");
      default:
        assertNever2(event);
    }
  }, _AssistantStream_endRequest = function _AssistantStream_endRequest2() {
    if (this.ended) {
      throw new OpenAIError(`stream has ended, this shouldn't happen`);
    }
    if (!__classPrivateFieldGet(this, _AssistantStream_finalRun, "f"))
      throw Error("Final run has not been received");
    return __classPrivateFieldGet(this, _AssistantStream_finalRun, "f");
  }, _AssistantStream_handleMessage = function _AssistantStream_handleMessage2(event) {
    const [accumulatedMessage, newContent] = __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateMessage).call(this, event, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
    __classPrivateFieldSet(this, _AssistantStream_messageSnapshot, accumulatedMessage, "f");
    __classPrivateFieldGet(this, _AssistantStream_messageSnapshots, "f")[accumulatedMessage.id] = accumulatedMessage;
    for (const content of newContent) {
      const snapshotContent = accumulatedMessage.content[content.index];
      if (snapshotContent?.type == "text") {
        this._emit("textCreated", snapshotContent.text);
      }
    }
    switch (event.event) {
      case "thread.message.created":
        this._emit("messageCreated", event.data);
        break;
      case "thread.message.in_progress":
        break;
      case "thread.message.delta":
        this._emit("messageDelta", event.data.delta, accumulatedMessage);
        if (event.data.delta.content) {
          for (const content of event.data.delta.content) {
            if (content.type == "text" && content.text) {
              let textDelta = content.text;
              let snapshot = accumulatedMessage.content[content.index];
              if (snapshot && snapshot.type == "text") {
                this._emit("textDelta", textDelta, snapshot.text);
              } else {
                throw Error("The snapshot associated with this text delta is not text or missing");
              }
            }
            if (content.index != __classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f")) {
              if (__classPrivateFieldGet(this, _AssistantStream_currentContent, "f")) {
                switch (__classPrivateFieldGet(this, _AssistantStream_currentContent, "f").type) {
                  case "text":
                    this._emit("textDone", __classPrivateFieldGet(this, _AssistantStream_currentContent, "f").text, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                    break;
                  case "image_file":
                    this._emit("imageFileDone", __classPrivateFieldGet(this, _AssistantStream_currentContent, "f").image_file, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                    break;
                }
              }
              __classPrivateFieldSet(this, _AssistantStream_currentContentIndex, content.index, "f");
            }
            __classPrivateFieldSet(this, _AssistantStream_currentContent, accumulatedMessage.content[content.index], "f");
          }
        }
        break;
      case "thread.message.completed":
      case "thread.message.incomplete":
        if (__classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f") !== undefined) {
          const currentContent = event.data.content[__classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f")];
          if (currentContent) {
            switch (currentContent.type) {
              case "image_file":
                this._emit("imageFileDone", currentContent.image_file, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                break;
              case "text":
                this._emit("textDone", currentContent.text, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                break;
            }
          }
        }
        if (__classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f")) {
          this._emit("messageDone", event.data);
        }
        __classPrivateFieldSet(this, _AssistantStream_messageSnapshot, undefined, "f");
    }
  }, _AssistantStream_handleRunStep = function _AssistantStream_handleRunStep2(event) {
    const accumulatedRunStep = __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateRunStep).call(this, event);
    __classPrivateFieldSet(this, _AssistantStream_currentRunStepSnapshot, accumulatedRunStep, "f");
    switch (event.event) {
      case "thread.run.step.created":
        this._emit("runStepCreated", event.data);
        break;
      case "thread.run.step.delta":
        const delta = event.data.delta;
        if (delta.step_details && delta.step_details.type == "tool_calls" && delta.step_details.tool_calls && accumulatedRunStep.step_details.type == "tool_calls") {
          for (const toolCall of delta.step_details.tool_calls) {
            if (toolCall.index == __classPrivateFieldGet(this, _AssistantStream_currentToolCallIndex, "f")) {
              this._emit("toolCallDelta", toolCall, accumulatedRunStep.step_details.tool_calls[toolCall.index]);
            } else {
              if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
                this._emit("toolCallDone", __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
              }
              __classPrivateFieldSet(this, _AssistantStream_currentToolCallIndex, toolCall.index, "f");
              __classPrivateFieldSet(this, _AssistantStream_currentToolCall, accumulatedRunStep.step_details.tool_calls[toolCall.index], "f");
              if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"))
                this._emit("toolCallCreated", __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
            }
          }
        }
        this._emit("runStepDelta", event.data.delta, accumulatedRunStep);
        break;
      case "thread.run.step.completed":
      case "thread.run.step.failed":
      case "thread.run.step.cancelled":
      case "thread.run.step.expired":
        __classPrivateFieldSet(this, _AssistantStream_currentRunStepSnapshot, undefined, "f");
        const details = event.data.step_details;
        if (details.type == "tool_calls") {
          if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
            this._emit("toolCallDone", __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
            __classPrivateFieldSet(this, _AssistantStream_currentToolCall, undefined, "f");
          }
        }
        this._emit("runStepDone", event.data, accumulatedRunStep);
        break;
      case "thread.run.step.in_progress":
        break;
    }
  }, _AssistantStream_handleEvent = function _AssistantStream_handleEvent2(event) {
    __classPrivateFieldGet(this, _AssistantStream_events, "f").push(event);
    this._emit("event", event);
  }, _AssistantStream_accumulateRunStep = function _AssistantStream_accumulateRunStep2(event) {
    switch (event.event) {
      case "thread.run.step.created":
        __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = event.data;
        return event.data;
      case "thread.run.step.delta":
        let snapshot = __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
        if (!snapshot) {
          throw Error("Received a RunStepDelta before creation of a snapshot");
        }
        let data = event.data;
        if (data.delta) {
          const accumulated = _a.accumulateDelta(snapshot, data.delta);
          __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = accumulated;
        }
        return __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
      case "thread.run.step.completed":
      case "thread.run.step.failed":
      case "thread.run.step.cancelled":
      case "thread.run.step.expired":
      case "thread.run.step.in_progress":
        __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = event.data;
        break;
    }
    if (__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id])
      return __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
    throw new Error("No snapshot available");
  }, _AssistantStream_accumulateMessage = function _AssistantStream_accumulateMessage2(event, snapshot) {
    let newContent = [];
    switch (event.event) {
      case "thread.message.created":
        return [event.data, newContent];
      case "thread.message.delta":
        if (!snapshot) {
          throw Error("Received a delta with no existing snapshot (there should be one from message creation)");
        }
        let data = event.data;
        if (data.delta.content) {
          for (const contentElement of data.delta.content) {
            if (contentElement.index in snapshot.content) {
              let currentContent = snapshot.content[contentElement.index];
              snapshot.content[contentElement.index] = __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateContent).call(this, contentElement, currentContent);
            } else {
              snapshot.content[contentElement.index] = contentElement;
              newContent.push(contentElement);
            }
          }
        }
        return [snapshot, newContent];
      case "thread.message.in_progress":
      case "thread.message.completed":
      case "thread.message.incomplete":
        if (snapshot) {
          return [snapshot, newContent];
        } else {
          throw Error("Received thread message event with no existing snapshot");
        }
    }
    throw Error("Tried to accumulate a non-message event");
  }, _AssistantStream_accumulateContent = function _AssistantStream_accumulateContent2(contentElement, currentContent) {
    return _a.accumulateDelta(currentContent, contentElement);
  }, _AssistantStream_handleRun = function _AssistantStream_handleRun2(event) {
    __classPrivateFieldSet(this, _AssistantStream_currentRunSnapshot, event.data, "f");
    switch (event.event) {
      case "thread.run.created":
        break;
      case "thread.run.queued":
        break;
      case "thread.run.in_progress":
        break;
      case "thread.run.requires_action":
      case "thread.run.cancelled":
      case "thread.run.failed":
      case "thread.run.completed":
      case "thread.run.expired":
      case "thread.run.incomplete":
        __classPrivateFieldSet(this, _AssistantStream_finalRun, event.data, "f");
        if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
          this._emit("toolCallDone", __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
          __classPrivateFieldSet(this, _AssistantStream_currentToolCall, undefined, "f");
        }
        break;
      case "thread.run.cancelling":
        break;
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/beta/threads/runs/runs.mjs
var Runs;
var init_runs = __esm(() => {
  init_steps();
  init_steps();
  init_pagination();
  init_headers();
  init_AssistantStream();
  init_path();
  Runs = class Runs extends APIResource {
    constructor() {
      super(...arguments);
      this.steps = new Steps(this._client);
    }
    create(threadID, params, options) {
      const { include, ...body } = params;
      return this._client.post(path`/threads/${threadID}/runs`, {
        query: { include },
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        stream: params.stream ?? false,
        __synthesizeEventData: true,
        __security: { bearerAuth: true }
      });
    }
    retrieve(runID, params, options) {
      const { thread_id } = params;
      return this._client.get(path`/threads/${thread_id}/runs/${runID}`, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    update(runID, params, options) {
      const { thread_id, ...body } = params;
      return this._client.post(path`/threads/${thread_id}/runs/${runID}`, {
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    list(threadID, query2 = {}, options) {
      return this._client.getAPIList(path`/threads/${threadID}/runs`, CursorPage, {
        query: query2,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    cancel(runID, params, options) {
      const { thread_id } = params;
      return this._client.post(path`/threads/${thread_id}/runs/${runID}/cancel`, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    async createAndPoll(threadId, body, options) {
      const run = await this.create(threadId, body, options);
      return await this.poll(run.id, { thread_id: threadId }, options);
    }
    createAndStream(threadId, body, options) {
      return AssistantStream.createAssistantStream(threadId, this._client.beta.threads.runs, body, options);
    }
    async poll(runId, params, options) {
      const headers = buildHeaders([
        options?.headers,
        {
          "X-Stainless-Poll-Helper": "true",
          "X-Stainless-Custom-Poll-Interval": options?.pollIntervalMs?.toString() ?? undefined
        }
      ]);
      while (true) {
        const { data: run, response } = await this.retrieve(runId, params, {
          ...options,
          headers: { ...options?.headers, ...headers }
        }).withResponse();
        switch (run.status) {
          case "queued":
          case "in_progress":
          case "cancelling":
            let sleepInterval = 5000;
            if (options?.pollIntervalMs) {
              sleepInterval = options.pollIntervalMs;
            } else {
              const headerInterval = response.headers.get("openai-poll-after-ms");
              if (headerInterval) {
                const headerIntervalMs = parseInt(headerInterval);
                if (!isNaN(headerIntervalMs)) {
                  sleepInterval = headerIntervalMs;
                }
              }
            }
            await sleep(sleepInterval);
            break;
          case "requires_action":
          case "incomplete":
          case "cancelled":
          case "completed":
          case "failed":
          case "expired":
            return run;
        }
      }
    }
    stream(threadId, body, options) {
      return AssistantStream.createAssistantStream(threadId, this._client.beta.threads.runs, body, options);
    }
    submitToolOutputs(runID, params, options) {
      const { thread_id, ...body } = params;
      return this._client.post(path`/threads/${thread_id}/runs/${runID}/submit_tool_outputs`, {
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        stream: params.stream ?? false,
        __synthesizeEventData: true,
        __security: { bearerAuth: true }
      });
    }
    async submitToolOutputsAndPoll(runId, params, options) {
      const run = await this.submitToolOutputs(runId, params, options);
      return await this.poll(run.id, params, options);
    }
    submitToolOutputsStream(runId, params, options) {
      return AssistantStream.createToolAssistantStream(runId, this._client.beta.threads.runs, params, options);
    }
  };
  Runs.Steps = Steps;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/beta/threads/threads.mjs
var Threads2;
var init_threads2 = __esm(() => {
  init_messages2();
  init_messages2();
  init_runs();
  init_runs();
  init_headers();
  init_AssistantStream();
  init_path();
  Threads2 = class Threads2 extends APIResource {
    constructor() {
      super(...arguments);
      this.runs = new Runs(this._client);
      this.messages = new Messages2(this._client);
    }
    create(body = {}, options) {
      return this._client.post("/threads", {
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    retrieve(threadID, options) {
      return this._client.get(path`/threads/${threadID}`, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    update(threadID, body, options) {
      return this._client.post(path`/threads/${threadID}`, {
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    delete(threadID, options) {
      return this._client.delete(path`/threads/${threadID}`, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    createAndRun(body, options) {
      return this._client.post("/threads/runs", {
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        stream: body.stream ?? false,
        __synthesizeEventData: true,
        __security: { bearerAuth: true }
      });
    }
    async createAndRunPoll(body, options) {
      const run = await this.createAndRun(body, options);
      return await this.runs.poll(run.id, { thread_id: run.thread_id }, options);
    }
    createAndRunStream(body, options) {
      return AssistantStream.createThreadAssistantStream(body, this._client.beta.threads, options);
    }
  };
  Threads2.Runs = Runs;
  Threads2.Messages = Messages2;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/beta/beta.mjs
var Beta;
var init_beta = __esm(() => {
  init_assistants();
  init_assistants();
  init_realtime();
  init_realtime();
  init_chatkit();
  init_chatkit();
  init_threads2();
  init_threads2();
  Beta = class Beta extends APIResource {
    constructor() {
      super(...arguments);
      this.realtime = new Realtime(this._client);
      this.chatkit = new ChatKit(this._client);
      this.assistants = new Assistants(this._client);
      this.threads = new Threads2(this._client);
    }
  };
  Beta.Realtime = Realtime;
  Beta.ChatKit = ChatKit;
  Beta.Assistants = Assistants;
  Beta.Threads = Threads2;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/completions.mjs
var Completions2;
var init_completions3 = __esm(() => {
  Completions2 = class Completions2 extends APIResource {
    create(body, options) {
      return this._client.post("/completions", {
        body,
        ...options,
        stream: body.stream ?? false,
        __security: { bearerAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/containers/files/content.mjs
var Content;
var init_content = __esm(() => {
  init_headers();
  init_path();
  Content = class Content extends APIResource {
    retrieve(fileID, params, options) {
      const { container_id } = params;
      return this._client.get(path`/containers/${container_id}/files/${fileID}/content`, {
        ...options,
        headers: buildHeaders([{ Accept: "application/binary" }, options?.headers]),
        __security: { bearerAuth: true },
        __binaryResponse: true
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/containers/files/files.mjs
var Files;
var init_files = __esm(() => {
  init_content();
  init_content();
  init_pagination();
  init_headers();
  init_uploads();
  init_path();
  Files = class Files extends APIResource {
    constructor() {
      super(...arguments);
      this.content = new Content(this._client);
    }
    create(containerID, body, options) {
      return this._client.post(path`/containers/${containerID}/files`, maybeMultipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
    }
    retrieve(fileID, params, options) {
      const { container_id } = params;
      return this._client.get(path`/containers/${container_id}/files/${fileID}`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
    list(containerID, query2 = {}, options) {
      return this._client.getAPIList(path`/containers/${containerID}/files`, CursorPage, {
        query: query2,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    delete(fileID, params, options) {
      const { container_id } = params;
      return this._client.delete(path`/containers/${container_id}/files/${fileID}`, {
        ...options,
        headers: buildHeaders([{ Accept: "*/*" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
  };
  Files.Content = Content;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/containers/containers.mjs
var Containers;
var init_containers = __esm(() => {
  init_files();
  init_files();
  init_pagination();
  init_headers();
  init_path();
  Containers = class Containers extends APIResource {
    constructor() {
      super(...arguments);
      this.files = new Files(this._client);
    }
    create(body, options) {
      return this._client.post("/containers", { body, ...options, __security: { bearerAuth: true } });
    }
    retrieve(containerID, options) {
      return this._client.get(path`/containers/${containerID}`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
    list(query2 = {}, options) {
      return this._client.getAPIList("/containers", CursorPage, {
        query: query2,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    delete(containerID, options) {
      return this._client.delete(path`/containers/${containerID}`, {
        ...options,
        headers: buildHeaders([{ Accept: "*/*" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
  };
  Containers.Files = Files;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/conversations/items.mjs
var Items;
var init_items = __esm(() => {
  init_pagination();
  init_path();
  Items = class Items extends APIResource {
    create(conversationID, params, options) {
      const { include, ...body } = params;
      return this._client.post(path`/conversations/${conversationID}/items`, {
        query: { include },
        body,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    retrieve(itemID, params, options) {
      const { conversation_id, ...query2 } = params;
      return this._client.get(path`/conversations/${conversation_id}/items/${itemID}`, {
        query: query2,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    list(conversationID, query2 = {}, options) {
      return this._client.getAPIList(path`/conversations/${conversationID}/items`, ConversationCursorPage, { query: query2, ...options, __security: { bearerAuth: true } });
    }
    delete(itemID, params, options) {
      const { conversation_id } = params;
      return this._client.delete(path`/conversations/${conversation_id}/items/${itemID}`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/conversations/conversations.mjs
var Conversations;
var init_conversations = __esm(() => {
  init_items();
  init_items();
  init_path();
  Conversations = class Conversations extends APIResource {
    constructor() {
      super(...arguments);
      this.items = new Items(this._client);
    }
    create(body = {}, options) {
      return this._client.post("/conversations", { body, ...options, __security: { bearerAuth: true } });
    }
    retrieve(conversationID, options) {
      return this._client.get(path`/conversations/${conversationID}`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
    update(conversationID, body, options) {
      return this._client.post(path`/conversations/${conversationID}`, {
        body,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    delete(conversationID, options) {
      return this._client.delete(path`/conversations/${conversationID}`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
  };
  Conversations.Items = Items;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/embeddings.mjs
var Embeddings;
var init_embeddings = __esm(() => {
  init_utils2();
  Embeddings = class Embeddings extends APIResource {
    create(body, options) {
      const hasUserProvidedEncodingFormat = !!body.encoding_format;
      let encoding_format = hasUserProvidedEncodingFormat ? body.encoding_format : "base64";
      if (hasUserProvidedEncodingFormat) {
        loggerFor(this._client).debug("embeddings/user defined encoding_format:", body.encoding_format);
      }
      const response = this._client.post("/embeddings", {
        body: {
          ...body,
          encoding_format
        },
        ...options,
        __security: { bearerAuth: true }
      });
      if (hasUserProvidedEncodingFormat) {
        return response;
      }
      loggerFor(this._client).debug("embeddings/decoding base64 embeddings from base64");
      return response._thenUnwrap((response2) => {
        if (response2 && response2.data) {
          response2.data.forEach((embeddingBase64Obj) => {
            const embeddingBase64Str = embeddingBase64Obj.embedding;
            embeddingBase64Obj.embedding = toFloat32Array(embeddingBase64Str);
          });
        }
        return response2;
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/evals/runs/output-items.mjs
var OutputItems;
var init_output_items = __esm(() => {
  init_pagination();
  init_path();
  OutputItems = class OutputItems extends APIResource {
    retrieve(outputItemID, params, options) {
      const { eval_id, run_id } = params;
      return this._client.get(path`/evals/${eval_id}/runs/${run_id}/output_items/${outputItemID}`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
    list(runID, params, options) {
      const { eval_id, ...query2 } = params;
      return this._client.getAPIList(path`/evals/${eval_id}/runs/${runID}/output_items`, CursorPage, { query: query2, ...options, __security: { bearerAuth: true } });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/evals/runs/runs.mjs
var Runs2;
var init_runs2 = __esm(() => {
  init_output_items();
  init_output_items();
  init_pagination();
  init_path();
  Runs2 = class Runs2 extends APIResource {
    constructor() {
      super(...arguments);
      this.outputItems = new OutputItems(this._client);
    }
    create(evalID, body, options) {
      return this._client.post(path`/evals/${evalID}/runs`, {
        body,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    retrieve(runID, params, options) {
      const { eval_id } = params;
      return this._client.get(path`/evals/${eval_id}/runs/${runID}`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
    list(evalID, query2 = {}, options) {
      return this._client.getAPIList(path`/evals/${evalID}/runs`, CursorPage, {
        query: query2,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    delete(runID, params, options) {
      const { eval_id } = params;
      return this._client.delete(path`/evals/${eval_id}/runs/${runID}`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
    cancel(runID, params, options) {
      const { eval_id } = params;
      return this._client.post(path`/evals/${eval_id}/runs/${runID}`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
  };
  Runs2.OutputItems = OutputItems;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/evals/evals.mjs
var Evals;
var init_evals = __esm(() => {
  init_runs2();
  init_runs2();
  init_pagination();
  init_path();
  Evals = class Evals extends APIResource {
    constructor() {
      super(...arguments);
      this.runs = new Runs2(this._client);
    }
    create(body, options) {
      return this._client.post("/evals", { body, ...options, __security: { bearerAuth: true } });
    }
    retrieve(evalID, options) {
      return this._client.get(path`/evals/${evalID}`, { ...options, __security: { bearerAuth: true } });
    }
    update(evalID, body, options) {
      return this._client.post(path`/evals/${evalID}`, { body, ...options, __security: { bearerAuth: true } });
    }
    list(query2 = {}, options) {
      return this._client.getAPIList("/evals", CursorPage, {
        query: query2,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    delete(evalID, options) {
      return this._client.delete(path`/evals/${evalID}`, { ...options, __security: { bearerAuth: true } });
    }
  };
  Evals.Runs = Runs2;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/files.mjs
var Files2;
var init_files2 = __esm(() => {
  init_pagination();
  init_headers();
  init_error2();
  init_uploads();
  init_path();
  Files2 = class Files2 extends APIResource {
    create(body, options) {
      return this._client.post("/files", multipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
    }
    retrieve(fileID, options) {
      return this._client.get(path`/files/${fileID}`, { ...options, __security: { bearerAuth: true } });
    }
    list(query2 = {}, options) {
      return this._client.getAPIList("/files", CursorPage, {
        query: query2,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    delete(fileID, options) {
      return this._client.delete(path`/files/${fileID}`, { ...options, __security: { bearerAuth: true } });
    }
    content(fileID, options) {
      return this._client.get(path`/files/${fileID}/content`, {
        ...options,
        headers: buildHeaders([{ Accept: "application/binary" }, options?.headers]),
        __security: { bearerAuth: true },
        __binaryResponse: true
      });
    }
    async waitForProcessing(id, { pollInterval = 5000, maxWait = 30 * 60 * 1000 } = {}) {
      const TERMINAL_STATES = new Set(["processed", "error", "deleted"]);
      const start = Date.now();
      let file = await this.retrieve(id);
      while (!file.status || !TERMINAL_STATES.has(file.status)) {
        await sleep(pollInterval);
        file = await this.retrieve(id);
        if (Date.now() - start > maxWait) {
          throw new APIConnectionTimeoutError({
            message: `Giving up on waiting for file ${id} to finish processing after ${maxWait} milliseconds.`
          });
        }
      }
      return file;
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/fine-tuning/methods.mjs
var Methods;
var init_methods = __esm(() => {
  Methods = class Methods extends APIResource {
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/fine-tuning/alpha/graders.mjs
var Graders;
var init_graders = __esm(() => {
  Graders = class Graders extends APIResource {
    run(body, options) {
      return this._client.post("/fine_tuning/alpha/graders/run", {
        body,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    validate(body, options) {
      return this._client.post("/fine_tuning/alpha/graders/validate", {
        body,
        ...options,
        __security: { bearerAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/fine-tuning/alpha/alpha.mjs
var Alpha;
var init_alpha = __esm(() => {
  init_graders();
  init_graders();
  Alpha = class Alpha extends APIResource {
    constructor() {
      super(...arguments);
      this.graders = new Graders(this._client);
    }
  };
  Alpha.Graders = Graders;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/fine-tuning/checkpoints/permissions.mjs
var Permissions;
var init_permissions = __esm(() => {
  init_pagination();
  init_path();
  Permissions = class Permissions extends APIResource {
    create(fineTunedModelCheckpoint, body, options) {
      return this._client.getAPIList(path`/fine_tuning/checkpoints/${fineTunedModelCheckpoint}/permissions`, Page, { body, method: "post", ...options, __security: { adminAPIKeyAuth: true } });
    }
    retrieve(fineTunedModelCheckpoint, query2 = {}, options) {
      return this._client.get(path`/fine_tuning/checkpoints/${fineTunedModelCheckpoint}/permissions`, {
        query: query2,
        ...options,
        __security: { adminAPIKeyAuth: true }
      });
    }
    list(fineTunedModelCheckpoint, query2 = {}, options) {
      return this._client.getAPIList(path`/fine_tuning/checkpoints/${fineTunedModelCheckpoint}/permissions`, ConversationCursorPage, { query: query2, ...options, __security: { adminAPIKeyAuth: true } });
    }
    delete(permissionID, params, options) {
      const { fine_tuned_model_checkpoint } = params;
      return this._client.delete(path`/fine_tuning/checkpoints/${fine_tuned_model_checkpoint}/permissions/${permissionID}`, { ...options, __security: { adminAPIKeyAuth: true } });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/fine-tuning/checkpoints/checkpoints.mjs
var Checkpoints;
var init_checkpoints = __esm(() => {
  init_permissions();
  init_permissions();
  Checkpoints = class Checkpoints extends APIResource {
    constructor() {
      super(...arguments);
      this.permissions = new Permissions(this._client);
    }
  };
  Checkpoints.Permissions = Permissions;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/fine-tuning/jobs/checkpoints.mjs
var Checkpoints2;
var init_checkpoints2 = __esm(() => {
  init_pagination();
  init_path();
  Checkpoints2 = class Checkpoints2 extends APIResource {
    list(fineTuningJobID, query2 = {}, options) {
      return this._client.getAPIList(path`/fine_tuning/jobs/${fineTuningJobID}/checkpoints`, CursorPage, { query: query2, ...options, __security: { bearerAuth: true } });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/fine-tuning/jobs/jobs.mjs
var Jobs;
var init_jobs = __esm(() => {
  init_checkpoints2();
  init_checkpoints2();
  init_pagination();
  init_path();
  Jobs = class Jobs extends APIResource {
    constructor() {
      super(...arguments);
      this.checkpoints = new Checkpoints2(this._client);
    }
    create(body, options) {
      return this._client.post("/fine_tuning/jobs", { body, ...options, __security: { bearerAuth: true } });
    }
    retrieve(fineTuningJobID, options) {
      return this._client.get(path`/fine_tuning/jobs/${fineTuningJobID}`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
    list(query2 = {}, options) {
      return this._client.getAPIList("/fine_tuning/jobs", CursorPage, {
        query: query2,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    cancel(fineTuningJobID, options) {
      return this._client.post(path`/fine_tuning/jobs/${fineTuningJobID}/cancel`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
    listEvents(fineTuningJobID, query2 = {}, options) {
      return this._client.getAPIList(path`/fine_tuning/jobs/${fineTuningJobID}/events`, CursorPage, { query: query2, ...options, __security: { bearerAuth: true } });
    }
    pause(fineTuningJobID, options) {
      return this._client.post(path`/fine_tuning/jobs/${fineTuningJobID}/pause`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
    resume(fineTuningJobID, options) {
      return this._client.post(path`/fine_tuning/jobs/${fineTuningJobID}/resume`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
  };
  Jobs.Checkpoints = Checkpoints2;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/fine-tuning/fine-tuning.mjs
var FineTuning;
var init_fine_tuning = __esm(() => {
  init_methods();
  init_methods();
  init_alpha();
  init_alpha();
  init_checkpoints();
  init_checkpoints();
  init_jobs();
  init_jobs();
  FineTuning = class FineTuning extends APIResource {
    constructor() {
      super(...arguments);
      this.methods = new Methods(this._client);
      this.jobs = new Jobs(this._client);
      this.checkpoints = new Checkpoints(this._client);
      this.alpha = new Alpha(this._client);
    }
  };
  FineTuning.Methods = Methods;
  FineTuning.Jobs = Jobs;
  FineTuning.Checkpoints = Checkpoints;
  FineTuning.Alpha = Alpha;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/graders/grader-models.mjs
var GraderModels;
var init_grader_models = __esm(() => {
  GraderModels = class GraderModels extends APIResource {
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/graders/graders.mjs
var Graders2;
var init_graders2 = __esm(() => {
  init_grader_models();
  init_grader_models();
  Graders2 = class Graders2 extends APIResource {
    constructor() {
      super(...arguments);
      this.graderModels = new GraderModels(this._client);
    }
  };
  Graders2.GraderModels = GraderModels;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/images.mjs
var Images;
var init_images = __esm(() => {
  init_uploads();
  Images = class Images extends APIResource {
    createVariation(body, options) {
      return this._client.post("/images/variations", multipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
    }
    edit(body, options) {
      return this._client.post("/images/edits", multipartFormRequestOptions({ body, ...options, stream: body.stream ?? false, __security: { bearerAuth: true } }, this._client));
    }
    generate(body, options) {
      return this._client.post("/images/generations", {
        body,
        ...options,
        stream: body.stream ?? false,
        __security: { bearerAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/models.mjs
var Models;
var init_models = __esm(() => {
  init_pagination();
  init_path();
  Models = class Models extends APIResource {
    retrieve(model, options) {
      return this._client.get(path`/models/${model}`, { ...options, __security: { bearerAuth: true } });
    }
    list(options) {
      return this._client.getAPIList("/models", Page, { ...options, __security: { bearerAuth: true } });
    }
    delete(model, options) {
      return this._client.delete(path`/models/${model}`, { ...options, __security: { bearerAuth: true } });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/moderations.mjs
var Moderations;
var init_moderations = __esm(() => {
  Moderations = class Moderations extends APIResource {
    create(body, options) {
      return this._client.post("/moderations", { body, ...options, __security: { bearerAuth: true } });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/realtime/calls.mjs
var Calls;
var init_calls = __esm(() => {
  init_headers();
  init_path();
  Calls = class Calls extends APIResource {
    accept(callID, body, options) {
      return this._client.post(path`/realtime/calls/${callID}/accept`, {
        body,
        ...options,
        headers: buildHeaders([{ Accept: "*/*" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    hangup(callID, options) {
      return this._client.post(path`/realtime/calls/${callID}/hangup`, {
        ...options,
        headers: buildHeaders([{ Accept: "*/*" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    refer(callID, body, options) {
      return this._client.post(path`/realtime/calls/${callID}/refer`, {
        body,
        ...options,
        headers: buildHeaders([{ Accept: "*/*" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    reject(callID, body = {}, options) {
      return this._client.post(path`/realtime/calls/${callID}/reject`, {
        body,
        ...options,
        headers: buildHeaders([{ Accept: "*/*" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/realtime/client-secrets.mjs
var ClientSecrets;
var init_client_secrets = __esm(() => {
  ClientSecrets = class ClientSecrets extends APIResource {
    create(body, options) {
      return this._client.post("/realtime/client_secrets", {
        body,
        ...options,
        __security: { bearerAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/realtime/realtime.mjs
var Realtime2;
var init_realtime2 = __esm(() => {
  init_calls();
  init_calls();
  init_client_secrets();
  init_client_secrets();
  Realtime2 = class Realtime2 extends APIResource {
    constructor() {
      super(...arguments);
      this.clientSecrets = new ClientSecrets(this._client);
      this.calls = new Calls(this._client);
    }
  };
  Realtime2.ClientSecrets = ClientSecrets;
  Realtime2.Calls = Calls;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/lib/ResponsesParser.mjs
function maybeParseResponse(response, params) {
  if (!params || !hasAutoParseableInput2(params)) {
    return {
      ...response,
      output_parsed: null,
      output: response.output.map((item) => {
        if (item.type === "function_call") {
          return {
            ...item,
            parsed_arguments: null
          };
        }
        if (item.type === "message") {
          return {
            ...item,
            content: item.content.map((content) => ({
              ...content,
              parsed: null
            }))
          };
        } else {
          return item;
        }
      })
    };
  }
  return parseResponse(response, params);
}
function parseResponse(response, params) {
  const output = response.output.map((item) => {
    if (item.type === "function_call") {
      return {
        ...item,
        parsed_arguments: parseToolCall2(params, item)
      };
    }
    if (item.type === "message") {
      const content = item.content.map((content2) => {
        if (content2.type === "output_text") {
          return {
            ...content2,
            parsed: parseTextFormat(params, content2.text)
          };
        }
        return content2;
      });
      return {
        ...item,
        content
      };
    }
    return item;
  });
  const parsed = Object.assign({}, response, { output });
  if (!Object.getOwnPropertyDescriptor(response, "output_text")) {
    addOutputText(parsed);
  }
  Object.defineProperty(parsed, "output_parsed", {
    enumerable: true,
    get() {
      for (const output2 of parsed.output) {
        if (output2.type !== "message") {
          continue;
        }
        for (const content of output2.content) {
          if (content.type === "output_text" && content.parsed !== null) {
            return content.parsed;
          }
        }
      }
      return null;
    }
  });
  return parsed;
}
function parseTextFormat(params, content) {
  if (params.text?.format?.type !== "json_schema") {
    return null;
  }
  if ("$parseRaw" in params.text?.format) {
    const text_format = params.text?.format;
    return text_format.$parseRaw(content);
  }
  return JSON.parse(content);
}
function hasAutoParseableInput2(params) {
  if (isAutoParsableResponseFormat(params.text?.format)) {
    return true;
  }
  return false;
}
function isAutoParsableTool2(tool) {
  return tool?.["$brand"] === "auto-parseable-tool";
}
function getInputToolByName(input_tools, name) {
  return input_tools.find((tool) => tool.type === "function" && tool.name === name);
}
function parseToolCall2(params, toolCall) {
  const inputTool = getInputToolByName(params.tools ?? [], toolCall.name);
  return {
    ...toolCall,
    ...toolCall,
    parsed_arguments: isAutoParsableTool2(inputTool) ? inputTool.$parseRaw(toolCall.arguments) : inputTool?.strict ? JSON.parse(toolCall.arguments) : null
  };
}
function addOutputText(rsp) {
  const texts = [];
  for (const output of rsp.output) {
    if (output.type !== "message") {
      continue;
    }
    for (const content of output.content) {
      if (content.type === "output_text") {
        texts.push(content.text);
      }
    }
  }
  rsp.output_text = texts.join("");
}
var init_ResponsesParser = __esm(() => {
  init_error2();
  init_parser();
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/lib/responses/ResponseStream.mjs
function finalizeResponse(snapshot, params) {
  return maybeParseResponse(snapshot, params);
}
var _ResponseStream_instances, _ResponseStream_params, _ResponseStream_currentResponseSnapshot, _ResponseStream_finalResponse, _ResponseStream_beginRequest, _ResponseStream_addEvent, _ResponseStream_endRequest, _ResponseStream_accumulateResponse, ResponseStream;
var init_ResponseStream = __esm(() => {
  init_tslib();
  init_error2();
  init_EventStream();
  init_ResponsesParser();
  ResponseStream = class ResponseStream extends EventStream {
    constructor(params) {
      super();
      _ResponseStream_instances.add(this);
      _ResponseStream_params.set(this, undefined);
      _ResponseStream_currentResponseSnapshot.set(this, undefined);
      _ResponseStream_finalResponse.set(this, undefined);
      __classPrivateFieldSet(this, _ResponseStream_params, params, "f");
    }
    static createResponse(client, params, options) {
      const runner = new ResponseStream(params);
      runner._run(() => runner._createOrRetrieveResponse(client, params, {
        ...options,
        headers: { ...options?.headers, "X-Stainless-Helper-Method": "stream" }
      }));
      return runner;
    }
    async _createOrRetrieveResponse(client, params, options) {
      const signal = options?.signal;
      if (signal) {
        if (signal.aborted)
          this.controller.abort();
        signal.addEventListener("abort", () => this.controller.abort());
      }
      __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_beginRequest).call(this);
      let stream;
      let starting_after = null;
      if ("response_id" in params) {
        stream = await client.responses.retrieve(params.response_id, { stream: true }, { ...options, signal: this.controller.signal, stream: true });
        starting_after = params.starting_after ?? null;
      } else {
        stream = await client.responses.create({ ...params, stream: true }, { ...options, signal: this.controller.signal });
      }
      this._connected();
      for await (const event of stream) {
        __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_addEvent).call(this, event, starting_after);
      }
      if (stream.controller.signal?.aborted) {
        throw new APIUserAbortError;
      }
      return __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_endRequest).call(this);
    }
    [(_ResponseStream_params = new WeakMap, _ResponseStream_currentResponseSnapshot = new WeakMap, _ResponseStream_finalResponse = new WeakMap, _ResponseStream_instances = new WeakSet, _ResponseStream_beginRequest = function _ResponseStream_beginRequest2() {
      if (this.ended)
        return;
      __classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, undefined, "f");
    }, _ResponseStream_addEvent = function _ResponseStream_addEvent2(event, starting_after) {
      if (this.ended)
        return;
      const maybeEmit = (name, event2) => {
        if (starting_after == null || event2.sequence_number > starting_after) {
          this._emit(name, event2);
        }
      };
      const response = __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_accumulateResponse).call(this, event);
      maybeEmit("event", event);
      switch (event.type) {
        case "response.output_text.delta": {
          const output = response.output[event.output_index];
          if (!output) {
            throw new OpenAIError(`missing output at index ${event.output_index}`);
          }
          if (output.type === "message") {
            const content = output.content[event.content_index];
            if (!content) {
              throw new OpenAIError(`missing content at index ${event.content_index}`);
            }
            if (content.type !== "output_text") {
              throw new OpenAIError(`expected content to be 'output_text', got ${content.type}`);
            }
            maybeEmit("response.output_text.delta", {
              ...event,
              snapshot: content.text
            });
          }
          break;
        }
        case "response.function_call_arguments.delta": {
          const output = response.output[event.output_index];
          if (!output) {
            throw new OpenAIError(`missing output at index ${event.output_index}`);
          }
          if (output.type === "function_call") {
            maybeEmit("response.function_call_arguments.delta", {
              ...event,
              snapshot: output.arguments
            });
          }
          break;
        }
        default:
          maybeEmit(event.type, event);
          break;
      }
    }, _ResponseStream_endRequest = function _ResponseStream_endRequest2() {
      if (this.ended) {
        throw new OpenAIError(`stream has ended, this shouldn't happen`);
      }
      const snapshot = __classPrivateFieldGet(this, _ResponseStream_currentResponseSnapshot, "f");
      if (!snapshot) {
        throw new OpenAIError(`request ended without sending any events`);
      }
      __classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, undefined, "f");
      const parsedResponse = finalizeResponse(snapshot, __classPrivateFieldGet(this, _ResponseStream_params, "f"));
      __classPrivateFieldSet(this, _ResponseStream_finalResponse, parsedResponse, "f");
      return parsedResponse;
    }, _ResponseStream_accumulateResponse = function _ResponseStream_accumulateResponse2(event) {
      let snapshot = __classPrivateFieldGet(this, _ResponseStream_currentResponseSnapshot, "f");
      if (!snapshot) {
        if (event.type !== "response.created") {
          throw new OpenAIError(`When snapshot hasn't been set yet, expected 'response.created' event, got ${event.type}`);
        }
        snapshot = __classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, event.response, "f");
        return snapshot;
      }
      switch (event.type) {
        case "response.output_item.added": {
          snapshot.output.push(event.item);
          break;
        }
        case "response.content_part.added": {
          const output = snapshot.output[event.output_index];
          if (!output) {
            throw new OpenAIError(`missing output at index ${event.output_index}`);
          }
          const type = output.type;
          const part = event.part;
          if (type === "message" && part.type !== "reasoning_text") {
            output.content.push(part);
          } else if (type === "reasoning" && part.type === "reasoning_text") {
            if (!output.content) {
              output.content = [];
            }
            output.content.push(part);
          }
          break;
        }
        case "response.output_text.delta": {
          const output = snapshot.output[event.output_index];
          if (!output) {
            throw new OpenAIError(`missing output at index ${event.output_index}`);
          }
          if (output.type === "message") {
            const content = output.content[event.content_index];
            if (!content) {
              throw new OpenAIError(`missing content at index ${event.content_index}`);
            }
            if (content.type !== "output_text") {
              throw new OpenAIError(`expected content to be 'output_text', got ${content.type}`);
            }
            content.text += event.delta;
          }
          break;
        }
        case "response.function_call_arguments.delta": {
          const output = snapshot.output[event.output_index];
          if (!output) {
            throw new OpenAIError(`missing output at index ${event.output_index}`);
          }
          if (output.type === "function_call") {
            output.arguments += event.delta;
          }
          break;
        }
        case "response.reasoning_text.delta": {
          const output = snapshot.output[event.output_index];
          if (!output) {
            throw new OpenAIError(`missing output at index ${event.output_index}`);
          }
          if (output.type === "reasoning") {
            const content = output.content?.[event.content_index];
            if (!content) {
              throw new OpenAIError(`missing content at index ${event.content_index}`);
            }
            if (content.type !== "reasoning_text") {
              throw new OpenAIError(`expected content to be 'reasoning_text', got ${content.type}`);
            }
            content.text += event.delta;
          }
          break;
        }
        case "response.completed": {
          __classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, event.response, "f");
          break;
        }
      }
      return snapshot;
    }, Symbol.asyncIterator)]() {
      const pushQueue = [];
      const readQueue = [];
      let done = false;
      this.on("event", (event) => {
        const reader = readQueue.shift();
        if (reader) {
          reader.resolve(event);
        } else {
          pushQueue.push(event);
        }
      });
      this.on("end", () => {
        done = true;
        for (const reader of readQueue) {
          reader.resolve(undefined);
        }
        readQueue.length = 0;
      });
      this.on("abort", (err) => {
        done = true;
        for (const reader of readQueue) {
          reader.reject(err);
        }
        readQueue.length = 0;
      });
      this.on("error", (err) => {
        done = true;
        for (const reader of readQueue) {
          reader.reject(err);
        }
        readQueue.length = 0;
      });
      return {
        next: async () => {
          if (!pushQueue.length) {
            if (done) {
              return { value: undefined, done: true };
            }
            return new Promise((resolve4, reject) => readQueue.push({ resolve: resolve4, reject })).then((event2) => event2 ? { value: event2, done: false } : { value: undefined, done: true });
          }
          const event = pushQueue.shift();
          return { value: event, done: false };
        },
        return: async () => {
          this.abort();
          return { value: undefined, done: true };
        }
      };
    }
    async finalResponse() {
      await this.done();
      const response = __classPrivateFieldGet(this, _ResponseStream_finalResponse, "f");
      if (!response)
        throw new OpenAIError("stream ended without producing a ChatCompletion");
      return response;
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/responses/input-items.mjs
var InputItems;
var init_input_items = __esm(() => {
  init_pagination();
  init_path();
  InputItems = class InputItems extends APIResource {
    list(responseID, query2 = {}, options) {
      return this._client.getAPIList(path`/responses/${responseID}/input_items`, CursorPage, { query: query2, ...options, __security: { bearerAuth: true } });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/responses/input-tokens.mjs
var InputTokens;
var init_input_tokens = __esm(() => {
  InputTokens = class InputTokens extends APIResource {
    count(body = {}, options) {
      return this._client.post("/responses/input_tokens", {
        body,
        ...options,
        __security: { bearerAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/responses/responses.mjs
var Responses;
var init_responses = __esm(() => {
  init_ResponsesParser();
  init_ResponseStream();
  init_input_items();
  init_input_items();
  init_input_tokens();
  init_input_tokens();
  init_headers();
  init_path();
  Responses = class Responses extends APIResource {
    constructor() {
      super(...arguments);
      this.inputItems = new InputItems(this._client);
      this.inputTokens = new InputTokens(this._client);
    }
    create(body, options) {
      return this._client.post("/responses", {
        body,
        ...options,
        stream: body.stream ?? false,
        __security: { bearerAuth: true }
      })._thenUnwrap((rsp) => {
        if ("object" in rsp && rsp.object === "response") {
          addOutputText(rsp);
        }
        return rsp;
      });
    }
    retrieve(responseID, query2 = {}, options) {
      return this._client.get(path`/responses/${responseID}`, {
        query: query2,
        ...options,
        stream: query2?.stream ?? false,
        __security: { bearerAuth: true }
      })._thenUnwrap((rsp) => {
        if ("object" in rsp && rsp.object === "response") {
          addOutputText(rsp);
        }
        return rsp;
      });
    }
    delete(responseID, options) {
      return this._client.delete(path`/responses/${responseID}`, {
        ...options,
        headers: buildHeaders([{ Accept: "*/*" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    parse(body, options) {
      return this._client.responses.create(body, options)._thenUnwrap((response) => parseResponse(response, body));
    }
    stream(body, options) {
      return ResponseStream.createResponse(this._client, body, options);
    }
    cancel(responseID, options) {
      return this._client.post(path`/responses/${responseID}/cancel`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
    compact(body, options) {
      return this._client.post("/responses/compact", { body, ...options, __security: { bearerAuth: true } });
    }
  };
  Responses.InputItems = InputItems;
  Responses.InputTokens = InputTokens;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/skills/content.mjs
var Content2;
var init_content2 = __esm(() => {
  init_headers();
  init_path();
  Content2 = class Content2 extends APIResource {
    retrieve(skillID, options) {
      return this._client.get(path`/skills/${skillID}/content`, {
        ...options,
        headers: buildHeaders([{ Accept: "application/binary" }, options?.headers]),
        __security: { bearerAuth: true },
        __binaryResponse: true
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/skills/versions/content.mjs
var Content3;
var init_content3 = __esm(() => {
  init_headers();
  init_path();
  Content3 = class Content3 extends APIResource {
    retrieve(version, params, options) {
      const { skill_id } = params;
      return this._client.get(path`/skills/${skill_id}/versions/${version}/content`, {
        ...options,
        headers: buildHeaders([{ Accept: "application/binary" }, options?.headers]),
        __security: { bearerAuth: true },
        __binaryResponse: true
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/skills/versions/versions.mjs
var Versions;
var init_versions = __esm(() => {
  init_content3();
  init_content3();
  init_pagination();
  init_uploads();
  init_path();
  Versions = class Versions extends APIResource {
    constructor() {
      super(...arguments);
      this.content = new Content3(this._client);
    }
    create(skillID, body = {}, options) {
      return this._client.post(path`/skills/${skillID}/versions`, maybeMultipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
    }
    retrieve(version, params, options) {
      const { skill_id } = params;
      return this._client.get(path`/skills/${skill_id}/versions/${version}`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
    list(skillID, query2 = {}, options) {
      return this._client.getAPIList(path`/skills/${skillID}/versions`, CursorPage, {
        query: query2,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    delete(version, params, options) {
      const { skill_id } = params;
      return this._client.delete(path`/skills/${skill_id}/versions/${version}`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
  };
  Versions.Content = Content3;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/skills/skills.mjs
var Skills;
var init_skills = __esm(() => {
  init_content2();
  init_content2();
  init_versions();
  init_versions();
  init_pagination();
  init_uploads();
  init_path();
  Skills = class Skills extends APIResource {
    constructor() {
      super(...arguments);
      this.content = new Content2(this._client);
      this.versions = new Versions(this._client);
    }
    create(body = {}, options) {
      return this._client.post("/skills", maybeMultipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
    }
    retrieve(skillID, options) {
      return this._client.get(path`/skills/${skillID}`, { ...options, __security: { bearerAuth: true } });
    }
    update(skillID, body, options) {
      return this._client.post(path`/skills/${skillID}`, {
        body,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    list(query2 = {}, options) {
      return this._client.getAPIList("/skills", CursorPage, {
        query: query2,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    delete(skillID, options) {
      return this._client.delete(path`/skills/${skillID}`, { ...options, __security: { bearerAuth: true } });
    }
  };
  Skills.Content = Content2;
  Skills.Versions = Versions;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/uploads/parts.mjs
var Parts;
var init_parts = __esm(() => {
  init_uploads();
  init_path();
  Parts = class Parts extends APIResource {
    create(uploadID, body, options) {
      return this._client.post(path`/uploads/${uploadID}/parts`, multipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/uploads/uploads.mjs
var Uploads;
var init_uploads3 = __esm(() => {
  init_parts();
  init_parts();
  init_path();
  Uploads = class Uploads extends APIResource {
    constructor() {
      super(...arguments);
      this.parts = new Parts(this._client);
    }
    create(body, options) {
      return this._client.post("/uploads", { body, ...options, __security: { bearerAuth: true } });
    }
    cancel(uploadID, options) {
      return this._client.post(path`/uploads/${uploadID}/cancel`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
    complete(uploadID, body, options) {
      return this._client.post(path`/uploads/${uploadID}/complete`, {
        body,
        ...options,
        __security: { bearerAuth: true }
      });
    }
  };
  Uploads.Parts = Parts;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/lib/Util.mjs
var allSettledWithThrow = async (promises) => {
  const results = await Promise.allSettled(promises);
  const rejected = results.filter((result) => result.status === "rejected");
  if (rejected.length) {
    for (const result of rejected) {
      console.error(result.reason);
    }
    throw new Error(`${rejected.length} promise(s) failed - see the above errors`);
  }
  const values2 = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      values2.push(result.value);
    }
  }
  return values2;
};

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/vector-stores/file-batches.mjs
var FileBatches;
var init_file_batches = __esm(() => {
  init_pagination();
  init_headers();
  init_path();
  FileBatches = class FileBatches extends APIResource {
    create(vectorStoreID, body, options) {
      return this._client.post(path`/vector_stores/${vectorStoreID}/file_batches`, {
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    retrieve(batchID, params, options) {
      const { vector_store_id } = params;
      return this._client.get(path`/vector_stores/${vector_store_id}/file_batches/${batchID}`, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    cancel(batchID, params, options) {
      const { vector_store_id } = params;
      return this._client.post(path`/vector_stores/${vector_store_id}/file_batches/${batchID}/cancel`, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    async createAndPoll(vectorStoreId, body, options) {
      const batch = await this.create(vectorStoreId, body);
      return await this.poll(vectorStoreId, batch.id, options);
    }
    listFiles(batchID, params, options) {
      const { vector_store_id, ...query2 } = params;
      return this._client.getAPIList(path`/vector_stores/${vector_store_id}/file_batches/${batchID}/files`, CursorPage, {
        query: query2,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    async poll(vectorStoreID, batchID, options) {
      const headers = buildHeaders([
        options?.headers,
        {
          "X-Stainless-Poll-Helper": "true",
          "X-Stainless-Custom-Poll-Interval": options?.pollIntervalMs?.toString() ?? undefined
        }
      ]);
      while (true) {
        const { data: batch, response } = await this.retrieve(batchID, { vector_store_id: vectorStoreID }, {
          ...options,
          headers
        }).withResponse();
        switch (batch.status) {
          case "in_progress":
            let sleepInterval = 5000;
            if (options?.pollIntervalMs) {
              sleepInterval = options.pollIntervalMs;
            } else {
              const headerInterval = response.headers.get("openai-poll-after-ms");
              if (headerInterval) {
                const headerIntervalMs = parseInt(headerInterval);
                if (!isNaN(headerIntervalMs)) {
                  sleepInterval = headerIntervalMs;
                }
              }
            }
            await sleep(sleepInterval);
            break;
          case "failed":
          case "cancelled":
          case "completed":
            return batch;
        }
      }
    }
    async uploadAndPoll(vectorStoreId, { files, fileIds = [] }, options) {
      if (files == null || files.length == 0) {
        throw new Error(`No \`files\` provided to process. If you've already uploaded files you should use \`.createAndPoll()\` instead`);
      }
      const configuredConcurrency = options?.maxConcurrency ?? 5;
      const concurrencyLimit = Math.min(configuredConcurrency, files.length);
      const client = this._client;
      const fileIterator = files.values();
      const allFileIds = [...fileIds];
      async function processFiles(iterator) {
        for (let item of iterator) {
          const fileObj = await client.files.create({ file: item, purpose: "assistants" }, options);
          allFileIds.push(fileObj.id);
        }
      }
      const workers = Array(concurrencyLimit).fill(fileIterator).map(processFiles);
      await allSettledWithThrow(workers);
      return await this.createAndPoll(vectorStoreId, {
        file_ids: allFileIds
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/vector-stores/files.mjs
var Files3;
var init_files3 = __esm(() => {
  init_pagination();
  init_headers();
  init_utils2();
  init_path();
  Files3 = class Files3 extends APIResource {
    create(vectorStoreID, body, options) {
      return this._client.post(path`/vector_stores/${vectorStoreID}/files`, {
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    retrieve(fileID, params, options) {
      const { vector_store_id } = params;
      return this._client.get(path`/vector_stores/${vector_store_id}/files/${fileID}`, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    update(fileID, params, options) {
      const { vector_store_id, ...body } = params;
      return this._client.post(path`/vector_stores/${vector_store_id}/files/${fileID}`, {
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    list(vectorStoreID, query2 = {}, options) {
      return this._client.getAPIList(path`/vector_stores/${vectorStoreID}/files`, CursorPage, {
        query: query2,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    delete(fileID, params, options) {
      const { vector_store_id } = params;
      return this._client.delete(path`/vector_stores/${vector_store_id}/files/${fileID}`, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    async createAndPoll(vectorStoreId, body, options) {
      const file = await this.create(vectorStoreId, body, options);
      return await this.poll(vectorStoreId, file.id, options);
    }
    async poll(vectorStoreID, fileID, options) {
      const headers = buildHeaders([
        options?.headers,
        {
          "X-Stainless-Poll-Helper": "true",
          "X-Stainless-Custom-Poll-Interval": options?.pollIntervalMs?.toString() ?? undefined
        }
      ]);
      while (true) {
        const fileResponse = await this.retrieve(fileID, {
          vector_store_id: vectorStoreID
        }, { ...options, headers }).withResponse();
        const file = fileResponse.data;
        switch (file.status) {
          case "in_progress":
            let sleepInterval = 5000;
            if (options?.pollIntervalMs) {
              sleepInterval = options.pollIntervalMs;
            } else {
              const headerInterval = fileResponse.response.headers.get("openai-poll-after-ms");
              if (headerInterval) {
                const headerIntervalMs = parseInt(headerInterval);
                if (!isNaN(headerIntervalMs)) {
                  sleepInterval = headerIntervalMs;
                }
              }
            }
            await sleep(sleepInterval);
            break;
          case "failed":
          case "completed":
            return file;
        }
      }
    }
    async upload(vectorStoreId, file, options) {
      const fileInfo = await this._client.files.create({ file, purpose: "assistants" }, options);
      return this.create(vectorStoreId, { file_id: fileInfo.id }, options);
    }
    async uploadAndPoll(vectorStoreId, file, options) {
      const fileInfo = await this.upload(vectorStoreId, file, options);
      return await this.poll(vectorStoreId, fileInfo.id, options);
    }
    content(fileID, params, options) {
      const { vector_store_id } = params;
      return this._client.getAPIList(path`/vector_stores/${vector_store_id}/files/${fileID}/content`, Page, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/vector-stores/vector-stores.mjs
var VectorStores;
var init_vector_stores = __esm(() => {
  init_file_batches();
  init_file_batches();
  init_files3();
  init_files3();
  init_pagination();
  init_headers();
  init_path();
  VectorStores = class VectorStores extends APIResource {
    constructor() {
      super(...arguments);
      this.files = new Files3(this._client);
      this.fileBatches = new FileBatches(this._client);
    }
    create(body, options) {
      return this._client.post("/vector_stores", {
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    retrieve(vectorStoreID, options) {
      return this._client.get(path`/vector_stores/${vectorStoreID}`, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    update(vectorStoreID, body, options) {
      return this._client.post(path`/vector_stores/${vectorStoreID}`, {
        body,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    list(query2 = {}, options) {
      return this._client.getAPIList("/vector_stores", CursorPage, {
        query: query2,
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    delete(vectorStoreID, options) {
      return this._client.delete(path`/vector_stores/${vectorStoreID}`, {
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
    search(vectorStoreID, body, options) {
      return this._client.getAPIList(path`/vector_stores/${vectorStoreID}/search`, Page, {
        body,
        method: "post",
        ...options,
        headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options?.headers]),
        __security: { bearerAuth: true }
      });
    }
  };
  VectorStores.Files = Files3;
  VectorStores.FileBatches = FileBatches;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/videos.mjs
var Videos;
var init_videos = __esm(() => {
  init_pagination();
  init_headers();
  init_uploads();
  init_path();
  Videos = class Videos extends APIResource {
    create(body, options) {
      return this._client.post("/videos", multipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
    }
    retrieve(videoID, options) {
      return this._client.get(path`/videos/${videoID}`, { ...options, __security: { bearerAuth: true } });
    }
    list(query2 = {}, options) {
      return this._client.getAPIList("/videos", ConversationCursorPage, {
        query: query2,
        ...options,
        __security: { bearerAuth: true }
      });
    }
    delete(videoID, options) {
      return this._client.delete(path`/videos/${videoID}`, { ...options, __security: { bearerAuth: true } });
    }
    createCharacter(body, options) {
      return this._client.post("/videos/characters", multipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
    }
    downloadContent(videoID, query2 = {}, options) {
      return this._client.get(path`/videos/${videoID}/content`, {
        query: query2,
        ...options,
        headers: buildHeaders([{ Accept: "application/binary" }, options?.headers]),
        __security: { bearerAuth: true },
        __binaryResponse: true
      });
    }
    edit(body, options) {
      return this._client.post("/videos/edits", multipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
    }
    extend(body, options) {
      return this._client.post("/videos/extensions", multipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
    }
    getCharacter(characterID, options) {
      return this._client.get(path`/videos/characters/${characterID}`, {
        ...options,
        __security: { bearerAuth: true }
      });
    }
    remix(videoID, body, options) {
      return this._client.post(path`/videos/${videoID}/remix`, maybeMultipartFormRequestOptions({ body, ...options, __security: { bearerAuth: true } }, this._client));
    }
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/webhooks/webhooks.mjs
var _Webhooks_instances, _Webhooks_validateSecret, _Webhooks_getRequiredHeader, Webhooks;
var init_webhooks = __esm(() => {
  init_tslib();
  init_error2();
  init_headers();
  Webhooks = class Webhooks extends APIResource {
    constructor() {
      super(...arguments);
      _Webhooks_instances.add(this);
    }
    async unwrap(payload, headers, secret = this._client.webhookSecret, tolerance = 300) {
      await this.verifySignature(payload, headers, secret, tolerance);
      return JSON.parse(payload);
    }
    async verifySignature(payload, headers, secret = this._client.webhookSecret, tolerance = 300) {
      if (typeof crypto === "undefined" || typeof crypto.subtle.importKey !== "function" || typeof crypto.subtle.verify !== "function") {
        throw new Error("Webhook signature verification is only supported when the `crypto` global is defined");
      }
      __classPrivateFieldGet(this, _Webhooks_instances, "m", _Webhooks_validateSecret).call(this, secret);
      const headersObj = buildHeaders([headers]).values;
      const signatureHeader = __classPrivateFieldGet(this, _Webhooks_instances, "m", _Webhooks_getRequiredHeader).call(this, headersObj, "webhook-signature");
      const timestamp = __classPrivateFieldGet(this, _Webhooks_instances, "m", _Webhooks_getRequiredHeader).call(this, headersObj, "webhook-timestamp");
      const webhookId = __classPrivateFieldGet(this, _Webhooks_instances, "m", _Webhooks_getRequiredHeader).call(this, headersObj, "webhook-id");
      const timestampSeconds = parseInt(timestamp, 10);
      if (isNaN(timestampSeconds)) {
        throw new InvalidWebhookSignatureError("Invalid webhook timestamp format");
      }
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (nowSeconds - timestampSeconds > tolerance) {
        throw new InvalidWebhookSignatureError("Webhook timestamp is too old");
      }
      if (timestampSeconds > nowSeconds + tolerance) {
        throw new InvalidWebhookSignatureError("Webhook timestamp is too new");
      }
      const signatures = signatureHeader.split(" ").map((part) => part.startsWith("v1,") ? part.substring(3) : part);
      const decodedSecret = secret.startsWith("whsec_") ? Buffer.from(secret.replace("whsec_", ""), "base64") : Buffer.from(secret, "utf-8");
      const signedPayload = webhookId ? `${webhookId}.${timestamp}.${payload}` : `${timestamp}.${payload}`;
      const key = await crypto.subtle.importKey("raw", decodedSecret, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
      for (const signature of signatures) {
        try {
          const signatureBytes = Buffer.from(signature, "base64");
          const isValid = await crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(signedPayload));
          if (isValid) {
            return;
          }
        } catch {
          continue;
        }
      }
      throw new InvalidWebhookSignatureError("The given webhook signature does not match the expected signature");
    }
  };
  _Webhooks_instances = new WeakSet, _Webhooks_validateSecret = function _Webhooks_validateSecret2(secret) {
    if (typeof secret !== "string" || secret.length === 0) {
      throw new Error(`The webhook secret must either be set using the env var, OPENAI_WEBHOOK_SECRET, on the client class, OpenAI({ webhookSecret: '123' }), or passed to this function`);
    }
  }, _Webhooks_getRequiredHeader = function _Webhooks_getRequiredHeader2(headers, name) {
    if (!headers) {
      throw new Error(`Headers are required`);
    }
    const value = headers.get(name);
    if (value === null || value === undefined) {
      throw new Error(`Missing required header: ${name}`);
    }
    return value;
  };
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/webhooks/index.mjs
var init_webhooks2 = __esm(() => {
  init_webhooks();
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/webhooks.mjs
var init_webhooks3 = __esm(() => {
  init_webhooks2();
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/resources/index.mjs
var init_resources = __esm(() => {
  init_admin();
  init_audio();
  init_batches();
  init_beta();
  init_completions3();
  init_containers();
  init_conversations();
  init_embeddings();
  init_evals();
  init_files2();
  init_fine_tuning();
  init_graders2();
  init_images();
  init_models();
  init_moderations();
  init_realtime2();
  init_responses();
  init_skills();
  init_uploads3();
  init_vector_stores();
  init_videos();
  init_webhooks3();
  init_chat2();
  init_shared();
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/client.mjs
class OpenAI {
  constructor({ baseURL = readEnv("OPENAI_BASE_URL"), apiKey = readEnv("OPENAI_API_KEY") ?? null, adminAPIKey = readEnv("OPENAI_ADMIN_KEY") ?? null, organization = readEnv("OPENAI_ORG_ID") ?? null, project = readEnv("OPENAI_PROJECT_ID") ?? null, webhookSecret = readEnv("OPENAI_WEBHOOK_SECRET") ?? null, workloadIdentity, ...opts } = {}) {
    _OpenAI_instances.add(this);
    _OpenAI_encoder.set(this, undefined);
    this.completions = new Completions2(this);
    this.chat = new Chat(this);
    this.embeddings = new Embeddings(this);
    this.files = new Files2(this);
    this.images = new Images(this);
    this.audio = new Audio(this);
    this.moderations = new Moderations(this);
    this.models = new Models(this);
    this.fineTuning = new FineTuning(this);
    this.graders = new Graders2(this);
    this.vectorStores = new VectorStores(this);
    this.webhooks = new Webhooks(this);
    this.beta = new Beta(this);
    this.batches = new Batches(this);
    this.uploads = new Uploads(this);
    this.admin = new Admin(this);
    this.responses = new Responses(this);
    this.realtime = new Realtime2(this);
    this.conversations = new Conversations(this);
    this.evals = new Evals(this);
    this.containers = new Containers(this);
    this.skills = new Skills(this);
    this.videos = new Videos(this);
    const options = {
      apiKey,
      adminAPIKey,
      organization,
      project,
      webhookSecret,
      workloadIdentity,
      ...opts,
      baseURL: baseURL || `https://api.openai.com/v1`
    };
    if (apiKey && workloadIdentity) {
      throw new OpenAIError("The `apiKey` and `workloadIdentity` options are mutually exclusive");
    }
    if (!apiKey && !adminAPIKey && !workloadIdentity) {
      throw new OpenAIError("Missing credentials. Please pass an `apiKey`, `workloadIdentity`, `adminAPIKey`, or set the `OPENAI_API_KEY` or `OPENAI_ADMIN_KEY` environment variable.");
    }
    if (!options.dangerouslyAllowBrowser && isRunningInBrowser()) {
      throw new OpenAIError(`It looks like you're running in a browser-like environment.

This is disabled by default, as it risks exposing your secret API credentials to attackers.
If you understand the risks and have appropriate mitigations in place,
you can set the \`dangerouslyAllowBrowser\` option to \`true\`, e.g.,

new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety
`);
    }
    this.baseURL = options.baseURL;
    this.timeout = options.timeout ?? _a2.DEFAULT_TIMEOUT;
    this.logger = options.logger ?? console;
    const defaultLogLevel = "warn";
    this.logLevel = defaultLogLevel;
    this.logLevel = parseLogLevel(options.logLevel, "ClientOptions.logLevel", this) ?? parseLogLevel(readEnv("OPENAI_LOG"), "process.env['OPENAI_LOG']", this) ?? defaultLogLevel;
    this.fetchOptions = options.fetchOptions;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetch = options.fetch ?? getDefaultFetch();
    __classPrivateFieldSet(this, _OpenAI_encoder, FallbackEncoder, "f");
    const customHeadersEnv = readEnv("OPENAI_CUSTOM_HEADERS");
    if (customHeadersEnv) {
      const parsed = {};
      for (const line of customHeadersEnv.split(`
`)) {
        const colon = line.indexOf(":");
        if (colon >= 0) {
          parsed[line.substring(0, colon).trim()] = line.substring(colon + 1).trim();
        }
      }
      options.defaultHeaders = buildHeaders([parsed, options.defaultHeaders]);
    }
    this._options = options;
    if (workloadIdentity) {
      this._workloadIdentityAuth = new WorkloadIdentityAuth(workloadIdentity, this.fetch);
    }
    this.apiKey = typeof apiKey === "string" ? apiKey : null;
    this.adminAPIKey = adminAPIKey;
    this.organization = organization;
    this.project = project;
    this.webhookSecret = webhookSecret;
  }
  withOptions(options) {
    const client = new this.constructor({
      ...this._options,
      baseURL: this.baseURL,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      logger: this.logger,
      logLevel: this.logLevel,
      fetch: this.fetch,
      fetchOptions: this.fetchOptions,
      apiKey: this._options.apiKey,
      adminAPIKey: this.adminAPIKey,
      workloadIdentity: this._options.workloadIdentity,
      organization: this.organization,
      project: this.project,
      webhookSecret: this.webhookSecret,
      ...options
    });
    return client;
  }
  defaultQuery() {
    return this._options.defaultQuery;
  }
  validateHeaders({ values: values2, nulls }, schemes = {
    bearerAuth: true,
    adminAPIKeyAuth: true
  }) {
    if (values2.get("authorization") || values2.get("api-key")) {
      return;
    }
    if (nulls.has("authorization") || nulls.has("api-key")) {
      return;
    }
    if (this._workloadIdentityAuth && schemes.bearerAuth) {
      return;
    }
    throw new Error('Could not resolve authentication method. Expected either apiKey or adminAPIKey to be set. Or for one of the "Authorization" or "api-key" headers to be explicitly omitted');
  }
  async authHeaders(opts, schemes = {
    bearerAuth: true,
    adminAPIKeyAuth: true
  }) {
    return buildHeaders([
      schemes.bearerAuth ? await this.bearerAuth(opts) : null,
      schemes.adminAPIKeyAuth ? await this.adminAPIKeyAuth(opts) : null
    ]);
  }
  async bearerAuth(opts) {
    if (this._workloadIdentityAuth) {
      return buildHeaders([{ Authorization: `Bearer ${await this._workloadIdentityAuth.getToken()}` }]);
    }
    if (this.apiKey == null) {
      return;
    }
    return buildHeaders([{ Authorization: `Bearer ${this.apiKey}` }]);
  }
  async adminAPIKeyAuth(opts) {
    if (this.adminAPIKey == null) {
      return;
    }
    return buildHeaders([{ Authorization: `Bearer ${this.adminAPIKey}` }]);
  }
  stringifyQuery(query2) {
    return stringifyQuery(query2);
  }
  getUserAgent() {
    return `${this.constructor.name}/JS ${VERSION}`;
  }
  defaultIdempotencyKey() {
    return `stainless-node-retry-${uuid4()}`;
  }
  makeStatusError(status, error2, message, headers) {
    return APIError.generate(status, error2, message, headers);
  }
  async _callApiKey() {
    const apiKey = this._options.apiKey;
    if (typeof apiKey !== "function")
      return false;
    let token;
    try {
      token = await apiKey();
    } catch (err) {
      if (err instanceof OpenAIError)
        throw err;
      throw new OpenAIError(`Failed to get token from 'apiKey' function: ${err.message}`, { cause: err });
    }
    if (typeof token !== "string" || !token) {
      throw new OpenAIError(`Expected 'apiKey' function argument to return a string but it returned ${token}`);
    }
    this.apiKey = token;
    return true;
  }
  buildURL(path2, query2, defaultBaseURL) {
    const baseURL = !__classPrivateFieldGet(this, _OpenAI_instances, "m", _OpenAI_baseURLOverridden).call(this) && defaultBaseURL || this.baseURL;
    const url = isAbsoluteURL(path2) ? new URL(path2) : new URL(baseURL + (baseURL.endsWith("/") && path2.startsWith("/") ? path2.slice(1) : path2));
    const defaultQuery = this.defaultQuery();
    const pathQuery = Object.fromEntries(url.searchParams);
    if (!isEmptyObj(defaultQuery) || !isEmptyObj(pathQuery)) {
      query2 = { ...pathQuery, ...defaultQuery, ...query2 };
    }
    if (typeof query2 === "object" && query2 && !Array.isArray(query2)) {
      url.search = this.stringifyQuery(query2);
    }
    return url.toString();
  }
  async prepareOptions(options) {
    const security = options.__security ?? { bearerAuth: true };
    if (security.bearerAuth) {
      await this._callApiKey();
    }
  }
  async prepareRequest(request, { url, options }) {}
  get(path2, opts) {
    return this.methodRequest("get", path2, opts);
  }
  post(path2, opts) {
    return this.methodRequest("post", path2, opts);
  }
  patch(path2, opts) {
    return this.methodRequest("patch", path2, opts);
  }
  put(path2, opts) {
    return this.methodRequest("put", path2, opts);
  }
  delete(path2, opts) {
    return this.methodRequest("delete", path2, opts);
  }
  methodRequest(method, path2, opts) {
    return this.request(Promise.resolve(opts).then((opts2) => {
      return { method, path: path2, ...opts2 };
    }));
  }
  request(options, remainingRetries = null) {
    return new APIPromise(this, this.makeRequest(options, remainingRetries, undefined));
  }
  async makeRequest(optionsInput, retriesRemaining, retryOfRequestLogID) {
    const options = await optionsInput;
    const maxRetries = options.maxRetries ?? this.maxRetries;
    if (retriesRemaining == null) {
      retriesRemaining = maxRetries;
    }
    await this.prepareOptions(options);
    const { req, url, timeout } = await this.buildRequest(options, {
      retryCount: maxRetries - retriesRemaining
    });
    await this.prepareRequest(req, { url, options });
    const requestLogID = "log_" + (Math.random() * (1 << 24) | 0).toString(16).padStart(6, "0");
    const retryLogStr = retryOfRequestLogID === undefined ? "" : `, retryOf: ${retryOfRequestLogID}`;
    const startTime = Date.now();
    loggerFor(this).debug(`[${requestLogID}] sending request`, formatRequestDetails({
      retryOfRequestLogID,
      method: options.method,
      url,
      options,
      headers: req.headers
    }));
    if (options.signal?.aborted) {
      throw new APIUserAbortError;
    }
    const security = options.__security ?? { bearerAuth: true };
    const controller = new AbortController;
    const response = await this.fetchWithAuth(url, req, timeout, controller, security).catch(castToError);
    const headersTime = Date.now();
    if (response instanceof globalThis.Error) {
      const retryMessage = `retrying, ${retriesRemaining} attempts remaining`;
      if (options.signal?.aborted) {
        throw new APIUserAbortError;
      }
      const isTimeout = isAbortError(response) || /timed? ?out/i.test(String(response) + ("cause" in response ? String(response.cause) : ""));
      if (retriesRemaining) {
        loggerFor(this).info(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} - ${retryMessage}`);
        loggerFor(this).debug(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} (${retryMessage})`, formatRequestDetails({
          retryOfRequestLogID,
          url,
          durationMs: headersTime - startTime,
          message: response.message
        }));
        return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID);
      }
      loggerFor(this).info(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} - error; no more retries left`);
      loggerFor(this).debug(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} (error; no more retries left)`, formatRequestDetails({
        retryOfRequestLogID,
        url,
        durationMs: headersTime - startTime,
        message: response.message
      }));
      if (response instanceof OAuthError || response instanceof SubjectTokenProviderError) {
        throw response;
      }
      if (isTimeout) {
        throw new APIConnectionTimeoutError;
      }
      throw new APIConnectionError({
        message: getConnectionErrorMessage(response),
        cause: response
      });
    }
    const specialHeaders = [...response.headers.entries()].filter(([name]) => name === "x-request-id").map(([name, value]) => ", " + name + ": " + JSON.stringify(value)).join("");
    const responseInfo = `[${requestLogID}${retryLogStr}${specialHeaders}] ${req.method} ${url} ${response.ok ? "succeeded" : "failed"} with status ${response.status} in ${headersTime - startTime}ms`;
    if (!response.ok) {
      if (response.status === 401 && this._workloadIdentityAuth && security.bearerAuth && !options.__metadata?.["hasStreamingBody"] && !options.__metadata?.["workloadIdentityTokenRefreshed"]) {
        await CancelReadableStream(response.body);
        this._workloadIdentityAuth.invalidateToken();
        return this.makeRequest({
          ...options,
          __metadata: {
            ...options.__metadata,
            workloadIdentityTokenRefreshed: true
          }
        }, retriesRemaining, retryOfRequestLogID ?? requestLogID);
      }
      const shouldRetry = await this.shouldRetry(response);
      if (retriesRemaining && shouldRetry) {
        const retryMessage2 = `retrying, ${retriesRemaining} attempts remaining`;
        await CancelReadableStream(response.body);
        loggerFor(this).info(`${responseInfo} - ${retryMessage2}`);
        loggerFor(this).debug(`[${requestLogID}] response error (${retryMessage2})`, formatRequestDetails({
          retryOfRequestLogID,
          url: response.url,
          status: response.status,
          headers: response.headers,
          durationMs: headersTime - startTime
        }));
        return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID, response.headers);
      }
      const retryMessage = shouldRetry ? `error; no more retries left` : `error; not retryable`;
      loggerFor(this).info(`${responseInfo} - ${retryMessage}`);
      const errText = await response.text().catch((err2) => castToError(err2).message);
      const errJSON = safeJSON(errText);
      const errMessage = errJSON ? undefined : errText;
      loggerFor(this).debug(`[${requestLogID}] response error (${retryMessage})`, formatRequestDetails({
        retryOfRequestLogID,
        url: response.url,
        status: response.status,
        headers: response.headers,
        message: errMessage,
        durationMs: Date.now() - startTime
      }));
      const err = this.makeStatusError(response.status, errJSON, errMessage, response.headers);
      throw err;
    }
    loggerFor(this).info(responseInfo);
    loggerFor(this).debug(`[${requestLogID}] response start`, formatRequestDetails({
      retryOfRequestLogID,
      url: response.url,
      status: response.status,
      headers: response.headers,
      durationMs: headersTime - startTime
    }));
    return { response, options, controller, requestLogID, retryOfRequestLogID, startTime };
  }
  getAPIList(path2, Page2, opts) {
    return this.requestAPIList(Page2, opts && "then" in opts ? opts.then((opts2) => ({ method: "get", path: path2, ...opts2 })) : { method: "get", path: path2, ...opts });
  }
  requestAPIList(Page2, options) {
    const request = this.makeRequest(options, null, undefined);
    return new PagePromise(this, request, Page2);
  }
  async fetchWithAuth(url, init, timeout, controller, schemes = {
    bearerAuth: true,
    adminAPIKeyAuth: true
  }) {
    if (this._workloadIdentityAuth && schemes.bearerAuth) {
      const headers = init.headers;
      const authHeader = headers.get("Authorization");
      if (!authHeader || authHeader === `Bearer ${WORKLOAD_IDENTITY_API_KEY_PLACEHOLDER}`) {
        const token = await this._workloadIdentityAuth.getToken();
        headers.set("Authorization", `Bearer ${token}`);
      }
    }
    const response = await this.fetchWithTimeout(url, init, timeout, controller);
    return response;
  }
  async fetchWithTimeout(url, init, ms, controller) {
    const { signal, method, ...options } = init || {};
    const abort = this._makeAbort(controller);
    if (signal)
      signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, ms);
    const isReadableBody = globalThis.ReadableStream && options.body instanceof globalThis.ReadableStream || typeof options.body === "object" && options.body !== null && Symbol.asyncIterator in options.body;
    const fetchOptions = {
      signal: controller.signal,
      ...isReadableBody ? { duplex: "half" } : {},
      method: "GET",
      ...options
    };
    if (method) {
      fetchOptions.method = method.toUpperCase();
    }
    try {
      return await this.fetch.call(undefined, url, fetchOptions);
    } finally {
      clearTimeout(timeout);
    }
  }
  async shouldRetry(response) {
    const shouldRetryHeader = response.headers.get("x-should-retry");
    if (shouldRetryHeader === "true")
      return true;
    if (shouldRetryHeader === "false")
      return false;
    if (response.status === 408)
      return true;
    if (response.status === 409)
      return true;
    if (response.status === 429)
      return true;
    if (response.status >= 500)
      return true;
    return false;
  }
  async retryRequest(options, retriesRemaining, requestLogID, responseHeaders) {
    let timeoutMillis;
    const retryAfterMillisHeader = responseHeaders?.get("retry-after-ms");
    if (retryAfterMillisHeader) {
      const timeoutMs = parseFloat(retryAfterMillisHeader);
      if (!Number.isNaN(timeoutMs)) {
        timeoutMillis = timeoutMs;
      }
    }
    const retryAfterHeader = responseHeaders?.get("retry-after");
    if (retryAfterHeader && !timeoutMillis) {
      const timeoutSeconds = parseFloat(retryAfterHeader);
      if (!Number.isNaN(timeoutSeconds)) {
        timeoutMillis = timeoutSeconds * 1000;
      } else {
        timeoutMillis = Date.parse(retryAfterHeader) - Date.now();
      }
    }
    if (timeoutMillis === undefined) {
      const maxRetries = options.maxRetries ?? this.maxRetries;
      timeoutMillis = this.calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries);
    }
    await sleep(timeoutMillis);
    return this.makeRequest(options, retriesRemaining - 1, requestLogID);
  }
  calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries) {
    const initialRetryDelay = 0.5;
    const maxRetryDelay = 8;
    const numRetries = maxRetries - retriesRemaining;
    const sleepSeconds = Math.min(initialRetryDelay * Math.pow(2, numRetries), maxRetryDelay);
    const jitter = 1 - Math.random() * 0.25;
    return sleepSeconds * jitter * 1000;
  }
  async buildRequest(inputOptions, { retryCount = 0 } = {}) {
    const options = { ...inputOptions };
    const { method, path: path2, query: query2, defaultBaseURL } = options;
    const url = this.buildURL(path2, query2, defaultBaseURL);
    if ("timeout" in options)
      validatePositiveInteger("timeout", options.timeout);
    options.timeout = options.timeout ?? this.timeout;
    const { bodyHeaders, body, isStreamingBody } = this.buildBody({ options });
    if (isStreamingBody) {
      inputOptions.__metadata = {
        ...inputOptions.__metadata,
        hasStreamingBody: true
      };
    }
    const reqHeaders = await this.buildHeaders({ options: inputOptions, method, bodyHeaders, retryCount });
    const req = {
      method,
      headers: reqHeaders,
      ...options.signal && { signal: options.signal },
      ...globalThis.ReadableStream && body instanceof globalThis.ReadableStream && { duplex: "half" },
      ...body && { body },
      ...this.fetchOptions ?? {},
      ...options.fetchOptions ?? {}
    };
    return { req, url, timeout: options.timeout };
  }
  async buildHeaders({ options, method, bodyHeaders, retryCount }) {
    let idempotencyHeaders = {};
    if (this.idempotencyHeader && method !== "get") {
      if (!options.idempotencyKey)
        options.idempotencyKey = this.defaultIdempotencyKey();
      idempotencyHeaders[this.idempotencyHeader] = options.idempotencyKey;
    }
    const headers = buildHeaders([
      idempotencyHeaders,
      {
        Accept: "application/json",
        "User-Agent": this.getUserAgent(),
        "X-Stainless-Retry-Count": String(retryCount),
        ...options.timeout ? { "X-Stainless-Timeout": String(Math.trunc(options.timeout / 1000)) } : {},
        ...getPlatformHeaders(),
        "OpenAI-Organization": this.organization,
        "OpenAI-Project": this.project
      },
      await this.authHeaders(options, options.__security ?? { bearerAuth: true }),
      this._options.defaultHeaders,
      bodyHeaders,
      options.headers
    ]);
    this.validateHeaders(headers, options.__security ?? { bearerAuth: true });
    return headers.values;
  }
  _makeAbort(controller) {
    return () => controller.abort();
  }
  buildBody({ options: { body, headers: rawHeaders } }) {
    if (!body) {
      return { bodyHeaders: undefined, body: undefined, isStreamingBody: false };
    }
    const headers = buildHeaders([rawHeaders]);
    const isReadableStream = typeof globalThis.ReadableStream !== "undefined" && body instanceof globalThis.ReadableStream;
    const isRetryableBody = !isReadableStream && (typeof body === "string" || body instanceof ArrayBuffer || ArrayBuffer.isView(body) || typeof globalThis.Blob !== "undefined" && body instanceof globalThis.Blob || body instanceof URLSearchParams || body instanceof FormData);
    if (ArrayBuffer.isView(body) || body instanceof ArrayBuffer || body instanceof DataView || typeof body === "string" && headers.values.has("content-type") || globalThis.Blob && body instanceof globalThis.Blob || body instanceof FormData || body instanceof URLSearchParams || isReadableStream) {
      return { bodyHeaders: undefined, body, isStreamingBody: !isRetryableBody };
    } else if (typeof body === "object" && ((Symbol.asyncIterator in body) || (Symbol.iterator in body) && ("next" in body) && typeof body.next === "function")) {
      return {
        bodyHeaders: undefined,
        body: ReadableStreamFrom(body),
        isStreamingBody: true
      };
    } else if (typeof body === "object" && headers.values.get("content-type") === "application/x-www-form-urlencoded") {
      return {
        bodyHeaders: { "content-type": "application/x-www-form-urlencoded" },
        body: this.stringifyQuery(body),
        isStreamingBody: false
      };
    } else {
      return { ...__classPrivateFieldGet(this, _OpenAI_encoder, "f").call(this, { body, headers }), isStreamingBody: false };
    }
  }
}
function getConnectionErrorMessage(error2) {
  if (isUndiciDispatcherVersionMismatchError(error2)) {
    return `Connection error. This may be caused by passing an undici dispatcher, such as ProxyAgent, that is incompatible with the fetch implementation. If you are using undici's ProxyAgent, pass the fetch implementation from the same undici package: import { fetch, ProxyAgent } from 'undici'; new OpenAI({ fetch, fetchOptions: { dispatcher: new ProxyAgent(...) } });`;
  }
  return;
}
function isUndiciDispatcherVersionMismatchError(error2) {
  let current = error2;
  for (let i = 0;i < 8 && current && typeof current === "object"; i++) {
    const err = current;
    if (err.code === "UND_ERR_INVALID_ARG" && typeof err.message === "string" && err.message.includes("invalid onRequestStart method")) {
      return true;
    }
    current = err.cause;
  }
  return false;
}
var _OpenAI_instances, _a2, _OpenAI_encoder, _OpenAI_baseURLOverridden, WORKLOAD_IDENTITY_API_KEY_PLACEHOLDER = "workload-identity-auth";
var init_client = __esm(() => {
  init_tslib();
  init_values();
  init_detect_platform();
  init_query();
  init_error();
  init_pagination();
  init_workload_identity_auth();
  init_error();
  init_uploads2();
  init_resources();
  init_api_promise();
  init_batches();
  init_completions3();
  init_embeddings();
  init_files2();
  init_images();
  init_models();
  init_moderations();
  init_videos();
  init_admin();
  init_audio();
  init_beta();
  init_chat();
  init_containers();
  init_conversations();
  init_evals();
  init_fine_tuning();
  init_graders2();
  init_realtime2();
  init_responses();
  init_skills();
  init_uploads3();
  init_vector_stores();
  init_webhooks();
  init_detect_platform();
  init_headers();
  init_log();
  init_values();
  _a2 = OpenAI, _OpenAI_encoder = new WeakMap, _OpenAI_instances = new WeakSet, _OpenAI_baseURLOverridden = function _OpenAI_baseURLOverridden2() {
    return this.baseURL !== "https://api.openai.com/v1";
  };
  OpenAI.OpenAI = _a2;
  OpenAI.DEFAULT_TIMEOUT = 600000;
  OpenAI.OpenAIError = OpenAIError;
  OpenAI.APIError = APIError;
  OpenAI.APIConnectionError = APIConnectionError;
  OpenAI.APIConnectionTimeoutError = APIConnectionTimeoutError;
  OpenAI.APIUserAbortError = APIUserAbortError;
  OpenAI.NotFoundError = NotFoundError;
  OpenAI.ConflictError = ConflictError;
  OpenAI.RateLimitError = RateLimitError;
  OpenAI.BadRequestError = BadRequestError;
  OpenAI.AuthenticationError = AuthenticationError;
  OpenAI.InternalServerError = InternalServerError;
  OpenAI.PermissionDeniedError = PermissionDeniedError;
  OpenAI.UnprocessableEntityError = UnprocessableEntityError;
  OpenAI.InvalidWebhookSignatureError = InvalidWebhookSignatureError;
  OpenAI.toFile = toFile;
  OpenAI.Completions = Completions2;
  OpenAI.Chat = Chat;
  OpenAI.Embeddings = Embeddings;
  OpenAI.Files = Files2;
  OpenAI.Images = Images;
  OpenAI.Audio = Audio;
  OpenAI.Moderations = Moderations;
  OpenAI.Models = Models;
  OpenAI.FineTuning = FineTuning;
  OpenAI.Graders = Graders2;
  OpenAI.VectorStores = VectorStores;
  OpenAI.Webhooks = Webhooks;
  OpenAI.Beta = Beta;
  OpenAI.Batches = Batches;
  OpenAI.Uploads = Uploads;
  OpenAI.Admin = Admin;
  OpenAI.Responses = Responses;
  OpenAI.Realtime = Realtime2;
  OpenAI.Conversations = Conversations;
  OpenAI.Evals = Evals;
  OpenAI.Containers = Containers;
  OpenAI.Skills = Skills;
  OpenAI.Videos = Videos;
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/azure.mjs
var _deployments_endpoints;
var init_azure = __esm(() => {
  init_headers();
  init_error2();
  init_utils2();
  init_client();
  _deployments_endpoints = new Set([
    "/completions",
    "/chat/completions",
    "/embeddings",
    "/audio/transcriptions",
    "/audio/translations",
    "/audio/speech",
    "/images/generations",
    "/batches",
    "/images/edits"
  ]);
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/bedrock.mjs
var init_bedrock = __esm(() => {
  init_error2();
  init_client();
  init_headers();
  init_utils2();
  init_ResponsesParser();
  init_resources();
});

// node_modules/.bun/openai@6.44.0+68a1e3a0c4588df3/node_modules/openai/index.mjs
var init_openai = __esm(() => {
  init_client();
  init_uploads2();
  init_api_promise();
  init_client();
  init_pagination();
  init_error();
  init_azure();
  init_bedrock();
});

// src/core/llm-judge.ts
function extractCandidates(text) {
  let cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, "$1").trim();
  const candidates = [];
  const allMatches = cleaned.match(/\{[\s\S]*?\}(?=\s*(?:\{|$))/g) ?? [];
  const fullMatch = cleaned.match(/\{[\s\S]*\}/);
  if (fullMatch) {
    try {
      candidates.push(JSON.parse(fullMatch[0]));
    } catch {}
  }
  for (const m of allMatches) {
    try {
      candidates.push(JSON.parse(m));
    } catch {}
  }
  if (cleaned.startsWith("{") || cleaned.startsWith("[")) {
    try {
      const direct = JSON.parse(cleaned);
      if (direct && typeof direct === "object")
        candidates.push(direct);
    } catch {}
  }
  const unwrapped = [];
  for (const c of candidates) {
    if (c.result) {
      let inner = c.result;
      if (typeof inner === "string") {
        try {
          inner = JSON.parse(inner);
        } catch {}
      }
      if (inner && typeof inner === "object")
        unwrapped.push(inner);
    }
    unwrapped.push(c);
  }
  function collectObjects(obj, out = []) {
    if (!obj || typeof obj !== "object")
      return out;
    if (Array.isArray(obj)) {
      for (const item of obj)
        collectObjects(item, out);
    } else {
      out.push(obj);
      for (const v of Object.values(obj))
        collectObjects(v, out);
    }
    return out;
  }
  const nested = [];
  for (const c of [...candidates, ...unwrapped]) {
    collectObjects(c, nested);
  }
  return [...unwrapped, ...nested];
}
function resolveProvider(model) {
  const m = (model || "").toLowerCase();
  return PROVIDERS.find((p) => p.prefixes.some((prefix) => m.includes(prefix)));
}
function resolveApiKey(cfg) {
  if (cfg.api_key)
    return cfg.api_key;
  const allKeys = [
    ...PROVIDERS.flatMap((p) => p.keyEnvVars),
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY"
  ];
  for (const key of allKeys) {
    const val = process.env[key];
    if (val)
      return val;
  }
  return;
}
function resolveBaseURL(cfg, model) {
  if (cfg.base_url)
    return cfg.base_url;
  if (process.env.ZAI_BASE_URL)
    return process.env.ZAI_BASE_URL;
  if (process.env.OPENAI_BASE_URL)
    return process.env.OPENAI_BASE_URL;
  const provider = resolveProvider(model);
  if (provider) {
    return provider.baseURL;
  }
  return "https://api.openai.com/v1";
}
function canUseApiJudge(evalCfg) {
  if (evalCfg.base_url)
    return true;
  if (evalCfg.api_key)
    return true;
  if (process.env.ZAI_BASE_URL || process.env.OPENAI_BASE_URL)
    return true;
  const provider = resolveProvider(evalCfg.model || "");
  const envKeys = provider ? provider.keyEnvVars : ["ZAI_API_KEY", "ZHIPU_API_KEY", "GLM_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"];
  return envKeys.some((k) => !!process.env[k]);
}
async function invokeJudge(promptText, evalCfg) {
  const model = (evalCfg.model || "").trim() || "gpt-4o-mini";
  const apiKey = resolveApiKey(evalCfg);
  const baseURL = resolveBaseURL(evalCfg, model);
  if (!apiKey) {
    return {
      success: false,
      error: "No API key for eval judge (set ZAI_API_KEY / OPENAI_API_KEY, or eval.api_key)."
    };
  }
  const client = new OpenAI({
    apiKey,
    baseURL: baseURL.replace(/\/+$/, "")
  });
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "You are a strict evaluator. Return ONLY a single valid JSON object. No markdown, no prose, no fences."
        },
        { role: "user", content: promptText }
      ],
      temperature: 0,
      ...model.startsWith("claude") ? {} : { response_format: { type: "json_object" } }
    });
    const content = completion.choices?.[0]?.message?.content ?? "";
    if (typeof content !== "string" || !content.trim()) {
      return { success: false, error: "Judge API returned empty content" };
    }
    const candidates = extractCandidates(content);
    for (const c of candidates) {
      if ("verdict" in c || "checklist" in c) {
        return { success: true, data: c };
      }
    }
    if (candidates[0]) {
      return { success: true, data: candidates[0] };
    }
    return { success: false, error: "No usable JSON found in judge response" };
  } catch (e) {
    const msg = e?.message || "Judge API request failed";
    const status = e?.status ? ` (status ${e.status})` : "";
    let error2 = `Judge API error${status}: ${msg}`;
    if (e?.response?.data) {
      try {
        error2 += ` \u2014 ${JSON.stringify(e.response.data).slice(0, 300)}`;
      } catch {}
    }
    return { success: false, error: error2 };
  }
}
var PROVIDERS;
var init_llm_judge = __esm(() => {
  init_openai();
  PROVIDERS = [
    {
      name: "zai",
      prefixes: ["glm", "z.ai", "zhipu"],
      baseURL: "https://api.z.ai/api/paas/v4",
      keyEnvVars: ["ZAI_API_KEY", "ZHIPU_API_KEY", "GLM_API_KEY"]
    }
  ];
});

// src/core/agent-invoke.ts
var {spawnSync } = globalThis.Bun;
function getLastInvokeError() {
  return lastInvokeError;
}
function isClaudeCommand(command) {
  return /claude/i.test(command);
}
function isGrokCommand(command) {
  return /grok/i.test(command);
}
function getDefaultPromptTemplate(command) {
  const lower = (command || "").toLowerCase();
  if (lower.includes("claude")) {
    return '-p "{{prompt}}" --output-format json --bare';
  }
  if (lower.includes("grok")) {
    return '-p "{{prompt}}" --no-auto-update --no-alt-screen --always-approve';
  }
  return '-p "{{prompt}}"';
}
function resolveAgentConfig(agent) {
  const command = agent.command || "";
  const desired = getDefaultPromptTemplate(command);
  let template = agent.prompt_template;
  if (template) {
    if (isClaudeCommand(command) && /--no-auto-update|--no-alt-screen|--always-approve/.test(template)) {
      template = desired;
    } else if (isGrokCommand(command) && /--output-format\s+json/.test(template)) {
      template = desired;
    }
  } else {
    template = desired;
  }
  let cwd_flag = agent.cwd_flag;
  if (isClaudeCommand(command) && cwd_flag) {
    cwd_flag = undefined;
  }
  return {
    command,
    prompt_template: template,
    ...cwd_flag ? { cwd_flag } : {}
  };
}
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
    return cleaned === marker ? promptText : cleaned;
  });
}
function extractCandidates2(text) {
  let cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, "$1").trim();
  const candidates = [];
  const allMatches = cleaned.match(/\{[\s\S]*?\}(?=\s*(?:\{|$))/g) ?? [];
  const fullMatch = cleaned.match(/\{[\s\S]*\}/);
  if (fullMatch) {
    try {
      candidates.push(JSON.parse(fullMatch[0]));
    } catch {}
  }
  for (const m of allMatches) {
    try {
      candidates.push(JSON.parse(m));
    } catch {}
  }
  if (cleaned.startsWith("{") || cleaned.startsWith("[")) {
    try {
      const direct = JSON.parse(cleaned);
      if (direct && typeof direct === "object")
        candidates.push(direct);
    } catch {}
  }
  const unwrapped = [];
  for (const c of candidates) {
    if (c.result) {
      let inner = c.result;
      if (typeof inner === "string") {
        try {
          inner = JSON.parse(inner);
        } catch {}
      }
      if (inner && typeof inner === "object")
        unwrapped.push(inner);
    }
    unwrapped.push(c);
  }
  function collectObjects(obj, out = []) {
    if (!obj || typeof obj !== "object")
      return out;
    if (Array.isArray(obj)) {
      for (const item of obj)
        collectObjects(item, out);
    } else {
      out.push(obj);
      for (const v of Object.values(obj))
        collectObjects(v, out);
    }
    return out;
  }
  const nested = [];
  for (const c of [...candidates, ...unwrapped]) {
    collectObjects(c, nested);
  }
  return [...unwrapped, ...nested];
}
function formatAgentFailure(stdout, stderr, exitCode) {
  if (stderr)
    return stderr;
  const candidates = extractCandidates2(stdout);
  for (const c of candidates) {
    if (c.is_error === true && typeof c.result === "string" && c.result.trim()) {
      return c.result.trim();
    }
    if (typeof c.error === "string" && c.error.trim())
      return c.error.trim();
  }
  if (stdout)
    return stdout;
  return `agent exited with code ${exitCode ?? "unknown"}`;
}
async function invokeAgent(promptText, agentCfg, expectedKeys) {
  lastInvokeError = "";
  const resolved = resolveAgentConfig(agentCfg);
  const template = resolved.prompt_template ?? getDefaultPromptTemplate(resolved.command);
  const extraArgs = buildAgentArgv(template, promptText);
  let result;
  try {
    result = spawnSync([resolved.command, ...extraArgs], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env }
    });
  } catch (e) {
    lastInvokeError = e instanceof Error ? e.message : "agent spawn failed";
    return null;
  }
  const stdout = (result.stdout ?? "").toString().trim();
  const stderr = (result.stderr ?? "").toString().trim();
  const cleaned = stdout.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, "$1").trim();
  const unwrapped = extractCandidates2(cleaned);
  for (const c of unwrapped) {
    if (expectedKeys.some((k) => (k in c)))
      return c;
  }
  if (result.exitCode !== 0) {
    lastInvokeError = formatAgentFailure(stdout, stderr, result.exitCode);
    return null;
  }
  if (unwrapped[0])
    return unwrapped[0];
  lastInvokeError = formatAgentFailure(stdout, stderr, result.exitCode);
  return null;
}
async function runAgentSession(promptText, agentCfg, opts = {}) {
  const { cwd, alwaysApprove = true, stream = true } = opts;
  const resolved = resolveAgentConfig(agentCfg);
  const cmd = resolved.command || "grok";
  let args = [];
  const isGrok = isGrokCommand(cmd);
  if (isGrok) {
    args = [
      "--no-auto-update",
      "-p",
      promptText,
      "--cwd",
      cwd || process.cwd(),
      "--always-approve",
      "--no-alt-screen",
      "--output-format",
      "plain"
    ];
  } else {
    const template = resolved.prompt_template && !resolved.prompt_template.includes("output-format json") ? resolved.prompt_template : '-p "{{prompt}}"';
    args = buildAgentArgv(template, promptText);
    if (cwd && resolved.cwd_flag) {
      args.push(resolved.cwd_flag, cwd);
    }
    if (alwaysApprove && isClaudeCommand(cmd)) {
      args.push("--dangerously-skip-permissions");
    }
  }
  const proc = Bun.spawn([cmd, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
    cwd: cwd || process.cwd()
  });
  let stdout = "";
  const decoder = new TextDecoder;
  const reader = proc.stdout.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done)
        break;
      const text = decoder.decode(value, { stream: true });
      stdout += text;
      if (stream) {
        process.stdout.write(text);
      }
    }
  } finally {
    reader.releaseLock();
  }
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    if (stderr && !stream)
      process.stderr.write(stderr);
    return `ERROR (exit ${exitCode}):
${stderr || stdout}`;
  }
  return stdout.trim() || "(no output)";
}
var lastInvokeError = "";
var init_agent_invoke = __esm(() => {
  init_llm_judge();
  init_llm_judge();
});

// src/core/session-eval.ts
function toolCallSummary(call) {
  const inputStr = JSON.stringify(call.input).slice(0, 100);
  return `${call.name}: ${inputStr}`;
}
function buildEvalPrompt(primitives, skillContent, maxToolCalls) {
  const truncated = truncateToolCalls(primitives.toolCalls, maxToolCalls);
  const wasTruncated = truncated.length < primitives.toolCalls.length;
  const toolCallLines = truncated.map((c) => toolCallSummary(c)).join(`
`);
  const truncationNote = wasTruncated ? `
[truncated: showing ${truncated.length} of ${primitives.toolCalls.length} total tool calls]` : "";
  const userMsgLines = primitives.userMessages.slice(0, 5).join(`
---
`);
  return `You are evaluating whether a coding agent followed a skill's instructions during a real session.

SKILL CONTENT:
${skillContent}

TOOL CALL SEQUENCE (ordered):
${toolCallLines}${truncationNote}

USER MESSAGES (first 5, for familiarity inference):
${userMsgLines}

TASKS:
1. Extract the key actions the skill instructs (e.g. "invoke X tool", "fetch N URLs", "create tasks for each item").
2. For each expected action, check if the tool call sequence shows it happened.
3. Infer user familiarity 1-10 from the user messages:
   - 1-3: vague/brief prompts, many typos, relies on agent to figure things out
   - 4-6: clear intent but informal, some corrections
   - 7-10: precise, technical, specific file paths/function names
4. Determine closure:
   - "1-shot": \u22642 user turns after first Skill invocation
   - "multi-turn": >2 user turns after first Skill invocation
   - "incomplete": no end_turn signal or session appears cut off
5. Overall verdict: "PASS" if all critical instructions were followed, "FAIL" if any critical instruction was missed.

CRITICAL: Output *ONLY* the JSON object. No markdown fences, no explanations, no text before or after it. The first character of your response must be '{' and the last must be '}'.

Return ONLY a valid JSON object with exactly these keys:
{
  "userFamiliarity": <number 1-10>,
  "userFamiliarityReason": "<one sentence>",
  "closure": "<1-shot|multi-turn|incomplete>",
  "userTurnsAfterSkill": <number>,
  "verdict": "<PASS|FAIL>",
  "verdictReason": "<one sentence>",
  "checklist": [
    { "instruction": "<what skill said>", "pass": <true|false>, "detail": "<optional>" }
  ]
}`;
}
function makeUnknownResult(primitives, skillName, reason) {
  return {
    schemaVersion: 1,
    sessionId: primitives.sessionId,
    sessionTitle: primitives.sessionTitle,
    timestamp: new Date().toISOString(),
    agent: primitives.agent,
    model: primitives.model,
    skill: skillName,
    userFamiliarity: 0,
    userFamiliarityReason: "",
    closure: "incomplete",
    userTurnsAfterSkill: 0,
    skillsInvoked: primitives.skillsInvoked,
    toolCallCounts: primitives.toolCallCounts,
    verdict: "UNKNOWN",
    verdictReason: reason,
    checklist: []
  };
}
async function runEval(primitives, skillName, skillContent, agentCfg, evalCfg) {
  const prompt = buildEvalPrompt(primitives, skillContent, evalCfg.max_tool_calls);
  const preference = evalCfg.judge ?? "auto";
  let raw = null;
  let judgeError;
  const shouldTryApi = preference !== "cli" && (preference === "api" || canUseApiJudge(evalCfg)) && !!evalCfg.model;
  if (shouldTryApi) {
    const result = await invokeJudge(prompt, evalCfg);
    if (result.success) {
      raw = result.data;
    } else {
      judgeError = result.error;
    }
  }
  if (!raw && preference !== "api") {
    raw = await invokeAgent(prompt, agentCfg, ["verdict", "checklist"]);
  }
  if (!raw) {
    const err = judgeError || getLastInvokeError();
    return makeUnknownResult(primitives, skillName, err ? `LLM call failed: ${err}` : "LLM call failed \u2014 no response");
  }
  if (typeof raw.verdict !== "string" || !Array.isArray(raw.checklist)) {
    return makeUnknownResult(primitives, skillName, "LLM returned malformed response");
  }
  const checklist = raw.checklist.map((item) => {
    const i = item;
    return {
      instruction: typeof i.instruction === "string" ? i.instruction : "unknown",
      pass: i.pass === true,
      detail: typeof i.detail === "string" ? i.detail : undefined
    };
  });
  return {
    schemaVersion: 1,
    sessionId: primitives.sessionId,
    sessionTitle: primitives.sessionTitle,
    timestamp: new Date().toISOString(),
    agent: primitives.agent,
    model: primitives.model,
    skill: skillName,
    userFamiliarity: typeof raw.userFamiliarity === "number" ? raw.userFamiliarity : 0,
    userFamiliarityReason: typeof raw.userFamiliarityReason === "string" ? raw.userFamiliarityReason : "",
    closure: raw.closure ?? "incomplete",
    userTurnsAfterSkill: typeof raw.userTurnsAfterSkill === "number" ? raw.userTurnsAfterSkill : 0,
    skillsInvoked: primitives.skillsInvoked,
    toolCallCounts: primitives.toolCallCounts,
    verdict: raw.verdict === "PASS" ? "PASS" : raw.verdict === "FAIL" ? "FAIL" : "UNKNOWN",
    verdictReason: typeof raw.verdictReason === "string" ? raw.verdictReason : "",
    checklist
  };
}
var init_session_eval = __esm(() => {
  init_agent_invoke();
  init_llm_judge();
});

// src/core/journal-config.ts
import { existsSync as existsSync4, mkdirSync } from "fs";
import { homedir as homedir2 } from "os";
import { join as join2 } from "path";
var {YAML: YAML2 } = globalThis.Bun;
function getDoravalDir() {
  return process.env.DORAVAL_HOME ?? join2(homedir2(), ".doraval");
}
function getConfigPath() {
  return join2(getDoravalDir(), "config.yml");
}
function getJournalsDir() {
  return join2(getDoravalDir(), "journals");
}
function getPendingDir() {
  return join2(getDoravalDir(), "pending");
}
function getPendingProjectDir(project) {
  return join2(getPendingDir(), project);
}
function getEvalsDir() {
  return join2(getDoravalDir(), "evals");
}
function getEvalConfig(config) {
  const defaults2 = {
    model: "",
    api_key: undefined,
    base_url: undefined,
    max_tool_calls: 200,
    save_history: true,
    judge: "auto"
  };
  return { ...defaults2, ...config?.eval ?? {} };
}
function ensureDoravalDirs() {
  const base = getDoravalDir();
  for (const dir of [base, getJournalsDir(), getPendingDir(), getEvalsDir()]) {
    if (!existsSync4(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
async function readConfig() {
  const path2 = getConfigPath();
  if (!existsSync4(path2))
    return null;
  const raw = await Bun.file(path2).text();
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

// src/cli/prompt.ts
function prompt(label, fallback) {
  process.stderr.write(`${label} ${import_picocolors3.default.dim(`(${fallback})`)} `);
  const buf = new Uint8Array(1024);
  const n = __require("fs").readSync(0, buf);
  const input = new TextDecoder().decode(buf.subarray(0, n)).trim();
  return input || fallback;
}
var import_picocolors3;
var init_prompt = __esm(() => {
  import_picocolors3 = __toESM(require_picocolors(), 1);
});

// src/core/prompt-gen.ts
async function randomPromptsForSkill(skillContent, count, agentCfg) {
  const focusExtractors = [
    (s) => s.match(/name:\s*["']?(.+?)["']?\n/i)?.[1],
    (s) => s.match(/when_to_use:\s*["']?(.+?)["']?\n/i)?.[1],
    (s) => s.match(/description:\s*["']?(.+?)["']?\n/i)?.[1]
  ];
  const skillFocus = focusExtractors.map((fn) => fn(skillContent)?.trim()).find(Boolean) || "the task described in the skill";
  if (agentCfg?.command) {
    try {
      const genPrompt = `Given this skill (focus: ${skillFocus}), generate exactly ${count} specific, varied, realistic prompts for a coding agent.

The agent will be given the full skill and told "You MUST follow this skill exactly".

Generate prompts that are direct applications of this skill's purpose (e.g. "Set up Scalekit auth following the skill's exact steps and requirements").

Output ONLY valid JSON: {"prompts": ["prompt1", "prompt2", ...]}
No other text.`;
      const res = await invokeAgent(genPrompt, agentCfg, ["prompts"]);
      if (res && typeof res === "object") {
        let promptList = res.prompts;
        if (Array.isArray(promptList)) {
          const cleaned = promptList.map((p) => String(p).trim()).filter((p) => p.length > 20 && !p.toLowerCase().includes("explore the current project") && !p.includes("result") && !p.includes("session_id"));
          if (cleaned.length > 0) {
            return cleaned.slice(0, count);
          }
        }
      }
    } catch {}
  }
  const focus = focusExtractors.map((fn) => fn(skillContent)?.trim()).find(Boolean) || "accomplish the main goal of the skill";
  const prompts = [];
  for (let i = 0;i < count; i++) {
    const base = `Follow the instructions in this skill exactly to ${focus.toLowerCase()}.`;
    prompts.push(i === 0 ? base : `${base} (variation ${i + 1})`);
  }
  return prompts;
}
var init_prompt_gen = __esm(() => {
  init_agent_invoke();
});

// src/core/skill-runner.ts
import { join as join3, resolve as pathResolve } from "path";
import { homedir as homedir3 } from "os";
import { existsSync as existsSync5, mkdirSync as mkdirSync2, readFileSync as readFileSync2, readdirSync as readdirSync2 } from "fs";
function cwdToGrokSessionDir(cwd) {
  const encoded = cwd.split("/").map(encodeURIComponent).join("%2F");
  return pathResolve(homedir3(), ".grok", "sessions", encoded);
}
function parseGrokUpdatesToPrimitives(updatesPath, sessionId, cwd) {
  if (!existsSync5(updatesPath))
    return null;
  const lines = readFileSync2(updatesPath, "utf8").trim().split(`
`).filter(Boolean);
  const toolCalls = [];
  const userMessages = [];
  let idx = 0;
  for (const line of lines) {
    const j = safeJsonParse(line);
    if (!j)
      continue;
    const u = j.params?.update || {};
    const su = u.sessionUpdate;
    if (su === "user_message_chunk" && u.content?.text) {
      userMessages.push(u.content.text);
    }
    if ((su === "tool_call" || su === "tool_call_update") && u.title) {
      toolCalls.push({
        name: u.title,
        input: u.input || u.args || { title: u.title },
        timestamp: new Date((j.timestamp || 0) * 1000).toISOString(),
        index: idx++
      });
    }
  }
  const toolCallCounts = {};
  for (const t of toolCalls) {
    toolCallCounts[t.name] = (toolCallCounts[t.name] || 0) + 1;
  }
  return {
    sessionId,
    sessionTitle: `Grok session`,
    model: "grok",
    agent: "grok",
    cwd,
    toolCalls,
    toolCallCounts,
    skillsInvoked: [],
    userMessages: userMessages.slice(0, 5),
    userTurnCount: userMessages.length
  };
}
async function runSkillSessions(skillDir, opts) {
  const skill = await loadSkill(skillDir);
  if (!skill.ok) {
    throw new Error(`Failed to load skill: ${skill.error}`);
  }
  const skillContent = skill.model.content;
  const skillName = skill.model.data.name || skillDir.split("/").pop() || "unknown-skill";
  const config = await readConfig();
  const agentCfg = config?.agent;
  if (!agentCfg?.command) {
    throw new Error("No coding agent configured. Run: doraval init");
  }
  const evalCfg = getEvalConfig(config);
  let prompts = [];
  if (opts.prompts && opts.prompts.length > 0) {
    const supplied = opts.prompts;
    for (let k = 0;k < opts.runs; k++) {
      prompts.push(supplied[k % supplied.length]);
    }
  } else if (opts.generate) {
    ui.write(`  Generating prompt variations using the agent...`);
    prompts = await randomPromptsForSkill(skillContent, opts.runs, agentCfg);
  } else {
    prompts = [
      "Perform the main task described by the skill on the current project.",
      "Use the skill to analyze and improve the current directory."
    ];
    if (prompts.length < opts.runs) {
      ui.write(`  Generating additional prompt variations...`);
      const more = await randomPromptsForSkill(skillContent, opts.runs - prompts.length, agentCfg);
      prompts = prompts.concat(more);
    }
    prompts = prompts.slice(0, opts.runs);
  }
  prompts = prompts.map((p) => String(p).trim()).filter((p) => p.length > 10 && !p.includes('"type":"result"') && !p.includes("session_id") && !p.startsWith("{"));
  const batchId = `run-${Date.now()}-${skillName.replace(/[^a-z0-9]/gi, "-")}`;
  const results = [];
  const isGrok = /grok/i.test(agentCfg.command || "");
  for (let i = 0;i < prompts.length; i++) {
    const taskPrompt = prompts[i];
    const fullPrompt = buildSkillPrompt(skillContent, taskPrompt, skillName);
    const useIsolated = !!opts.cwd || isGrok || !!agentCfg.cwd_flag;
    const runCwd = opts.cwd ? `${opts.cwd}/run-${i}` : useIsolated ? `/tmp/doraval-skill-run/${batchId}/run-${i}` : process.cwd();
    if (useIsolated) {
      try {
        mkdirSync2(runCwd, { recursive: true });
        await Bun.write(`${runCwd}/.gitkeep`, "");
      } catch {}
    }
    const trace = await runAgentSession(fullPrompt, agentCfg, {
      cwd: runCwd,
      alwaysApprove: true,
      stream: Boolean(opts.verbose)
    });
    let primitives = null;
    if (isGrok) {
      const grokBase = cwdToGrokSessionDir(runCwd);
      try {
        if (existsSync5(grokBase)) {
          const subs = readdirSync2(grokBase).filter((d) => d && !d.startsWith("."));
          if (subs.length) {
            subs.sort().reverse();
            const updatesPath = pathResolve(grokBase, subs[0], "updates.jsonl");
            const real = parseGrokUpdatesToPrimitives(updatesPath, `${batchId}-${i}`, runCwd);
            if (real && real.toolCalls && real.toolCalls.length > 0) {
              const augmentedCalls = [
                {
                  name: "Skill",
                  input: { skill: skillName, args: taskPrompt },
                  timestamp: real.toolCalls[0]?.timestamp || new Date().toISOString(),
                  index: -1
                },
                ...real.toolCalls
              ];
              primitives = {
                ...real,
                toolCalls: augmentedCalls,
                sessionId: `${batchId}-${i}`,
                sessionTitle: taskPrompt,
                skillsInvoked: [skillName]
              };
            }
          }
        }
      } catch {}
    }
    if (!primitives) {
      primitives = {
        sessionId: `${batchId}-${i}`,
        sessionTitle: `Run ${i + 1} for ${skillName}`,
        model: "run-driver",
        agent: isGrok ? "grok" : "agent",
        cwd: runCwd,
        toolCalls: [
          {
            name: "Skill",
            input: { skill: skillName, args: taskPrompt },
            timestamp: new Date().toISOString(),
            index: 0
          },
          {
            name: "AgentResponse",
            input: { output: trace.slice(0, 2000) },
            timestamp: new Date().toISOString(),
            index: 1
          }
        ],
        toolCallCounts: { Skill: 1, AgentResponse: 1 },
        skillsInvoked: [skillName],
        userMessages: [taskPrompt],
        userTurnCount: 1,
        durationMs: 0
      };
    }
    const evalResult = await runEval(primitives, skillName, skillContent, agentCfg, evalCfg);
    results.push({
      prompt: taskPrompt,
      trace,
      eval: evalResult
    });
  }
  const summary = {
    total: results.length,
    adheres: results.filter((r) => r.eval.verdict === "PASS").length,
    drifts: results.filter((r) => r.eval.verdict === "FAIL").length,
    unknown: results.filter((r) => r.eval.verdict === "UNKNOWN").length
  };
  try {
    ensureDoravalDirs();
    const evalsDir = getEvalsDir();
    for (const r of results) {
      const fname = `${r.eval.sessionId}.json`;
      await Bun.write(join3(evalsDir, fname), JSON.stringify({ ...r.eval, _batchId: batchId, _prompt: r.prompt }, null, 2));
    }
  } catch {}
  return {
    batchId,
    skill: skillName,
    runs: results,
    summary
  };
}
function buildSkillPrompt(skillContent, task, skillName) {
  return `You are a careful coding agent. You MUST follow the instructions in this skill as closely as possible.

SKILL: ${skillName}

${skillContent}

TASK:
${task}

Instructions:
- Strictly adhere to the skill's rules, steps, and style.
- If the skill tells you to use certain tools, formats, or produce specific outputs, do so.
- At the end, briefly summarize the key actions you took in service of the skill.
- Work in the current working directory. Do not escape the provided context.
`;
}
function displayVerdict(verdict, useDriftTerms = false) {
  if (!useDriftTerms)
    return verdict;
  if (verdict === "PASS")
    return "ADHERES";
  if (verdict === "FAIL")
    return "DRIFTS";
  return "UNKNOWN";
}
function renderBatchResults(result, verbose = false) {
  const lines = [];
  lines.push(`
Batch ${result.batchId} for skill: ${result.skill}`);
  lines.push(`Summary: ${result.summary.adheres} ADHERES / ${result.summary.drifts} DRIFTS / ${result.summary.unknown} UNKNOWN (${result.summary.total} runs)
`);
  result.runs.forEach((r, i) => {
    const v = r.eval.verdict;
    const displayV = displayVerdict(v, true);
    const color = v === "PASS" ? "\x1B[32m" : v === "FAIL" ? "\x1B[31m" : "\x1B[33m";
    const reset = "\x1B[0m";
    lines.push(`${i + 1}. ${color}[${displayV}]${reset} ${r.prompt.slice(0, 80)}${r.prompt.length > 80 ? "..." : ""}`);
    if (r.eval.checklist?.length) {
      const passed = r.eval.checklist.filter((c) => c.pass).length;
      lines.push(`   Score: ${passed}/${r.eval.checklist.length}`);
      if (verbose) {
        r.eval.checklist.forEach((c) => {
          lines.push(`     ${c.pass ? "\u2713" : "\u2717"} ${c.instruction}`);
        });
      }
    }
  });
  return lines.join(`
`);
}
var init_skill_runner = __esm(() => {
  init_skill_validate();
  init_agent_invoke();
  init_session_eval();
  init_journal_config();
  init_prompt_gen();
  init_out();
});

// src/cli/commands/eval-history.ts
var exports_eval_history = {};
__export(exports_eval_history, {
  default: () => eval_history_default
});
import { existsSync as existsSync6, readdirSync as readdirSync3 } from "fs";
import { join as join4 } from "path";
var import_picocolors4, eval_history_default;
var init_eval_history = __esm(() => {
  init_dist();
  init_out();
  init_journal_config();
  import_picocolors4 = __toESM(require_picocolors(), 1);
  eval_history_default = defineCommand({
    meta: {
      name: "history",
      description: "List stored eval results"
    },
    args: {
      limit: {
        type: "string",
        description: "Maximum number of results to show (default: 20)",
        default: "20"
      },
      skill: {
        type: "string",
        description: "Filter by skill name"
      },
      format: {
        type: "string",
        alias: "f",
        description: "Output format: table (default) or json",
        default: "table"
      }
    },
    async run({ args }) {
      const evalsDir = getEvalsDir();
      if (!existsSync6(evalsDir)) {
        guidedError({
          context: "dora eval history shows past judgments. It is populated after you run dora eval (or --runs).",
          problem: "No eval history yet",
          solutions: [
            "dora eval",
            "dora eval --runs 3 --skill ./skills/example"
          ],
          next: "dora eval"
        });
        process.exit(0);
      }
      const files = readdirSync3(evalsDir).filter((f) => f.endsWith(".json")).sort().reverse();
      const limit2 = parseInt(String(args.limit), 10) || 20;
      const results = [];
      for (const file of files) {
        if (results.length >= limit2)
          break;
        try {
          const raw = await Bun.file(join4(evalsDir, file)).text();
          const parsed = JSON.parse(raw);
          if (parsed.schemaVersion !== 1)
            continue;
          if (args.skill && !parsed.skill.includes(args.skill))
            continue;
          results.push(parsed);
        } catch {}
      }
      if (results.length === 0) {
        ui.info("No eval results found.");
        process.exit(0);
      }
      if (args.format === "json") {
        process.stdout.write(JSON.stringify(results, null, 2) + `
`);
      } else {
        ui.heading("doraval eval history");
        ui.write(`  ${"DATE".padEnd(20)} ${"SESSION TITLE".padEnd(35)} ${"SKILL".padEnd(35)} RESULT`);
        ui.write(`  ${"-".repeat(100)}`);
        for (const r of results) {
          const date = r.timestamp.slice(0, 10);
          const title = (r.sessionTitle ?? r.sessionId.slice(0, 8)).slice(0, 33).padEnd(35);
          const skill = r.skill.slice(0, 33).padEnd(35);
          const verdictColor = r.verdict === "PASS" ? import_picocolors4.default.green : r.verdict === "FAIL" ? import_picocolors4.default.red : import_picocolors4.default.yellow;
          ui.write(`  ${date.padEnd(20)} ${title} ${skill} ${verdictColor(r.verdict)}`);
        }
        ui.blank();
      }
      process.exit(0);
    }
  });
});

// src/cli/commands/eval.ts
var exports_eval = {};
__export(exports_eval, {
  default: () => eval_default
});
import { join as join5, basename, resolve as resolve4, dirname } from "path";
import { existsSync as existsSync7, readFileSync as readFileSync3 } from "fs";
function renderResult(result, verbose, useDriftTerms = false) {
  const v = result.verdict;
  const isPass = v === "PASS";
  const isFail = v === "FAIL";
  const displayV = displayVerdict(v, useDriftTerms);
  const displaySymbol = isPass ? "\u2713" : isFail ? "\u2717" : "?";
  const verdictColor = isPass ? import_picocolors5.default.green : isFail ? import_picocolors5.default.red : import_picocolors5.default.yellow;
  ui.write(`
  ${verdictColor(`[${displayV}]`)} ${import_picocolors5.default.bold(result.skill)}`);
  ui.write(`  agent:       ${result.agent}`);
  ui.write(`  model:       ${result.model}`);
  if (result.userFamiliarity > 0) {
    ui.write(`  familiarity: ${result.userFamiliarity}/10  (${result.userFamiliarityReason})`);
  }
  ui.write(`  closure:     ${result.closure}${result.userTurnsAfterSkill > 0 ? ` (${result.userTurnsAfterSkill} turns)` : ""}`);
  if (result.sessionTitle) {
    ui.write(`  session:     ${result.sessionId.slice(0, 8)}  "${result.sessionTitle}"`);
  }
  if (result.checklist.length > 0) {
    ui.write(`
  Adherence:`);
    for (const item of result.checklist) {
      const sym = item.pass ? import_picocolors5.default.green("\u2713") : import_picocolors5.default.red("\u2717");
      const detail = item.detail ? `  ${import_picocolors5.default.dim(item.detail)}` : "";
      ui.write(`  ${sym} ${item.instruction}${detail}`);
    }
    const passed = result.checklist.filter((c) => c.pass).length;
    ui.write(`
  Result: ${passed}/${result.checklist.length}  [${verdictColor(displayV)}${result.verdictReason ? ` \u2014 ${result.verdictReason}` : ""}]`);
  } else if (result.verdictReason) {
    ui.write(`
  ${verdictColor(displaySymbol)} ${result.verdictReason}`);
  }
}
function selectRecentSessions(recent) {
  if (recent.length === 0)
    return [];
  if (recent.length === 1)
    return [recent[0].path];
  ui.write(`
  Recent sessions for this directory:`);
  recent.forEach((s, i) => {
    const date = new Date(s.mtime).toISOString().slice(0, 10);
    const titleStr = s.title ? ` "${s.title.slice(0, 45)}"` : "";
    const skillStr = s.skillCount > 0 ? ` (${s.skillCount} skill${s.skillCount === 1 ? "" : "s"})` : "";
    const short = basename(s.path);
    ui.write(`    ${i + 1}. ${date}${titleStr}${skillStr}  ${import_picocolors5.default.dim(short)}`);
  });
  const input = prompt(`
  Select session(s) (e.g. 1,3 or 2-4 or all or latest): `, "1").trim().toLowerCase();
  if (input === "all")
    return recent.map((s) => s.path);
  if (input === "latest")
    return [recent[0].path];
  if (input.includes("/") || input.endsWith(".jsonl"))
    return [input];
  const selected = new Set;
  const parts = input.split(/[\s,]+/);
  for (const part of parts) {
    if (part.includes("-")) {
      const nums = part.split("-").map((n) => parseInt(n, 10)).filter((n) => !isNaN(n));
      const start = nums[0] ?? 0;
      const end = nums[1] ?? start;
      for (let n = start;n <= end; n++) {
        const item = recent[n - 1];
        if (item)
          selected.add(item.path);
      }
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n)) {
        const item = recent[n - 1];
        if (item)
          selected.add(item.path);
      }
    }
  }
  return selected.size > 0 ? Array.from(selected) : [recent[0].path];
}
var import_picocolors5, eval_default;
var init_eval = __esm(() => {
  init_dist();
  init_out();
  init_session_adapters();
  init_session_eval();
  init_journal_config();
  init_llm_judge();
  init_skill_validate();
  init_prompt();
  init_skill_runner();
  import_picocolors5 = __toESM(require_picocolors(), 1);
  eval_default = defineCommand({
    meta: {
      name: "eval",
      description: "Evaluate sessions against skill instructions (or generate runs with --runs --skill)"
    },
    subCommands: {
      history: () => Promise.resolve().then(() => (init_eval_history(), exports_eval_history)).then((m) => m.default)
    },
    args: {
      session: {
        type: "string",
        description: "Path to .jsonl session file(s). Supports comma/space separated values, or omit to interactively select from recent sessions."
      },
      skill: {
        type: "string",
        description: "Path to a skill directory to filter to (default: all skills in session)"
      },
      format: {
        type: "string",
        alias: "f",
        description: "Output format: table (default) or json",
        default: "table"
      },
      ci: {
        type: "boolean",
        description: "Exit with code 1 if any verdict is FAIL (DRIFTS for generated runs)",
        default: false
      },
      verbose: {
        type: "boolean",
        alias: "v",
        description: "Show full checklist reasoning",
        default: false
      },
      runs: {
        type: "string",
        description: "Generate and run N sessions for the skill (using prompts) then eval comparatively. Requires --skill. Use --workdir to control the base directory for the runs.",
        default: "0"
      },
      prompt: {
        type: "string",
        description: "Single prompt to use for generated sessions. For multiple distinct prompts use --prompts-file."
      },
      "prompts-file": {
        type: "string",
        description: "File containing prompts (one per line) for generated sessions"
      },
      generate: {
        type: "boolean",
        description: "Auto-generate prompts from the skill (when using --runs)",
        default: false
      },
      real: {
        type: "boolean",
        description: "Force real agent CLI for generated sessions (vs faster internal)",
        default: false
      },
      workdir: {
        type: "string",
        description: "Base directory for generated test runs (--runs). Each run gets its own subdirectory. Use this to point the agent at a populated checkout/repo instead of an empty temp dir."
      }
    },
    async run({ args }) {
      const config = await readConfig();
      const evalCfg = getEvalConfig(config);
      const agentCfg = config?.agent;
      if (!agentCfg) {
        guidedError({
          context: "doraval eval judges real agent sessions (or generates runs) and needs to know which coding agent CLI to use or proxy through.",
          problem: "No coding agent configured in ~/.doraval/config.yml",
          solutions: [
            "dora init                 (recommended \u2014 sets up agent + eval.model)",
            "dora eval --session <path>  (bypass discovery; use an explicit transcript)"
          ],
          next: "dora init"
        });
        process.exit(2);
      }
      if (!evalCfg.model) {
        ui.warn("No eval.model configured \u2014 falling back to your agent CLI for the judge LLM.");
        ui.info("  This works, but direct API (with OPENAI_API_KEY or ZAI_API_KEY + eval.model) is usually faster/cheaper.");
        nextAction2("dora config set eval.model gpt-4o-mini   (or glm-4, claude-3-5-sonnet-20241022, ...)");
      }
      const numRuns = parseInt(String(args.runs || "0"), 10) || 0;
      if (numRuns > 0) {
        if (!args.skill) {
          guidedError({
            context: "--runs generates new sessions using a skill then evaluates them.",
            problem: "--runs requires --skill",
            solutions: [
              "dora eval --runs 3 --skill ./skills/my-skill"
            ],
            next: "dora eval --runs 3 --skill ./path/to/skill"
          });
          process.exit(1);
        }
        let skillInput = String(args.skill);
        if (skillInput.endsWith("SKILL.md") || skillInput.endsWith("/SKILL.md")) {
          skillInput = dirname(skillInput);
        }
        const skillPath = resolve4(skillInput);
        let prompts;
        if (args.prompt) {
          prompts = [String(args.prompt).trim()].filter(Boolean);
        } else if (args["prompts-file"]) {
          try {
            const content = await Bun.file(String(args["prompts-file"])).text();
            prompts = content.split(`
`).map((l) => l.trim()).filter(Boolean);
          } catch (e) {
            ui.fail(`Failed to read prompts file: ${e.message}`);
            process.exit(1);
          }
        }
        ui.heading("doraval eval \u2014 Generated session runs + comparative results");
        const workdirNote = args.workdir ? ` workdir=${args.workdir}` : "";
        const driveCmd = agentCfg?.command || "default";
        ui.write(`  Running ${numRuns} sessions (generate=${Boolean(args.generate)}, real=${Boolean(args.real)}${workdirNote}, command=${driveCmd})... This can take a while for complex skills.`);
        const result = await runSkillSessions(skillPath, {
          runs: numRuns,
          prompts,
          generate: Boolean(args.generate),
          real: Boolean(args.real),
          verbose: Boolean(args.verbose),
          cwd: args.workdir ? resolve4(String(args.workdir)) : undefined
        });
        if (args.format === "json") {
          process.stdout.write(JSON.stringify(result, null, 2) + `
`);
        } else {
          ui.heading("doraval eval \u2014 Generated session runs + comparative results");
          for (let i = 0;i < result.runs.length; i++) {
            const r = result.runs[i];
            renderResult(r.eval, Boolean(args.verbose), true);
          }
          ui.blank();
          const table = renderBatchResults(result, Boolean(args.verbose));
          ui.write(table);
        }
        if (args.ci && result.summary.drifts > 0) {
          process.exit(1);
        }
        process.exit(0);
      }
      ui.heading("doraval eval \u2014 Session skill adherence");
      let sessionPaths = [];
      let discoveryAdapter = null;
      if (args.session) {
        sessionPaths = String(args.session).split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
      } else {
        discoveryAdapter = getAdapter();
        if (!discoveryAdapter) {
          guidedError({
            context: "Without --session, dora eval discovers recent sessions with skills from your local coding agent history (~/.claude or ~/.grok).",
            problem: "No supported coding agent with history detected for this directory",
            solutions: [
              "dora eval --session <path-to-.jsonl>   (explicit transcript, works without local agent)",
              "Install/use Claude Code (or Grok) and run a session that invokes a skill"
            ],
            next: "dora eval --session ~/.claude/projects/.../latest.jsonl"
          });
          process.exit(2);
        }
        let recent = discoveryAdapter.listRecentSessions(process.cwd(), 12);
        const withSkills = recent.filter((s) => s.skillCount > 0);
        if (withSkills.length > 0)
          recent = withSkills;
        if (recent.length === 0) {
          guidedError({
            context: `dora eval looks for recent .jsonl sessions (with skill invocations) under your agent's history for ${process.cwd()}.`,
            problem: "No sessions with skills found",
            solutions: [
              "Run a session that uses a skill, then retry",
              "dora eval --session <path-to-.jsonl>"
            ],
            next: "dora eval --session <path>"
          });
          process.exit(2);
        }
        if (recent.length === 1) {
          sessionPaths = [recent[0].path];
        } else if (!process.stdout.isTTY || !process.stdin.isTTY) {
          sessionPaths = [recent[0].path];
        } else {
          sessionPaths = selectRecentSessions(recent);
        }
      }
      if (sessionPaths.length === 0) {
        guidedError({
          context: "Session selection (interactive or via args) produced no paths.",
          problem: "No sessions selected",
          solutions: [
            "Provide --session <path>",
            "Run interactively and choose from the list"
          ],
          next: "dora eval --session <path>"
        });
        process.exit(2);
      }
      const allResults = [];
      for (const sessionPath of sessionPaths) {
        ui.info(`  Session: ${import_picocolors5.default.dim(sessionPath)}`);
        let primitives;
        try {
          if (discoveryAdapter) {
            primitives = discoveryAdapter.parse(sessionPath);
          } else {
            const text = readFileSync3(sessionPath, "utf8");
            primitives = parseSession(text);
          }
        } catch (err) {
          guidedError({
            context: `Could not load the session transcript at ${sessionPath}.`,
            problem: "Failed to read or parse session",
            solutions: [
              "Check the path and that it is a valid .jsonl from your agent",
              "Use a different --session"
            ]
          });
          if (err?.message)
            ui.dim(`  ${err.message}`);
          continue;
        }
        if (primitives.skillsInvoked.length === 0) {
          ui.warn("  No skills were invoked in this session. (eval only makes sense for sessions that used skills)");
          continue;
        }
        let skillsToEval = primitives.skillsInvoked;
        if (args.skill) {
          skillsToEval = skillsToEval.filter((s) => s.includes(args.skill));
          if (skillsToEval.length === 0) {
            guidedError({
              context: `Filtering the skills invoked in the session to only those matching "${args.skill}".`,
              problem: "No matching skills found for filter",
              solutions: [
                "Omit --skill to eval all skills in the session",
                "Use a skill name that appears in the session"
              ]
            });
            continue;
          }
        }
        const judgeVia = canUseApiJudge(evalCfg) && evalCfg.model ? "direct (no proxy)" : "your agent CLI";
        ui.write(`  ${import_picocolors5.default.dim("\xB7 Sending session summary (tool calls + 5 user messages) to")} ${import_picocolors5.default.dim(evalCfg.model || "configured model")} ${import_picocolors5.default.dim(`(${judgeVia})`)}${import_picocolors5.default.dim(". Use --verbose to inspect.")}`);
        ensureDoravalDirs();
        for (const skillName of skillsToEval) {
          ui.info(`
  Evaluating: ${import_picocolors5.default.bold(skillName)}`);
          let skillContent = `Skill: ${skillName}
(skill content not found locally \u2014 using skill name only for evaluation)`;
          const candidateDirs = [
            process.cwd(),
            join5(process.cwd(), ".claude", "skills", skillName.split(":").pop() ?? skillName),
            join5(process.cwd(), "skills", skillName.split(":").pop() ?? skillName)
          ];
          for (const dir of candidateDirs) {
            if (existsSync7(join5(dir, "SKILL.md"))) {
              const loaded = await loadSkill(dir);
              if (loaded.ok) {
                skillContent = loaded.model.content;
                break;
              }
            }
          }
          const result = await runEval(primitives, skillName, skillContent, agentCfg, evalCfg);
          allResults.push(result);
          if (evalCfg.save_history) {
            const safeId = sanitizeSessionId(primitives.sessionId) || `unknown-${Date.now()}`;
            const evalPath = join5(getEvalsDir(), `${safeId}-${Date.now()}.json`);
            await Bun.write(evalPath, JSON.stringify(result, null, 2));
          }
        }
      }
      if (args.format === "json") {
        process.stdout.write(JSON.stringify(allResults, null, 2) + `
`);
      } else {
        for (const result of allResults) {
          renderResult(result, Boolean(args.verbose));
        }
        ui.blank();
      }
      if (args.ci && allResults.some((r) => r.verdict === "FAIL")) {
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
  judge_default = defineCommand({
    meta: {
      name: "judge",
      description: "Evaluate the latest session for a skill (alias for eval --skill)"
    },
    args: {
      path: {
        type: "positional",
        description: "Path to skill directory or skill name",
        required: true
      },
      format: {
        type: "string",
        alias: "f",
        description: "Output format (json or table)",
        default: "table"
      },
      ci: {
        type: "boolean",
        description: "Exit non-zero if FAIL",
        default: false
      },
      verbose: {
        type: "boolean",
        alias: "v",
        description: "Show full checklist",
        default: false
      }
    },
    async run({ args }) {
      const evalCmd = await Promise.resolve().then(() => (init_eval(), exports_eval)).then((m) => m.default);
      const newArgs = {
        ...args,
        skill: args.path,
        session: undefined
      };
      return evalCmd.run?.({ args: newArgs });
    }
  });
});

// src/core/journal-remote.ts
var {spawnSync: spawnSync2 } = globalThis.Bun;
function tryGh(args) {
  try {
    const result = spawnSync2(["gh", ...args], { stdout: "pipe", stderr: "pipe" });
    return { ok: true, result };
  } catch {
    return { ok: false };
  }
}
function tryGit(args) {
  try {
    const result = spawnSync2(["git", ...args], { stdout: "pipe", stderr: "pipe" });
    return { ok: true, result };
  } catch {
    return { ok: false };
  }
}
function hasGhCli() {
  const r = tryGh(["--version"]);
  return r.ok && r.result.exitCode === 0;
}
function ensureGhCli() {
  if (hasGhCli())
    return { ok: true, value: true };
  return { ok: false, error: "GH_CLI_MISSING" };
}
function fetchRemoteJournalFile(repo, path2) {
  const r = tryGh(["api", `repos/${repo}/contents/${path2}`, "--jq", "{sha, content, encoding}"]);
  if (!r.ok) {
    return { ok: false, error: "The GitHub CLI (gh) is not installed. Run `gh --version` to verify." };
  }
  const result = r.result;
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
    return { ok: false, error: `Unexpected response when fetching ${path2} from ${repo}` };
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
function getRemoteJournalFileMeta(repo, path2) {
  const r = tryGh(["api", `repos/${repo}/contents/${path2}`, "--jq", "{sha, content, encoding}"]);
  if (!r.ok) {
    return { ok: false, error: "The GitHub CLI (gh) is not installed. Run `gh --version` to verify." };
  }
  const result = r.result;
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
    return { ok: false, error: `Unexpected response when fetching ${path2} from ${repo}` };
  }
}
function getGitRemoteOwner() {
  const r = tryGit(["config", "--get", "remote.origin.url"]);
  if (!r.ok)
    return null;
  const result = r.result;
  if (result.exitCode !== 0)
    return null;
  const url = result.stdout.toString().trim();
  if (!url)
    return null;
  const match = url.match(/[:/]([^/]+)\/([^/.]+)(\.git)?$/);
  return match ? match[1] : null;
}
function ghUser() {
  const r = tryGh(["api", "user", "--jq", ".login"]);
  if (!r.ok)
    return null;
  const result = r.result;
  if (result.exitCode !== 0)
    return null;
  return result.stdout.toString().trim() || null;
}
function repoExists(repo) {
  const r = tryGh(["api", `repos/${repo}`, "--jq", ".full_name"]);
  if (!r.ok)
    return false;
  const result = r.result;
  return result.exitCode === 0 && result.stdout.toString().trim().length > 0;
}
var init_journal_remote = () => {};

// src/cli/commands/journal/init.ts
var exports_init = {};
__export(exports_init, {
  default: () => init_default
});
import { basename as basename2, join as join6 } from "path";
var import_picocolors6, init_default;
var init_init = __esm(() => {
  init_dist();
  init_out();
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
      ui.write(`
  ${import_picocolors6.default.bold(import_picocolors6.default.white("dora journal init"))} (or top-level ${import_picocolors6.default.dim(import_picocolors6.default.gray("dora init"))}) \u2014 Set up your journal
`);
      const ghCheck = ensureGhCli();
      if (!ghCheck.ok) {
        ui.write(`  ${import_picocolors6.default.red("\u2717")} ${import_picocolors6.default.white("The GitHub CLI (")}${import_picocolors6.default.bold("gh")}${import_picocolors6.default.white(") is not installed.")}
`);
        ui.write(`  doraval uses ${import_picocolors6.default.bold("gh")} to fetch and sync journal files with GitHub.
`);
        ui.write(`  Install it:
`);
        ui.write(`    macOS:   ${import_picocolors6.default.dim("brew install gh")}`);
        ui.write(`    Linux:   ${import_picocolors6.default.dim("https://github.com/cli/cli/blob/trunk/docs/install_linux.md")}`);
        ui.write(`    Windows: ${import_picocolors6.default.dim("winget install --id GitHub.cli")}
`);
        ui.write(`  Then authenticate: ${import_picocolors6.default.dim("gh auth login")}
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
          ui.write(`  ${import_picocolors6.default.yellow("\u26A0")} Not logged in to GitHub. Run ${import_picocolors6.default.dim("gh auth login")} first.
`);
          process.exit(1);
        }
        const existingConfig = await readConfig();
        if (existingConfig?.journal.repo) {
          defaultRepo = existingConfig.journal.repo;
          sourceNote = `  ${import_picocolors6.default.dim("(from your previous journal setup)")}
`;
        }
        ui.write(`  Journal repo ${import_picocolors6.default.dim(import_picocolors6.default.gray("(owner/name)"))}`);
        if (sourceNote)
          ui.write(sourceNote);
        repo = prompt("  >", defaultRepo);
      }
      let project = args.project || process.env.DORAVAL_PROJECT;
      if (!project) {
        const defaultProject = basename2(process.cwd());
        project = prompt("  Project name", defaultProject);
      }
      project = sanitizeProjectName(project);
      if (!repoExists(repo)) {
        ui.write(`  ${import_picocolors6.default.red("\u2717")} Repository ${import_picocolors6.default.bold(import_picocolors6.default.white(repo))} not found on GitHub.
`);
        ui.write(`  Create it first:
`);
        ui.write(`    ${import_picocolors6.default.dim(`gh repo create ${repo} --private --description "Personal journal for agent decisions"`)}
`);
        ui.write(`  The repo should be private. doraval will populate it on first ${import_picocolors6.default.dim("dora journal sync")}.
`);
        process.exit(1);
      }
      const existing = await readConfig();
      const alreadyRegistered = existing?.journal.projects[project];
      const isRefresh = alreadyRegistered && args.refresh;
      if (alreadyRegistered && !isRefresh) {
        ui.write(`  ${import_picocolors6.default.yellow("\u26A0")} Project ${import_picocolors6.default.bold(import_picocolors6.default.white(project))} is already registered.
`);
        ui.write(`  Repo:   ${import_picocolors6.default.gray(existing.journal.repo)}`);
        ui.write(`  Remote: ${existing.journal.projects[project]?.remote_path}
`);
        ui.write(`  To refresh local files, run: ${import_picocolors6.default.dim(import_picocolors6.default.gray(`dora journal update`))}
` + `  (init --refresh still works for compatibility.)
` + `  Or remove the project from ${import_picocolors6.default.dim(import_picocolors6.default.gray("~/.doraval/config.yml"))} to fully re-initialize.
`);
        process.exit(0);
      }
      const journalsDir = getJournalsDir();
      const remotePath = `projects/${project}.md`;
      const localPath = join6(journalsDir, `${project}.md`);
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
      ui.write(`  ${import_picocolors6.default.dim(import_picocolors6.default.gray(`${actionLabel} journal files from`))} ${import_picocolors6.default.gray(effectiveRepo)}${import_picocolors6.default.dim(import_picocolors6.default.gray("..."))}
`);
      const globalDest = join6(journalsDir, "global.md");
      const refreshGlobalRes = await refreshLocalJournalFile(effectiveRepo, "global.md", globalDest);
      let wroteGlobal;
      if (!refreshGlobalRes.ok) {
        if (refreshGlobalRes.isNotFound) {
          wroteGlobal = false;
        } else {
          ui.write(`  ${import_picocolors6.default.red("\u2717")} Failed to fetch global.md from ${effectiveRepo}:`);
          ui.write(refreshGlobalRes.error);
          process.exit(1);
        }
      } else {
        wroteGlobal = refreshGlobalRes.value;
      }
      if (wroteGlobal) {
        ui.write(`  ${import_picocolors6.default.green("\u2713")} global.md`);
      } else {
        ui.write(`  ${import_picocolors6.default.dim("\xB7")} global.md ${import_picocolors6.default.dim("(not found \u2014 will be created on first sync)")}`);
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
          ui.write(`  ${import_picocolors6.default.red("\u2717")} Failed to fetch ${remotePath} from ${effectiveRepo}:`);
          ui.write(refreshProjectRes.error);
          process.exit(1);
        }
      } else {
        wroteProject = refreshProjectRes.value;
      }
      if (wroteProject) {
        ui.write(`  ${import_picocolors6.default.green("\u2713")} ${remotePath}`);
      } else {
        ui.write(`  ${import_picocolors6.default.dim("\xB7")} ${remotePath} ${import_picocolors6.default.dim("(not found \u2014 will be created on first sync)")}`);
        await Bun.write(localPath, `# ${project} Journal

Project-specific decisions.
`);
      }
      await writeConfig(config);
      ui.write(`
  ${import_picocolors6.default.green("\u2713")} Project ${import_picocolors6.default.bold(import_picocolors6.default.white(project))} registered to ${import_picocolors6.default.bold(import_picocolors6.default.white(repo))}.
`);
      ui.write(`  Config:   ${import_picocolors6.default.dim(import_picocolors6.default.gray("~/.doraval/config.yml"))}`);
      ui.write(`  Journals: ${import_picocolors6.default.dim(import_picocolors6.default.gray("~/.doraval/journals/"))}`);
      ui.write(`  Pending:  ${import_picocolors6.default.dim(import_picocolors6.default.gray("~/.doraval/pending/"))}
`);
      ui.write(`  Use ${import_picocolors6.default.dim(import_picocolors6.default.gray("dora journal add"))} to propose decisions and ${import_picocolors6.default.dim(import_picocolors6.default.gray("dora journal list"))} to view them.
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
import { existsSync as existsSync8, readdirSync as readdirSync4 } from "fs";
import { join as join7 } from "path";
var import_picocolors7, list_default;
var init_list = __esm(() => {
  init_dist();
  init_out();
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
        ui.write(`${import_picocolors7.default.yellow("\u26A0")} ${import_picocolors7.default.yellow("No project mapping found.")}

` + `Run ${import_picocolors7.default.dim(import_picocolors7.default.gray("dora init"))} (or ${import_picocolors7.default.dim(import_picocolors7.default.gray("doraval journal init"))}) first, or pass ${import_picocolors7.default.dim(import_picocolors7.default.gray("--project <name>"))}.`);
        process.exit(1);
      }
      const journalRepo = config?.journal.repo ?? "(unknown)";
      const journalsDir = getJournalsDir();
      const projectFile = join7(journalsDir, `${project}.md`);
      const globalFile = join7(journalsDir, "global.md");
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
      let staged = [];
      try {
        const pdir = getPendingProjectDir(project);
        if (existsSync8(pdir)) {
          const files = readdirSync4(pdir).filter((f) => f.endsWith(".md") && f !== ".gitkeep");
          const stagedResults = await Promise.all(files.map(async (f) => {
            const txt = await Bun.file(join7(pdir, f)).text();
            const parsed = parseJournalEntries(txt);
            return parsed.map((e) => ({ ...e, _staged: true }));
          }));
          staged = stagedResults.flat();
        }
      } catch {}
      if (args.format === "json") {
        console.log(JSON.stringify({ project, entries: [...staged, ...allEntries] }, null, 2));
        return;
      }
      ui.write(`
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
        ui.write(`  ${import_picocolors7.default.yellow("\u26A0")} ${import_picocolors7.default.yellow("Duplicate titles in this view (clean in your journal repo + update):")} ${uniqueDups.map((t) => import_picocolors7.default.yellow(`"${t}"`)).join(", ")}
`);
      }
      if (!hasStaged && !hasCommitted) {
        ui.write(`  ${import_picocolors7.default.dim(import_picocolors7.default.gray("No active entries found for"))} ${import_picocolors7.default.bold(import_picocolors7.default.white(project))}.
`);
        ui.write(`  Journal repo: ${import_picocolors7.default.dim(import_picocolors7.default.gray(journalRepo))}`);
        ui.write(`  Local file:   ${import_picocolors7.default.dim(import_picocolors7.default.gray(projectFile))}
`);
        ui.write(`  ${import_picocolors7.default.dim(import_picocolors7.default.gray("This is normal for a freshly initialized project."))}
` + `  Use ${import_picocolors7.default.dim(import_picocolors7.default.gray("dora journal add"))} to propose decisions.
` + `  They will be staged locally until you run ${import_picocolors7.default.dim(import_picocolors7.default.gray("dora journal sync"))}.
`);
        ui.write(`  If you expect content, try: ${import_picocolors7.default.dim(import_picocolors7.default.gray(`dora journal update`))}
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
        ui.write(`  ${pbColor(String(pb).padStart(2))}  ${import_picocolors7.default.bold(import_picocolors7.default.white(entry.title))}${statusNote}${stagedNote}`);
        ui.write(`      ${import_picocolors7.default.dim(import_picocolors7.default.gray("tags:"))} ${import_picocolors7.default.gray(tagsStr)}`);
        const by = entry.author?.startsWith("agent:") ? import_picocolors7.default.cyan(entry.author) : entry.author || "human";
        ui.write(`      ${import_picocolors7.default.dim(import_picocolors7.default.gray("by:"))} ${import_picocolors7.default.gray(by)}  ${import_picocolors7.default.dim(import_picocolors7.default.gray("on"))} ${import_picocolors7.default.gray(entry.date)}`);
        const rat = (entry.rationale || "").replace(/\s+/g, " ").trim();
        if (rat) {
          const preview = rat.length > 88 ? rat.slice(0, 85) + import_picocolors7.default.dim(import_picocolors7.default.gray("\u2026")) : rat;
          ui.write(`      ${import_picocolors7.default.dim(import_picocolors7.default.gray(preview))}`);
        }
        ui.write("");
      }
      if (hasStaged) {
        ui.write(`  ${import_picocolors7.default.yellow("\u25CF")} ${import_picocolors7.default.bold(import_picocolors7.default.white("Staged / pending"))} (not yet in remote; run ${import_picocolors7.default.dim(import_picocolors7.default.gray("dora journal sync"))} to publish):
`);
        for (const entry of staged) {
          printEntry(entry);
        }
        if (hasCommitted)
          ui.write("");
      }
      if (hasCommitted) {
        if (hasStaged) {
          ui.write(`  ${import_picocolors7.default.dim(import_picocolors7.default.gray("Committed (from local cache):"))}
`);
        }
        for (const entry of allEntries) {
          printEntry(entry);
        }
      }
      const totalShown = staged.length + allEntries.length;
      ui.write(`  ${import_picocolors7.default.dim(import_picocolors7.default.gray(`${totalShown} entries shown from ${journalRepo}.`))}
`);
      process.exit(0);
    }
  });
});

// src/cli/commands/journal/context.ts
var exports_context = {};
__export(exports_context, {
  generateJournalContext: () => generateJournalContext,
  formatJournalHookJson: () => formatJournalHookJson,
  default: () => context_default
});
import { existsSync as existsSync9 } from "fs";
import { join as join8, resolve as resolvePath } from "path";
function formatJournalHookJson(contextText) {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: contextText
    }
  });
}
function truncate(text, max = 180) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max)
    return clean;
  return clean.slice(0, max - 1) + "\u2026";
}
function groupByPushback(entries) {
  const strong = [];
  const friction = [];
  const nudge = [];
  for (const e of entries) {
    const pb = e.pushback ?? 0;
    if (pb >= 7)
      strong.push(e);
    else if (pb >= 4)
      friction.push(e);
    else
      nudge.push(e);
  }
  const byPush = (a, b) => (b.pushback ?? 0) - (a.pushback ?? 0);
  return {
    strong: strong.sort(byPush),
    friction: friction.sort(byPush),
    nudge: nudge.sort(byPush)
  };
}
function generateJournalContext(entries, project, opts = {}) {
  const minPb = opts.minPushback ?? 1;
  const showFull = !!opts.full;
  const includeGlobal = !opts.noGlobal;
  let filtered = entries.filter((e) => {
    const pb = e.pushback ?? 0;
    const isActive = (e.status || "active") === "active";
    return isActive && pb >= minPb;
  });
  if (!includeGlobal) {}
  if (filtered.length === 0) {
    return "";
  }
  const groups = groupByPushback(filtered);
  let out = "";
  const scope = project ? `for ${project}` : "from your journal";
  out += `These are recorded decisions and principles ${scope}. `;
  out += `Higher pushback entries represent stronger prior commitments.

`;
  const renderGroup = (title, items) => {
    if (items.length === 0)
      return "";
    let g = `## ${title}

`;
    for (const e of items) {
      const tags = (e.tags || []).length ? `tags: ${(e.tags || []).join(", ")}` : "";
      const pb = e.pushback ?? 0;
      g += `- **${e.title}** (pushback: ${pb}${tags ? `, ${tags}` : ""})
`;
      const body = showFull ? (e.rationale || "").trim() : truncate(e.rationale || "");
      if (body) {
        g += `  ${body}
`;
      }
      g += `
`;
    }
    return g;
  };
  out += renderGroup("Strong (pushback 7\u201310)", groups.strong);
  out += renderGroup("Friction (pushback 4\u20136)", groups.friction);
  out += renderGroup("Nudges (pushback 1\u20133)", groups.nudge);
  out += "If these feel out of date, run: `dora journal update` or `dora journal list`.\n";
  return out.trimEnd() + `
`;
}
async function appendOrUpdateJournalBlock(target, contextText, project, useReference) {
  const absTarget = resolvePath(process.cwd(), target);
  let original = "";
  if (existsSync9(absTarget)) {
    original = await Bun.file(absTarget).text();
  }
  let blockContent;
  if (useReference) {
    const refLines = [];
    refLines.push("## Recorded decisions (from journal)");
    refLines.push("");
    refLines.push("@~/.doraval/journals/global.md");
    if (project) {
      refLines.push(`@~/.doraval/journals/${project}.md`);
    }
    refLines.push("");
    refLines.push("_These are your synced project decisions. High pushback items are strong commitments._");
    blockContent = refLines.join(`
`);
  } else {
    blockContent = contextText.trim();
  }
  const newBlock = [
    JOURNAL_BLOCK_START,
    "",
    blockContent,
    "",
    JOURNAL_BLOCK_END
  ].join(`
`);
  let updated;
  const startIdx = original.indexOf(JOURNAL_BLOCK_START);
  const endIdx = original.indexOf(JOURNAL_BLOCK_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = original.slice(0, startIdx);
    const after = original.slice(endIdx + JOURNAL_BLOCK_END.length);
    updated = before + newBlock + after;
  } else {
    const separator = original.trim().length > 0 ? `

` : "";
    updated = original + separator + newBlock + `
`;
  }
  await Bun.write(absTarget, updated);
  const action = existsSync9(absTarget) && startIdx !== -1 ? "Updated" : "Added";
  ui.write(`
  ${import_picocolors8.default.green("\u2713")} ${action} journal decisions section in ${import_picocolors8.default.white(target)}`);
  if (useReference) {
    ui.write(`  ${import_picocolors8.default.dim("Using @import references (full files will be loaded by Claude).")}`);
  } else {
    ui.write(`  ${import_picocolors8.default.dim("Embedded compact decisions (low noise).")}`);
  }
}
var import_picocolors8, JOURNAL_BLOCK_START = "<!-- doraval-journal:start -->", JOURNAL_BLOCK_END = "<!-- doraval-journal:end -->", context_default;
var init_context = __esm(() => {
  init_dist();
  init_out();
  init_journal_config();
  init_journal_parse();
  import_picocolors8 = __toESM(require_picocolors(), 1);
  context_default = defineCommand({
    meta: {
      name: "context",
      description: "Output compact journal decisions (for hooks, CLAUDE.md, or piping)"
    },
    args: {
      project: {
        type: "string",
        alias: "p",
        description: "Project name (defaults to directory-based mapping)"
      },
      "min-pushback": {
        type: "string",
        description: "Only include entries with at least this pushback (1-10)",
        default: "1"
      },
      full: {
        type: "boolean",
        description: "Show full rationale instead of truncated",
        default: false
      },
      "no-global": {
        type: "boolean",
        description: "Exclude global entries (project only)",
        default: false
      },
      "append-to": {
        type: "string",
        description: "Append (or update) a managed section in this file (e.g. CLAUDE.md or AGENTS.md)"
      },
      reference: {
        type: "boolean",
        description: "When appending, use @import references instead of embedding compact decisions",
        default: false
      },
      "print-hook": {
        type: "boolean",
        description: "Print a ready-to-paste SessionStart hook snippet for hooks.json",
        default: false
      },
      json: {
        type: "boolean",
        description: "Emit Claude SessionStart hook JSON (hookSpecificOutput.additionalContext)",
        default: false
      },
      quiet: {
        type: "boolean",
        description: "For hook use: omit plain-text output when there are no entries (still emits JSON with --json)",
        default: false
      }
    },
    async run({ args }) {
      if (args["print-hook"]) {
        console.log(JSON.stringify({
          hooks: [
            {
              type: "command",
              command: "sh -c 'dora journal context 2>/dev/null || true'"
            }
          ]
        }, null, 2));
        ui.write("\nTip: Use `dora journal hook enable` to install the hook automatically.");
        ui.write("     Use `dora journal hook disable` to remove it.");
        ui.write("     (sh -c wrapper ensures shell features like redir work reliably.)");
        process.exit(0);
      }
      const config = await readConfig();
      let project = args.project;
      if (!project) {
        project = resolveProjectName(config) ?? undefined;
      }
      if (project) {
        project = sanitizeProjectName(project);
      }
      const journalsDir = getJournalsDir();
      const entries = [];
      const globalPath = join8(journalsDir, "global.md");
      if (existsSync9(globalPath)) {
        try {
          const raw = await Bun.file(globalPath).text();
          entries.push(...parseJournalEntries(raw));
        } catch {}
      }
      if (project) {
        const projectPath = join8(journalsDir, `${project}.md`);
        if (existsSync9(projectPath)) {
          try {
            const raw = await Bun.file(projectPath).text();
            entries.push(...parseJournalEntries(raw));
          } catch {}
        }
      }
      const minPb = parseInt(String(args["min-pushback"] ?? "1"), 10) || 1;
      const contextText = generateJournalContext(entries, project ?? null, {
        minPushback: minPb,
        full: !!args.full,
        noGlobal: !!args["no-global"]
      });
      const appendTarget = args["append-to"];
      if (appendTarget && contextText) {
        await appendOrUpdateJournalBlock(appendTarget, contextText, project ?? null, !!args.reference);
      }
      const useJson = !!args.json;
      const useQuiet = !!args.quiet;
      if (useJson) {
        console.log(formatJournalHookJson(contextText));
      } else if (contextText && !appendTarget) {
        console.log(contextText);
      } else if (contextText && appendTarget) {} else if (!useQuiet && !appendTarget && !contextText) {}
      process.exit(0);
    }
  });
});

// src/core/journal-hook.ts
import { existsSync as existsSync10 } from "fs";
import { join as join9, dirname as dirname2 } from "path";
import { fileURLToPath } from "url";
var {spawnSync: spawnSync3 } = globalThis.Bun;
function decodeSpawnStdout(stdout) {
  if (!stdout?.length)
    return "";
  return new TextDecoder().decode(stdout).trim().split(/\r?\n/)[0]?.trim() ?? "";
}
function probePathBinary(name) {
  const probes = process.platform === "win32" ? [[`where.exe`, name]] : [
    ["command", "-v", name],
    ["which", name]
  ];
  for (const cmd of probes) {
    try {
      const probe = spawnSync3(cmd, { stdout: "pipe", stderr: "pipe" });
      if (probe.exitCode === 0) {
        const found = decodeSpawnStdout(probe.stdout);
        if (found)
          return found;
      }
    } catch {}
  }
  return null;
}
function resolvePackagedBinary() {
  try {
    const here = dirname2(fileURLToPath(import.meta.url));
    for (const candidate of ["doraval-wrapper.js", "doraval.js"]) {
      const path2 = join9(here, "../../bin", candidate);
      if (existsSync10(path2))
        return path2;
    }
  } catch {}
  return null;
}
function resolveDoraBinary() {
  for (const name of ["dora", "doraval"]) {
    const found = probePathBinary(name);
    if (found)
      return found;
  }
  const packaged = resolvePackagedBinary();
  if (packaged)
    return packaged;
  const argv1 = process.argv[1];
  if (argv1 && existsSync10(argv1))
    return argv1;
  return "dora";
}
function buildJournalHookCommand(opts) {
  const bin = opts?.doraPath ?? resolveDoraBinary();
  const args = ["journal", "context"];
  if (opts?.json !== false)
    args.push("--json");
  if (opts?.quiet)
    args.push("--quiet");
  const inner = [bin, ...args].join(" ");
  if (opts?.quiet) {
    return `sh -c '${inner.replace(/'/g, "'\\''")} 2>/dev/null || true'`;
  }
  return inner;
}
function isJournalHookCommand(command) {
  if (typeof command !== "string")
    return false;
  if (command === LEGACY_JOURNAL_HOOK_COMMAND)
    return true;
  return /\bjournal\s+context\b/.test(command);
}
function journalHookGroup(opts) {
  return {
    hooks: [
      {
        type: "command",
        command: buildJournalHookCommand({ quiet: opts?.quiet })
      }
    ]
  };
}
var LEGACY_JOURNAL_HOOK_COMMAND = "sh -c 'dora journal context 2>/dev/null || true'";
var init_journal_hook = () => {};

// src/cli/commands/journal/hook.ts
var exports_hook = {};
__export(exports_hook, {
  writeHookConfig: () => writeJson,
  removeHook: () => removeHook,
  readHookConfig: () => readJson,
  isJournalHookCommand: () => isJournalHookCommand,
  hasHook: () => hasHook,
  getLocalHooksPath: () => getLocalHooksPath,
  getGlobalSettingsPath: () => getGlobalSettingsPath,
  default: () => hook_default,
  buildJournalHookCommand: () => buildJournalHookCommand,
  addHook: () => addHook
});
import { existsSync as existsSync11, mkdirSync as mkdirSync3, unlinkSync, rmdirSync, readdirSync as readdirSync5 } from "fs";
import { join as join10, dirname as dirname3 } from "path";
import { homedir as homedir4 } from "os";
function getGlobalSettingsPath() {
  return join10(homedir4(), ".claude", "settings.json");
}
function getLocalHooksPath() {
  return join10(process.cwd(), "hooks", "hooks.json");
}
async function readJson(file) {
  if (!existsSync11(file))
    return {};
  try {
    const raw = await Bun.file(file).text();
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
async function writeJson(file, data) {
  const dir = dirname3(file);
  if (!existsSync11(dir)) {
    mkdirSync3(dir, { recursive: true });
  }
  await Bun.write(file, JSON.stringify(data, null, 2) + `
`);
}
function hasHook(config) {
  const sessionStart = config?.hooks?.SessionStart;
  if (!Array.isArray(sessionStart))
    return false;
  return sessionStart.some((group) => Array.isArray(group?.hooks) && group.hooks.some((h) => isJournalHookCommand(h?.command)));
}
async function addHook(file, opts) {
  const original = await readJson(file);
  const config = JSON.parse(JSON.stringify(original));
  if (!config.hooks)
    config.hooks = {};
  if (!Array.isArray(config.hooks.SessionStart)) {
    config.hooks.SessionStart = [];
  }
  const desiredCommand = buildJournalHookCommand({ quiet: opts?.quiet });
  if (hasHook(config)) {
    if (!opts?.upgrade) {
      return { changed: false, path: file };
    }
    config.hooks.SessionStart = config.hooks.SessionStart.map((group) => {
      if (!group || !Array.isArray(group.hooks))
        return group;
      group.hooks = group.hooks.map((h) => isJournalHookCommand(h?.command) ? { ...h, command: desiredCommand } : h);
      return group;
    });
    await writeJson(file, config);
    return { changed: true, path: file };
  }
  config.hooks.SessionStart.push(journalHookGroup({ quiet: opts?.quiet }));
  await writeJson(file, config);
  return { changed: true, path: file };
}
async function removeHook(file) {
  if (!existsSync11(file))
    return { changed: false, path: file };
  const original = await readJson(file);
  const config = JSON.parse(JSON.stringify(original));
  if (!config.hooks || !Array.isArray(config.hooks.SessionStart)) {
    return { changed: false, path: file };
  }
  const beforeLen = config.hooks.SessionStart.length;
  config.hooks.SessionStart = config.hooks.SessionStart.map((group) => {
    if (!group || !Array.isArray(group.hooks))
      return group;
    group.hooks = group.hooks.filter((h) => !isJournalHookCommand(h?.command));
    return group;
  }).filter((group) => Array.isArray(group?.hooks) && group.hooks.length > 0);
  if (config.hooks.SessionStart.length === 0) {
    delete config.hooks.SessionStart;
  }
  if (config.hooks && Object.keys(config.hooks).length === 0) {
    delete config.hooks;
  }
  const changed = JSON.stringify(config) !== JSON.stringify(original);
  if (changed) {
    const isEmpty = !config || Object.keys(config).length === 0;
    if (isEmpty && existsSync11(file)) {
      try {
        unlinkSync(file);
      } catch {}
      try {
        const dir = dirname3(file);
        if (existsSync11(dir) && readdirSync5(dir).length === 0)
          rmdirSync(dir);
      } catch {}
    } else {
      await writeJson(file, config);
    }
  }
  return { changed, path: file };
}
async function printHookStatus() {
  const localPath = getLocalHooksPath();
  const globalPath = getGlobalSettingsPath();
  const localHas = hasHook(await readJson(localPath));
  const globalHas = hasHook(await readJson(globalPath));
  if (localHas) {
    ui.success(`Enabled in project: ${localPath}`);
  }
  if (globalHas) {
    ui.success(`Enabled globally: ${globalPath}`);
  }
  if (!localHas && !globalHas) {
    ui.info("Journal hook is not installed.");
    ui.info("Run `dora journal hook enable -g` to install it (recommended).");
  } else {
    ui.dim(`Expected command shape: ${buildJournalHookCommand()}`);
  }
}
var enable, disable, status, hook_default;
var init_hook = __esm(() => {
  init_dist();
  init_out();
  init_journal_hook();
  enable = defineCommand({
    meta: {
      name: "enable",
      description: "Install the journal decisions hook (SessionStart) so decisions are injected into Claude sessions"
    },
    args: {
      global: {
        type: "boolean",
        alias: "g",
        description: "Install to global ~/.claude/settings.json (recommended)",
        default: false
      },
      quiet: {
        type: "boolean",
        description: "Swallow hook errors (2>/dev/null || true) \u2014 default shows failures",
        default: false
      },
      upgrade: {
        type: "boolean",
        description: "Replace an existing journal hook with the latest command (absolute dora path + --json)",
        default: false
      }
    },
    async run({ args }) {
      const useGlobal = !!args.global;
      const target = useGlobal ? getGlobalSettingsPath() : getLocalHooksPath();
      const result = await addHook(target, {
        quiet: !!args.quiet,
        upgrade: !!args.upgrade
      });
      const hookCmd = buildJournalHookCommand({ quiet: !!args.quiet });
      if (result.changed) {
        ui.success(`Enabled journal hook in ${result.path}`);
        ui.dim(`Hook command: ${hookCmd}`);
        if (useGlobal) {
          ui.info("Installed globally \u2014 affects all new Claude Code sessions.");
        } else {
          ui.info("Installed in hooks/hooks.json for this project.");
          ui.warn("Project hooks/hooks.json only loads when Claude runs from this directory with the plugin active.");
          ui.info("For most setups, prefer: dora journal hook enable -g");
          ui.info("Or use: dora journal context --append-to CLAUDE.md");
        }
        ui.info(`Resolved dora binary: ${resolveDoraBinary()}`);
        ui.info("Start a new Claude session (or restart) for the hook to take effect.");
        ui.dim("The hook runs `dora journal context --json` on SessionStart.");
        ui.info("Preview plain text: dora journal context");
        ui.info("Preview hook JSON: dora journal context --json");
      } else {
        ui.info(`Journal hook is already enabled in ${result.path}`);
        ui.info("To migrate an older hook, run: dora journal hook enable --upgrade" + (useGlobal ? " -g" : ""));
      }
    }
  });
  disable = defineCommand({
    meta: {
      name: "disable",
      description: "Remove the journal decisions hook from Claude configuration"
    },
    args: {
      global: {
        type: "boolean",
        alias: "g",
        description: "Remove from global ~/.claude/settings.json",
        default: false
      }
    },
    async run({ args }) {
      const useGlobal = !!args.global;
      const target = useGlobal ? getGlobalSettingsPath() : getLocalHooksPath();
      const result = await removeHook(target);
      if (result.changed) {
        ui.success(`Disabled journal hook in ${result.path}`);
        ui.info("The decisions will no longer be injected on new SessionStart.");
      } else {
        ui.info(`Journal hook was not present in ${result.path}`);
      }
    }
  });
  status = defineCommand({
    meta: {
      name: "status",
      description: "Check where the journal hook is currently installed"
    },
    async run() {
      await printHookStatus();
    }
  });
  hook_default = defineCommand({
    meta: {
      name: "hook",
      description: "Manage Claude hooks for automatically injecting journal decisions"
    },
    subCommands: {
      enable: () => Promise.resolve(enable),
      disable: () => Promise.resolve(disable),
      status: () => Promise.resolve(status)
    },
    async run() {
      const cliArgs = process.argv.slice(2);
      const hookIdx = cliArgs.indexOf("hook");
      if (hookIdx !== -1 && cliArgs.length > hookIdx + 1)
        return;
      await printHookStatus();
    }
  });
});

// src/cli/commands/journal/update.ts
var exports_update = {};
__export(exports_update, {
  default: () => update_default
});
import { existsSync as existsSync12 } from "fs";
import { join as join11 } from "path";
var import_picocolors9, update_default;
var init_update = __esm(() => {
  init_dist();
  init_out();
  init_journal_config();
  init_journal_remote();
  import_picocolors9 = __toESM(require_picocolors(), 1);
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
      const config = await readConfig();
      if (!config?.journal.repo) {
        ui.write(`${import_picocolors9.default.red("\u2717")} No journal repo configured. Run ${import_picocolors9.default.dim("dora init")} (or ${import_picocolors9.default.dim("doraval journal init")}) first.`);
        process.exit(1);
      }
      const journalRepo = config.journal.repo;
      ensureDoravalDirs();
      const journalsDir = getJournalsDir();
      ui.write(`
  ${import_picocolors9.default.bold(import_picocolors9.default.white("dora journal update"))} \u2014 ${import_picocolors9.default.dim(import_picocolors9.default.gray(journalRepo))}
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
            ui.write(`${import_picocolors9.default.red("\u2717")} Invalid project name: ${project}`);
            process.exit(1);
          }
        }
      }
      const globalLocal = join11(journalsDir, "global.md");
      const refreshGlobalRes = await refreshLocalJournalFile(journalRepo, "global.md", globalLocal);
      let gotGlobal;
      if (!refreshGlobalRes.ok) {
        if (refreshGlobalRes.isNotFound) {
          gotGlobal = false;
        } else {
          ui.write(`${import_picocolors9.default.red("\u2717")} Failed to fetch global.md from ${journalRepo}:`);
          ui.write(refreshGlobalRes.error);
          process.exit(1);
        }
      } else {
        gotGlobal = refreshGlobalRes.value;
      }
      if (gotGlobal) {
        ui.write(`  ${import_picocolors9.default.green("\u2713")} global.md`);
      } else {
        ui.write(`  ${import_picocolors9.default.dim("\xB7")} global.md ${import_picocolors9.default.dim("(not present on remote)")}`);
      }
      if (projectsToUpdate.length === 0) {
        if (args.all) {
          ui.write(`
  ${import_picocolors9.default.dim(import_picocolors9.default.gray("No projects registered."))}
`);
        } else {
          ui.write(`
  ${import_picocolors9.default.yellow("\u26A0")} No project mapping found.
` + `  Run ${import_picocolors9.default.dim("dora init")} or pass ${import_picocolors9.default.dim("--project <name>")} / ${import_picocolors9.default.dim("--all")}.
`);
        }
        return;
      }
      for (const project of projectsToUpdate) {
        const remotePath = `projects/${project}.md`;
        const localPath = join11(journalsDir, `${project}.md`);
        const refreshRes = await refreshLocalJournalFile(journalRepo, remotePath, localPath);
        let got;
        if (!refreshRes.ok) {
          if (refreshRes.isNotFound) {
            got = false;
          } else {
            ui.write(`${import_picocolors9.default.red("\u2717")} Failed to fetch ${remotePath} from ${journalRepo}:`);
            ui.write(refreshRes.error);
            process.exit(1);
          }
        } else {
          got = refreshRes.value;
        }
        if (got) {
          ui.write(`  ${import_picocolors9.default.green("\u2713")} ${remotePath}`);
        } else {
          ui.write(`  ${import_picocolors9.default.dim("\xB7")} ${remotePath} ${import_picocolors9.default.dim("(not present on remote \u2014 will be created on first sync)")}`);
          if (!existsSync12(localPath)) {
            await Bun.write(localPath, `# ${project} Journal

Project-specific decisions.
`);
          }
        }
      }
      const summary = args.all && projectsToUpdate.length > 1 ? `${projectsToUpdate.length} projects + global` : projectsToUpdate.length === 1 ? projectsToUpdate[0] : "journals";
      ui.write(`
  ${import_picocolors9.default.dim(import_picocolors9.default.gray("Local cache refreshed for"))} ${import_picocolors9.default.bold(import_picocolors9.default.white(summary))}.
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
  default: () => add_default
});
import { existsSync as existsSync13 } from "fs";
import { join as join12 } from "path";
function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "untitled";
}
var import_picocolors10, add_default;
var init_add = __esm(() => {
  init_dist();
  init_out();
  init_journal_config();
  init_journal_validate();
  init_agent_invoke();
  import_picocolors10 = __toESM(require_picocolors(), 1);
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
        ui.write(`${import_picocolors10.default.yellow("\u26A0")} No project mapping found.

` + `Run ${import_picocolors10.default.dim("dora init")} (or ${import_picocolors10.default.dim("doraval journal init")}) first, or pass ${import_picocolors10.default.dim("--project <name>")}.`);
        process.exit(1);
      }
      let title;
      let pushback;
      let tags = [];
      let author = String(args.author || "human");
      let status2 = args.status || "active";
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
            status2 = parsed.status;
          if (parsed.date)
            date = String(parsed.date);
        } catch (e) {
          ui.write(`${import_picocolors10.default.red("\u2717")} Failed to parse --json input: ${e.message}`);
          process.exit(1);
        }
      }
      let rawBody;
      const rawMdArg = args.rawMarkdown;
      if (rawMdArg && !jsonInput) {
        if (rawMdArg === "-" || rawMdArg === "") {
          rawBody = (await new Response(Bun.stdin.stream()).text()).trim();
        } else if (existsSync13(rawMdArg)) {
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
          ui.write(`${import_picocolors10.default.red("\u2717")} --raw-markdown provided without a TITLE and without a leading '# Heading' in the markdown.`);
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
          ui.write(`  ${import_picocolors10.default.dim(import_picocolors10.default.gray("(querying your configured coding agent...)"))}`);
          const scaffold = `Raw user capture (a decision, observation, or useful note that just happened): "${title}"

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
          const agentResult = await invokeAgent(scaffold, agentCfg, ["title", "rationale"]);
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
              status2 = agentResult.status;
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
        status: status2
      };
      const validation = validateEntry(entry);
      if (!validation.valid) {
        ui.write(`${import_picocolors10.default.red("\u2717")} Invalid entry:
`);
        for (const err of validation.errors) {
          ui.write(`  ${import_picocolors10.default.red("\u2022")} ${err}`);
        }
        process.exit(1);
      }
      for (const warn of validation.warnings) {
        if ((warn.includes("not supplied") || warn.includes("empty")) && attemptedAgent) {} else if (warn.includes("not supplied") || warn.includes("empty")) {
          ui.write(`${import_picocolors10.default.dim("\xB7")} ${warn}`);
        } else {
          ui.write(`${import_picocolors10.default.yellow("\u26A0")} ${warn}`);
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
status: ${status2}
\`\`\`

${rationale}
`;
      ensureDoravalDirs();
      const pendingDir = getPendingProjectDir(project);
      if (!existsSync13(pendingDir)) {
        await Bun.write(join12(pendingDir, ".gitkeep"), "");
      }
      const slug = slugify(title);
      const filename = `${date}-${slug}.md`;
      const filePath = join12(pendingDir, filename);
      await Bun.write(filePath, content);
      ui.write(`
  ${import_picocolors10.default.green("\u2713")} ${import_picocolors10.default.bold(import_picocolors10.default.white(title))}`);
      ui.write(`  Project: ${import_picocolors10.default.white(project)}  \xB7 run ${import_picocolors10.default.dim(import_picocolors10.default.gray("dora journal sync"))} to publish
`);
      if (args.verbose) {
        const authorDisplay = author.startsWith("agent:") ? import_picocolors10.default.cyan(author) : author;
        ui.write(`  Pushback: ${import_picocolors10.default.white(String(pushback))}`);
        ui.write(`  Tags:     ${import_picocolors10.default.gray(tags.join(", ") || import_picocolors10.default.dim("(none)"))}`);
        ui.write(`  Author:   ${authorDisplay}`);
        ui.write(`  File:     ${import_picocolors10.default.dim(import_picocolors10.default.gray(filePath))}
`);
      }
      if (isThinInput && !author.startsWith("agent:")) {
        if (attemptedAgent) {
          ui.write(`  ${import_picocolors10.default.dim(import_picocolors10.default.gray("Note: agent was called but returned no usable enrichment. Edit the pending file or re-run dora init."))}
`);
        } else {
          ui.write(`  ${import_picocolors10.default.dim(import_picocolors10.default.gray("Tip: run dora init to configure an agent for auto-enrichment."))}
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
import { readdirSync as readdirSync6, existsSync as existsSync14 } from "fs";
import { join as join13 } from "path";
var {spawnSync: spawnSync4 } = globalThis.Bun;
function updateGitHubFile(repo, path2, content, message, sha) {
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
    `repos/${repo}/contents/${path2}`,
    "-f",
    `message=${payload.message}`,
    "-f",
    `content=${payload.content}`
  ];
  if (sha) {
    args.push("-f", `sha=${sha}`);
  }
  let result;
  try {
    result = spawnSync4(args, {
      stdout: "pipe",
      stderr: "pipe"
    });
  } catch {
    ui.write(import_picocolors11.default.red(`Failed to update ${path2} on ${repo}:`));
    ui.write("GitHub CLI (gh) is not available.");
    process.exit(1);
  }
  if (result.exitCode !== 0) {
    ui.write(import_picocolors11.default.red(`Failed to update ${path2} on ${repo}:`));
    ui.write(result.stderr.toString());
    process.exit(1);
  }
}
var import_picocolors11, sync_default;
var init_sync = __esm(() => {
  init_dist();
  init_out();
  init_journal_config();
  init_journal_remote();
  import_picocolors11 = __toESM(require_picocolors(), 1);
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
        ui.write(`${import_picocolors11.default.yellow("\u26A0")} No project mapping found.

` + `Run ${import_picocolors11.default.dim("dora init")} (or ${import_picocolors11.default.dim("doraval journal init")}) first, or pass ${import_picocolors11.default.dim("--project <name>")}.`);
        process.exit(1);
      }
      if (!config?.journal.repo) {
        guidedError({
          context: "Journal sync publishes decisions to a GitHub repo you control (set during dora init).",
          problem: "No journal repo configured",
          solutions: [
            "dora init",
            "dora journal init"
          ],
          next: "dora init"
        });
        process.exit(1);
      }
      const ghCheck = ensureGhCli();
      if (!ghCheck.ok) {
        ui.write(`  ${import_picocolors11.default.red("\u2717")} ${import_picocolors11.default.white("The GitHub CLI (")}${import_picocolors11.default.bold("gh")}${import_picocolors11.default.white(") is not installed.")}
`);
        ui.write(`  doraval uses ${import_picocolors11.default.bold("gh")} to fetch and sync journal files with GitHub.
`);
        ui.write(`  Install it:
`);
        ui.write(`    macOS:   ${import_picocolors11.default.dim("brew install gh")}`);
        ui.write(`    Linux:   ${import_picocolors11.default.dim("https://github.com/cli/cli/blob/trunk/docs/install_linux.md")}`);
        ui.write(`    Windows: ${import_picocolors11.default.dim("winget install --id GitHub.cli")}
`);
        ui.write(`  Then authenticate: ${import_picocolors11.default.dim("gh auth login")}
`);
        process.exit(1);
      }
      const journalRepo = config.journal.repo;
      const pendingDir = getPendingProjectDir(project);
      ui.write(`
  ${import_picocolors11.default.bold(import_picocolors11.default.white("dora journal sync"))} \u2014 ${import_picocolors11.default.white(project)}
`);
      ui.write(`  Journal repo: ${import_picocolors11.default.dim(import_picocolors11.default.gray(journalRepo))}`);
      ensureDoravalDirs();
      const journalsDir = getJournalsDir();
      const remoteProjectPath = `projects/${project}.md`;
      const localProjectPath = join13(journalsDir, `${project}.md`);
      ui.write(`  ${import_picocolors11.default.dim(import_picocolors11.default.gray("Refreshing local cache from remote..."))}`);
      const refreshGlobalRes = await refreshLocalJournalFile(journalRepo, "global.md", join13(journalsDir, "global.md"));
      if (!refreshGlobalRes.ok) {
        if (!refreshGlobalRes.isNotFound) {
          ui.write(import_picocolors11.default.red(`Failed to fetch global.md from ${journalRepo}:`));
          ui.write(refreshGlobalRes.error);
          process.exit(1);
        }
      }
      const gotGlobal = refreshGlobalRes.ok && refreshGlobalRes.value;
      if (gotGlobal) {
        ui.write(`  ${import_picocolors11.default.dim(import_picocolors11.default.gray("\u2713 global.md"))}`);
      }
      const refreshProjectCacheRes = await refreshLocalJournalFile(journalRepo, remoteProjectPath, localProjectPath);
      if (!refreshProjectCacheRes.ok) {
        if (!refreshProjectCacheRes.isNotFound) {
          ui.write(import_picocolors11.default.red(`Failed to fetch ${remoteProjectPath} from ${journalRepo}:`));
          ui.write(refreshProjectCacheRes.error);
          process.exit(1);
        }
      }
      const gotProjectCache = refreshProjectCacheRes.ok && refreshProjectCacheRes.value;
      if (gotProjectCache) {
        ui.write(`  ${import_picocolors11.default.dim(import_picocolors11.default.gray(`\u2713 ${remoteProjectPath}`))}`);
      }
      const pendingFiles = existsSync14(pendingDir) ? readdirSync6(pendingDir).filter((f) => f.endsWith(".md") && f !== ".gitkeep").sort() : [];
      if (pendingFiles.length === 0) {
        ui.write(`
  ${import_picocolors11.default.yellow("\u26A0")} No pending entries. Local cache is now up to date.
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
          ui.write(import_picocolors11.default.red(`Failed to fetch ${remotePath} from ${journalRepo}:`));
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
          ui.write(`  ${import_picocolors11.default.dim(import_picocolors11.default.gray("Found existing remote file (sha: " + (currentSha?.slice(0, 7) ?? "") + "...)"))}`);
      } else {
        if (args.verbose)
          ui.write(`  ${import_picocolors11.default.dim(import_picocolors11.default.gray("No existing file on remote \u2014 will create it"))}`);
      }
      let newEntries = "";
      for (const file of pendingFiles) {
        const fullPath = join13(pendingDir, file);
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
  ${import_picocolors11.default.dim(import_picocolors11.default.gray("Pushing to remote..."))}`);
      try {
        updateGitHubFile(journalRepo, remotePath, newContent, commitMessage, currentSha);
        ui.write(`  ${import_picocolors11.default.green("\u2713")} ${import_picocolors11.default.white("Successfully pushed to")} ${import_picocolors11.default.white(remotePath)}`);
      } catch (err) {
        ui.write(`${import_picocolors11.default.red("\u2717")} ${import_picocolors11.default.white("Failed to push to GitHub.")}`);
        process.exit(1);
      }
      for (const file of pendingFiles) {
        const fullPath = join13(pendingDir, file);
        try {
          await Bun.file(fullPath).unlink();
        } catch {}
      }
      ui.write(`  ${import_picocolors11.default.green("\u2713")} ${import_picocolors11.default.white("Cleared local pending entries")}`);
      try {
        const refreshRes = await refreshLocalJournalFile(journalRepo, remotePath, localProjectPath);
        if (!refreshRes.ok) {
          if (!refreshRes.isNotFound) {
            ui.write(`  ${import_picocolors11.default.yellow("\u26A0")} Could not re-fetch updated file (you can run sync again later)`);
          }
        } else if (refreshRes.value) {
          if (args.verbose)
            ui.write(`  ${import_picocolors11.default.green("\u2713")} ${import_picocolors11.default.white("Re-fetched")} ${import_picocolors11.default.white(project)}.md ${import_picocolors11.default.white("into local cache")}`);
        }
      } catch {
        ui.write(`  ${import_picocolors11.default.yellow("\u26A0")} Could not re-fetch updated file (you can run sync again later)`);
      }
      ui.write(`
  ${import_picocolors11.default.green("Done!")} ${import_picocolors11.default.white(pendingFiles.length + " entr" + (pendingFiles.length === 1 ? "y" : "ies") + " published.")}
`);
      process.exit(0);
    }
  });
});

// src/cli/commands/config.ts
var exports_config = {};
__export(exports_config, {
  default: () => config_default
});
var {YAML: YAML4 } = globalThis.Bun;
function getNestedValue(obj, keyPath) {
  const parts = keyPath.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || typeof current !== "object")
      return;
    current = current[part];
  }
  return current;
}
function setNestedValue(obj, keyPath, value) {
  const parts = keyPath.split(".");
  let current = obj;
  for (let i = 0;i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}
function coerceValue(raw) {
  if (raw === "true")
    return true;
  if (raw === "false")
    return false;
  const num = Number(raw);
  if (!isNaN(num) && raw.trim() !== "")
    return num;
  return raw;
}
var configSet, configGet, config_default;
var init_config = __esm(() => {
  init_dist();
  init_out();
  init_journal_config();
  configSet = defineCommand({
    meta: { name: "set", description: "Set a config value" },
    args: {
      key: { type: "positional", description: "Dot-notation key (e.g. eval.model)", required: true },
      value: { type: "positional", description: "Value to set", required: true }
    },
    async run({ args }) {
      ensureDoravalDirs();
      const config = await readConfig() ?? {
        journal: { repo: "", projects: {} }
      };
      const coerced = coerceValue(String(args.value));
      setNestedValue(config, String(args.key), coerced);
      await writeConfig(config);
      ui.success(`${args.key} = ${JSON.stringify(coerced)}`);
      process.exit(0);
    }
  });
  configGet = defineCommand({
    meta: { name: "get", description: "Get a config value (omit key to print all)" },
    args: {
      key: { type: "positional", description: "Dot-notation key (omit to print all)", required: false }
    },
    async run({ args }) {
      const config = await readConfig();
      if (!config) {
        guidedError({
          context: "doraval config and most commands (eval, journal, etc.) read ~/.doraval/config.yml.",
          problem: "No doraval config found",
          solutions: [
            "dora init   (one-time setup for journal + agent + eval)"
          ],
          next: "dora init"
        });
        process.exit(0);
      }
      if (!args.key) {
        process.stdout.write(YAML4.stringify(config));
        process.exit(0);
      }
      const value = getNestedValue(config, String(args.key));
      if (value === undefined) {
        ui.info(`${args.key}: (not set)`);
      } else {
        process.stdout.write(`${JSON.stringify(value)}
`);
      }
      process.exit(0);
    }
  });
  config_default = defineCommand({
    meta: { name: "config", description: "Get or set doraval configuration (dot-notation keys)" },
    subCommands: { set: configSet, get: configGet },
    run() {
      ui.info("Usage: doraval config set <key> <value>  |  doraval config get [key]");
      process.exit(0);
    }
  });
});

// src/providers/spec.ts
function getProviderSpec(id) {
  return PROVIDER_SPECS[id];
}
var PROVIDER_SPECS, supportedProviders;
var init_spec = __esm(() => {
  PROVIDER_SPECS = {
    claude: {
      id: "claude",
      name: "Claude Code",
      manifestPath: ".claude-plugin/plugin.json",
      marketplacePath: ".claude-plugin/marketplace.json",
      mcpFilename: ".mcp.json",
      skillsField: "array-or-dir-string",
      sourceShape: "string",
      requiresInterface: false
    },
    codex: {
      id: "codex",
      name: "Codex",
      manifestPath: ".codex-plugin/plugin.json",
      marketplacePath: ".agents/plugins/marketplace.json",
      mcpFilename: ".mcp.json",
      skillsField: "directory-string",
      sourceShape: "object",
      requiresInterface: true
    },
    cursor: {
      id: "cursor",
      name: "Cursor",
      manifestPath: ".cursor-plugin/plugin.json",
      marketplacePath: ".cursor-plugin/marketplace.json",
      mcpFilename: "mcp.json",
      skillsField: "directory-string",
      sourceShape: "string",
      requiresInterface: false
    },
    copilot: {
      id: "copilot",
      name: "Copilot CLI",
      manifestPath: ".github/plugin/plugin.json",
      marketplacePath: ".github/plugin/marketplace.json",
      mcpFilename: ".mcp.json",
      skillsField: "array-of-paths",
      sourceShape: "string",
      requiresInterface: false
    },
    grok: {
      id: "grok",
      name: "Grok",
      manifestPath: ".grok-plugin/plugin.json",
      marketplacePath: ".grok-plugin/marketplace.json",
      mcpFilename: ".mcp.json",
      skillsField: "directory-string",
      sourceShape: "string",
      requiresInterface: false
    }
  };
  supportedProviders = Object.keys(PROVIDER_SPECS);
});

// src/cli/commands/claude/context.ts
import { existsSync as existsSync15, readdirSync as readdirSync7 } from "fs";
import { join as join14 } from "path";
function detectContext(cwd = process.cwd()) {
  const claudeSpec = getProviderSpec("claude");
  const hasClaudeDir = existsSync15(join14(cwd, ".claude"));
  const hasPluginManifest = existsSync15(join14(cwd, claudeSpec.manifestPath));
  let looseSkillFiles = [];
  try {
    const files = readdirSync7(cwd);
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
var init_context2 = __esm(() => {
  init_spec();
});

// src/cli/commands/claude/new.ts
var exports_new = {};
__export(exports_new, {
  scaffold: () => scaffold,
  default: () => new_default,
  decidePath: () => decidePath
});
import { join as join15, basename as basename3, dirname as dirname4 } from "path";
import { mkdirSync as mkdirSync4, writeFileSync, existsSync as existsSync16 } from "fs";
function decidePath(ctx, intent, providedName) {
  const rawName = providedName || "";
  let decisionPath = "standalone";
  let targetDir = ctx.cwd;
  let shouldCreateDir = false;
  let migrateExisting = false;
  const useCurrentDirAsRoot = rawName === "." || rawName === basename3(ctx.cwd) || !rawName;
  if (intent === "distribute" || intent === "self-later" && ctx.looseSkillFiles.length > 0 && !ctx.hasClaudeDir) {
    decisionPath = "plugin";
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join15(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
    migrateExisting = ctx.looseSkillFiles.length > 0;
  } else if (intent === "self-later" && !ctx.hasClaudeDir) {
    decisionPath = "plugin";
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join15(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
  } else if (decisionPath === "standalone") {
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join15(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
  }
  return { path: decisionPath, targetDir, shouldCreateDir, migrateExisting };
}
function scaffold(decision, ctx, migrateContent) {
  const { targetDir, path: path2, shouldCreateDir } = decision;
  if (existsSync16(targetDir) && shouldCreateDir) {
    ui.fail("Target already exists");
    process.exit(1);
  }
  if (shouldCreateDir) {
    mkdirSync4(targetDir, { recursive: true });
  }
  if (path2 === "plugin") {
    const pluginName = basename3(targetDir);
    const claudeSpec = getProviderSpec("claude");
    const claudeManifestDir = dirname4(claudeSpec.manifestPath);
    const pluginJson = {
      name: pluginName,
      description: "Scaffolded by doraval claude new",
      version: "0.1.0",
      keywords: ["example-keyword", "another-keyword"]
    };
    mkdirSync4(join15(targetDir, claudeManifestDir), { recursive: true });
    writeFileSync(join15(targetDir, claudeSpec.manifestPath), JSON.stringify(pluginJson, null, 2));
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
    writeFileSync(join15(targetDir, "marketplace.json"), JSON.stringify(marketplaceJson, null, 2));
    const demoSkillName = "doraval";
    mkdirSync4(join15(targetDir, "skills", demoSkillName), { recursive: true });
    let skillContent;
    if (migrateContent) {
      skillContent = migrateContent;
    } else {
      skillContent = `---
name: ${demoSkillName}
description: Use doraval to validate, measure drift, and judge skills and plugins. Use when authoring or reviewing context engineering artifacts for AI coding agents.
---

# Use Doraval

Scale your AI context for coding agents. Make your next context work (skills, plugins & more) for your team, community, or self. Context engineering toolkit for AI coding agents.

When you need to check a skill or plugin:

- Validate the current directory: \`doraval validate .\`
- Validate a specific plugin: \`doraval validate . --for claude:plugin\`
- Validate one skill: \`doraval skill validate ./skills/${demoSkillName}/\`
- Check for rubric drift: \`doraval skill drift ./skills/${demoSkillName}/\`
- Get an AI quality judgment: \`doraval skill judge ./skills/${demoSkillName}/\`

Always run \`doraval validate\` before sharing or publishing a plugin. This skill demonstrates a complete, self-referential example of using doraval inside a generated plugin.`;
    }
    writeFileSync(join15(targetDir, "skills", demoSkillName, "SKILL.md"), skillContent);
    const readmePath = join15(targetDir, "README.md");
    if (!existsSync16(readmePath)) {
      writeFileSync(readmePath, "# " + pluginName + `

Claude Code plugin scaffolded by doraval.`);
    }
  } else {
    mkdirSync4(join15(targetDir, ".claude", "skills", "my-skill"), { recursive: true });
    const skillBody = migrateContent || `# My Skill

Basic starter.`;
    writeFileSync(join15(targetDir, ".claude", "skills", "my-skill", "SKILL.md"), `---
name: my-skill
description: Starter
---

${skillBody}`);
  }
}
var import_picocolors12, new_default;
var init_new = __esm(() => {
  init_dist();
  init_out();
  init_context2();
  init_prompt();
  init_spec();
  import_picocolors12 = __toESM(require_picocolors(), 1);
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
  ${import_picocolors12.default.green("\u2713")} Created ${decision.path} at ${import_picocolors12.default.bold(decision.targetDir)}`);
      const cmdName = decision.path === "plugin" ? `/${basename3(decision.targetDir)}:doraval` : "/my-skill";
      ui.info(`  Command: ${cmdName}`);
      if (decision.path === "plugin") {
        const claudeSpec = getProviderSpec("claude");
        ui.info(`  Claude: ${claudeSpec.manifestPath}`);
        ui.info(`  Marketplace: marketplace.json (unified / cross-provider listings)`);
      }
      ui.info(`  Test: claude --plugin-dir ${decision.targetDir}   (or use normally for standalone)`);
      ui.info(`  Validate: doraval validate ${decision.targetDir}`);
      if (decision.path === "plugin") {
        ui.info(`  Keywords: keywords array added for discovery \u2014 run validate to see "If users mention any of these keywords, your plugin will get triggered"`);
      }
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
import { resolve as resolve5, join as join16, dirname as dirname5, relative } from "path";
import { existsSync as existsSync17, readFileSync as readFileSync4, writeFileSync as writeFileSync2, readdirSync as readdirSync8, statSync as statSync2 } from "fs";
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
function readJson2(p) {
  try {
    const content = readFileSync4(p, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
function writeJson2(p, data) {
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
function bumpPluginEntriesVersions(plugins, bumpType) {
  if (!Array.isArray(plugins))
    return 0;
  let changed = 0;
  for (const p of plugins) {
    if (p && typeof p === "object") {
      const currentVer = typeof p.version === "string" ? p.version : undefined;
      if (currentVer) {
        try {
          const nextVer = bumpVersion(currentVer, bumpType);
          if (currentVer !== nextVer) {
            p.version = nextVer;
            changed++;
          }
        } catch {}
      }
    }
  }
  return changed;
}
function walkForTargets(dir, maxDepth = 6, currentDepth = 0) {
  const results = [];
  if (currentDepth > maxDepth)
    return results;
  let entries;
  try {
    entries = readdirSync8(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join16(dir, entry);
    let st;
    try {
      st = statSync2(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      const sub = walkForTargets(full, maxDepth, currentDepth + 1);
      results.push(...sub);
    } else if (st.isFile()) {
      if (entry === "plugin.json") {
        const parentDir = dirname5(full);
        const parentName = parentDir.split(/[/\\]/).pop();
        if (parentName === ".claude-plugin" || parentName === ".codex-plugin" || parentName === ".cursor-plugin" || parentName === ".github") {
          results.push({
            file: full,
            kind: "plugin",
            label: `plugin manifest (${parentName.replace(".", "")})`
          });
        }
      } else if (entry === "marketplace.json") {
        const json = readJson2(full);
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
var import_picocolors13, bump_default;
var init_bump = __esm(() => {
  init_dist();
  init_out();
  import_picocolors13 = __toESM(require_picocolors(), 1);
  bump_default = defineCommand({
    meta: {
      name: "bump",
      description: "Bump semver versions in plugin.json (manifests) and marketplace.json files (supports Claude, Codex, Cursor, Copilot)"
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
      const maybePath = resolve5(rawType);
      const looksLikeDir = existsSync17(maybePath) || rawType === "." || rawType.startsWith("./") || rawType.startsWith("../");
      if (!isKnownType && looksLikeDir) {
        targetPath = rawType;
        rawType = "patch";
      } else if (!isKnownType) {
        ui.fail(`Unknown bump type "${rawType}". Use patch | minor | major | 1.2.3`);
        process.exit(1);
      }
      const root = resolve5(targetPath);
      if (!existsSync17(root)) {
        ui.fail(`Path does not exist: ${root}`);
        process.exit(1);
      }
      ui.heading("doraval bump");
      ui.info(`  scanning: ${root}`);
      ui.info(`  scope: ${scope}   (use --only plugin or --only marketplace to narrow; Cursor/Copilot metadata.version supported)`);
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
        ui.info("    \u2022 **/.github/plugin/plugin.json (or marketplace.json)");
        ui.info("    \u2022 **/marketplace.json (top-level/metadata.version + versions inside plugins[] for Cursor/Copilot)");
        ui.info("");
        ui.info("  Tip: run from inside a plugin directory, or pass a path that contains plugins/.");
        ui.info("  Examples:");
        ui.info("    dora bump minor");
        ui.info("    dora bump minor ./my-claude-plugin");
        ui.info("    dora bump --only plugin .          # only the manifests");
        ui.info("    dora bump --only marketplace ./marketplaces-root   # bumps metadata.version + plugins[].version (Copilot/Cursor)");
        process.exit(1);
      }
      ui.info(`  matched ${targets.length} file(s)`);
      let bumpedCount = 0;
      for (const t of targets) {
        const json = readJson2(t.file);
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
        const rootUnchanged = current === next;
        let innerChanged = 0;
        if (t.kind === "marketplace" && Array.isArray(json.plugins)) {
          innerChanged = bumpPluginEntriesVersions(json.plugins, rawType);
        }
        if (rootUnchanged && innerChanged === 0) {
          ui.dim(`  \u2022 ${t.label}  ${current || "(no version)"}  (no change)  [${relPath}]`);
          continue;
        }
        const didRootUpdate = setVersion(json, next);
        const didAnyUpdate = didRootUpdate || innerChanged > 0;
        if (!didAnyUpdate) {
          ui.warnItem(`skipped (could not locate version field to update): ${relPath}`);
          continue;
        }
        writeJson2(t.file, json);
        if (didRootUpdate && current) {
          ui.success(`${t.label}: ${import_picocolors13.default.dim(current)} \u2192 ${import_picocolors13.default.green(next)}`);
        } else if (didRootUpdate) {
          ui.success(`${t.label}: ${import_picocolors13.default.green(next)}`);
        } else {
          ui.success(`${t.label} (no root version)`);
        }
        ui.info(`    ${relPath}`);
        if (innerChanged > 0) {
          ui.info(`    + bumped ${innerChanged} entry version(s) inside plugins[]`);
        }
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
import { existsSync as existsSync18, readdirSync as readdirSync9 } from "fs";
import { join as join17 } from "path";
function detectContext2(cwd = process.cwd()) {
  const codexSpec = getProviderSpec("codex");
  const hasCodexDir = existsSync18(join17(cwd, ".codex"));
  const hasPluginManifest = existsSync18(join17(cwd, codexSpec.manifestPath));
  const hasMarketplace = existsSync18(join17(cwd, ".agents", "plugins", "marketplace.json")) || existsSync18(join17(cwd, codexSpec.manifestPath));
  let looseSkillFiles = [];
  try {
    const files = readdirSync9(cwd);
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
var init_context3 = __esm(() => {
  init_spec();
});

// src/cli/commands/codex/new.ts
var exports_new2 = {};
__export(exports_new2, {
  scaffold: () => scaffold2,
  default: () => new_default2,
  decidePath: () => decidePath2
});
import { join as join18, basename as basename4, dirname as dirname6 } from "path";
import { mkdirSync as mkdirSync5, writeFileSync as writeFileSync3, existsSync as existsSync19 } from "fs";
function decidePath2(ctx, intent, providedName) {
  const rawName = providedName || "";
  let decisionPath = "standalone";
  let targetDir = ctx.cwd;
  let shouldCreateDir = false;
  let migrateExisting = false;
  const useCurrentDirAsRoot = rawName === "." || rawName === basename4(ctx.cwd) || !rawName;
  if (intent === "distribute" || intent === "self-later" && ctx.looseSkillFiles.length > 0 && !ctx.hasPluginManifest) {
    decisionPath = "plugin";
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join18(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
    migrateExisting = ctx.looseSkillFiles.length > 0;
  } else if (intent === "self-later" && !ctx.hasPluginManifest) {
    decisionPath = "plugin";
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join18(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
  } else if (decisionPath === "standalone") {
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join18(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
  }
  return { path: decisionPath, targetDir, shouldCreateDir, migrateExisting };
}
function scaffold2(decision, ctx, migrateContent) {
  const { targetDir, path: path2, shouldCreateDir } = decision;
  if (existsSync19(targetDir) && shouldCreateDir) {
    ui.fail("Target already exists");
    process.exit(1);
  }
  if (shouldCreateDir) {
    mkdirSync5(targetDir, { recursive: true });
  }
  if (path2 === "plugin") {
    const pluginName = basename4(targetDir);
    const codexSpec = getProviderSpec("codex");
    const codexManifestDir = dirname6(codexSpec.manifestPath);
    const pluginJson = {
      name: pluginName,
      version: "0.1.0",
      description: "Scaffolded by doraval codex new",
      skills: "./skills/",
      interface: {
        displayName: pluginName,
        shortDescription: "Scaffolded starter plugin",
        category: "Productivity"
      },
      keywords: ["example-keyword", "another-keyword"]
    };
    mkdirSync5(join18(targetDir, codexManifestDir), { recursive: true });
    writeFileSync3(join18(targetDir, codexSpec.manifestPath), JSON.stringify(pluginJson, null, 2));
    const marketplaceDir = dirname6(codexSpec.marketplacePath);
    mkdirSync5(join18(targetDir, marketplaceDir), { recursive: true });
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
    writeFileSync3(join18(targetDir, codexSpec.marketplacePath), JSON.stringify(marketplaceJson, null, 2));
    const demoSkillName = "doraval";
    mkdirSync5(join18(targetDir, "skills", demoSkillName), { recursive: true });
    let skillContent;
    if (migrateContent) {
      skillContent = migrateContent;
    } else {
      skillContent = `---
name: ${demoSkillName}
description: Use doraval to validate, measure drift, and judge skills and plugins. Use when authoring or reviewing context engineering artifacts for AI coding agents (works for Codex too).
---

# Use Doraval (Codex edition)

Scale your AI context for coding agents. Make your next context work (skills, plugins & more) for your team, community, or self. Context engineering toolkit for AI coding agents.

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
    writeFileSync3(join18(targetDir, "skills", demoSkillName, "SKILL.md"), skillContent);
    const readmePath = join18(targetDir, "README.md");
    if (!existsSync19(readmePath)) {
      writeFileSync3(readmePath, "# " + pluginName + `

Codex plugin scaffolded by doraval.`);
    }
  } else {
    mkdirSync5(join18(targetDir, "skills", "doraval"), { recursive: true });
    const skillBody = migrateContent || `# My Skill

Basic starter for Codex.`;
    writeFileSync3(join18(targetDir, "skills", "doraval", "SKILL.md"), `---
name: doraval
description: Starter (local skill)
---

${skillBody}`);
  }
}
var import_picocolors14, new_default2;
var init_new2 = __esm(() => {
  init_dist();
  init_out();
  init_context3();
  init_prompt();
  init_spec();
  import_picocolors14 = __toESM(require_picocolors(), 1);
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
  ${import_picocolors14.default.green("\u2713")} Created ${decision.path} at ${import_picocolors14.default.bold(decision.targetDir)}`);
      const cmdName = decision.path === "plugin" ? `/${basename4(decision.targetDir)}:doraval` : "/doraval (local skill)";
      ui.info(`  Command: ${cmdName}`);
      if (decision.path === "plugin") {
        ui.info(`  Codex manifest: .codex-plugin/plugin.json`);
        ui.info(`  Marketplace catalog: .agents/plugins/marketplace.json (starter for local testing)`);
        ui.info(`  (Move/expand the marketplace.json to $REPO_ROOT/.agents/plugins/ or ~/.agents/plugins/ as needed)`);
      }
      ui.info(`  Test (local): restart Codex, select your marketplace in the plugin directory`);
      ui.info(`  Validate: doraval validate ${decision.targetDir}`);
      if (decision.path === "plugin") {
        ui.info(`  Keywords: keywords array added for discovery \u2014 run validate to see "If users mention any of these keywords, your plugin will get triggered"`);
      }
      if (decision.path === "plugin" && decision.migrateExisting) {
        ui.info("  (Existing content migrated where confirmed.)");
      }
      process.exit(0);
    }
  });
});

// src/cli/commands/cursor/context.ts
import { existsSync as existsSync20, readdirSync as readdirSync10 } from "fs";
import { join as join19 } from "path";
function detectContext3(cwd = process.cwd()) {
  const hasCursorDir = existsSync20(join19(cwd, ".cursor"));
  const hasPluginManifest = existsSync20(join19(cwd, ".cursor-plugin", "plugin.json"));
  let looseSkillFiles = [];
  try {
    const files = readdirSync10(cwd);
    looseSkillFiles = files.filter((f) => {
      if (!f.endsWith(".md") || f.startsWith("."))
        return false;
      const lower = f.toLowerCase();
      if (lower === "readme.md" || lower === "changelog.md" || lower === "license.md" || lower.includes("contributing"))
        return false;
      return lower.includes("skill") || lower === "skill.md";
    });
  } catch {}
  const isEmpty = !hasCursorDir && !hasPluginManifest && looseSkillFiles.length === 0;
  return {
    cwd,
    hasCursorDir,
    hasPluginManifest,
    looseSkillFiles,
    isEmpty
  };
}
var init_context4 = () => {};

// src/cli/commands/cursor/new.ts
var exports_new3 = {};
__export(exports_new3, {
  scaffold: () => scaffold3,
  default: () => new_default3,
  decidePath: () => decidePath3
});
import { join as join20, basename as basename5, dirname as dirname7 } from "path";
import { mkdirSync as mkdirSync6, writeFileSync as writeFileSync4, existsSync as existsSync21 } from "fs";
function decidePath3(ctx, intent, providedName) {
  const rawName = providedName || "";
  let decisionPath = "standalone";
  let targetDir = ctx.cwd;
  let shouldCreateDir = false;
  let migrateExisting = false;
  const useCurrentDirAsRoot = rawName === "." || rawName === basename5(ctx.cwd) || !rawName;
  if (intent === "distribute" || intent === "self-later" && ctx.looseSkillFiles.length > 0 && !ctx.hasPluginManifest) {
    decisionPath = "plugin";
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join20(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
    migrateExisting = ctx.looseSkillFiles.length > 0;
  } else if (intent === "self-later" && !ctx.hasPluginManifest) {
    decisionPath = "plugin";
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join20(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
  } else if (decisionPath === "standalone") {
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join20(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
  }
  return { path: decisionPath, targetDir, shouldCreateDir, migrateExisting };
}
function scaffold3(decision, ctx, migrateContent) {
  const { targetDir, path: path2, shouldCreateDir } = decision;
  if (existsSync21(targetDir) && shouldCreateDir) {
    ui.fail("Target already exists");
    process.exit(1);
  }
  if (shouldCreateDir) {
    mkdirSync6(targetDir, { recursive: true });
  }
  if (path2 === "plugin") {
    const pluginName = basename5(targetDir);
    const cursorSpec = getProviderSpec("cursor");
    const cursorManifestDir = dirname7(cursorSpec.manifestPath);
    const pluginJson = {
      name: pluginName,
      version: "0.1.0",
      description: "Scaffolded by doraval cursor new",
      skills: "./skills/",
      displayName: pluginName,
      keywords: ["example-keyword", "another-keyword"]
    };
    mkdirSync6(join20(targetDir, cursorManifestDir), { recursive: true });
    writeFileSync4(join20(targetDir, cursorSpec.manifestPath), JSON.stringify(pluginJson, null, 2));
    const marketplaceDir = dirname7(cursorSpec.marketplacePath);
    mkdirSync6(join20(targetDir, marketplaceDir), { recursive: true });
    const marketplaceJson = {
      name: pluginName,
      version: "0.1.0",
      description: "Scaffolded by doraval cursor new",
      author: { name: "" },
      homepage: "",
      repository: "",
      license: "MIT",
      keywords: ["cursor", "skills", "plugin"]
    };
    writeFileSync4(join20(targetDir, cursorSpec.marketplacePath), JSON.stringify(marketplaceJson, null, 2));
    const demoSkillName = "doraval";
    mkdirSync6(join20(targetDir, "skills", demoSkillName), { recursive: true });
    let skillContent;
    if (migrateContent) {
      skillContent = migrateContent;
    } else {
      skillContent = `---
name: ${demoSkillName}
description: Use doraval to validate, measure drift, and judge skills and plugins. Use when authoring or reviewing context engineering artifacts for AI coding agents (works for Cursor too).
---

# Use Doraval (Cursor edition)

Scale your AI context for coding agents. Make your next context work (skills, plugins & more) for your team, community, or self. Context engineering toolkit for AI coding agents.

When you need to check a skill or Cursor plugin:

- Validate the current directory: \`doraval validate .\`
- Validate one skill: \`doraval skill validate ./skills/${demoSkillName}/\`
- Check for rubric drift: \`doraval skill drift ./skills/${demoSkillName}/\`
- Get an AI quality judgment: \`doraval skill judge ./skills/${demoSkillName}/\`

Always run \`doraval validate\` before sharing or publishing a plugin.

This skill demonstrates a complete, self-referential example of using doraval inside a generated Cursor plugin.

To test in Cursor:
1. Open the plugin directory or add via marketplace.
2. The demo skill will be available.`;
    }
    writeFileSync4(join20(targetDir, "skills", demoSkillName, "SKILL.md"), skillContent);
    const readmePath = join20(targetDir, "README.md");
    if (!existsSync21(readmePath)) {
      writeFileSync4(readmePath, "# " + pluginName + `

Cursor plugin scaffolded by doraval.`);
    }
  } else {
    mkdirSync6(join20(targetDir, "skills", "doraval"), { recursive: true });
    const skillBody = migrateContent || `# My Skill

Basic starter for Cursor.`;
    writeFileSync4(join20(targetDir, "skills", "doraval", "SKILL.md"), `---
name: doraval
description: Starter (local skill)
---

${skillBody}`);
  }
}
var import_picocolors15, new_default3;
var init_new3 = __esm(() => {
  init_dist();
  init_out();
  init_context4();
  init_prompt();
  init_spec();
  import_picocolors15 = __toESM(require_picocolors(), 1);
  new_default3 = defineCommand({
    meta: {
      name: "new",
      description: "Create a new skill or plugin following Cursor packaging rules"
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
      ui.heading("doraval cursor new \u2014 Context-aware scaffolding");
      const ctx = detectContext3();
      let intent = args.intent || "self-later";
      if (!args.yes) {
        const ans = prompt("  Intent (self | self-later | distribute)", intent);
        intent = ans || intent;
      }
      const decision = decidePath3(ctx, intent, args.name);
      ui.info(`  Decision: path=${decision.path}, target=${decision.targetDir}`);
      let migrateContent;
      if (decision.migrateExisting && !args.yes) {
        migrateContent = "Content from your existing SKILL.md (user-confirmed).";
      }
      scaffold3(decision, ctx, migrateContent);
      ui.write(`
  ${import_picocolors15.default.green("\u2713")} Created ${decision.path} at ${import_picocolors15.default.bold(decision.targetDir)}`);
      const cmdName = decision.path === "plugin" ? `/${basename5(decision.targetDir)}:doraval` : "/doraval (local skill)";
      ui.info(`  Command: ${cmdName}`);
      if (decision.path === "plugin") {
        ui.info(`  Cursor manifest: .cursor-plugin/plugin.json`);
        ui.info(`  Marketplace catalog: .cursor-plugin/marketplace.json`);
      }
      ui.info(`  Test (local): add the plugin dir in Cursor settings or use local skills`);
      ui.info(`  Validate: doraval validate ${decision.targetDir}`);
      if (decision.path === "plugin") {
        ui.info(`  Keywords: keywords array added for discovery \u2014 run validate to see "If users mention any of these keywords, your plugin will get triggered"`);
      }
      if (decision.path === "plugin" && decision.migrateExisting) {
        ui.info("  (Existing content migrated where confirmed.)");
      }
      process.exit(0);
    }
  });
});

// src/cli/commands/copilot/context.ts
import { existsSync as existsSync22, readdirSync as readdirSync11 } from "fs";
import { join as join21 } from "path";
function detectContext4(cwd = process.cwd()) {
  const hasGithubDir = existsSync22(join21(cwd, ".github"));
  const hasPluginManifest = existsSync22(join21(cwd, ".github", "plugin", "plugin.json"));
  let looseSkillFiles = [];
  try {
    const files = readdirSync11(cwd);
    looseSkillFiles = files.filter((f) => {
      if (!f.endsWith(".md") || f.startsWith("."))
        return false;
      const lower = f.toLowerCase();
      if (lower === "readme.md" || lower === "changelog.md" || lower === "license.md" || lower.includes("contributing"))
        return false;
      return lower.includes("skill") || lower === "skill.md";
    });
  } catch {}
  const isEmpty = !hasGithubDir && !hasPluginManifest && looseSkillFiles.length === 0;
  return {
    cwd,
    hasGithubDir,
    hasPluginManifest,
    looseSkillFiles,
    isEmpty
  };
}
var init_context5 = () => {};

// src/cli/commands/copilot/new.ts
var exports_new4 = {};
__export(exports_new4, {
  scaffold: () => scaffold4,
  default: () => new_default4,
  decidePath: () => decidePath4
});
import { join as join22, basename as basename6, dirname as dirname8 } from "path";
import { mkdirSync as mkdirSync7, writeFileSync as writeFileSync5, existsSync as existsSync23 } from "fs";
function decidePath4(ctx, intent, providedName) {
  const rawName = providedName || "";
  let decisionPath = "standalone";
  let targetDir = ctx.cwd;
  let shouldCreateDir = false;
  let migrateExisting = false;
  const useCurrentDirAsRoot = rawName === "." || rawName === basename6(ctx.cwd) || !rawName;
  if (intent === "distribute" || intent === "self-later" && ctx.looseSkillFiles.length > 0 && !ctx.hasPluginManifest) {
    decisionPath = "plugin";
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join22(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
    migrateExisting = ctx.looseSkillFiles.length > 0;
  } else if (intent === "self-later" && !ctx.hasPluginManifest) {
    decisionPath = "plugin";
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join22(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
  } else if (decisionPath === "standalone") {
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join22(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
  }
  return { path: decisionPath, targetDir, shouldCreateDir, migrateExisting };
}
function scaffold4(decision, ctx, migrateContent) {
  const { targetDir, path: path2, shouldCreateDir } = decision;
  if (existsSync23(targetDir) && shouldCreateDir) {
    ui.fail("Target already exists");
    process.exit(1);
  }
  if (shouldCreateDir) {
    mkdirSync7(targetDir, { recursive: true });
  }
  if (path2 === "plugin") {
    const pluginName = basename6(targetDir);
    const copilotSpec = getProviderSpec("copilot");
    const copilotManifestDir = dirname8(copilotSpec.manifestPath);
    const pluginJson = {
      name: pluginName,
      version: "0.1.0",
      description: "Scaffolded by doraval copilot new",
      skills: ["./skills/doraval"],
      displayName: pluginName,
      keywords: ["example-keyword", "another-keyword"]
    };
    mkdirSync7(join22(targetDir, copilotManifestDir), { recursive: true });
    writeFileSync5(join22(targetDir, copilotSpec.manifestPath), JSON.stringify(pluginJson, null, 2));
    const marketplaceDir = dirname8(copilotSpec.marketplacePath);
    mkdirSync7(join22(targetDir, marketplaceDir), { recursive: true });
    const marketplaceJson = {
      name: "local",
      plugins: [
        {
          name: pluginName,
          source: {
            source: "local",
            path: "."
          }
        }
      ]
    };
    writeFileSync5(join22(targetDir, copilotSpec.marketplacePath), JSON.stringify(marketplaceJson, null, 2));
    const demoSkillName = "doraval";
    mkdirSync7(join22(targetDir, "skills", demoSkillName), { recursive: true });
    let skillContent;
    if (migrateContent) {
      skillContent = migrateContent;
    } else {
      skillContent = `---
name: ${demoSkillName}
description: Use doraval to validate, measure drift, and judge skills and plugins. Use when authoring or reviewing context engineering artifacts for AI coding agents (works for Copilot too).
---

# Use Doraval (Copilot edition)

Scale your AI context for coding agents. Make your next context work (skills, plugins & more) for your team, community, or self. Context engineering toolkit for AI coding agents.

When you need to check a skill or Copilot plugin:

- Validate the current directory: \`doraval validate .\`
- Validate one skill: \`doraval skill validate ./skills/${demoSkillName}/\`
- Check for rubric drift: \`doraval skill drift ./skills/${demoSkillName}/\`
- Get an AI quality judgment: \`doraval skill judge ./skills/${demoSkillName}/\`

Always run \`doraval validate\` before sharing or publishing a plugin.

This skill demonstrates a complete, self-referential example of using doraval inside a generated Copilot plugin.

To test in Copilot:
1. Configure the .github/plugin as local source.
2. Restart/reload and invoke the skill.`;
    }
    writeFileSync5(join22(targetDir, "skills", demoSkillName, "SKILL.md"), skillContent);
    const readmePath = join22(targetDir, "README.md");
    if (!existsSync23(readmePath)) {
      writeFileSync5(readmePath, "# " + pluginName + `

Copilot plugin scaffolded by doraval.`);
    }
  } else {
    mkdirSync7(join22(targetDir, "skills", "doraval"), { recursive: true });
    const skillBody = migrateContent || `# My Skill

Basic starter for Copilot.`;
    writeFileSync5(join22(targetDir, "skills", "doraval", "SKILL.md"), `---
name: doraval
description: Starter (local skill)
---

${skillBody}`);
  }
}
var import_picocolors16, new_default4;
var init_new4 = __esm(() => {
  init_dist();
  init_out();
  init_context5();
  init_prompt();
  init_spec();
  import_picocolors16 = __toESM(require_picocolors(), 1);
  new_default4 = defineCommand({
    meta: {
      name: "new",
      description: "Create a new skill or plugin following Copilot packaging rules"
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
      ui.heading("doraval copilot new \u2014 Context-aware scaffolding");
      const ctx = detectContext4();
      let intent = args.intent || "self-later";
      if (!args.yes) {
        const ans = prompt("  Intent (self | self-later | distribute)", intent);
        intent = ans || intent;
      }
      const decision = decidePath4(ctx, intent, args.name);
      ui.info(`  Decision: path=${decision.path}, target=${decision.targetDir}`);
      let migrateContent;
      if (decision.migrateExisting && !args.yes) {
        migrateContent = "Content from your existing SKILL.md (user-confirmed).";
      }
      scaffold4(decision, ctx, migrateContent);
      ui.write(`
  ${import_picocolors16.default.green("\u2713")} Created ${decision.path} at ${import_picocolors16.default.bold(decision.targetDir)}`);
      const cmdName = decision.path === "plugin" ? `/${basename6(decision.targetDir)}:doraval` : "/doraval (local skill)";
      ui.info(`  Command: ${cmdName}`);
      if (decision.path === "plugin") {
        ui.info(`  Copilot manifest: .github/plugin/plugin.json`);
        ui.info(`  Marketplace catalog: .github/plugin/marketplace.json`);
      }
      ui.info(`  Test (local): configure local plugin source in Copilot and reload`);
      ui.info(`  Validate: doraval validate ${decision.targetDir}`);
      if (decision.path === "plugin") {
        ui.info(`  Keywords: keywords array added for discovery \u2014 run validate to see "If users mention any of these keywords, your plugin will get triggered"`);
      }
      if (decision.path === "plugin" && decision.migrateExisting) {
        ui.info("  (Existing content migrated where confirmed.)");
      }
      process.exit(0);
    }
  });
});

// src/cli/commands/ui.ts
var exports_ui = {};
__export(exports_ui, {
  default: () => ui_default
});
import { existsSync as existsSync24, readdirSync as readdirSync12, writeFileSync as writeFileSync6, unlinkSync as unlinkSync2, readFileSync as readFileSync5 } from "fs";
import { join as join23 } from "path";
import { spawn } from "child_process";
function slugify2(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "untitled";
}
async function loadAllEntries(project) {
  const journalsDir = getJournalsDir();
  const entries = [];
  const globalPath = join23(journalsDir, "global.md");
  if (existsSync24(globalPath)) {
    try {
      const raw = await Bun.file(globalPath).text();
      const parsed = parseJournalEntries(raw);
      parsed.forEach((e) => entries.push({ ...e, _source: "global" }));
    } catch {}
  }
  if (project) {
    const projPath = join23(journalsDir, `${project}.md`);
    if (existsSync24(projPath)) {
      try {
        const raw = await Bun.file(projPath).text();
        const parsed = parseJournalEntries(raw);
        parsed.forEach((e) => entries.push({ ...e, _source: "project" }));
      } catch {}
    }
  }
  const staged = [];
  try {
    const pdir = project ? getPendingProjectDir(project) : null;
    if (pdir && existsSync24(pdir)) {
      const files = readdirSync12(pdir).filter((f) => f.endsWith(".md") && f !== ".gitkeep");
      for (const f of files) {
        const txt = await Bun.file(join23(pdir, f)).text();
        const parsed = parseJournalEntries(txt);
        parsed.forEach((e) => {
          e._staged = true;
          e._source = "staged";
          e._filename = f;
          staged.push(e);
        });
      }
    }
  } catch {}
  return { committed: entries, staged };
}
async function writePendingEntry(project, input) {
  ensureDoravalDirs();
  const pendingDir = getPendingProjectDir(project);
  if (!existsSync24(pendingDir)) {
    await Bun.write(join23(pendingDir, ".gitkeep"), "");
  }
  const date = new Date().toISOString().split("T")[0];
  const slug = slugify2(input.title);
  const filename = `${date}-${slug}.md`;
  const filePath = join23(pendingDir, filename);
  const content = `## ${input.title}

\`\`\`yaml
pushback: ${input.pushback}
tags: [${input.tags.join(", ")}]
author: ${input.author || "human"}
date: ${date}
status: active
\`\`\`

${input.rationale}
`;
  await Bun.write(filePath, content);
  return { filePath, filename };
}
async function loadEvals(limit2 = 30) {
  const dir = getEvalsDir();
  if (!existsSync24(dir))
    return [];
  let files = readdirSync12(dir).filter((f) => f.endsWith(".json")).map((f) => ({ name: f, path: join23(dir, f) }));
  files.sort((a, b) => b.name.localeCompare(a.name));
  const results = [];
  for (const f of files.slice(0, limit2)) {
    try {
      const raw = await Bun.file(f.path).text();
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.schemaVersion === 1 || parsed.verdict || parsed.skill)) {
        results.push({ ...parsed, _filename: f.name });
      }
    } catch {}
  }
  results.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return results.slice(0, limit2);
}
async function killPort(port) {
  if (process.platform === "win32") {
    return;
  }
  try {
    const proc = Bun.spawn(["lsof", "-ti", `tcp:${port}`, "-sTCP:LISTEN"], { stdout: "pipe", stderr: "ignore" });
    const output = (await new Response(proc.stdout).text()).trim();
    if (!output)
      return;
    const pids = output.split(`
`).map((p) => p.trim()).filter(Boolean);
    ui.write(`  Killing previous doraval ui on port ${port}...`);
    for (const pid of pids) {
      ui.write(`    \u2192 kill -9 ${pid}`);
      Bun.spawn(["kill", "-9", pid], { stdout: "ignore", stderr: "ignore" });
    }
    await new Promise((r) => setTimeout(r, 400));
  } catch {}
}
function readPid(p) {
  const file = getPidFile(p);
  if (!existsSync24(file))
    return null;
  try {
    const raw = readFileSync5(file, "utf8").trim();
    const pid = parseInt(raw, 10);
    if (isNaN(pid))
      return null;
    process.kill(pid, 0);
    return pid;
  } catch {
    try {
      unlinkSync2(file);
    } catch {}
    return null;
  }
}
function writePid(pid, p) {
  ensureDoravalDirs();
  writeFileSync6(getPidFile(p), String(pid) + `
`);
}
function removePid(p) {
  try {
    unlinkSync2(getPidFile(p));
  } catch {}
}
async function getDashboardHtml() {
  const isSource = import.meta.url.includes("/src/");
  const htmlPath = isSource ? new URL("../../ui/index.html", import.meta.url) : new URL("./ui/index.html", import.meta.url);
  try {
    return await Bun.file(htmlPath).text();
  } catch (err) {
    ui.write(`[doraval ui] Failed to load HTML from ${htmlPath}`);
    return `<!doctype html><meta charset="utf-8"><body style="font-family:monospace;background:#111;color:#ddd;padding:2rem"><h1>doraval ui</h1><p>Dashboard HTML missing.</p><pre>${String(err)}</pre></body>`;
  }
}
var import_picocolors17, DEFAULT_PORT = 3737, getPidFile = (p) => join23(getDoravalDir(), `ui.${p}.pid`), ui_default;
var init_ui = __esm(() => {
  init_out();
  init_journal_config();
  init_journal_parse();
  init_context();
  init_hook();
  import_picocolors17 = __toESM(require_picocolors(), 1);
  ui_default = {
    async run({ args }) {
      const port = Number(args.port) || DEFAULT_PORT;
      const host = args.host || "127.0.0.1";
      const shouldOpen = args.open !== false;
      const showStatusOnly = !!args.status;
      const force = !!args.force;
      ensureDoravalDirs();
      const existingPid = readPid(port);
      if (showStatusOnly) {
        if (existingPid) {
          const url2 = `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
          ui.write(`  Dashboard running (pid ${existingPid})`);
          ui.write(`  URL:     ${import_picocolors17.default.underline(import_picocolors17.default.cyan(url2))}`);
        } else {
          ui.write(`  No dashboard running.`);
        }
        return;
      }
      if (existingPid && !force) {
        const url2 = `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
        ui.write(`  Dashboard already running (pid ${existingPid}).`);
        ui.write(`  URL:     ${import_picocolors17.default.underline(import_picocolors17.default.cyan(url2))}`);
        if (shouldOpen && process.stdout.isTTY) {
          try {
            const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
            spawn(opener, [url2], { stdio: "ignore", detached: true }).unref();
          } catch {}
        }
        return;
      }
      if (existingPid && force) {
        ui.write(`  Force restarting (killing pid ${existingPid})...`);
        try {
          process.kill(existingPid, "SIGTERM");
        } catch {}
        await new Promise((r) => setTimeout(r, 400));
        removePid(port);
      } else if (!existingPid) {
        await killPort(port);
      }
      const config = await readConfig();
      let project = resolveProjectName(config) ?? undefined;
      if (project) {
        try {
          project = sanitizeProjectName(project);
        } catch {
          project = undefined;
        }
      }
      let server;
      try {
        server = Bun.serve({
          port,
          hostname: host,
          async fetch(req) {
            const url2 = new URL(req.url);
            if (url2.pathname === "/" || url2.pathname === "/index.html") {
              const html = await getDashboardHtml();
              return new Response(html, {
                headers: { "content-type": "text/html; charset=utf-8" }
              });
            }
            if (url2.pathname === "/api/status") {
              return Response.json({
                project: project || null,
                doravalRoot: getDoravalDir(),
                doravalDir: getJournalsDir(),
                hasConfig: !!config,
                repo: config?.journal?.repo ?? null
              });
            }
            if (url2.pathname === "/api/entries") {
              const { committed, staged } = await loadAllEntries(project || null);
              return Response.json({ project, committed, staged });
            }
            if (url2.pathname === "/api/context") {
              const { committed, staged } = await loadAllEntries(project || null);
              const all = [...staged, ...committed].filter((e) => (e.status || "active") === "active");
              const text = generateJournalContext(all, project || null, { minPushback: 1 });
              return Response.json({ text, project });
            }
            if (url2.pathname === "/api/hooks/status" && req.method === "GET") {
              const localPath = getLocalHooksPath();
              const globalPath = getGlobalSettingsPath();
              const localHas = hasHook(await readJson(localPath));
              const globalHas = hasHook(await readJson(globalPath));
              return Response.json({
                local: { enabled: localHas, path: localPath },
                global: { enabled: globalHas, path: globalPath }
              });
            }
            if (url2.pathname === "/api/hooks/enable" && req.method === "POST") {
              const body = await req.json().catch(() => ({}));
              const useGlobal = !!body.global;
              const target = useGlobal ? getGlobalSettingsPath() : getLocalHooksPath();
              const res = await addHook(target);
              return Response.json(res);
            }
            if (url2.pathname === "/api/hooks/disable" && req.method === "POST") {
              const body = await req.json().catch(() => ({}));
              const useGlobal = !!body.global;
              const target = useGlobal ? getGlobalSettingsPath() : getLocalHooksPath();
              const res = await removeHook(target);
              return Response.json(res);
            }
            if (url2.pathname === "/api/add" && req.method === "POST") {
              if (!project) {
                return Response.json({ error: "No project configured. Run dora init or dora journal init first." }, { status: 400 });
              }
              const body = await req.json();
              const title = String(body.title || "Untitled decision").trim();
              const pushback = Number(body.pushback ?? 4);
              const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean) : [];
              const rationale = String(body.rationale || title).trim();
              try {
                const result = await writePendingEntry(project, { title, pushback, tags, rationale });
                return Response.json({ ok: true, ...result });
              } catch (e) {
                return Response.json({ error: e.message }, { status: 500 });
              }
            }
            if (url2.pathname === "/api/refresh" && req.method === "POST") {
              const { committed, staged } = await loadAllEntries(project || null);
              return Response.json({ ok: true, committed, staged });
            }
            if (url2.pathname === "/api/delete-staged" && req.method === "POST") {
              if (!project) {
                return Response.json({ error: "No project" }, { status: 400 });
              }
              const body = await req.json().catch(() => ({}));
              const filename = body.filename;
              if (!filename) {
                return Response.json({ error: "filename required" }, { status: 400 });
              }
              const pdir = getPendingProjectDir(project);
              const filePath = join23(pdir, filename);
              if (existsSync24(filePath)) {
                try {
                  await Bun.file(filePath).unlink();
                } catch {}
                return Response.json({ ok: true });
              }
              return Response.json({ error: "not found" }, { status: 404 });
            }
            if (url2.pathname === "/api/evals") {
              const evals = await loadEvals(25);
              return Response.json({ evals });
            }
            if (url2.pathname === "/api/open-dir" && req.method === "POST") {
              const dir = getDoravalDir();
              try {
                const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
                Bun.spawn([opener, dir], { stdout: "ignore", stderr: "ignore" });
              } catch {}
              return Response.json({ ok: true, path: dir });
            }
            if (url2.pathname.startsWith("/api/")) {
              return Response.json({ error: "Not found" }, { status: 404 });
            }
            return new Response("Not found", { status: 404 });
          }
        });
      } catch (err) {
        removePid(port);
        ui.write(`  Failed to start dashboard on port ${port}: ${err?.message || err}`);
        process.exit(1);
      }
      const url = `http://${host === "0.0.0.0" ? "localhost" : host}:${server.port}`;
      writePid(process.pid, port);
      const msg = `
  ${import_picocolors17.default.blue("\u25C9")}  dora local dashboard
  ${import_picocolors17.default.dim("Project:")} ${project ? import_picocolors17.default.white(project) : import_picocolors17.default.yellow("none (run dora init)")}
  ${import_picocolors17.default.dim("Data dir:")} ${getDoravalDir()}
  ${import_picocolors17.default.dim("URL:")}     ${import_picocolors17.default.underline(import_picocolors17.default.cyan(url))}

  ${import_picocolors17.default.dim("Press Ctrl+C to stop")}
`;
      ui.write(msg);
      ui.write(`  ${import_picocolors17.default.dim("Tip:")} data location = ${getDoravalDir()} (set DORAVAL_HOME to change)`);
      if (shouldOpen && process.stdout.isTTY) {
        try {
          const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
          spawn(opener, [url], { stdio: "ignore", detached: true }).unref();
        } catch {
          ui.write(import_picocolors17.default.dim(`  Could not auto-open. Visit ${url}`));
        }
      }
      const cleanup = () => {
        removePid(port);
        ui.write(`
  Stopping dashboard...`);
        server.stop();
        process.exit(0);
      };
      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);
    }
  };
});

// src/validators/claude/skill.ts
import { existsSync as existsSync25 } from "fs";
import { resolve as resolve6 } from "path";
var claudeSkillValidator;
var init_skill = __esm(() => {
  init_skill_validate();
  claudeSkillValidator = {
    id: "claude:skill",
    provider: "claude",
    name: "Claude Skill",
    description: "Validates SKILL.md per current Claude Code spec: frontmatter (name/description relaxed to recommended; directory name usually provides the /command), body, supporting files, dynamic injection (!`cmd`), substitutions ($ARGUMENTS, ${CLAUDE_*}), and advanced fields (allowed-tools, context, disable-model-invocation, when_to_use, etc.)",
    detect(dir) {
      return existsSync25(resolve6(dir, "SKILL.md"));
    },
    async validate(dir, _opts) {
      const loaded = await loadSkillFromDir(dir);
      if (!loaded.ok) {
        return {
          errors: [{ text: "Failed to parse YAML frontmatter in SKILL.md" }],
          warnings: [],
          passes: []
        };
      }
      return validateSkillModel(loaded.model, { existingDirs: [...loaded.existingDirs] });
    }
  };
});

// src/validators/claude/plugin.ts
import { existsSync as existsSync26, readdirSync as readdirSync13 } from "fs";
import { resolve as resolve7, join as join24 } from "path";
function levenshtein(a, b) {
  if (a === b)
    return 0;
  const m = a.length, n = b.length;
  if (m === 0)
    return n;
  if (n === 0)
    return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0;i <= m; i++) {
    const row = dp[i];
    row[0] = i;
  }
  for (let j = 0;j <= n; j++) {
    const row = dp[0];
    row[j] = j;
  }
  for (let i = 1;i <= m; i++) {
    const row = dp[i];
    const prev = dp[i - 1];
    for (let j = 1;j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
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
      return existsSync26(resolve7(dir, ".claude-plugin", "plugin.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const manifestPath = resolve7(dir, ".claude-plugin", "plugin.json");
      const dotClaudePluginDir = resolve7(dir, ".claude-plugin");
      let manifest;
      try {
        const raw = await Bun.file(manifestPath).text();
        manifest = JSON.parse(raw);
        passes.push({ text: ".claude-plugin/plugin.json is valid JSON" });
      } catch (err) {
        if (!existsSync26(manifestPath)) {
          errors.push({ text: `.claude-plugin/plugin.json is missing (looked for ${manifestPath})` });
          warnings.push({ text: "Hint: Run `doraval claude new` (or `dora claude new`) to scaffold a new Claude plugin in this directory." });
        } else {
          errors.push({ text: `.claude-plugin/plugin.json is invalid JSON (${err.message})` });
        }
        return { errors, warnings, passes };
      }
      try {
        const entries = readdirSync13(dotClaudePluginDir);
        const unexpected = entries.filter((e) => e !== "plugin.json");
        if (unexpected.length > 0) {
          for (const e of unexpected) {
            warnings.push({ text: `Unexpected item "${e}" inside .claude-plugin/ \u2014 only plugin.json belongs here. Move component directories and files (skills/, commands/, agents/, hooks/, .mcp.json etc.) to the plugin root.` });
          }
        } else if (entries.length === 1) {
          passes.push({ text: ".claude-plugin/ contains only plugin.json (correct layout)" });
        }
      } catch {}
      if (!manifest.name) {
        errors.push({ text: 'Missing required field: "name"' });
      } else {
        const name = String(manifest.name);
        if (!NAME_REGEX2.test(name)) {
          errors.push({ text: `Invalid name format: "${name}" \u2014 must be kebab-case (a-z, 0-9, hyphens)` });
        } else {
          passes.push({ text: `name: "${name}"` });
        }
      }
      if (manifest.version !== undefined) {
        const v = String(manifest.version);
        if (!/^\d+\.\d+\.\d+/.test(v)) {
          errors.push({ text: `Invalid version format: "${v}" \u2014 must look like semver (MAJOR.MINOR.PATCH) when using explicit versioning` });
        } else {
          passes.push({ text: `version: "${v}" (explicit \u2014 bump on every release to publish updates)` });
        }
      } else {
        passes.push({ text: "version omitted (git commit SHA used as version key \u2014 every commit becomes an available update)" });
      }
      if (manifest.description !== undefined) {
        const desc = String(manifest.description);
        if (desc.length < 10) {
          warnings.push({ text: `Description is very short (${desc.length} chars) \u2014 50-200 chars recommended` });
        } else {
          passes.push({ text: "description field present" });
        }
      } else {
        warnings.push({ text: 'Missing "description" (recommended for UI, marketplace listings, and auto-discovery)' });
      }
      if (manifest.displayName !== undefined) {
        passes.push(`displayName: "${manifest.displayName}" (human UI label; falls back to name)`);
      }
      if (manifest.author !== undefined) {
        const a = manifest.author;
        if (a && typeof a === "object" && a.name) {
          passes.push({ text: "author present" });
        } else {
          warnings.push({ text: 'author should be an object like {"name": "...", "email?": "..."}' });
        }
      }
      if (manifest.license !== undefined) {
        passes.push({ text: `license: "${manifest.license}"` });
      }
      if (manifest.keywords !== undefined) {
        if (Array.isArray(manifest.keywords)) {
          passes.push({ text: `keywords: [${manifest.keywords.join(", ")}] \u2014 If users mention any of these keywords, your plugin will get triggered in Claude Code` });
        } else {
          errors.push({ text: "keywords must be an array of strings" });
        }
      } else {
        warnings.push({ text: 'Missing "keywords" (recommended \u2014 if users mention any of these, your plugin will get triggered in Claude Code)' });
      }
      if (manifest.defaultEnabled !== undefined) {
        passes.push({ text: `defaultEnabled: ${manifest.defaultEnabled}` });
      }
      if (manifest.homepage)
        passes.push({ text: "homepage present" });
      if (manifest.repository)
        passes.push({ text: "repository present" });
      const unknown = Object.keys(manifest).filter((k) => !KNOWN_FIELDS2.has(k));
      for (const k of unknown) {
        const sug = suggestField(k);
        const hint = sug ? ` (did you mean "${sug}"?)` : "";
        warnings.push({ text: `Unrecognized top-level field "${k}"${hint} \u2014 will be ignored at runtime (allowed for cross-tool manifest compatibility).` });
      }
      const handleField = (field, val) => {
        if (val === undefined || val === null)
          return;
        if (isRelativePathLike(val) || Array.isArray(val) && val.every(isRelativePathLike)) {
          const arr = Array.isArray(val) ? val : [val];
          for (const p of arr) {
            const s = String(p);
            if (!RELATIVE_PATH_REGEX.test(s)) {
              errors.push({ text: `${field}: path "${s}" must start with "./"` });
            } else if (s.includes("..")) {
              errors.push({ text: `${field}: path "${s}" must not use ".." (paths are confined to the plugin tree after cache copy)` });
            } else if (existsSync26(resolve7(dir, s))) {
              passes.push({ text: `${field}: path "${s}" exists` });
            } else {
              warnings.push({ text: `${field}: path "${s}" does not exist on disk` });
            }
          }
          if (field === "skills") {
            passes.push({ text: `${field}: augments the default skills/ (both are scanned)` });
          } else if (REPLACES_DEFAULT.has(field)) {
            passes.push({ text: `${field}: custom path replaces default ${field}/ scan` });
          } else {
            passes.push({ text: `${field}: custom path or config (merge rules apply)` });
          }
        } else if (typeof val === "object") {
          passes.push({ text: `${field}: inline ${field} config present` });
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
        passes.push({ text: "experimental section present (themes and monitors are experimental components)" });
      }
      if (manifest.userConfig && typeof manifest.userConfig === "object") {
        const keys = Object.keys(manifest.userConfig);
        passes.push({ text: `userConfig: ${keys.length} user-configurable value(s) declared` });
        for (const k of keys) {
          const opt = manifest.userConfig[k];
          if (!opt || !opt.type || !opt.title) {
            warnings.push({ text: `userConfig.${k} is missing required "type" and/or "title"` });
          }
        }
      }
      if (Array.isArray(manifest.channels)) {
        passes.push({ text: `channels: ${manifest.channels.length} channel(s) (each binds to an mcpServer)` });
        manifest.channels.forEach((ch, i) => {
          if (!ch?.server)
            warnings.push({ text: `channels[${i}]: "server" is required and must match an mcpServers key` });
        });
      }
      if (Array.isArray(manifest.dependencies)) {
        passes.push({ text: `dependencies: declares ${manifest.dependencies.length} plugin dependency/ies` });
      }
      const skillsDir = resolve7(dir, "skills");
      if (existsSync26(skillsDir)) {
        const entries = readdirSync13(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
        for (const e of entries) {
          const md = join24(skillsDir, e.name, "SKILL.md");
          if (existsSync26(md)) {
            passes.push({ text: `skills/${e.name}/SKILL.md exists` });
          } else {
            errors.push({ text: `skills/${e.name}/ is missing SKILL.md` });
          }
        }
        if (manifest.skills !== undefined) {
          warnings.push({ text: 'Default skills/ dir co-exists with manifest "skills" \u2014 manifest path is authoritative; default folder ignored for loading' });
        }
      }
      const commandsDir = resolve7(dir, "commands");
      if (existsSync26(commandsDir)) {
        const mds = readdirSync13(commandsDir).filter((f) => f.endsWith(".md"));
        if (mds.length) {
          passes.push({ text: `commands/ has ${mds.length} .md file(s)` });
        }
        if (manifest.commands !== undefined) {
          warnings.push({ text: 'commands/ co-exists with manifest "commands" \u2014 manifest replaces default (dir ignored)' });
        }
      }
      const agentsDir = resolve7(dir, "agents");
      if (existsSync26(agentsDir)) {
        const mds = readdirSync13(agentsDir).filter((f) => f.endsWith(".md"));
        if (mds.length) {
          passes.push({ text: `agents/ has ${mds.length} .md file(s)` });
        }
        if (manifest.agents !== undefined) {
          warnings.push({ text: 'agents/ co-exists with manifest "agents" \u2014 manifest replaces default (dir ignored)' });
        }
      }
      if (existsSync26(resolve7(dir, "output-styles"))) {
        passes.push({ text: "output-styles/ directory present" });
        if (manifest.outputStyles)
          warnings.push({ text: "output-styles/ co-exists with manifest outputStyles \u2014 manifest wins" });
      }
      if (existsSync26(resolve7(dir, "themes")))
        passes.push({ text: "themes/ present (experimental)" });
      if (existsSync26(resolve7(dir, "monitors")) || manifest.experimental?.monitors) {
        passes.push({ text: "monitors config present (experimental)" });
      }
      if (existsSync26(resolve7(dir, "bin")))
        passes.push("bin/ present (adds executables to Bash tool $PATH)");
      if (existsSync26(resolve7(dir, "settings.json")))
        passes.push("settings.json present (plugin defaults for agent/statusline)");
      if (existsSync26(resolve7(dir, "README.md")))
        passes.push("README.md present");
      if (existsSync26(resolve7(dir, ".mcp.json")))
        passes.push(".mcp.json present (validated by claude:mcp)");
      if (existsSync26(resolve7(dir, ".lsp.json")))
        passes.push(".lsp.json present (validated by claude:lsp when registered)");
      if (existsSync26(resolve7(dir, "hooks/hooks.json")) || existsSync26(resolve7(dir, "hooks.json"))) {
        passes.push("hooks config present (validated by claude:hooks)");
      }
      if (existsSync26(resolve7(dir, "SKILL.md")) && !existsSync26(skillsDir) && manifest.skills === undefined) {
        passes.push('Root SKILL.md detected \u2014 plugin will be treated as a single-skill plugin (prefer frontmatter "name" for stable /command)');
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/claude/marketplace.ts
import { existsSync as existsSync27, readdirSync as readdirSync14 } from "fs";
import { resolve as resolve8, join as join25 } from "path";
var claudeMarketplaceValidator;
var init_marketplace = __esm(() => {
  claudeMarketplaceValidator = {
    id: "claude:marketplace",
    provider: "claude",
    name: "Claude Plugin Marketplace",
    description: "Validates .claude-plugin/marketplace.json or plugins/ marketplace layouts (plugins array with sources)",
    detect(dir) {
      if (existsSync27(resolve8(dir, ".claude-plugin", "marketplace.json")))
        return true;
      const pluginsDir = resolve8(dir, "plugins");
      if (!existsSync27(pluginsDir))
        return false;
      try {
        const entries = readdirSync14(pluginsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory())
            continue;
          const hasSkills = existsSync27(join25(pluginsDir, entry.name, "skills"));
          const hasManifest = existsSync27(join25(pluginsDir, entry.name, ".claude-plugin", "plugin.json"));
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
      const claudeMktPath = resolve8(dir, ".claude-plugin", "marketplace.json");
      const hasClaudeMkt = existsSync27(claudeMktPath);
      const pluginsDir = resolve8(dir, "plugins");
      const hasPluginsDirLayout = existsSync27(pluginsDir);
      if (!hasClaudeMkt && !hasPluginsDirLayout) {
        errors.push("Missing .claude-plugin/marketplace.json or plugins/ directory");
        return { errors, warnings, passes };
      }
      if (hasClaudeMkt) {
        let mkt;
        try {
          const raw = await Bun.file(claudeMktPath).text();
          mkt = JSON.parse(raw);
          passes.push(".claude-plugin/marketplace.json is valid JSON");
        } catch {
          errors.push(".claude-plugin/marketplace.json is missing or invalid JSON");
          return { errors, warnings, passes };
        }
        if (mkt.name) {
          passes.push(`name: "${mkt.name}"`);
        } else {
          warnings.push('Missing "name" at marketplace root');
        }
        if (mkt.description) {
          passes.push("description present");
        }
        if (mkt.owner) {
          passes.push("owner present");
        }
        if (!Array.isArray(mkt.plugins) || mkt.plugins.length === 0) {
          errors.push('"plugins" must be a non-empty array');
          return { errors, warnings, passes };
        }
        passes.push(`${mkt.plugins.length} plugin(s) declared`);
        for (const [i, p] of mkt.plugins.entries()) {
          if (!p || typeof p !== "object") {
            errors.push(`plugins[${i}]: must be an object`);
            continue;
          }
          if (p.name) {
            passes.push(`plugins[${i}].name: "${p.name}"`);
          } else {
            errors.push(`plugins[${i}]: missing "name"`);
          }
          if (p.source) {
            const src = String(p.source);
            passes.push(`plugins[${i}].source: "${src}"`);
            const srcDir = resolve8(dir, src);
            if (existsSync27(srcDir)) {
              const hasManifest = existsSync27(resolve8(srcDir, ".claude-plugin", "plugin.json"));
              const hasSkills = existsSync27(resolve8(srcDir, "skills"));
              if (hasManifest || hasSkills) {
                passes.push(`plugins[${i}]: source exists (${hasManifest ? "manifest" : "skills/"})`);
              } else {
                warnings.push(`plugins[${i}].source "${src}" exists but lacks plugin markers`);
              }
            } else {
              warnings.push(`plugins[${i}].source path "${src}" does not exist`);
            }
          } else {
            errors.push(`plugins[${i}]: missing "source"`);
          }
          if (p.category) {
            passes.push(`plugins[${i}].category: "${p.category}"`);
          }
        }
        if (existsSync27(resolve8(dir, "README.md"))) {
          passes.push("README.md exists at marketplace root");
        } else {
          warnings.push("No README.md at marketplace root \u2014 recommended for discoverability");
        }
        if (existsSync27(resolve8(dir, "LICENSE"))) {
          passes.push("LICENSE exists at marketplace root");
        } else {
          warnings.push("No LICENSE at marketplace root \u2014 recommended");
        }
        return { errors, warnings, passes };
      }
      if (hasPluginsDirLayout) {
        passes.push("plugins/ directory exists");
        const pluginEntries = readdirSync14(pluginsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
        if (pluginEntries.length === 0) {
          errors.push("plugins/ directory is empty \u2014 expected at least one plugin");
          return { errors, warnings, passes };
        }
        passes.push(`${pluginEntries.length} plugin(s) found`);
        if (existsSync27(resolve8(dir, "README.md"))) {
          passes.push("README.md exists at marketplace root");
        } else {
          warnings.push("No README.md at marketplace root \u2014 recommended for discoverability");
        }
        if (existsSync27(resolve8(dir, "LICENSE"))) {
          passes.push("LICENSE exists at marketplace root");
        } else {
          warnings.push("No LICENSE at marketplace root \u2014 recommended");
        }
        for (const plugin of pluginEntries) {
          const pluginPath = join25(pluginsDir, plugin.name);
          const hasSkills = existsSync27(join25(pluginPath, "skills"));
          const hasManifest = existsSync27(join25(pluginPath, ".claude-plugin", "plugin.json"));
          const hasReadme = existsSync27(join25(pluginPath, "README.md"));
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
      return { errors, warnings, passes };
    }
  };
});

// src/validators/claude/hooks.ts
import { existsSync as existsSync28 } from "fs";
import { resolve as resolve9 } from "path";
function normalizeHooksConfig(config) {
  const keys = Object.keys(config);
  if (keys.length === 1 && keys[0] === "hooks" && config.hooks && typeof config.hooks === "object" && !Array.isArray(config.hooks)) {
    return config.hooks;
  }
  return config;
}
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
      return existsSync28(resolve9(dir, "hooks", "hooks.json")) || existsSync28(resolve9(dir, "hooks.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const hooksPath = existsSync28(resolve9(dir, "hooks", "hooks.json")) ? resolve9(dir, "hooks", "hooks.json") : resolve9(dir, "hooks.json");
      let config;
      try {
        const raw = await Bun.file(hooksPath).text();
        const parsed = JSON.parse(raw);
        config = normalizeHooksConfig(parsed);
        passes.push("hooks.json is valid JSON");
        if (parsed !== config && Object.keys(parsed).length === 1 && "hooks" in parsed) {
          passes.push('Uses nested "hooks" object (plugin/settings layout)');
        }
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
import { existsSync as existsSync29 } from "fs";
import { resolve as resolve10 } from "path";
var claudeMcpValidator;
var init_mcp = __esm(() => {
  claudeMcpValidator = {
    id: "claude:mcp",
    provider: "claude",
    name: "Claude MCP Config",
    description: "Validates .mcp.json (or inline via plugin.json mcpServers): server entries (stdio: command+args, or url), env, cwd, ${CLAUDE_PLUGIN_ROOT} etc. substitutions per Plugins reference",
    detect(dir) {
      return existsSync29(resolve10(dir, ".mcp.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const mcpPath = resolve10(dir, ".mcp.json");
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
import { existsSync as existsSync30, readdirSync as readdirSync15 } from "fs";
import { resolve as resolve11, join as join26 } from "path";
var claudeSubagentValidator;
var init_subagent = __esm(() => {
  init_frontmatter();
  claudeSubagentValidator = {
    id: "claude:subagent",
    provider: "claude",
    name: "Claude Subagents",
    description: "Validates agents/*.md (plugin subagents): frontmatter per spec (name, description, model, effort, maxTurns, tools, disallowedTools, skills, memory, background, isolation=worktree), body; warns on disallowed fields (hooks, mcpServers, permissionMode) for security",
    detect(dir) {
      const agentsDir = resolve11(dir, "agents");
      if (!existsSync30(agentsDir))
        return false;
      try {
        return readdirSync15(agentsDir).some((f) => f.endsWith(".md"));
      } catch {
        return false;
      }
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const agentsDir = resolve11(dir, "agents");
      const mdFiles = readdirSync15(agentsDir).filter((f) => f.endsWith(".md"));
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
        const filePath = join26(agentsDir, file);
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
import { existsSync as existsSync31, readdirSync as readdirSync16 } from "fs";
import { resolve as resolve12, join as join27 } from "path";
var claudeCommandValidator;
var init_command = __esm(() => {
  init_frontmatter();
  claudeCommandValidator = {
    id: "claude:command",
    provider: "claude",
    name: "Claude Commands",
    description: "Validates commands/ (or legacy .claude/commands/) .md files: frontmatter (including rich skill fields), description, body",
    detect(dir) {
      const commandsDir = resolve12(dir, "commands");
      if (!existsSync31(commandsDir))
        return false;
      try {
        return readdirSync16(commandsDir).some((f) => f.endsWith(".md"));
      } catch {
        return false;
      }
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const commandsDir = resolve12(dir, "commands");
      const mdFiles = readdirSync16(commandsDir).filter((f) => f.endsWith(".md"));
      if (mdFiles.length === 0) {
        errors.push("commands/ directory has no .md files");
        return { errors, warnings, passes };
      }
      passes.push(`${mdFiles.length} command definition(s) found`);
      for (const file of mdFiles) {
        const filePath = join27(commandsDir, file);
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
import { existsSync as existsSync32 } from "fs";
import { resolve as resolve13 } from "path";
var claudeMemoryValidator;
var init_memory = __esm(() => {
  claudeMemoryValidator = {
    id: "claude:memory",
    provider: "claude",
    name: "Claude CLAUDE.md",
    description: "Validates CLAUDE.md: non-empty, length recommendations, @path imports",
    detect(dir) {
      return existsSync32(resolve13(dir, "CLAUDE.md"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const filePath = resolve13(dir, "CLAUDE.md");
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
        const resolvedImport = resolve13(dir, importPath);
        if (existsSync32(resolvedImport)) {
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
import { existsSync as existsSync33 } from "fs";
import { resolve as resolve14 } from "path";
var claudeLspValidator;
var init_lsp = __esm(() => {
  claudeLspValidator = {
    id: "claude:lsp",
    provider: "claude",
    name: "Claude LSP Servers",
    description: "Validates .lsp.json (or plugin.json lspServers): language server configs with required command + extensionToLanguage; optional transport, env, settings, diagnostics etc. (binaries installed separately)",
    detect(dir) {
      return existsSync33(resolve14(dir, ".lsp.json")) || existsSync33(resolve14(dir, ".claude-plugin", "plugin.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      let cfg = null;
      const lspPath = resolve14(dir, ".lsp.json");
      if (existsSync33(lspPath)) {
        try {
          cfg = JSON.parse(await Bun.file(lspPath).text());
          passes.push(".lsp.json is valid JSON");
        } catch {
          errors.push(".lsp.json is invalid JSON");
          return { errors, warnings, passes };
        }
      } else {
        const manifestPath = resolve14(dir, ".claude-plugin", "plugin.json");
        if (existsSync33(manifestPath)) {
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
        if (!existsSync33(lspPath)) {
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
import { existsSync as existsSync34 } from "fs";
import { resolve as resolve15 } from "path";
var claudeMonitorsValidator;
var init_monitors = __esm(() => {
  claudeMonitorsValidator = {
    id: "claude:monitors",
    provider: "claude",
    name: "Claude Monitors (experimental)",
    description: "Validates monitors/monitors.json (or experimental.monitors): array of {name, command, description, when?}; commands support ${CLAUDE_PLUGIN_*} subs. Monitors run only in interactive CLI sessions.",
    detect(dir) {
      return existsSync34(resolve15(dir, "monitors", "monitors.json")) || existsSync34(resolve15(dir, "monitors.json")) || existsSync34(resolve15(dir, ".claude-plugin", "plugin.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      let arr = null;
      const candidates = [
        resolve15(dir, "monitors", "monitors.json"),
        resolve15(dir, "monitors.json")
      ];
      for (const p of candidates) {
        if (existsSync34(p)) {
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
        const mp = resolve15(dir, ".claude-plugin", "plugin.json");
        if (existsSync34(mp)) {
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

// src/validators/codex/plugin.ts
import { existsSync as existsSync35, readdirSync as readdirSync17 } from "fs";
import { resolve as resolve16, join as join28 } from "path";
var NAME_REGEX3, codexPluginValidator;
var init_plugin2 = __esm(() => {
  NAME_REGEX3 = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
  codexPluginValidator = {
    id: "codex:plugin",
    provider: "codex",
    name: "Codex Plugin",
    description: "Validates .codex-plugin/plugin.json manifest (requires interface block and skills as directory string per Codex packaging)",
    detect(dir) {
      return existsSync35(resolve16(dir, ".codex-plugin", "plugin.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const manifestPath = resolve16(dir, ".codex-plugin", "plugin.json");
      let manifest;
      try {
        const raw = await Bun.file(manifestPath).text();
        manifest = JSON.parse(raw);
        passes.push(".codex-plugin/plugin.json is valid JSON");
      } catch {
        errors.push(".codex-plugin/plugin.json is missing or invalid JSON");
        return { errors, warnings, passes };
      }
      if (!manifest.name) {
        errors.push('Missing required field: "name"');
      } else {
        const name = String(manifest.name);
        if (!NAME_REGEX3.test(name)) {
          errors.push(`Invalid name format: "${name}" \u2014 must be kebab-case (a-z, 0-9, hyphens)`);
        } else {
          passes.push(`name: "${name}"`);
        }
      }
      if (manifest.skills === undefined) {
        errors.push('Missing required field: "skills" (must be a directory string like "./skills/")');
      } else if (typeof manifest.skills !== "string") {
        errors.push('"skills" must be a string directory path');
      } else {
        const s = manifest.skills;
        if (!s.startsWith("./")) {
          warnings.push('"skills" should start with "./"');
        }
        passes.push(`skills: "${s}" (directory string)`);
      }
      if (!manifest.interface || typeof manifest.interface !== "object") {
        errors.push('Missing required "interface" object (Codex uses it for displayName, shortDescription, category, etc.)');
      } else {
        const iface = manifest.interface;
        if (iface.displayName) {
          passes.push(`interface.displayName: "${iface.displayName}"`);
        } else {
          warnings.push("interface.displayName recommended");
        }
        if (iface.category) {
          passes.push(`interface.category: "${iface.category}"`);
        }
        passes.push("interface block present");
      }
      if (manifest.version !== undefined) {
        const v = String(manifest.version);
        if (!/^\d+\.\d+\.\d+/.test(v)) {
          warnings.push(`version "${v}" should look like semver for explicit versioning`);
        } else {
          passes.push(`version: "${v}"`);
        }
      } else {
        passes.push("version omitted (git commit SHA used as version key)");
      }
      if (manifest.description !== undefined) {
        const desc = String(manifest.description);
        if (desc.length < 10) {
          warnings.push(`Description is very short (${desc.length} chars) \u2014 50-200 chars recommended`);
        } else {
          passes.push("description field present");
        }
      } else {
        warnings.push('Missing "description" (recommended)');
      }
      if (manifest.keywords !== undefined) {
        if (Array.isArray(manifest.keywords)) {
          passes.push(`keywords: [${manifest.keywords.join(", ")}] \u2014 If users mention any of these keywords, your plugin will get triggered in Codex`);
        } else {
          errors.push("keywords must be an array of strings");
        }
      } else {
        warnings.push('Missing "keywords" (recommended \u2014 if users mention any of these, your plugin will get triggered in Codex)');
      }
      const skillsDir = resolve16(dir, "skills");
      if (existsSync35(skillsDir)) {
        const entries = readdirSync17(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
        for (const e of entries) {
          const md = join28(skillsDir, e.name, "SKILL.md");
          if (existsSync35(md)) {
            passes.push(`skills/${e.name}/SKILL.md exists`);
          } else {
            errors.push(`skills/${e.name}/ is missing SKILL.md`);
          }
        }
      }
      const known = new Set(["name", "version", "description", "skills", "interface", "author", "homepage", "repository", "license", "keywords"]);
      const unknown = Object.keys(manifest).filter((k) => !known.has(k));
      for (const k of unknown) {
        warnings.push(`Unrecognized field "${k}" \u2014 will be ignored (for compatibility)`);
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/codex/marketplace.ts
import { existsSync as existsSync36 } from "fs";
import { resolve as resolve17 } from "path";
var codexMarketplaceValidator;
var init_marketplace2 = __esm(() => {
  codexMarketplaceValidator = {
    id: "codex:marketplace",
    provider: "codex",
    name: "Codex Plugin Marketplace",
    description: "Validates .agents/plugins/marketplace.json (Codex convention: object source + policy blocks)",
    detect(dir) {
      if (existsSync36(resolve17(dir, ".agents", "plugins", "marketplace.json")))
        return true;
      if (existsSync36(resolve17(dir, ".agents", "plugins", "marketplace.json")))
        return true;
      return false;
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const marketplacePath = resolve17(dir, ".agents", "plugins", "marketplace.json");
      if (!existsSync36(marketplacePath)) {
        errors.push("Missing .agents/plugins/marketplace.json");
        return { errors, warnings, passes };
      }
      let marketplace;
      try {
        const raw = await Bun.file(marketplacePath).text();
        marketplace = JSON.parse(raw);
        passes.push(".agents/plugins/marketplace.json is valid JSON");
      } catch {
        errors.push(".agents/plugins/marketplace.json is missing or invalid JSON");
        return { errors, warnings, passes };
      }
      if (marketplace.name) {
        passes.push(`name: "${marketplace.name}"`);
      } else {
        warnings.push('Missing "name" at marketplace root');
      }
      if (marketplace.interface && typeof marketplace.interface === "object") {
        const iface = marketplace.interface;
        if (iface.displayName) {
          passes.push(`interface.displayName: "${iface.displayName}"`);
        }
        passes.push("interface block present");
      } else {
        warnings.push('Recommended: "interface" with displayName at marketplace root');
      }
      if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
        errors.push('"plugins" must be a non-empty array');
        return { errors, warnings, passes };
      }
      passes.push(`${marketplace.plugins.length} plugin(s) declared`);
      for (const [i, p] of marketplace.plugins.entries()) {
        if (!p || typeof p !== "object") {
          errors.push(`plugins[${i}]: must be an object`);
          continue;
        }
        if (!p.name) {
          errors.push(`plugins[${i}]: missing "name"`);
        } else {
          passes.push(`plugins[${i}].name: "${p.name}"`);
        }
        if (!p.source || typeof p.source !== "object") {
          errors.push(`plugins[${i}].source: must be an object like { "source": "local", "path": "..." }`);
        } else {
          if (p.source.source) {
            passes.push(`plugins[${i}].source.source: "${p.source.source}"`);
          } else {
            warnings.push(`plugins[${i}].source: missing "source"`);
          }
          if (p.source.path) {
            const pathStr = String(p.source.path);
            if (!pathStr.startsWith("./") && !pathStr.startsWith("../")) {
              warnings.push(`plugins[${i}].source.path: "${pathStr}" should be relative (./ or ../)`);
            }
            passes.push(`plugins[${i}].source.path: "${pathStr}"`);
          } else {
            errors.push(`plugins[${i}].source: missing "path"`);
          }
        }
        if (p.policy && typeof p.policy === "object") {
          passes.push(`plugins[${i}].policy present`);
          if (p.policy.installation) {
            passes.push(`plugins[${i}].policy.installation: "${p.policy.installation}"`);
          }
          if (p.policy.authentication) {
            passes.push(`plugins[${i}].policy.authentication: "${p.policy.authentication}"`);
          }
        } else {
          warnings.push(`plugins[${i}]: "policy" recommended (installation/authentication)`);
        }
        if (p.category) {
          passes.push(`plugins[${i}].category: "${p.category}"`);
        }
      }
      if (existsSync36(resolve17(dir, "README.md"))) {
        passes.push("README.md exists at marketplace root");
      } else {
        warnings.push("No README.md at marketplace root \u2014 recommended");
      }
      if (existsSync36(resolve17(dir, "LICENSE"))) {
        passes.push("LICENSE exists at marketplace root");
      } else {
        warnings.push("No LICENSE at marketplace root \u2014 recommended");
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/codex/mcp.ts
import { existsSync as existsSync37 } from "fs";
import { resolve as resolve18 } from "path";
var codexMcpValidator;
var init_mcp2 = __esm(() => {
  codexMcpValidator = {
    id: "codex:mcp",
    provider: "codex",
    name: "Codex MCP Config",
    description: "Validates .mcp.json (or inline via plugin.json mcpServers): server entries (stdio: command+args, or url), env, cwd, substitutions per Codex MCP support",
    detect(dir) {
      return existsSync37(resolve18(dir, ".mcp.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const mcpPath = resolve18(dir, ".mcp.json");
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
        const hasSubs = JSON.stringify(e).match(/\$\{CODEX_|CLAUDE_PLUGIN_|user_config\.|ENV_VAR\}/);
        if (hasSubs) {
          passes.push(`mcp server "${name}": uses substitutions (e.g. \${CODEX_*} or env)`);
        }
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/codex/skill.ts
import { existsSync as existsSync38 } from "fs";
import { resolve as resolve19 } from "path";
var codexSkillValidator;
var init_skill2 = __esm(() => {
  init_skill_validate();
  codexSkillValidator = {
    id: "codex:skill",
    provider: "codex",
    name: "Codex Skill",
    description: "Validates SKILL.md (shared format): frontmatter (name/description), body, supporting files, substitutions. Codex uses the same SKILL.md spec as other providers.",
    detect(dir) {
      return existsSync38(resolve19(dir, "SKILL.md"));
    },
    async validate(dir, _opts) {
      const loaded = await loadSkill(dir);
      if (!loaded.ok) {
        return {
          errors: [{ text: loaded.error }],
          warnings: [],
          passes: []
        };
      }
      const { model, existingDirs } = loaded;
      return validateSkillModel(model, { existingDirs: [...existingDirs] });
    }
  };
});

// src/validators/cursor/plugin.ts
import { existsSync as existsSync39, readdirSync as readdirSync19 } from "fs";
import { resolve as resolve20, join as join30 } from "path";
var NAME_REGEX4, cursorPluginValidator;
var init_plugin3 = __esm(() => {
  NAME_REGEX4 = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
  cursorPluginValidator = {
    id: "cursor:plugin",
    provider: "cursor",
    name: "Cursor Plugin",
    description: "Validates .cursor-plugin/plugin.json manifest (skills as directory string; mcpServers support)",
    detect(dir) {
      return existsSync39(resolve20(dir, ".cursor-plugin", "plugin.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const manifestPath = resolve20(dir, ".cursor-plugin", "plugin.json");
      let manifest;
      try {
        const raw = await Bun.file(manifestPath).text();
        manifest = JSON.parse(raw);
        passes.push(".cursor-plugin/plugin.json is valid JSON");
      } catch {
        errors.push(".cursor-plugin/plugin.json is missing or invalid JSON");
        return { errors, warnings, passes };
      }
      if (!manifest.name) {
        errors.push('Missing required field: "name"');
      } else {
        const name = String(manifest.name);
        if (!NAME_REGEX4.test(name)) {
          errors.push(`Invalid name format: "${name}" \u2014 must be kebab-case (a-z, 0-9, hyphens)`);
        } else {
          passes.push(`name: "${name}"`);
        }
      }
      if (manifest.skills === undefined) {
        errors.push('Missing required field: "skills" (must be a directory string like "./skills")');
      } else if (typeof manifest.skills !== "string") {
        errors.push('"skills" must be a string directory path');
      } else {
        const s = manifest.skills;
        if (!s.startsWith("./")) {
          warnings.push('"skills" should start with "./"');
        }
        passes.push(`skills: "${s}" (directory string)`);
      }
      if (manifest.mcpServers !== undefined) {
        if (typeof manifest.mcpServers === "string") {
          passes.push(`mcpServers: "${manifest.mcpServers}"`);
        } else {
          warnings.push('"mcpServers" should be a string path when present');
        }
      }
      if (manifest.displayName) {
        passes.push(`displayName: "${manifest.displayName}"`);
      } else {
        warnings.push("displayName recommended for Cursor UI");
      }
      if (manifest.version !== undefined) {
        const v = String(manifest.version);
        if (!/^\d+\.\d+\.\d+/.test(v)) {
          warnings.push(`version "${v}" should look like semver`);
        } else {
          passes.push(`version: "${v}"`);
        }
      } else {
        passes.push("version omitted (git commit SHA used as version key)");
      }
      if (manifest.description !== undefined) {
        const desc = String(manifest.description);
        if (desc.length < 10) {
          warnings.push(`Description is very short (${desc.length} chars) \u2014 50-200 chars recommended`);
        } else {
          passes.push("description field present");
        }
      } else {
        warnings.push('Missing "description" (recommended)');
      }
      if (manifest.author)
        passes.push("author present");
      if (manifest.license)
        passes.push(`license: "${manifest.license}"`);
      if (manifest.homepage)
        passes.push("homepage present");
      if (manifest.repository)
        passes.push("repository present");
      if (manifest.keywords !== undefined) {
        if (Array.isArray(manifest.keywords)) {
          passes.push(`keywords: [${manifest.keywords.join(", ")}] \u2014 If users mention any of these keywords, your plugin will get triggered in Cursor`);
        } else {
          errors.push("keywords must be an array of strings");
        }
      } else {
        warnings.push('Missing "keywords" (recommended \u2014 if users mention any of these, your plugin will get triggered in Cursor)');
      }
      const skillsDir = resolve20(dir, "skills");
      if (existsSync39(skillsDir)) {
        const entries = readdirSync19(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
        for (const e of entries) {
          const md = join30(skillsDir, e.name, "SKILL.md");
          if (existsSync39(md)) {
            passes.push(`skills/${e.name}/SKILL.md exists`);
          } else {
            errors.push(`skills/${e.name}/ is missing SKILL.md`);
          }
        }
      }
      if (typeof manifest.mcpServers === "string") {
        const mcpRef = manifest.mcpServers;
        if (mcpRef.startsWith("./") || mcpRef.startsWith("../")) {
          const mcpPath = resolve20(dir, mcpRef);
          if (existsSync39(mcpPath)) {
            passes.push(`mcpServers file exists at ${mcpRef}`);
          } else {
            warnings.push(`mcpServers path "${mcpRef}" does not exist on disk`);
          }
        }
      }
      const known = new Set([
        "name",
        "displayName",
        "version",
        "description",
        "author",
        "homepage",
        "repository",
        "license",
        "keywords",
        "skills",
        "mcpServers"
      ]);
      const unknown = Object.keys(manifest).filter((k) => !known.has(k));
      for (const k of unknown) {
        warnings.push(`Unrecognized field "${k}" \u2014 will be ignored (for compatibility)`);
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/cursor/marketplace.ts
import { existsSync as existsSync40, readdirSync as readdirSync20 } from "fs";
import { resolve as resolve21, join as join31 } from "path";
var cursorMarketplaceValidator;
var init_marketplace3 = __esm(() => {
  cursorMarketplaceValidator = {
    id: "cursor:marketplace",
    provider: "cursor",
    name: "Cursor Plugin Marketplace",
    description: "Validates .cursor-plugin/marketplace.json (string sources + metadata.pluginRoot)",
    detect(dir) {
      if (existsSync40(resolve21(dir, ".cursor-plugin", "marketplace.json")))
        return true;
      const pluginsDir = resolve21(dir, "plugins");
      if (!existsSync40(pluginsDir))
        return false;
      try {
        const entries = readdirSync20(pluginsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory())
            continue;
          const hasSkills = existsSync40(join31(pluginsDir, entry.name, "skills"));
          const hasManifest = existsSync40(join31(pluginsDir, entry.name, ".cursor-plugin", "plugin.json"));
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
      const cursorMktPath = resolve21(dir, ".cursor-plugin", "marketplace.json");
      const hasCursorMkt = existsSync40(cursorMktPath);
      const pluginsDir = resolve21(dir, "plugins");
      const hasPluginsDirLayout = existsSync40(pluginsDir);
      if (!hasCursorMkt && !hasPluginsDirLayout) {
        errors.push("Missing .cursor-plugin/marketplace.json or plugins/ directory");
        return { errors, warnings, passes };
      }
      if (hasCursorMkt) {
        let mkt;
        try {
          const raw = await Bun.file(cursorMktPath).text();
          mkt = JSON.parse(raw);
          passes.push(".cursor-plugin/marketplace.json is valid JSON");
        } catch {
          errors.push(".cursor-plugin/marketplace.json is missing or invalid JSON");
          return { errors, warnings, passes };
        }
        if (mkt.name) {
          passes.push(`name: "${mkt.name}"`);
        } else {
          warnings.push('Missing "name" at marketplace root');
        }
        if (mkt.metadata && typeof mkt.metadata === "object") {
          passes.push("metadata present");
          if (mkt.metadata.pluginRoot) {
            passes.push(`metadata.pluginRoot: "${mkt.metadata.pluginRoot}"`);
          }
          if (mkt.metadata.description) {
            passes.push("metadata.description present");
          }
        } else {
          warnings.push('Recommended: "metadata" with pluginRoot and description');
        }
        if (mkt.owner) {
          passes.push("owner present");
        }
        if (!Array.isArray(mkt.plugins) || mkt.plugins.length === 0) {
          errors.push('"plugins" must be a non-empty array');
          return { errors, warnings, passes };
        }
        passes.push(`${mkt.plugins.length} plugin(s) declared`);
        const pluginRoot = mkt.metadata && mkt.metadata.pluginRoot ? String(mkt.metadata.pluginRoot) : ".";
        for (const [i, p] of mkt.plugins.entries()) {
          if (!p || typeof p !== "object") {
            errors.push(`plugins[${i}]: must be an object`);
            continue;
          }
          if (p.name) {
            passes.push(`plugins[${i}].name: "${p.name}"`);
          } else {
            errors.push(`plugins[${i}]: missing "name"`);
          }
          if (p.source !== undefined) {
            const src = String(p.source);
            passes.push(`plugins[${i}].source: "${src}"`);
            const srcDir = resolve21(dir, pluginRoot, src);
            if (existsSync40(srcDir)) {
              const hasManifest = existsSync40(resolve21(srcDir, ".cursor-plugin", "plugin.json"));
              const hasSkills = existsSync40(resolve21(srcDir, "skills"));
              if (hasManifest || hasSkills) {
                passes.push(`plugins[${i}]: source exists (${hasManifest ? "manifest" : "skills/"})`);
              } else {
                warnings.push(`plugins[${i}].source "${src}" exists but lacks plugin markers`);
              }
            } else {
              warnings.push(`plugins[${i}].source path "${src}" (under ${pluginRoot}) does not exist`);
            }
          } else {
            const implicitSrc = resolve21(dir, pluginRoot, p.name || "");
            if (p.name && existsSync40(implicitSrc)) {
              passes.push(`plugins[${i}]: implicit source via name under ${pluginRoot}`);
            } else {
              warnings.push(`plugins[${i}]: missing "source" (and no implicit dir)`);
            }
          }
          if (p.description)
            passes.push(`plugins[${i}].description present`);
          if (p.category) {
            passes.push(`plugins[${i}].category: "${p.category}"`);
          }
          if (p.homepage) {
            passes.push(`plugins[${i}].homepage present`);
          }
        }
        if (existsSync40(resolve21(dir, "README.md"))) {
          passes.push("README.md exists at marketplace root");
        } else {
          warnings.push("No README.md at marketplace root \u2014 recommended for discoverability");
        }
        if (existsSync40(resolve21(dir, "LICENSE"))) {
          passes.push("LICENSE exists at marketplace root");
        } else {
          warnings.push("No LICENSE at marketplace root \u2014 recommended");
        }
        return { errors, warnings, passes };
      }
      if (hasPluginsDirLayout) {
        passes.push("plugins/ directory exists");
        const pluginEntries = readdirSync20(pluginsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
        if (pluginEntries.length === 0) {
          errors.push("plugins/ directory is empty \u2014 expected at least one plugin");
          return { errors, warnings, passes };
        }
        passes.push(`${pluginEntries.length} plugin(s) found`);
        if (existsSync40(resolve21(dir, "README.md"))) {
          passes.push("README.md exists at marketplace root");
        } else {
          warnings.push("No README.md at marketplace root \u2014 recommended");
        }
        for (const plugin of pluginEntries) {
          const pluginPath = join31(pluginsDir, plugin.name);
          const hasSkills = existsSync40(join31(pluginPath, "skills"));
          const hasManifest = existsSync40(join31(pluginPath, ".cursor-plugin", "plugin.json"));
          if (hasManifest || hasSkills) {
            passes.push(`Plugin "${plugin.name}" has ${hasManifest ? "manifest" : "skills/"}`);
          }
        }
        return { errors, warnings, passes };
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/cursor/mcp.ts
import { existsSync as existsSync41 } from "fs";
import { resolve as resolve22 } from "path";
var cursorMcpValidator;
var init_mcp3 = __esm(() => {
  cursorMcpValidator = {
    id: "cursor:mcp",
    provider: "cursor",
    name: "Cursor MCP Config",
    description: "Validates mcp.json (Cursor uses no leading dot; supports mcpServers wrapper or direct server map)",
    detect(dir) {
      return existsSync41(resolve22(dir, "mcp.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const mcpPath = resolve22(dir, "mcp.json");
      let rawConfig;
      try {
        const raw = await Bun.file(mcpPath).text();
        rawConfig = JSON.parse(raw);
        passes.push("mcp.json is valid JSON");
      } catch {
        errors.push("mcp.json is missing or invalid JSON");
        return { errors, warnings, passes };
      }
      let config;
      if (rawConfig && typeof rawConfig === "object" && !Array.isArray(rawConfig) && rawConfig.mcpServers && typeof rawConfig.mcpServers === "object") {
        config = rawConfig.mcpServers;
        passes.push("mcp.json uses mcpServers wrapper (normalized)");
      } else if (typeof rawConfig === "object" && !Array.isArray(rawConfig)) {
        config = rawConfig;
      } else {
        errors.push("mcp.json must be an object (or contain mcpServers object)");
        return { errors, warnings, passes };
      }
      const serverNames = Object.keys(config);
      if (serverNames.length === 0) {
        warnings.push("mcp.json is empty \u2014 no servers defined");
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
        const hasSubs = JSON.stringify(e).match(/\$\{CODEX_|CLAUDE_PLUGIN_|CURSOR_|user_config\.|ENV_VAR\}/);
        if (hasSubs) {
          passes.push(`mcp server "${name}": uses substitutions`);
        }
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/cursor/skill.ts
import { existsSync as existsSync42 } from "fs";
import { resolve as resolve23 } from "path";
var cursorSkillValidator;
var init_skill3 = __esm(() => {
  init_skill_validate();
  cursorSkillValidator = {
    id: "cursor:skill",
    provider: "cursor",
    name: "Cursor Skill",
    description: "Validates SKILL.md (shared format): frontmatter (name/description), body, supporting files, substitutions. Cursor uses the same SKILL.md spec as other providers.",
    detect(dir) {
      return existsSync42(resolve23(dir, "SKILL.md"));
    },
    async validate(dir, _opts) {
      const loaded = await loadSkill(dir);
      if (!loaded.ok) {
        return {
          errors: [{ text: loaded.error }],
          warnings: [],
          passes: []
        };
      }
      const { model, existingDirs } = loaded;
      return validateSkillModel(model, { existingDirs: [...existingDirs] });
    }
  };
});

// src/validators/copilot/plugin.ts
import { existsSync as existsSync43 } from "fs";
import { resolve as resolve24 } from "path";
var NAME_REGEX5, copilotPluginValidator;
var init_plugin4 = __esm(() => {
  NAME_REGEX5 = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
  copilotPluginValidator = {
    id: "copilot:plugin",
    provider: "copilot",
    name: "Copilot Plugin",
    description: "Validates .github/plugin/plugin.json (skills as array of paths, mcpServers support)",
    detect(dir) {
      return existsSync43(resolve24(dir, ".github", "plugin", "plugin.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const manifestPath = resolve24(dir, ".github", "plugin", "plugin.json");
      let manifest;
      try {
        const raw = await Bun.file(manifestPath).text();
        manifest = JSON.parse(raw);
        passes.push(".github/plugin/plugin.json is valid JSON");
      } catch {
        errors.push(".github/plugin/plugin.json is missing or invalid JSON");
        return { errors, warnings, passes };
      }
      if (!manifest.name) {
        errors.push('Missing required field: "name"');
      } else {
        const name = String(manifest.name);
        if (!NAME_REGEX5.test(name)) {
          errors.push(`Invalid name format: "${name}" \u2014 must be kebab-case (a-z, 0-9, hyphens)`);
        } else {
          passes.push(`name: "${name}"`);
        }
      }
      if (manifest.skills === undefined) {
        errors.push('Missing required field: "skills" (must be an array of paths like ["./skills/foo"])');
      } else if (!Array.isArray(manifest.skills)) {
        errors.push('"skills" must be an array of relative paths');
      } else {
        const skillsArr = manifest.skills;
        passes.push(`skills: array with ${skillsArr.length} path(s)`);
        for (const [i, p] of skillsArr.entries()) {
          if (typeof p !== "string") {
            errors.push(`skills[${i}]: must be a string path`);
            continue;
          }
          if (!p.startsWith("./") && !p.startsWith("../")) {
            warnings.push(`skills[${i}]: "${p}" should be relative (./ or ../)`);
          }
          const skillDir = resolve24(dir, p);
          const skillMd = resolve24(skillDir, "SKILL.md");
          if (existsSync43(skillMd)) {
            passes.push(`skills[${i}]: ${p}/SKILL.md exists`);
          } else if (existsSync43(skillDir)) {
            warnings.push(`skills[${i}]: directory exists but no SKILL.md inside`);
          } else {
            warnings.push(`skills[${i}]: path "${p}" does not exist`);
          }
        }
      }
      if (manifest.mcpServers !== undefined) {
        if (typeof manifest.mcpServers === "string") {
          passes.push(`mcpServers: "${manifest.mcpServers}"`);
          const mcpRef = String(manifest.mcpServers);
          const mcpPath = resolve24(dir, mcpRef);
          if (existsSync43(mcpPath)) {
            passes.push(`mcpServers file exists at ${mcpRef}`);
          } else {
            warnings.push(`mcpServers path "${mcpRef}" does not exist on disk`);
          }
        } else {
          warnings.push('"mcpServers" should be a string path when present');
        }
      }
      if (manifest.description) {
        const desc = String(manifest.description);
        if (desc.length < 10) {
          warnings.push(`Description is very short (${desc.length} chars)`);
        } else {
          passes.push("description field present");
        }
      } else {
        warnings.push('Missing "description" (recommended)');
      }
      if (manifest.version)
        passes.push(`version: "${manifest.version}"`);
      if (manifest.author)
        passes.push("author present");
      if (manifest.license)
        passes.push(`license: "${manifest.license}"`);
      if (manifest.homepage)
        passes.push("homepage present");
      if (manifest.repository)
        passes.push("repository present");
      if (manifest.keywords !== undefined) {
        if (Array.isArray(manifest.keywords)) {
          passes.push(`keywords: [${manifest.keywords.join(", ")}] \u2014 If users mention any of these keywords, your plugin will get triggered in Copilot CLI`);
        } else {
          errors.push("keywords must be an array of strings");
        }
      } else {
        warnings.push('Missing "keywords" (recommended \u2014 if users mention any of these, your plugin will get triggered in Copilot CLI)');
      }
      const known = new Set([
        "name",
        "version",
        "description",
        "author",
        "homepage",
        "repository",
        "license",
        "keywords",
        "skills",
        "mcpServers"
      ]);
      const unknown = Object.keys(manifest).filter((k) => !known.has(k));
      for (const k of unknown) {
        warnings.push(`Unrecognized field "${k}" \u2014 will be ignored (for compatibility)`);
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/copilot/marketplace.ts
import { existsSync as existsSync44 } from "fs";
import { resolve as resolve25 } from "path";
var copilotMarketplaceValidator;
var init_marketplace4 = __esm(() => {
  copilotMarketplaceValidator = {
    id: "copilot:marketplace",
    provider: "copilot",
    name: "Copilot Plugin Marketplace",
    description: "Validates .github/plugin/marketplace.json (string sources)",
    detect(dir) {
      return existsSync44(resolve25(dir, ".github", "plugin", "marketplace.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const mktPath = resolve25(dir, ".github", "plugin", "marketplace.json");
      let mkt;
      try {
        const raw = await Bun.file(mktPath).text();
        mkt = JSON.parse(raw);
        passes.push(".github/plugin/marketplace.json is valid JSON");
      } catch {
        errors.push(".github/plugin/marketplace.json is missing or invalid JSON");
        return { errors, warnings, passes };
      }
      if (mkt.name) {
        passes.push(`name: "${mkt.name}"`);
      } else {
        warnings.push('Missing "name" at marketplace root');
      }
      if (mkt.metadata && typeof mkt.metadata === "object") {
        passes.push("metadata present");
        if (mkt.metadata.description)
          passes.push("metadata.description present");
        if (mkt.metadata.version)
          passes.push(`metadata.version: "${mkt.metadata.version}"`);
      }
      if (mkt.owner) {
        passes.push("owner present");
      }
      if (!Array.isArray(mkt.plugins) || mkt.plugins.length === 0) {
        errors.push('"plugins" must be a non-empty array');
        return { errors, warnings, passes };
      }
      passes.push(`${mkt.plugins.length} plugin(s) declared`);
      for (const [i, p] of mkt.plugins.entries()) {
        if (!p || typeof p !== "object") {
          errors.push(`plugins[${i}]: must be an object`);
          continue;
        }
        if (p.name) {
          passes.push(`plugins[${i}].name: "${p.name}"`);
        } else {
          errors.push(`plugins[${i}]: missing "name"`);
        }
        if (p.source) {
          const src = String(p.source);
          passes.push(`plugins[${i}].source: "${src}"`);
          const srcDir = resolve25(dir, src);
          if (existsSync44(srcDir)) {
            const hasManifest = existsSync44(resolve25(srcDir, ".github", "plugin", "plugin.json"));
            const hasSkills = existsSync44(resolve25(srcDir, "skills"));
            if (hasManifest || hasSkills) {
              passes.push(`plugins[${i}]: source exists (${hasManifest ? "manifest" : "skills/"})`);
            } else {
              warnings.push(`plugins[${i}].source "${src}" exists but lacks plugin markers`);
            }
          } else {
            warnings.push(`plugins[${i}].source path "${src}" does not exist`);
          }
        } else {
          warnings.push(`plugins[${i}]: missing "source"`);
        }
        if (p.description)
          passes.push(`plugins[${i}].description present`);
        if (p.version)
          passes.push(`plugins[${i}].version: "${p.version}"`);
      }
      if (existsSync44(resolve25(dir, "README.md"))) {
        passes.push("README.md exists at marketplace root");
      } else {
        warnings.push("No README.md at marketplace root \u2014 recommended");
      }
      if (existsSync44(resolve25(dir, "LICENSE"))) {
        passes.push("LICENSE exists at marketplace root");
      } else {
        warnings.push("No LICENSE at marketplace root \u2014 recommended");
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/copilot/mcp.ts
import { existsSync as existsSync45 } from "fs";
import { resolve as resolve26 } from "path";
var copilotMcpValidator;
var init_mcp4 = __esm(() => {
  copilotMcpValidator = {
    id: "copilot:mcp",
    provider: "copilot",
    name: "Copilot MCP Config",
    description: "Validates .mcp.json (referenced via mcpServers in manifest). Supports stdio and http servers.",
    detect(dir) {
      return existsSync45(resolve26(dir, ".mcp.json"));
    },
    async validate(dir, _opts) {
      const errors = [];
      const warnings = [];
      const passes = [];
      const mcpPath = resolve26(dir, ".mcp.json");
      let rawConfig;
      try {
        const raw = await Bun.file(mcpPath).text();
        rawConfig = JSON.parse(raw);
        passes.push(".mcp.json is valid JSON");
      } catch {
        errors.push(".mcp.json is missing or invalid JSON");
        return { errors, warnings, passes };
      }
      let config;
      if (rawConfig && typeof rawConfig === "object" && !Array.isArray(rawConfig) && rawConfig.mcpServers && typeof rawConfig.mcpServers === "object") {
        config = rawConfig.mcpServers;
        passes.push("mcp.json uses mcpServers wrapper (normalized)");
      } else if (typeof rawConfig === "object" && !Array.isArray(rawConfig)) {
        config = rawConfig;
      } else {
        errors.push(".mcp.json must be an object (or contain mcpServers object)");
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
        const hasSubs = JSON.stringify(e).match(/\$\{CODEX_|CLAUDE_PLUGIN_|COPILOT_|PLUGIN_ROOT|user_config\.|ENV_VAR\}/);
        if (hasSubs) {
          passes.push(`mcp server "${name}": uses substitutions (e.g. \${PLUGIN_ROOT} or env)`);
        }
      }
      return { errors, warnings, passes };
    }
  };
});

// src/validators/copilot/skill.ts
import { existsSync as existsSync46 } from "fs";
import { resolve as resolve27 } from "path";
var copilotSkillValidator;
var init_skill4 = __esm(() => {
  init_skill_validate();
  copilotSkillValidator = {
    id: "copilot:skill",
    provider: "copilot",
    name: "Copilot Skill",
    description: "Validates SKILL.md (shared format). Copilot supports skills referenced via array paths in the manifest.",
    detect(dir) {
      return existsSync46(resolve27(dir, "SKILL.md"));
    },
    async validate(dir, _opts) {
      const loaded = await loadSkill(dir);
      if (!loaded.ok) {
        return {
          errors: [{ text: loaded.error }],
          warnings: [],
          passes: []
        };
      }
      const { model, existingDirs } = loaded;
      return validateSkillModel(model, { existingDirs: [...existingDirs] });
    }
  };
});

// src/providers/index.ts
var claudeAdapter, codexAdapter, cursorAdapter, copilotAdapter, grokAdapter2, adapters;
var init_providers = __esm(() => {
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
  init_plugin2();
  init_marketplace2();
  init_mcp2();
  init_skill2();
  init_plugin3();
  init_marketplace3();
  init_mcp3();
  init_skill3();
  init_plugin4();
  init_marketplace4();
  init_mcp4();
  init_skill4();
  init_spec();
  claudeAdapter = {
    id: "claude",
    name: "Claude Code",
    manifestPath: ".claude-plugin/plugin.json",
    marketplacePath: ".claude-plugin/marketplace.json",
    mcpFilename: ".mcp.json",
    validators: [
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
    ],
    detectContext(dir) {
      return { cwd: dir };
    },
    async scaffold(decision, ctx) {
      throw new Error("Scaffold via adapter not yet implemented");
    }
  };
  codexAdapter = {
    id: "codex",
    name: "Codex",
    manifestPath: ".codex-plugin/plugin.json",
    marketplacePath: ".agents/plugins/marketplace.json",
    mcpFilename: ".mcp.json",
    validators: [
      codexPluginValidator,
      codexMarketplaceValidator,
      codexMcpValidator,
      codexSkillValidator
    ],
    detectContext(dir) {
      return { cwd: dir };
    },
    async scaffold(decision, ctx) {
      throw new Error("Scaffold via adapter not yet implemented");
    }
  };
  cursorAdapter = {
    id: "cursor",
    name: "Cursor",
    manifestPath: ".cursor-plugin/plugin.json",
    marketplacePath: ".cursor-plugin/marketplace.json",
    mcpFilename: "mcp.json",
    validators: [
      cursorPluginValidator,
      cursorMarketplaceValidator,
      cursorMcpValidator,
      cursorSkillValidator
    ],
    detectContext(dir) {
      return { cwd: dir };
    },
    async scaffold(decision, ctx) {
      throw new Error("Scaffold via adapter not yet implemented");
    }
  };
  copilotAdapter = {
    id: "copilot",
    name: "Copilot CLI",
    manifestPath: ".github/plugin/plugin.json",
    marketplacePath: ".github/plugin/marketplace.json",
    mcpFilename: ".mcp.json",
    validators: [
      copilotPluginValidator,
      copilotMarketplaceValidator,
      copilotMcpValidator,
      copilotSkillValidator
    ],
    detectContext(dir) {
      return { cwd: dir };
    },
    async scaffold(decision, ctx) {
      throw new Error("Scaffold via adapter not yet implemented");
    }
  };
  grokAdapter2 = {
    id: "grok",
    name: "Grok",
    manifestPath: ".grok-plugin/plugin.json",
    marketplacePath: ".grok-plugin/marketplace.json",
    mcpFilename: ".mcp.json",
    validators: [],
    detectContext(dir) {
      return { cwd: dir };
    },
    async scaffold(decision, ctx) {
      throw new Error("Scaffold via adapter not yet implemented for grok");
    }
  };
  adapters = [claudeAdapter, codexAdapter, cursorAdapter, copilotAdapter, grokAdapter2];
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
    const knownProviders = [...new Set([
      ...allValidators.map((v) => v.provider),
      ...supportedProviders
    ])];
    if (!knownProviders.includes(forFlag)) {
      return { matched: [], error: `Unknown provider: "${forFlag}"

Available providers: ${knownProviders.join(", ")}` };
    }
    return { matched: [] };
  }
  return { matched: byProvider };
}
var validators;
var init_validators = __esm(() => {
  init_providers();
  init_spec();
  validators = adapters.flatMap((a) => a.validators);
});

// src/core/remote.ts
import { spawnSync as spawnSync5 } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { join as join33 } from "path";
import { tmpdir } from "os";
function sanitizeSubpath(subpath) {
  if (!subpath)
    return null;
  if (subpath.startsWith("/") || subpath.startsWith("~"))
    return null;
  const parts = subpath.split("/").filter(Boolean);
  if (parts.some((p) => p === ".." || p.startsWith("..")))
    return null;
  const safe = parts.join("/");
  if (!safe)
    return null;
  return safe;
}
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
      subpath: sanitizeSubpath(subpath) ?? undefined
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
  try {
    const result = spawnSync5("gh", ["auth", "status"], {
      stdio: "pipe",
      timeout: 5000
    });
    if (result.error) {
      ghAvailable = false;
      return false;
    }
    ghAvailable = result.status === 0;
    return ghAvailable;
  } catch {
    ghAvailable = false;
    return false;
  }
}
function hasGitCli() {
  if (gitAvailable !== null)
    return gitAvailable;
  try {
    const result = spawnSync5("git", ["--version"], {
      stdio: "pipe",
      timeout: 5000
    });
    if (result.error) {
      gitAvailable = false;
      return false;
    }
    gitAvailable = result.status === 0;
    return gitAvailable;
  } catch {
    gitAvailable = false;
    return false;
  }
}
async function cloneToTemp(parsed) {
  const tmpDir = mkdtempSync(join33(tmpdir(), "dora-"));
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
    const gh = spawnSync5("gh", ghArgs, { stdio: "pipe", timeout: 60000 });
    if (gh.status === 0) {
      return { dir: tmpDir, cleanup: wrappedCleanup };
    }
  }
  if (!hasGitCli()) {
    wrappedCleanup();
    throw new Error("git is not installed. Install git to clone remote repositories for validation.");
  }
  const gitArgs = ["clone", "--depth", "1"];
  if (parsed.ref)
    gitArgs.push("--branch", parsed.ref);
  gitArgs.push(parsed.gitUrl, tmpDir);
  const git = spawnSync5("git", gitArgs, { stdio: "pipe", timeout: 60000 });
  if (git.status !== 0 || git.error) {
    wrappedCleanup();
    if (git.error && /ENOENT|not found/i.test(String(git.error))) {
      throw new Error("git is not installed. Install git to clone remote repositories for validation.");
    }
    const stderr = git.stderr?.toString().trim() || git.error?.message || "unknown error";
    throw new Error(`Failed to clone ${parsed.original}: ${stderr}`);
  }
  return { dir: tmpDir, cleanup: wrappedCleanup };
}
var GITHUB_RE, GENERIC_GIT_RE, ghAvailable = null, gitAvailable = null;
var init_remote = __esm(() => {
  GITHUB_RE = /^(?:https?:\/\/)?github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/]+)(?:\/(.+))?)?$/;
  GENERIC_GIT_RE = /^https?:\/\/[^/]+\/[^/]+\/[^/]+/;
});

// src/cli/commands/validate-top.ts
var exports_validate_top = {};
__export(exports_validate_top, {
  default: () => validate_top_default
});
import { existsSync as existsSync48 } from "fs";
import { resolve as resolve28 } from "path";
var import_picocolors18, validate_top_default;
var init_validate_top = __esm(() => {
  init_dist();
  init_out();
  init_validators();
  init_remote();
  import_picocolors18 = __toESM(require_picocolors(), 1);
  validate_top_default = defineCommand({
    meta: {
      name: "validate",
      description: "Auto-detect project type and run matching validators. Accepts a local path or a Git URL (e.g. https://github.com/owner/repo). Use --for <provider>:plugin to see keyword trigger messages."
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
        if (!hasGitCli()) {
          guidedError({
            context: "Remote validate clones a git repo (or uses gh) so it can inspect its skills, plugins, etc. without you checking it out.",
            problem: "git is not installed",
            solutions: [
              "Install git (macOS: brew install git)",
              "Validate a local checkout instead: dora validate ."
            ],
            next: "dora validate ."
          });
          process.exit(1);
        }
        ui.info(`
  Cloning ${import_picocolors18.default.dim(args.path)}...`);
        try {
          const result = await cloneToTemp(remote);
          cleanup = result.cleanup;
          if (remote.subpath) {
            const safe = sanitizeSubpath(remote.subpath);
            if (!safe) {
              if (cleanup)
                cleanup();
              ui.fail(`Invalid subdirectory in remote URL: ${remote.subpath}`);
              process.exit(1);
            }
            fullPath = resolve28(result.dir, safe);
          } else {
            fullPath = result.dir;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ui.fail(msg);
          process.exit(1);
        }
        if (!existsSync48(fullPath)) {
          cleanup();
          ui.fail(`Error (E-VAL-001): Subdirectory not found in repo: ${remote.subpath}`);
          nextAction2("dora validate <valid-path-or-url>");
          process.exit(1);
        }
      } else {
        fullPath = resolve28(args.path);
        if (!existsSync48(fullPath)) {
          ui.fail(`Error (E-VAL-001): Path not found: ${args.path}`);
          ui.info("  Check that the path is correct and the directory exists.");
          nextAction2("dora validate .");
          process.exit(1);
        }
      }
      try {
        const opts = {
          format: args.format ?? "table",
          verbose: !!args.verbose,
          ci: !!args.ci
        };
        const { matched: candidates, error: error2 } = resolveFor(args.for);
        if (error2) {
          ui.fail(error2);
          nextAction2("dora validate . --for claude   (or another provider)");
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
          guidedError({
            context: `dora validate auto-detects skills, plugins, hooks, etc. based on files present. Nothing matched ${args.path}.`,
            problem: "No validator matched this directory",
            solutions: [
              `dora validate . --for <provider>   (e.g. claude, cursor)`,
              "dora providers   (see all supported + keywords)"
            ],
            next: "dora validate . --for claude"
          });
          ui.info(`  Available providers:
` + providers.map((p) => {
            const pvs = validators.filter((v) => v.provider === p);
            return `    ${import_picocolors18.default.bold(p)}
` + pvs.map((v) => `      \u2022 ${import_picocolors18.default.dim(v.id)} \u2014 ${v.description}`).join(`
`);
          }).join(`
`));
          process.exit(1);
        }
        const allResults = [];
        let totalErrors = 0;
        let totalWarnings = 0;
        for (const v of matched) {
          const result = await v.validate(fullPath, opts);
          allResults.push({ id: v.id, name: v.name, result });
          totalErrors += result.errors.length;
          totalWarnings += result.warnings.length;
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
          renderValidationReport(allResults, { path: args.path, verbose: !!args.verbose });
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
import { basename as basename7, join as join34 } from "path";
var {spawnSync: spawnSync6 } = globalThis.Bun;
var import_picocolors19, init_default2;
var init_init2 = __esm(() => {
  init_dist();
  init_out();
  init_journal_config();
  init_journal_remote();
  init_prompt();
  import_picocolors19 = __toESM(require_picocolors(), 1);
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
      ui.write(`  ${import_picocolors19.default.bold(import_picocolors19.default.white("Step 1: Journal setup"))}
`);
      const ghCheck = ensureGhCli();
      if (!ghCheck.ok) {
        ui.write(`  ${import_picocolors19.default.red("\u2717")} ${import_picocolors19.default.white("The GitHub CLI (")}${import_picocolors19.default.bold("gh")}${import_picocolors19.default.white(") is not installed.")}
`);
        ui.info(`  doraval uses ${import_picocolors19.default.bold("gh")} to fetch and sync journal files with GitHub.
`);
        ui.info(`  Install it:
`);
        ui.info(`    macOS:   ${import_picocolors19.default.dim("brew install gh")}`);
        ui.info(`    Linux:   ${import_picocolors19.default.dim("https://github.com/cli/cli/blob/trunk/docs/install_linux.md")}`);
        ui.info(`    Windows: ${import_picocolors19.default.dim("winget install --id GitHub.cli")}
`);
        ui.info(`  Then authenticate: ${import_picocolors19.default.dim("gh auth login")}
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
            sourceNote = `  ${import_picocolors19.default.dim("(from git remote; your active gh account is " + ghLogin + ")")}
`;
          } else {
            sourceNote = `  ${import_picocolors19.default.dim("(from git remote)")}
`;
          }
        } else if (ghLogin) {
          defaultRepo = `${ghLogin}/${ghLogin}.md`;
          sourceNote = `  ${import_picocolors19.default.dim("(from your active gh account)")}
`;
        } else {
          ui.warn(`Not logged in to GitHub. Run ${import_picocolors19.default.dim("gh auth login")} first.
`);
          process.exit(1);
        }
        const existingConfig = await readConfig();
        if (existingConfig?.journal.repo) {
          defaultRepo = existingConfig.journal.repo;
          sourceNote = `  ${import_picocolors19.default.dim("(from your previous journal setup)")}
`;
        }
        ui.info(`  Journal repo ${import_picocolors19.default.dim("(owner/name)")}`);
        if (sourceNote)
          ui.write(sourceNote);
        repo = prompt("  >", defaultRepo);
      }
      let project = args.project || process.env.DORAVAL_PROJECT;
      if (!project) {
        const defaultProject = basename7(process.cwd());
        project = prompt("  Project name", defaultProject);
      }
      project = sanitizeProjectName(project);
      if (!repoExists(repo)) {
        ui.write(`  ${import_picocolors19.default.red("\u2717")} ${import_picocolors19.default.white("Repository")} ${import_picocolors19.default.bold(repo)} ${import_picocolors19.default.white("not found on GitHub.")}
`);
        ui.info(`  Create it first:
`);
        ui.info(`    ${import_picocolors19.default.dim(`gh repo create ${repo} --private --description "Personal journal for agent decisions"`)}
`);
        process.exit(1);
      }
      const existing = await readConfig();
      const alreadyRegistered = existing?.journal.projects[project];
      const isRefresh = alreadyRegistered && args.refresh;
      if (alreadyRegistered && !isRefresh) {
        ui.write(`  ${import_picocolors19.default.yellow("\u26A0")} ${import_picocolors19.default.white("Project")} ${import_picocolors19.default.bold(project)} ${import_picocolors19.default.white("is already registered.")}
`);
        ui.info(`  Repo:   ${existing.journal.repo}
`);
        ui.info(`  To refresh journal files, use ${import_picocolors19.default.dim("dora journal update")} (or ${import_picocolors19.default.dim("dora init --refresh")}).
`);
      }
      const journalsDir = getJournalsDir();
      const remotePath = `projects/${project}.md`;
      const localPath = join34(journalsDir, `${project}.md`);
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
      ui.write(`  ${import_picocolors19.default.dim(import_picocolors19.default.gray("Fetching journal files from"))} ${import_picocolors19.default.gray(effectiveRepo)}${import_picocolors19.default.dim(import_picocolors19.default.gray("..."))}
`);
      const globalDest = join34(journalsDir, "global.md");
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
        ui.write(`  ${import_picocolors19.default.dim("\xB7")} global.md ${import_picocolors19.default.dim("(not found \u2014 will be created on first sync)")}`);
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
        ui.write(`  ${import_picocolors19.default.dim("\xB7")} ${remotePath} ${import_picocolors19.default.dim("(not found \u2014 will be created on first sync)")}`);
        await Bun.write(localPath, `# ${project} Journal

Project-specific decisions.
`);
      }
      await writeConfig(config);
      ui.write(`
  ${import_picocolors19.default.green("\u2713")} ${import_picocolors19.default.white("Journal ready for project")} ${import_picocolors19.default.bold(import_picocolors19.default.white(project))}.
`);
      const existingAgent = (await readConfig())?.agent;
      if (existingAgent?.command) {
        ui.write(`  ${import_picocolors19.default.bold(import_picocolors19.default.white("Coding agent (already configured)"))}
`);
        ui.write(`    Current: ${import_picocolors19.default.dim(import_picocolors19.default.gray(existingAgent.command))}  template: ${import_picocolors19.default.dim(import_picocolors19.default.gray(existingAgent.prompt_template || "(default)"))}  cwd_flag: ${import_picocolors19.default.dim(import_picocolors19.default.gray(existingAgent.cwd_flag || "(none)"))}
`);
        const change = prompt("  Reconfigure / change the coding agent for on-the-fly enrichment? (y/N)", "n");
        if (!/^y/i.test(String(change))) {
          ui.dim(`  Keeping existing agent config. You can re-run dora init later to change it.
`);
          const cfg = await readConfig() || { journal: { repo: effectiveRepo, projects: {} } };
          if (existingAgent)
            cfg.agent = existingAgent;
          await writeConfig(cfg);
          ui.write(`  ${import_picocolors19.default.green("\u2713")} ${import_picocolors19.default.white("Try:")} ${import_picocolors19.default.dim(import_picocolors19.default.gray('dora journal add "short decision"'))}
`);
          process.exit(0);
          return;
        }
        ui.blank();
      } else {
        ui.write(`
  ${import_picocolors19.default.bold(import_picocolors19.default.white("Step 2: Coding agent for journal add"))}
`);
        ui.info(`  When configured, ${import_picocolors19.default.dim(import_picocolors19.default.gray('dora journal add ".."'))} will use your agent to enrich entries with tags and rationale automatically.
`);
      }
      const common = [
        { name: "claude", template: '-p "{{prompt}}" --output-format json --bare', cwd_flag: "" },
        { name: "grok", template: '-p "{{prompt}}" --no-auto-update --no-alt-screen --always-approve', cwd_flag: "--cwd" },
        { name: "cursor", template: "", cwd_flag: "" }
      ];
      let detected = "";
      for (const c of common) {
        let probe = spawnSync6(["command", "-v", c.name], { stdout: "pipe", stderr: "pipe" });
        if (probe.exitCode !== 0) {
          probe = spawnSync6(["which", c.name], { stdout: "pipe", stderr: "pipe" });
        }
        if (probe.exitCode === 0) {
          detected = c.name;
          break;
        }
      }
      let agentCmd = detected || "claude";
      ui.write(`  Detected / default agent command: ${import_picocolors19.default.dim(import_picocolors19.default.gray(agentCmd))}`);
      agentCmd = prompt("  Agent command (the binary you run for prompts)", agentCmd);
      let template = detected ? common.find((c) => c.name === detected)?.template || '-p "{{prompt}}"' : '-p "{{prompt}}"';
      ui.info(`  Prompt template (use {{prompt}} placeholder):`);
      template = prompt("  ", template);
      const detectedCommon = common.find((c) => c.name === detected);
      let cwdFlag = detectedCommon?.cwd_flag ?? "";
      if (detected) {
        ui.info(`  Cwd flag (flag your agent uses to set working directory/repo, e.g. --cwd or -C; blank = rely on process cwd only):`);
        cwdFlag = prompt("  ", cwdFlag);
      }
      const finalConfig = await readConfig() || { journal: { repo: effectiveRepo, projects: {} } };
      finalConfig.agent = {
        command: agentCmd,
        prompt_template: template,
        ...cwdFlag ? { cwd_flag: cwdFlag } : {}
      };
      await writeConfig(finalConfig);
      ui.write(`
  ${import_picocolors19.default.green("\u2713")} ${import_picocolors19.default.white("Agent configured.")}
`);
      ui.info(`  Re-run ${import_picocolors19.default.dim(import_picocolors19.default.gray("dora init"))} anytime to change it.
`);
      ui.write(`
  ${import_picocolors19.default.bold("Step 3: Eval configuration (doraval eval)")}
`);
      const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.ZHIPU_API_KEY || process.env.GLM_API_KEY);
      if (hasApiKey) {
        ui.success("API key found \u2014 doraval eval can call models directly (no proxy server needed). GLM works great for cheap dev evals.");
      } else {
        guidedError({
          context: "doraval eval can judge using your agent CLI (always works) or call an LLM API directly (faster, cheaper, no local agent needed for judging).",
          problem: "No API key detected for direct eval judging",
          solutions: [
            "Set OPENAI_API_KEY or ZAI_API_KEY (or ANTHROPIC_*) and choose a model below",
            "Skip \u2014 eval will fall back to your configured agent CLI"
          ]
        });
      }
      const evalModelAnswer = await prompt(`  Which model should doraval eval use? ${import_picocolors19.default.dim("(e.g. glm-4, gpt-4o-mini, claude-3-5-sonnet-20241022)")} `, "");
      if (evalModelAnswer.trim()) {
        const updatedConfig2 = await readConfig();
        if (updatedConfig2) {
          updatedConfig2.eval = {
            model: evalModelAnswer.trim(),
            max_tool_calls: 200,
            save_history: true
          };
          await writeConfig(updatedConfig2);
          ui.success(`eval.model set to ${evalModelAnswer.trim()}`);
        }
      } else {
        ui.info("  Skipped. You can set later with: dora config set eval.model <model>");
        ui.info("  Eval will still work via your agent CLI.");
      }
      ui.info(`  Next: ${import_picocolors19.default.dim(import_picocolors19.default.gray('dora journal add ".."'))}, ${import_picocolors19.default.dim(import_picocolors19.default.gray("dora journal list"))}, or ${import_picocolors19.default.dim(import_picocolors19.default.gray("dora journal update"))}.
`);
      process.exit(0);
    }
  });
});

// src/core/update.ts
import { resolve as resolve29 } from "path";
import { homedir as homedir5 } from "os";
function normalizePath(p) {
  return p.replace(/\\/g, "/").replace(/\/+$/, "");
}
function isInside(child, parent) {
  const c = normalizePath(child);
  const p = normalizePath(parent);
  return c === p || c.startsWith(`${p}/`);
}
async function realpathOrSelf(ctx, p) {
  try {
    return await ctx.realpath(p);
  } catch {
    return p;
  }
}
function markerMatchesCurrentInstall(marker, realEntry) {
  if (marker.entrypointRealpath && normalizePath(marker.entrypointRealpath) === realEntry) {
    return true;
  }
  if (marker.packageRoot && isInside(realEntry, normalizePath(marker.packageRoot))) {
    return true;
  }
  return false;
}
async function detectHomebrew(ctx, entry, realEntry) {
  const prefix = await ctx.run("brew", ["--prefix", "doraval"]);
  if (!prefix.ok)
    return null;
  const brewPrefix = normalizePath(await realpathOrSelf(ctx, prefix.stdout.trim()));
  if (isInside(realEntry, brewPrefix) || realEntry.includes("/Cellar/doraval/")) {
    return { type: "homebrew", source: "probe" };
  }
  return null;
}
async function detectNpmGlobal(ctx, entry, realEntry) {
  const root = await ctx.run("npm", ["root", "-g"]);
  if (root.ok) {
    const npmRoot = normalizePath(await realpathOrSelf(ctx, root.stdout.trim()));
    if (isInside(realEntry, `${npmRoot}/@hacksmith/doraval`)) {
      return { type: "npm", source: "probe" };
    }
  }
  if (realEntry.includes("/lib/node_modules/@hacksmith/doraval/")) {
    return { type: "npm", source: "path" };
  }
  return null;
}
async function detectBunGlobal(ctx, entry, realEntry) {
  const bunBin = await ctx.run("bun", ["pm", "bin", "-g"]);
  if (bunBin.ok) {
    for (const name of ["doraval", "dora"]) {
      const shim = normalizePath(`${bunBin.stdout.trim()}/${name}`);
      if (await ctx.exists(shim)) {
        const realShim = normalizePath(await realpathOrSelf(ctx, shim));
        if (realShim === realEntry || shim === entry) {
          return { type: "bun", source: "probe" };
        }
      }
    }
  }
  if (realEntry.includes("/.bun/install/global/node_modules/@hacksmith/doraval/")) {
    return { type: "bun", source: "path" };
  }
  return null;
}
function detectTransient(entry, realEntry) {
  if (realEntry.includes("/_npx/") && realEntry.includes("/node_modules/@hacksmith/doraval/")) {
    return { type: "transient", via: "npx", source: "path" };
  }
  if (realEntry.includes("/.bun/install/cache/")) {
    return { type: "transient", via: "bunx", source: "path" };
  }
  return null;
}
async function detectInstallMethod(ctx, options) {
  const env2 = ctx.env || {};
  if (env2.DORAVAL_TEST) {
    return { type: "npm", source: "probe" };
  }
  if (options?.force) {
    const f = options.force;
    if (["homebrew", "npm", "bun"].includes(f)) {
      return { type: f, source: "probe" };
    }
    if (f === "npx" || f === "bunx") {
      return { type: "transient", via: f, source: "path" };
    }
  }
  const rawEntry = ctx.entrypoint ?? ctx.argv?.[1];
  if (!rawEntry) {
    return { type: "unknown", reason: "No CLI entrypoint path available" };
  }
  const entry = normalizePath(rawEntry);
  const realEntry = normalizePath(await realpathOrSelf(ctx, rawEntry));
  const owners = await Promise.all([
    detectHomebrew(ctx, entry, realEntry),
    detectNpmGlobal(ctx, entry, realEntry),
    detectBunGlobal(ctx, entry, realEntry)
  ]);
  const owned = owners.filter(Boolean);
  if (owned.length === 1)
    return owned[0];
  const transient = detectTransient(entry, realEntry);
  if (transient)
    return transient;
  const marker = await ctx.readMarker();
  if (marker && markerMatchesCurrentInstall(marker, realEntry)) {
    return { type: marker.type, source: "marker" };
  }
  if (owned.length > 1) {
    return { type: "unknown", reason: "Multiple package managers appear to own this path" };
  }
  return { type: "unknown", reason: "Could not determine install method" };
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
  if (method.type === "transient" || method.type === "unknown") {
    throw new Error("Cannot build upgrade command for transient or unknown installs");
  }
  switch (method.type) {
    case "homebrew":
      return ["brew", "upgrade", "doraval"];
    case "npm":
      return ["npm", "install", "-g", "@hacksmith/doraval@latest"];
    case "bun":
      return ["bun", "add", "-g", "@hacksmith/doraval@latest"];
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
async function readMarker() {
  try {
    const { readFile } = await import("fs/promises");
    const data = await readFile(MARKER_PATH, "utf8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}
async function writeMarker(marker) {
  try {
    const { mkdir, writeFile } = await import("fs/promises");
    const { dirname: dirname10 } = await import("path");
    await mkdir(dirname10(MARKER_PATH), { recursive: true });
    await writeFile(MARKER_PATH, JSON.stringify(marker, null, 2));
  } catch {}
}
var MARKER_PATH;
var init_update2 = __esm(() => {
  MARKER_PATH = resolve29(homedir5(), ".doraval", "install.json");
});

// src/cli/commands/update.ts
var exports_update2 = {};
__export(exports_update2, {
  default: () => update_default2
});
import { spawnSync as spawnSync7 } from "child_process";
import { homedir as homedir6 } from "os";
import { fileURLToPath as fileURLToPath2 } from "url";
import { realpath, access } from "fs/promises";
async function confirmUpdate() {
  const { createInterface } = await import("readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve30) => {
    rl.question("Update now? (y/N) ", (answer) => {
      rl.close();
      resolve30(answer.toLowerCase().startsWith("y"));
    });
  });
}
async function promptInstallMethod() {
  const { createInterface } = await import("readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve30) => {
    ui.info("How was doraval installed?");
    ui.info("  1. homebrew (brew tap + trust + brew install doraval)");
    ui.info("  2. npm    (npm install -g @hacksmith/doraval)");
    ui.info("  3. bun    (bun add -g @hacksmith/doraval)");
    rl.question("Enter 1, 2, or 3 (or q to cancel): ", (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (a === "1" || a === "homebrew")
        return resolve30("homebrew");
      if (a === "2" || a === "npm")
        return resolve30("npm");
      if (a === "3" || a === "bun")
        return resolve30("bun");
      if (a === "q" || a === "quit" || a === "cancel")
        return resolve30(null);
      ui.info("Invalid choice.");
      resolve30(null);
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
      },
      via: {
        type: "string",
        description: "Force install method (homebrew|npm|bun). Bypasses auto-detection and interactive picker (useful for scripts/CI)."
      }
    },
    async run({ args }) {
      const currentVersion = require_package().version;
      const entrypoint = fileURLToPath2(import.meta.url);
      const ctx = {
        entrypoint,
        argv: process.argv,
        env: process.env,
        homeDir: homedir6(),
        realpath: (p) => realpath(p),
        exists: async (p) => {
          try {
            await access(p);
            return true;
          } catch {
            return false;
          }
        },
        run: async (cmd2, args2) => {
          const res = spawnSync7(cmd2, args2, { encoding: "utf8" });
          return { ok: res.status === 0, stdout: res.stdout || "" };
        },
        readMarker
      };
      let method;
      if (args.via) {
        const f = args.via;
        if (["homebrew", "npm", "bun"].includes(f)) {
          method = { type: f, source: "user" };
        } else if (f === "npx" || f === "bunx") {
          method = { type: "transient", via: f, source: "path" };
        } else {
          ui.fail(`Invalid --via value: "${f}". Valid: homebrew | npm | bun (or npx | bunx for transient).`);
          ui.info("Use --via to bypass detection for scripts/CI.");
          process.exit(2);
        }
      } else {
        method = await detectInstallMethod(ctx);
      }
      if (method.type === "transient") {
        ui.info("It looks like you're using doraval via npx or bunx.");
        ui.info("These always fetch the latest version on the next run.");
        ui.info("");
        ui.info("For easier updates, install globally:");
        ui.info("");
        ui.info("macOS (Homebrew, recommended):");
        ui.info("  brew tap saif-shines/tap");
        ui.info("  brew trust saif-shines/tap");
        ui.info("  brew install doraval");
        ui.info("");
        ui.info("npm:");
        ui.info("  npm install -g @hacksmith/doraval");
        ui.info("");
        ui.info("Bun:");
        ui.info("  bun add -g @hacksmith/doraval");
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
      if (method.type === "unknown") {
        ui.fail(`Could not determine how doraval was installed: ${method.reason}`);
        if (!process.stdin.isTTY || !process.stdout.isTTY) {
          ui.info("Use --via homebrew|npm|bun to specify (non-interactive).");
          process.exit(2);
        }
        const chosen = await promptInstallMethod();
        if (chosen) {
          method = { type: chosen, source: "user" };
        } else {
          ui.info("Update cancelled.");
          process.exit(0);
        }
      }
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
      const result = spawnSync7(cmd[0], cmd.slice(1), { stdio: "inherit" });
      if (result.status === 0) {
        ui.success(`Successfully updated to ${latestInfo.version}.`);
        ui.info("You may need to restart your shell to pick up the new version.");
        const marker = {
          type: method.type,
          packageRoot: undefined,
          entrypointRealpath: await realpath(entrypoint).catch(() => entrypoint),
          version: latestInfo.version,
          writtenAt: new Date().toISOString()
        };
        await writeMarker(marker);
      } else {
        ui.fail("Update failed.");
        ui.info("Common fixes:");
        if (cmd[0] === "brew") {
          ui.info("  \u2022 Try: sudo brew upgrade doraval  or  ensure you are in the admin group");
          ui.info("  \u2022 For custom taps (e.g. saif-shines/tap): run `brew trust saif-shines/tap`");
          ui.info("    or `brew trust --formula saif-shines/tap/doraval`");
        }
        if (cmd[0] === "npm" || cmd[0] === "bun") {
          ui.info("  \u2022 Try running with appropriate permissions or check network.");
        }
        ui.info(`
Raw output above.`);
        process.exit(result.status ?? 1);
      }
    }
  });
});

// src/cli/commands/providers.ts
var exports_providers = {};
__export(exports_providers, {
  default: () => providers_default
});
var import_picocolors20, providers_default;
var init_providers2 = __esm(() => {
  init_dist();
  init_out();
  init_spec();
  import_picocolors20 = __toESM(require_picocolors(), 1);
  providers_default = defineCommand({
    meta: {
      name: "providers",
      description: "List supported providers and their packaging details (including keyword discovery)"
    },
    args: {
      json: {
        type: "boolean",
        description: "Output as JSON",
        default: false
      }
    },
    run({ args }) {
      if (args.json) {
        console.log(JSON.stringify(supportedProviders.map((id) => {
          const spec = getProviderSpec(id);
          return { ...spec, id };
        }), null, 2));
        process.exit(0);
      }
      ui.heading("doraval providers \u2014 Supported platforms");
      for (const id of supportedProviders) {
        const spec = getProviderSpec(id);
        ui.write(`
  ${import_picocolors20.default.bold(id)} \u2014 ${spec.name}`);
        ui.info(`  Manifest: ${spec.manifestPath}`);
        ui.info(`  Marketplace: ${spec.marketplacePath}`);
        ui.info(`  MCP: ${spec.mcpFilename}`);
        ui.info(`  Keywords in plugin.json: supported \u2014 If users mention any of these keywords, your plugin will get triggered`);
        ui.info(`  Example: doraval validate . --for ${id}:plugin`);
      }
      ui.write(`
  Use --json for machine-readable output.`);
      ui.write(`  Tip: Add a "keywords" array to your plugin manifest for better agent discovery.`);
      process.exit(0);
    }
  });
});

// src/cli/commands/completion.ts
var exports_completion = {};
__export(exports_completion, {
  default: () => completion_default
});
var commands, uiFlags, subCommands, completion_default;
var init_completion = __esm(() => {
  init_dist();
  commands = [
    "validate",
    "init",
    "bump",
    "update",
    "providers",
    "skill",
    "journal",
    "ui",
    "eval",
    "config",
    "claude",
    "codex",
    "cursor",
    "copilot"
  ];
  uiFlags = ["--port", "--open", "--no-open", "--host", "--status", "--force"];
  subCommands = {
    skill: ["validate", "drift", "judge"],
    journal: ["init", "list", "context", "hook", "update", "add", "sync"],
    eval: ["history"],
    config: ["set", "get"],
    hook: ["enable", "disable", "status"],
    claude: ["new", "bump"],
    codex: ["new", "bump"],
    cursor: ["new", "bump"],
    copilot: ["new", "bump"]
  };
  completion_default = defineCommand({
    meta: {
      name: "completion",
      description: "Generate shell completion scripts (bash, zsh, fish)"
    },
    args: {
      shell: {
        type: "positional",
        description: "Shell to generate completion for (bash | zsh | fish)",
        required: true
      }
    },
    run({ args }) {
      const shell = String(args.shell).toLowerCase();
      if (shell === "bash") {
        console.log(`# doraval bash completion
_doraval_completions() {
  local cur prev
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  if [ $COMP_CWORD -eq 1 ]; then
    COMPREPLY=( $(compgen -W "${commands.join(" ")}" -- "$cur") )
  elif [ $COMP_CWORD -eq 2 ]; then
    case "$prev" in
      skill) COMPREPLY=( $(compgen -W "${(subCommands.skill ?? []).join(" ")}" -- "$cur") ) ;;
      journal) COMPREPLY=( $(compgen -W "${(subCommands.journal ?? []).join(" ")}" -- "$cur") ) ;;
      eval) COMPREPLY=( $(compgen -W "${(subCommands.eval ?? []).join(" ")}" -- "$cur") ) ;;
      config) COMPREPLY=( $(compgen -W "${(subCommands.config ?? []).join(" ")}" -- "$cur") ) ;;
      hook) COMPREPLY=( $(compgen -W "${(subCommands.hook ?? []).join(" ")}" -- "$cur") ) ;;
      ui) COMPREPLY=( $(compgen -W "${uiFlags.join(" ")}" -- "$cur") ) ;;
      claude|codex|cursor|copilot) COMPREPLY=( $(compgen -W "${(subCommands.claude ?? []).join(" ")}" -- "$cur") ) ;;
    esac
  fi
}
complete -F _doraval_completions doraval
`);
      } else if (shell === "zsh") {
        console.log(`# doraval zsh completion
#compdef doraval

_doraval() {
  local -a commands sub
  commands=(validate init bump update providers skill journal ui eval config claude codex cursor copilot)
  _arguments -C \\
    '1: :->cmd' \\
    '*::arg:->args'

  case $state in
    cmd)
      _describe 'command' commands
      ;;
    args)
      case $words[1] in
        skill)
          _describe 'subcommand' (validate drift judge)
          ;;
        journal)
          _describe 'subcommand' (init list context hook update add sync)
          ;;
        eval)
          _describe 'subcommand' (history)
          ;;
        config)
          _describe 'subcommand' (set get)
          ;;
        hook)
          _describe 'subcommand' (enable disable status)
          ;;
        ui)
          _describe 'flag' (${uiFlags})
          ;;
        claude|codex|cursor|copilot)
          _describe 'subcommand' (new bump)
          ;;
      esac
      ;;
  esac
}

_doraval "$@"
`);
      } else if (shell === "fish") {
        console.log(`# doraval fish completion
complete -c doraval -f
complete -c doraval -n '__fish_use_subcommand' -a 'validate init bump update providers skill journal ui eval config claude codex cursor copilot'

complete -c doraval -n '__fish_seen_subcommand_from skill' -a 'validate drift judge'
complete -c doraval -n '__fish_seen_subcommand_from journal' -a 'init list context hook update add sync'
complete -c doraval -n '__fish_seen_subcommand_from eval' -a 'history'
complete -c doraval -n '__fish_seen_subcommand_from config' -a 'set get'
complete -c doraval -n '__fish_seen_subcommand_from hook' -a 'enable disable status'
complete -c doraval -n '__fish_seen_subcommand_from ui' -l port -d 'Port'
complete -c doraval -n '__fish_seen_subcommand_from ui' -l open -d 'Open browser'
complete -c doraval -n '__fish_seen_subcommand_from ui' -l no-open -d 'Do not open browser'
complete -c doraval -n '__fish_seen_subcommand_from ui' -l host -d 'Host'
complete -c doraval -n '__fish_seen_subcommand_from ui' -l status -d 'Show status only'
complete -c doraval -n '__fish_seen_subcommand_from ui' -l force -d 'Force restart'
complete -c doraval -n '__fish_seen_subcommand_from claude codex cursor copilot' -a 'new bump'
`);
      } else {
        console.error(`Unsupported shell: ${shell}. Supported: bash, zsh, fish`);
        process.exit(1);
      }
      process.exit(0);
    }
  });
});

// src/cli/index.ts
init_dist();
init_out();
var import__package = __toESM(require_package(), 1);
var import_picocolors21 = __toESM(require_picocolors(), 1);
var skill = defineCommand({
  meta: {
    name: "skill",
    description: "Validate, measure drift, run sessions with prompts, and judge AI agent skills"
  },
  subCommands: {
    validate: () => Promise.resolve().then(() => (init_validate(), exports_validate)).then((m) => m.default),
    drift: () => Promise.resolve().then(() => (init_drift(), exports_drift)).then((m) => m.default),
    judge: () => Promise.resolve().then(() => (init_judge(), exports_judge)).then((m) => m.default)
  },
  run() {
    const cliArgs = process.argv.slice(2);
    if (cliArgs[0] === "skill" && cliArgs.length > 1)
      return;
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
    context: () => Promise.resolve().then(() => (init_context(), exports_context)).then((m) => m.default),
    hook: () => Promise.resolve().then(() => (init_hook(), exports_hook)).then((m) => m.default),
    update: () => Promise.resolve().then(() => (init_update(), exports_update)).then((m) => m.default),
    add: () => Promise.resolve().then(() => (init_add(), exports_add)).then((m) => m.default),
    sync: () => Promise.resolve().then(() => (init_sync(), exports_sync)).then((m) => m.default)
  },
  run() {
    const cliArgs = process.argv.slice(2);
    if (cliArgs[0] === "journal" && cliArgs.length > 1)
      return;
    showUsage(journal);
  }
});
var config = () => Promise.resolve().then(() => (init_config(), exports_config)).then((m) => m.default);
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
    const cliArgs = process.argv.slice(2);
    if (cliArgs[0] === "claude" && cliArgs.length > 1)
      return;
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
    const cliArgs = process.argv.slice(2);
    if (cliArgs[0] === "codex" && cliArgs.length > 1)
      return;
    showUsage(codex);
  }
});
var cursor = defineCommand({
  meta: {
    name: "cursor",
    description: "Cursor-specific commands (packaging, scaffolding, distribution)"
  },
  subCommands: {
    new: () => Promise.resolve().then(() => (init_new3(), exports_new3)).then((m) => m.default),
    bump: () => Promise.resolve().then(() => (init_bump(), exports_bump)).then((m) => m.default)
  },
  run() {
    const cliArgs = process.argv.slice(2);
    if (cliArgs[0] === "cursor" && cliArgs.length > 1)
      return;
    showUsage(cursor);
  }
});
var copilot = defineCommand({
  meta: {
    name: "copilot",
    description: "Copilot CLI-specific commands (packaging, scaffolding, distribution)"
  },
  subCommands: {
    new: () => Promise.resolve().then(() => (init_new4(), exports_new4)).then((m) => m.default),
    bump: () => Promise.resolve().then(() => (init_bump(), exports_bump)).then((m) => m.default)
  },
  run() {
    const cliArgs = process.argv.slice(2);
    if (cliArgs[0] === "copilot" && cliArgs.length > 1)
      return;
    showUsage(copilot);
  }
});
var ui2 = defineCommand({
  meta: {
    name: "ui",
    description: "Launch the local doraval web dashboard (no more typing commands for common tasks)"
  },
  args: {
    port: {
      type: "string",
      description: "Port to run the local UI server on (default 3737)",
      default: "3737"
    },
    open: {
      type: "boolean",
      description: "Automatically open the dashboard in your browser",
      default: true
    },
    host: {
      type: "string",
      description: "Host to bind (default 127.0.0.1 for local only)",
      default: "127.0.0.1"
    },
    status: {
      type: "boolean",
      description: "Check if a dashboard is running and print its URL (no start)",
      default: false
    },
    force: {
      type: "boolean",
      description: "Force start/restart even if one is already running",
      default: false
    }
  },
  async run({ args }) {
    await Promise.resolve().then(() => (init_ui(), exports_ui)).then((m) => m.default.run({ args }));
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
    description: "Scale your AI context for coding agents. Make your next context work (skills, plugins & more) for your team, community, or self. Context engineering toolkit for AI coding agents."
  },
  subCommands: {
    validate: () => Promise.resolve().then(() => (init_validate_top(), exports_validate_top)).then((m) => m.default),
    init: () => Promise.resolve().then(() => (init_init2(), exports_init2)).then((m) => m.default),
    bump: () => Promise.resolve().then(() => (init_bump(), exports_bump)).then((m) => m.default),
    update: () => Promise.resolve().then(() => (init_update3(), exports_update2)).then((m) => m.default),
    providers: () => Promise.resolve().then(() => (init_providers2(), exports_providers)).then((m) => m.default),
    completion: () => Promise.resolve().then(() => (init_completion(), exports_completion)).then((m) => m.default),
    skill: () => Promise.resolve(skill),
    journal: () => Promise.resolve(journal),
    eval: () => Promise.resolve().then(() => (init_eval(), exports_eval)).then((m) => m.default),
    config,
    claude: () => Promise.resolve(claude),
    codex: () => Promise.resolve(codex),
    cursor: () => Promise.resolve(cursor),
    copilot: () => Promise.resolve(copilot),
    ui: () => Promise.resolve(ui2)
  },
  run() {
    const cliArgs = process.argv.slice(2);
    if (cliArgs.length > 0)
      return;
    if (process.stdout.isTTY) {
      ui.write(`
` + import_picocolors21.default.blue(doraemonArt) + `
`);
    }
    showUsage(main);
  }
});
runMain(main);
