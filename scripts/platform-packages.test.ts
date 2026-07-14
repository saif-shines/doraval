import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, existsSync, statSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { TARGETS, genPlatformPackageJson, assemblePlatformPackage } from "./platform-packages.ts";

describe("TARGETS", () => {
  test("exactly the five supported platforms, correct npm os/cpu and bun targets", () => {
    const bySuffix = Object.fromEntries(TARGETS.map((t) => [t.suffix, t]));
    expect(Object.keys(bySuffix).sort()).toEqual(
      ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win32-x64"]
    );
    expect(bySuffix["darwin-arm64"]).toMatchObject({
      os: "darwin", cpu: "arm64", bunTarget: "bun-darwin-arm64", binaryName: "doraval",
    });
    expect(bySuffix["win32-x64"]).toMatchObject({
      os: "win32", cpu: "x64", bunTarget: "bun-windows-x64", binaryName: "doraval.exe",
    });
    expect(bySuffix["linux-x64"]!.bunTarget).toBe("bun-linux-x64");
  });
});

describe("genPlatformPackageJson", () => {
  test("scoped name, exact version, os/cpu filters, only the binary in files", () => {
    const t = TARGETS.find((t) => t.suffix === "darwin-arm64")!;
    const pkg = genPlatformPackageJson(t, "0.5.0") as Record<string, unknown>;
    expect(pkg.name).toBe("@hacksmith/doraval-darwin-arm64");
    expect(pkg.version).toBe("0.5.0");
    expect(pkg.os).toEqual(["darwin"]);
    expect(pkg.cpu).toEqual(["arm64"]);
    expect(pkg.files).toEqual(["bin/doraval"]);
    expect(pkg.license).toBe("MIT");
    // No bin field: platform packages are payload only; the main stub execs the file.
    expect(pkg.bin).toBeUndefined();
    // No dependencies of any kind.
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.optionalDependencies).toBeUndefined();
  });
});

describe("assemblePlatformPackage", () => {
  test("lays out package.json + executable binary", () => {
    const t = TARGETS.find((t) => t.suffix === "linux-x64")!;
    const tmp = mkdtempSync(join(tmpdir(), "dora-pp-"));
    const fakeBinary = join(tmp, "doraval-linux-x64");
    writeFileSync(fakeBinary, "#!/bin/sh\necho fake\n");

    const dir = assemblePlatformPackage(t, "0.5.0", fakeBinary, join(tmp, "out"));
    expect(existsSync(join(dir, "package.json"))).toBe(true);
    expect(existsSync(join(dir, "bin", "doraval"))).toBe(true);
    // chmod bit is meaningless on Windows NTFS even when we set 0o755 for non-win32 packages
    if (process.platform !== "win32") {
      const mode = statSync(join(dir, "bin", "doraval")).mode & 0o777;
      expect(mode & 0o111).toBeGreaterThan(0); // executable
    }
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
    expect(pkg.name).toBe("@hacksmith/doraval-linux-x64");
  });
});
