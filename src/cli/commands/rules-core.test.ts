import { describe, expect, test } from "bun:test";
import type { JournalConfig } from "../../core/journal-config.js";
import { applyOverride, applyPackage, readScopeRules, resolveScope } from "./rules-core.js";

const cfg = (
  projects: JournalConfig["journal"]["projects"] = {},
  rules?: JournalConfig["rules"],
): JournalConfig => ({ journal: { repo: "", projects }, ...(rules ? { rules } : {}) });

describe("resolveScope", () => {
  test("defaults to project when cwd is registered", () => {
    const config = cfg({ doraval: { remote_path: "", local_path: "", source_dir: "/repo" } });
    expect(resolveScope(config, { cwd: "/repo" })).toEqual({
      ok: true,
      scope: { kind: "project", name: "doraval" },
    });
  });

  test("defaults to global when cwd is not registered", () => {
    expect(resolveScope(cfg(), { cwd: "/elsewhere" })).toEqual({
      ok: true,
      scope: { kind: "global" },
    });
  });

  test("--global forces global even inside a project", () => {
    const config = cfg({ doraval: { remote_path: "", local_path: "", source_dir: "/repo" } });
    expect(resolveScope(config, { global: true, cwd: "/repo" })).toEqual({
      ok: true,
      scope: { kind: "global" },
    });
  });

  test("--project on unregistered cwd refuses with guidance", () => {
    const result = resolveScope(cfg(), { project: true, cwd: "/nope" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Not a registered project/);
  });
});

describe("applyOverride", () => {
  test("stores overrides by slug at global scope", () => {
    const result = applyOverride(cfg(), { kind: "global" }, "R007", "off");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config.rules?.overrides?.["body-size"]).toBe("off");
  });

  test("sets a severity", () => {
    const result = applyOverride(cfg(), { kind: "global" }, "drift-trigger", "error");
    if (result.ok) expect(result.config.rules?.overrides?.["drift-trigger"]).toBe("error");
  });

  test("refuses to disable or demote locked rules", () => {
    const disabled = applyOverride(cfg(), { kind: "global" }, "no-injection", "off");
    expect(disabled.ok).toBe(false);
    if (!disabled.ok) expect(disabled.error).toMatch(/R003 no-injection is locked/);
    expect(applyOverride(cfg(), { kind: "global" }, "R020", "fyi").ok).toBe(false);
  });

  test("rejects an unknown rule", () => {
    expect(applyOverride(cfg(), { kind: "global" }, "nope", "off").ok).toBe(false);
  });

  test("writes under a registered project", () => {
    const config = cfg({ doraval: { remote_path: "", local_path: "", source_dir: "/repo" } });
    const result = applyOverride(config, { kind: "project", name: "doraval" }, "body-size", "off");
    if (result.ok) {
      expect(result.config.journal.projects.doraval?.rules?.overrides?.["body-size"]).toBe("off");
    }
  });

  test("does not mutate the input config", () => {
    const config = cfg();
    applyOverride(config, { kind: "global" }, "body-size", "off");
    expect(config.rules).toBeUndefined();
  });
});

describe("applyPackage", () => {
  test("sets a known base package", () => {
    const result = applyPackage(cfg(), { kind: "global" }, "strict");
    if (result.ok) expect(result.config.rules?.package).toBe("strict");
  });

  test("rejects an unknown package", () => {
    expect(applyPackage(cfg(), { kind: "global" }, "bogus").ok).toBe(false);
  });
});

describe("readScopeRules", () => {
  test("reads global rules", () => {
    expect(readScopeRules(cfg({}, { package: "strict" }), { kind: "global" })).toEqual({
      package: "strict",
    });
  });

  test("reads project rules", () => {
    const config = cfg({
      doraval: {
        remote_path: "",
        local_path: "",
        source_dir: "/repo",
        rules: { package: "minimal" },
      },
    });
    expect(readScopeRules(config, { kind: "project", name: "doraval" })).toEqual({
      package: "minimal",
    });
  });

  test("empty when scope has no rules", () => {
    expect(readScopeRules(cfg(), { kind: "global" })).toEqual({});
  });
});
