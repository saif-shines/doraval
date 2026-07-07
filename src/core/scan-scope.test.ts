import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { resolveScanScope } from "./scan-scope.js";

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "dora-scope-"));
  mkdirSync(join(root, ".git"));
  return root;
}

describe("resolveScanScope", () => {
  test("at git root: scan root = git root, not a subdir", () => {
    const root = makeRepo();
    const scope = resolveScanScope(root);
    expect(scope.scanRoot).toBe(root);
    expect(scope.gitRoot).toBe(root);
    expect(scope.isMonorepoSubdir).toBe(false);
  });

  test("in a subdirectory: scans the subdir, reports git root + root agent files", () => {
    const root = makeRepo();
    writeFileSync(join(root, "AGENTS.md"), "# shared");
    const pkg = join(root, "packages", "api");
    mkdirSync(pkg, { recursive: true });
    const scope = resolveScanScope(pkg);
    expect(scope.scanRoot).toBe(pkg);
    expect(scope.gitRoot).toBe(root);
    expect(scope.isMonorepoSubdir).toBe(true);
    expect(scope.rootAgentFiles).toContain("AGENTS.md");
  });

  test("no git: scanRoot = cwd, gitRoot null", () => {
    const dir = mkdtempSync(join(tmpdir(), "dora-nogit-"));
    const scope = resolveScanScope(dir);
    expect(scope.gitRoot).toBeNull();
    expect(scope.scanRoot).toBe(dir);
    expect(scope.isMonorepoSubdir).toBe(false);
  });

  test("home directory is flagged", () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "dora-home-"));
    const scope = resolveScanScope(fakeHome, fakeHome);
    expect(scope.isHomeDir).toBe(true);
  });
});
