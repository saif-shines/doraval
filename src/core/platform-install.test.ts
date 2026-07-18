import { describe, expect, test } from "bun:test";
import {
  checkPlatformInstall,
  platformPackageName,
  mainPackageDeclaresOptionalDeps,
} from "./platform-install.js";

describe("platformPackageName", () => {
  test("maps supported hosts", () => {
    expect(platformPackageName("darwin", "arm64")).toBe("@hacksmith/doraval-darwin-arm64");
    expect(platformPackageName("linux", "x64")).toBe("@hacksmith/doraval-linux-x64");
    expect(platformPackageName("win32", "x64")).toBe("@hacksmith/doraval-win32-x64");
  });

  test("null for unsupported", () => {
    expect(platformPackageName("freebsd", "x64")).toBeNull();
    expect(platformPackageName("win32", "arm64")).toBeNull();
  });
});

describe("mainPackageDeclaresOptionalDeps", () => {
  test("false when absent (source tree)", () => {
    expect(mainPackageDeclaresOptionalDeps({})).toBe(false);
    expect(mainPackageDeclaresOptionalDeps({ optionalDependencies: {} })).toBe(false);
  });

  test("true when platform packages listed", () => {
    expect(
      mainPackageDeclaresOptionalDeps({
        optionalDependencies: { "@hacksmith/doraval-darwin-arm64": "0.6.6" },
      }),
    ).toBe(true);
  });
});

describe("checkPlatformInstall", () => {
  test("source/dev without optionalDeps → skip ok", () => {
    const r = checkPlatformInstall({
      platform: "darwin",
      arch: "arm64",
      expectedVersion: "0.6.6",
      hasOptionalDepsDeclared: false,
      resolvePlatform: () => {
        throw new Error("should not resolve in source mode");
      },
    });
    expect(r.status).toBe("skip");
    expect(r.code).toBe("E-INSTALL-SOURCE");
    expect(r.packageName).toBe("@hacksmith/doraval-darwin-arm64");
  });

  test("unsupported platform → skip with hint", () => {
    const r = checkPlatformInstall({
      platform: "freebsd",
      arch: "x64",
      expectedVersion: "0.6.6",
      hasOptionalDepsDeclared: true,
      resolvePlatform: () => null,
    });
    expect(r.status).toBe("skip");
    expect(r.code).toBe("E-INSTALL-UNSUPPORTED");
    expect(r.packageName).toBeNull();
  });

  test("published layout missing optionalDep → fail + reinstall hint", () => {
    const r = checkPlatformInstall({
      platform: "linux",
      arch: "x64",
      expectedVersion: "0.6.6",
      hasOptionalDepsDeclared: true,
      resolvePlatform: () => null,
    });
    expect(r.status).toBe("fail");
    expect(r.code).toBe("E-INSTALL-MISSING");
    expect(r.packageName).toBe("@hacksmith/doraval-linux-x64");
    expect(r.hint).toMatch(/npm install @hacksmith\/doraval/);
    expect(r.hint).toMatch(/omit=optional|optional/i);
  });

  test("package present but binary missing → fail", () => {
    const r = checkPlatformInstall({
      platform: "darwin",
      arch: "arm64",
      expectedVersion: "0.6.6",
      hasOptionalDepsDeclared: true,
      resolvePlatform: () => ({ version: "0.6.6", binaryOk: false }),
    });
    expect(r.status).toBe("fail");
    expect(r.code).toBe("E-INSTALL-BINARY");
    expect(r.binaryOk).toBe(false);
  });

  test("version skew → warn", () => {
    const r = checkPlatformInstall({
      platform: "darwin",
      arch: "arm64",
      expectedVersion: "0.6.6",
      hasOptionalDepsDeclared: true,
      resolvePlatform: () => ({ version: "0.6.0", binaryOk: true }),
    });
    expect(r.status).toBe("warn");
    expect(r.code).toBe("E-INSTALL-SKEW");
    expect(r.foundVersion).toBe("0.6.0");
  });

  test("matching package + binary → ok", () => {
    const r = checkPlatformInstall({
      platform: "darwin",
      arch: "arm64",
      expectedVersion: "0.6.6",
      hasOptionalDepsDeclared: true,
      resolvePlatform: () => ({ version: "0.6.6", binaryOk: true }),
    });
    expect(r.status).toBe("ok");
    expect(r.code).toBe("E-INSTALL-OK");
    expect(r.binaryOk).toBe(true);
    expect(r.detail).toContain("@hacksmith/doraval-darwin-arm64@0.6.6");
  });
});
