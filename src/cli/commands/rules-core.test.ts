import { describe, expect, test } from "bun:test";
import type { JournalConfig } from "../../core/journal-config.js";
import { readScopeRules, resolveScope } from "./rules-core.js";

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
