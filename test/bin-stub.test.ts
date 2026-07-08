import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createRequire } from "module";

const require_ = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const stub = require_("../bin/doraval.cjs");

describe("platformPackageName", () => {
  test("maps platform/arch to the scoped package name", () => {
    expect(stub.platformPackageName("darwin", "arm64")).toBe("@hacksmith/doraval-darwin-arm64");
    expect(stub.platformPackageName("linux", "x64")).toBe("@hacksmith/doraval-linux-x64");
    expect(stub.platformPackageName("win32", "x64")).toBe("@hacksmith/doraval-win32-x64");
  });

  test("returns null for unsupported combos", () => {
    expect(stub.platformPackageName("freebsd", "x64")).toBeNull();
    expect(stub.platformPackageName("linux", "ia32")).toBeNull();
    expect(stub.platformPackageName("win32", "arm64")).toBeNull();
  });
});

describe("resolveBinaryPath", () => {
  test("finds the binary inside an installed platform package", () => {
    // Simulate node_modules layout: <tmp>/node_modules/@hacksmith/doraval-linux-x64/bin/doraval
    const tmp = mkdtempSync(join(tmpdir(), "dora-stub-"));
    const pkgDir = join(tmp, "node_modules", "@hacksmith", "doraval-linux-x64");
    mkdirSync(join(pkgDir, "bin"), { recursive: true });
    writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "@hacksmith/doraval-linux-x64", version: "0.0.1" }));
    writeFileSync(join(pkgDir, "bin", "doraval"), "");

    const result = stub.resolveBinaryPath("linux", "x64", [tmp]);
    expect(realpathSync(result)).toBe(realpathSync(join(pkgDir, "bin", "doraval")));
  });

  test("appends .exe on win32", () => {
    const tmp = mkdtempSync(join(tmpdir(), "dora-stub-win-"));
    const pkgDir = join(tmp, "node_modules", "@hacksmith", "doraval-win32-x64");
    mkdirSync(join(pkgDir, "bin"), { recursive: true });
    writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "@hacksmith/doraval-win32-x64", version: "0.0.1" }));
    writeFileSync(join(pkgDir, "bin", "doraval.exe"), "");

    const result = stub.resolveBinaryPath("win32", "x64", [tmp]);
    expect(realpathSync(result)).toBe(realpathSync(join(pkgDir, "bin", "doraval.exe")));
  });

  test("returns null when the platform package is absent", () => {
    const tmp = mkdtempSync(join(tmpdir(), "dora-stub-empty-"));
    expect(stub.resolveBinaryPath("linux", "x64", [tmp])).toBeNull();
  });
});
