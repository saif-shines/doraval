/**
 * Platform-package generation for compiled-binary distribution (plan B1).
 * Each target becomes @hacksmith/doraval-<suffix>, an npm package holding
 * exactly one compiled binary, os/cpu-filtered so npm installs only the
 * matching one. Injected as optionalDependencies at publish time by CI —
 * never committed to package.json.
 */
import { copyFileSync, chmodSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

export interface PlatformTarget {
  suffix: string;      // package name suffix + release artifact suffix
  os: string;          // npm "os" filter value (process.platform)
  cpu: string;         // npm "cpu" filter value (process.arch)
  bunTarget: string;   // bun build --compile --target value
  binaryName: string;  // file name inside the package's bin/
}

export const TARGETS: PlatformTarget[] = [
  { suffix: "darwin-arm64", os: "darwin", cpu: "arm64", bunTarget: "bun-darwin-arm64", binaryName: "doraval" },
  { suffix: "darwin-x64",   os: "darwin", cpu: "x64",   bunTarget: "bun-darwin-x64",   binaryName: "doraval" },
  { suffix: "linux-x64",    os: "linux",  cpu: "x64",   bunTarget: "bun-linux-x64",    binaryName: "doraval" },
  { suffix: "linux-arm64",  os: "linux",  cpu: "arm64", bunTarget: "bun-linux-arm64",  binaryName: "doraval" },
  { suffix: "win32-x64",    os: "win32",  cpu: "x64",   bunTarget: "bun-windows-x64",  binaryName: "doraval.exe" },
];

export function genPlatformPackageJson(t: PlatformTarget, version: string): Record<string, unknown> {
  return {
    name: `@hacksmith/doraval-${t.suffix}`,
    version,
    description: `doraval compiled binary for ${t.os}-${t.cpu}. Install @hacksmith/doraval instead.`,
    repository: { type: "git", url: "git+https://github.com/saif-shines/doraval.git" },
    license: "MIT",
    os: [t.os],
    cpu: [t.cpu],
    files: [`bin/${t.binaryName}`],
  };
}

export function assemblePlatformPackage(
  t: PlatformTarget,
  version: string,
  binarySrc: string,
  outRoot: string
): string {
  const dir = join(outRoot, `doraval-${t.suffix}`);
  mkdirSync(join(dir, "bin"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify(genPlatformPackageJson(t, version), null, 2) + "\n");
  const dest = join(dir, "bin", t.binaryName);
  copyFileSync(binarySrc, dest);
  if (t.os !== "win32") chmodSync(dest, 0o755);
  return dir;
}

// CLI: bun run scripts/platform-packages.ts <version> <artifactsDir> <outRoot>
// Release artifacts are named doraval-<suffix> (doraval-<suffix>.exe for win32).
if (import.meta.main) {
  const [version, artifactsDir, outRoot] = process.argv.slice(2);
  if (!version || !artifactsDir || !outRoot) {
    console.error("Usage: bun run scripts/platform-packages.ts <version> <artifactsDir> <outRoot>");
    process.exit(1);
  }
  const missing: string[] = [];
  for (const t of TARGETS) {
    const artifact = join(artifactsDir, t.os === "win32" ? `doraval-${t.suffix}.exe` : `doraval-${t.suffix}`);
    if (!existsSync(artifact)) {
      missing.push(artifact);
      continue;
    }
    console.log(assemblePlatformPackage(t, version, artifact, outRoot));
  }
  if (missing.length > 0) {
    // Partial platform coverage must fail the release, not silently ship 4/5.
    console.error(`Missing release binaries:\n${missing.join("\n")}`);
    process.exit(1);
  }
}
