#!/usr/bin/env node
/**
 * doraval bin stub (plan B1). Plain Node CommonJS — this file is the ONLY
 * thing that runs before the compiled binary takes over, and it must work
 * on any Node >= 14.18 with zero dependencies and zero prompts.
 *
 * npm installed exactly one @hacksmith/doraval-<os>-<arch> optionalDependency
 * (filtered by the platform packages' os/cpu fields). Resolve it, exec it,
 * forward the exit code.
 */
"use strict";

const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const SUPPORTED = {
  "darwin-arm64": true,
  "darwin-x64": true,
  "linux-x64": true,
  "linux-arm64": true,
  "win32-x64": true,
};

function platformPackageName(platform, arch) {
  const suffix = platform + "-" + arch;
  if (!SUPPORTED[suffix]) return null;
  return "@hacksmith/doraval-" + suffix;
}

/**
 * Resolve the compiled binary's absolute path.
 * `extraPaths` lets tests point resolution at a fake node_modules root;
 * production resolution starts from this file's location (works for global
 * installs, npx cache, and local node_modules alike).
 */
function resolveBinaryPath(platform, arch, extraPaths) {
  const pkgName = platformPackageName(platform, arch);
  if (!pkgName) return null;
  const binaryName = platform === "win32" ? "doraval.exe" : "doraval";
  const paths = (extraPaths || []).concat([__dirname, path.join(__dirname, "..")]);
  try {
    const pkgJson = require.resolve(pkgName + "/package.json", { paths });
    const candidate = path.join(path.dirname(pkgJson), "bin", binaryName);
    return existsSync(candidate) ? candidate : null;
  } catch (_e) {
    return null;
  }
}

function fail(msg) {
  process.stderr.write(msg + "\n");
  process.exit(1);
}

function main() {
  const platform = process.platform;
  const arch = process.arch;
  const bin = resolveBinaryPath(platform, arch);

  if (!bin) {
    const suffix = platform + "-" + arch;
    if (!SUPPORTED[suffix]) {
      fail(
        "doraval: no prebuilt binary for " + suffix + ".\n" +
        "Supported: darwin-arm64, darwin-x64, linux-x64, linux-arm64, win32-x64.\n" +
        "(Alpine/musl is not yet supported.)\n" +
        "Run from source instead: bun install && bunx @hacksmith/doraval  (https://bun.sh)"
      );
    }
    fail(
      "doraval: the platform package @hacksmith/doraval-" + suffix + " is not installed.\n" +
      "This usually means npm was run with --omit=optional or --no-optional.\n" +
      "Fix: reinstall without omitting optional dependencies:\n" +
      "  npm install @hacksmith/doraval\n" +
      "Or run from source: bun install && bunx @hacksmith/doraval"
    );
  }

  const result = spawnSync(bin, process.argv.slice(2), { stdio: "inherit" });
  if (result.error) {
    fail("doraval: failed to launch " + bin + ": " + result.error.message);
  }
  process.exit(result.status === null ? 1 : result.status);
}

if (require.main === module) {
  main();
}

module.exports = { platformPackageName, resolveBinaryPath };
