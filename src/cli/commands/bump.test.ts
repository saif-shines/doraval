import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { bumpVersion, walkForTargets, planBumps, bumpPluginEntriesVersions } from "./bump.js";

describe("bumpVersion", () => {
  test("patch / minor / major", () => {
    expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4");
    expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(bumpVersion("1.2.3", "major")).toBe("2.0.0");
  });

  test("exact version", () => {
    expect(bumpVersion("1.2.3", "9.9.9")).toBe("9.9.9");
  });

  test("missing current defaults to 0.0.0", () => {
    expect(bumpVersion(undefined, "patch")).toBe("0.0.1");
  });

  test("invalid type throws", () => {
    expect(() => bumpVersion("1.0.0", "nope")).toThrow(/Invalid bump type/);
  });
});

describe("walkForTargets + planBumps", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `doraval-bump-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(root, ".claude-plugin"), { recursive: true });
    writeFileSync(
      join(root, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "demo", version: "0.1.0" }, null, 2) + "\n",
    );
    mkdirSync(join(root, "market"), { recursive: true });
    writeFileSync(
      join(root, "market", "marketplace.json"),
      JSON.stringify(
        {
          name: "mkt",
          version: "1.0.0",
          plugins: [{ name: "a", version: "1.0.0" }, { name: "b", version: "1.0.0" }],
        },
        null,
        2,
      ) + "\n",
    );
  });

  afterEach(() => {
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  });

  test("discovers plugin and marketplace manifests", () => {
    const targets = walkForTargets(root);
    expect(targets.some((t) => t.kind === "plugin")).toBe(true);
    expect(targets.some((t) => t.kind === "marketplace")).toBe(true);
  });

  test("planBumps previews without writing", () => {
    const targets = walkForTargets(root);
    const plans = planBumps(targets, root, "minor");
    const plugin = plans.find((p) => p.target.kind === "plugin");
    const mkt = plans.find((p) => p.target.kind === "marketplace");
    expect(plugin?.current).toBe("0.1.0");
    expect(plugin?.next).toBe("0.2.0");
    expect(mkt?.next).toBe("1.1.0");
    expect(mkt?.innerWouldChange).toBe(2);
    // files unchanged
    const still = JSON.parse(
      require("fs").readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8"),
    );
    expect(still.version).toBe("0.1.0");
  });
});

describe("bumpPluginEntriesVersions", () => {
  test("bumps each plugins[] version", () => {
    const plugins = [{ version: "1.0.0" }, { version: "2.0.0" }];
    expect(bumpPluginEntriesVersions(plugins, "patch")).toBe(2);
    expect(plugins[0]!.version).toBe("1.0.1");
    expect(plugins[1]!.version).toBe("2.0.1");
  });
});
