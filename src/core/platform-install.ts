/**
 * B-xi — Platform package install doctor.
 * After 0.6.x optionalDep publish gaps, tell the user when this host's
 * @hacksmith/doraval-<os>-<arch> binary package is missing or version-skewed.
 * No network: local resolve only. YAGNI brotli/home-bin.
 */
import { createRequire } from "module";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import pkg from "../../package.json" with { type: "json" };

const SUPPORTED: Record<string, true> = {
  "darwin-arm64": true,
  "darwin-x64": true,
  "linux-x64": true,
  "linux-arm64": true,
  "win32-x64": true,
};

export type PlatformInstallStatus = "ok" | "warn" | "fail" | "skip";

export interface PlatformInstallCheck {
  status: PlatformInstallStatus;
  /** e.g. @hacksmith/doraval-darwin-arm64; null if unsupported host */
  packageName: string | null;
  expectedVersion: string;
  foundVersion?: string;
  binaryOk: boolean;
  detail: string;
  hint?: string;
  code?: string;
}

export interface PlatformInstallDeps {
  platform: string;
  arch: string;
  expectedVersion: string;
  /** When false/undefined, treat as source/dev (no optionalDeps injection). */
  hasOptionalDepsDeclared: boolean;
  /** Resolve platform package; null = not installed. */
  resolvePlatform: (packageName: string, binaryName: string) => {
    version: string;
    binaryOk: boolean;
  } | null;
}

export function platformPackageName(platform: string, arch: string): string | null {
  const suffix = `${platform}-${arch}`;
  if (!SUPPORTED[suffix]) return null;
  return `@hacksmith/doraval-${suffix}`;
}

function binaryNameFor(platform: string): string {
  return platform === "win32" ? "doraval.exe" : "doraval";
}

/** Default: createRequire from this module (works for global/npx/local installs). */
export function defaultResolvePlatform(
  packageName: string,
  binaryName: string,
  extraPaths?: string[],
): { version: string; binaryOk: boolean } | null {
  const require = createRequire(import.meta.url);
  try {
    const paths = extraPaths?.length ? { paths: extraPaths } : undefined;
    const pkgJsonPath = require.resolve(`${packageName}/package.json`, paths);
    const raw = readFileSync(pkgJsonPath, "utf8");
    const meta = JSON.parse(raw) as { version?: string };
    const bin = join(dirname(pkgJsonPath), "bin", binaryName);
    return {
      version: String(meta.version ?? ""),
      binaryOk: existsSync(bin),
    };
  } catch {
    return null;
  }
}

export function mainPackageDeclaresOptionalDeps(
  packageJson: { optionalDependencies?: Record<string, string> } = pkg,
): boolean {
  const od = packageJson.optionalDependencies;
  if (!od) return false;
  return Object.keys(od).some((k) => k.startsWith("@hacksmith/doraval-"));
}

export function checkPlatformInstall(deps?: Partial<PlatformInstallDeps>): PlatformInstallCheck {
  const platform = deps?.platform ?? process.platform;
  const arch = deps?.arch ?? process.arch;
  const expectedVersion = deps?.expectedVersion ?? String(pkg.version);
  const hasOptionalDepsDeclared =
    deps?.hasOptionalDepsDeclared ?? mainPackageDeclaresOptionalDeps();
  const resolve =
    deps?.resolvePlatform ??
    ((name, binary) => defaultResolvePlatform(name, binary));

  const packageName = platformPackageName(platform, arch);
  if (!packageName) {
    return {
      status: "skip",
      packageName: null,
      expectedVersion,
      binaryOk: false,
      detail: `no prebuilt binary for ${platform}-${arch}`,
      hint: "Supported: darwin-arm64, darwin-x64, linux-x64, linux-arm64, win32-x64. Or run from source with bun.",
      code: "E-INSTALL-UNSUPPORTED",
    };
  }

  // Dev / git tree: package.json never commits optionalDependencies.
  if (!hasOptionalDepsDeclared) {
    return {
      status: "skip",
      packageName,
      expectedVersion,
      binaryOk: true,
      detail: "source/dev install — platform optionalDependency not required",
      code: "E-INSTALL-SOURCE",
    };
  }

  const binaryName = binaryNameFor(platform);
  const found = resolve(packageName, binaryName);

  if (!found) {
    return {
      status: "fail",
      packageName,
      expectedVersion,
      binaryOk: false,
      detail: `${packageName} is not installed (optionalDependency missing)`,
      hint:
        "Reinstall without omitting optional deps: npm install @hacksmith/doraval  (avoid --omit=optional). Then verify: npm view " +
        packageName +
        "@" +
        expectedVersion +
        " version",
      code: "E-INSTALL-MISSING",
    };
  }

  if (!found.binaryOk) {
    return {
      status: "fail",
      packageName,
      expectedVersion,
      foundVersion: found.version,
      binaryOk: false,
      detail: `${packageName}@${found.version} is present but bin/${binaryName} is missing`,
      hint: `Reinstall the platform package: npm install ${packageName}@${expectedVersion}`,
      code: "E-INSTALL-BINARY",
    };
  }

  if (found.version && found.version !== expectedVersion) {
    return {
      status: "warn",
      packageName,
      expectedVersion,
      foundVersion: found.version,
      binaryOk: true,
      detail: `${packageName} version skew: found ${found.version}, main expects ${expectedVersion}`,
      hint: `Align versions: npm install @hacksmith/doraval@${expectedVersion} (refreshes optionalDeps)`,
      code: "E-INSTALL-SKEW",
    };
  }

  return {
    status: "ok",
    packageName,
    expectedVersion,
    foundVersion: found.version,
    binaryOk: true,
    detail: `${packageName}@${found.version || expectedVersion} binary ok`,
    code: "E-INSTALL-OK",
  };
}
