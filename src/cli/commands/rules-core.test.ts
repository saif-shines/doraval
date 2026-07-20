import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readConfig, type JournalConfig } from "../../core/journal-config.js";
import rulesCommand from "./rules.js";
import {
  applyOverride,
  applyPackage,
  buildListRows,
  displaySeverity,
  explainRule,
  formatRulesListHuman,
  listSeverityLabel,
  persist,
  readRulesConfig,
  readScopeRules,
  resolveListPackageName,
  resolveScope,
  validatePackagePreview,
} from "./rules-core.js";

test("rules command exports a citty command", () => {
  expect(rulesCommand).toBeDefined();
  expect(Object.keys(rulesCommand.subCommands ?? {})).toEqual([
    "list",
    "on",
    "off",
    "set",
    "package",
    "explain",
  ]);
});

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

  test("rejects simultaneous --global and --project", () => {
    const result = resolveScope(cfg(), { global: true, project: true, cwd: "/repo" });
    expect(result).toEqual({ ok: false, error: "Choose either --global or --project, not both." });
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
    expect(applyOverride(cfg(), { kind: "global" }, "R003", "warning").ok).toBe(false);
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

describe("validatePackagePreview", () => {
  test("rejects unknown package previews", () => {
    expect(validatePackagePreview("bogus")).toContain('Unknown package "bogus"');
    expect(validatePackagePreview("strict")).toBeNull();
  });
});

describe("buildListRows", () => {
  test("returns each rule with its effective package state", () => {
    const rows = buildListRows(cfg({}, { package: "recommended" }), "/x");
    expect(rows).toHaveLength(33);
    expect(rows.find((row) => row.slug === "body-size")?.enabled).toBe(true);
    expect(rows.find((row) => row.slug === "advanced-fields")?.enabled).toBe(false);
  });

  test("previews the requested package", () => {
    const rows = buildListRows(cfg({}, { package: "minimal" }), "/x", "strict");
    expect(rows.every((row) => row.enabled)).toBe(true);
  });

  test("labels info severity as FYI", () => {
    expect(buildListRows(null, "/x").some((row) => row.severity === "FYI")).toBe(true);
  });
});

describe("formatRulesListHuman", () => {
  test("headers package/scope counts and groups by tier", () => {
    const rows = buildListRows(cfg({}, { package: "recommended" }), "/x");
    const lines = formatRulesListHuman(rows, {
      packageName: "recommended",
      scopeLabel: "scope: global",
    });
    expect(lines[0]).toMatch(/^package: recommended · scope: global · \d+ on · \d+ off$/);
    expect(lines).toContain("Structure");
    expect(lines).toContain("Heuristic");
    expect(lines).toContain("LLM");
    expect(lines).toContain("Session");
    const advanced = lines.find((line) => line.includes("R009"));
    expect(advanced).toContain("off");
    expect(advanced).not.toMatch(/\bFYI\b/);
    const sessionFyi = lines.find((line) => line.includes("R028"));
    expect(sessionFyi).toContain("FYI");
  });

  test("listSeverityLabel is off when disabled", () => {
    expect(listSeverityLabel({ enabled: false, severity: "FYI" })).toBe("off");
    expect(listSeverityLabel({ enabled: true, severity: "warning" })).toBe("warning");
  });

  test("resolveListPackageName prefers preview then project then global", () => {
    expect(resolveListPackageName(null, "/x")).toBe("recommended");
    expect(resolveListPackageName(cfg({}, { package: "minimal" }), "/x")).toBe("minimal");
    expect(resolveListPackageName(cfg({}, { package: "minimal" }), "/x", "strict")).toBe("strict");
  });
});

describe("explainRule", () => {
  test("explains code or slug with docs and effective state", () => {
    const result = explainRule(cfg({}, { package: "recommended" }), "/x", "R003");
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.lines.join("\n");
      expect(output).toContain("no-injection");
      expect(output).toContain("/reference/rules/R003");
      expect(output).toMatch(/locked/i);
    }
  });

  test("rejects an unknown rule", () => {
    expect(explainRule(null, "/x", "nope").ok).toBe(false);
  });
});

describe("displaySeverity", () => {
  test("renders info as FYI", () => {
    expect(displaySeverity("info")).toBe("FYI");
    expect(displaySeverity("error")).toBe("error");
  });
});

async function readPersistedRules(raw: string) {
  const home = mkdtempSync(join(tmpdir(), "dora-rules-validation-"));
  const previous = process.env.DORAVAL_HOME;
  process.env.DORAVAL_HOME = home;
  try {
    await Bun.write(join(home, "config.yml"), raw);
    return await readRulesConfig();
  } finally {
    if (previous === undefined) delete process.env.DORAVAL_HOME;
    else process.env.DORAVAL_HOME = previous;
    rmSync(home, { recursive: true, force: true });
  }
}

describe("readRulesConfig RulesConfig validation", () => {
  const root = "journal:\n  repo: ''\n  projects: {}\n";
  const project = (rules: string) =>
    `journal:\n  repo: ''\n  projects:\n    demo:\n      remote_path: ''\n      local_path: ''\n      rules:\n${rules}\n`;

  test.each([
    ["global rules object", `${root}rules: nope\n`, "rules must be an object"],
    ["global unknown field", `${root}rules:\n  extra: true\n`, 'unknown field "rules.extra"'],
    ["global package", `${root}rules:\n  package: bogus\n`, "rules.package"],
    ["global overrides object", `${root}rules:\n  overrides: nope\n`, "rules.overrides"],
    ["global unknown key", `${root}rules:\n  overrides:\n    nope: off\n`, 'unknown rule "nope"'],
    ["global invalid value", `${root}rules:\n  overrides:\n    body-size: loud\n`, "rules.overrides.body-size"],
    ["project rules object", project("        nope"), "journal.projects.demo.rules"],
    ["project package", project("        package: bogus"), "journal.projects.demo.rules.package"],
    ["project overrides object", project("        overrides: nope"), "journal.projects.demo.rules.overrides"],
    ["project unknown key", project("        overrides:\n          nope: off"), 'unknown rule "nope"'],
    ["project invalid value", project("        overrides:\n          R007: loud"), "journal.projects.demo.rules.overrides.R007"],
  ])("rejects malformed %s", async (_name, raw, expected) => {
    const result = await readPersistedRules(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(expected);
  });

  test("accepts code and slug override keys at both scopes", async () => {
    const result = await readPersistedRules(
      `${root}rules:\n  package: strict\n  overrides:\n    R007: off\njournal:\n  repo: ''\n  projects:\n    demo:\n      remote_path: ''\n      local_path: ''\n      rules:\n        package: minimal\n        overrides:\n          body-size: warning\n`,
    );
    expect(result.ok).toBe(true);
  });
});

test("readRulesConfig rejects malformed persisted config without throwing", async () => {
  const home = mkdtempSync(join(tmpdir(), "dora-rules-malformed-"));
  const previous = process.env.DORAVAL_HOME;
  process.env.DORAVAL_HOME = home;
  try {
    await Bun.write(join(home, "config.yml"), "journal: nope\n");
    const result = await readRulesConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Invalid doraval config");
  } finally {
    if (previous === undefined) delete process.env.DORAVAL_HOME;
    else process.env.DORAVAL_HOME = previous;
    rmSync(home, { recursive: true, force: true });
  }
});

test("persist round-trips config through DORAVAL_HOME", async () => {
  const home = mkdtempSync(join(tmpdir(), "dora-rules-"));
  const previous = process.env.DORAVAL_HOME;
  process.env.DORAVAL_HOME = home;
  try {
    await persist(cfg({}, { package: "strict", overrides: { "body-size": "off" } }));
    const saved = await readConfig();
    expect(saved?.rules).toEqual({ package: "strict", overrides: { "body-size": "off" } });
  } finally {
    if (previous === undefined) delete process.env.DORAVAL_HOME;
    else process.env.DORAVAL_HOME = previous;
    rmSync(home, { recursive: true, force: true });
  }
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
