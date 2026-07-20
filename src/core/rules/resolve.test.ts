import { describe, test, expect } from "bun:test";
import { resolveEffectiveRules, overrideToState } from "./resolve.js";
import type { JournalConfig } from "../journal-config.js";

function cfg(partial: Partial<JournalConfig>): JournalConfig {
  return { journal: { repo: "", projects: {} }, ...partial };
}

describe("overrideToState", () => {
  test("off disables", () => expect(overrideToState("off", "warning")).toEqual({ enabled: false, severity: "warning" }));
  test("on enables at default", () => expect(overrideToState("on", "warning")).toEqual({ enabled: true, severity: "warning" }));
  test("fyi maps to info", () => expect(overrideToState("fyi", "error")).toEqual({ enabled: true, severity: "info" }));
  test("error sets severity", () => expect(overrideToState("error", "warning")).toEqual({ enabled: true, severity: "error" }));
});

describe("resolveEffectiveRules", () => {
  test("no rules section -> recommended package", () => {
    const { map } = resolveEffectiveRules(cfg({}));
    expect(map.get("R001")?.enabled).toBe(true);
    expect(map.get("R009")?.enabled).toBe(false);
  });

  test("global override off disables a package rule", () => {
    const { map } = resolveEffectiveRules(cfg({ rules: { package: "recommended", overrides: { "body-size": "off" } } }));
    expect(map.get("R007")?.enabled).toBe(false);
  });

  test("global override can enable a rule the package omits + set severity", () => {
    const { map } = resolveEffectiveRules(cfg({ rules: { package: "recommended", overrides: { "advanced-fields": "error" } } }));
    expect(map.get("R009")).toEqual({ enabled: true, severity: "error", overridden: true });
  });

  test("enabled without a severity override marks overridden:false (keeps emitted severity in R2)", () => {
    const { map } = resolveEffectiveRules(cfg({}));
    expect(map.get("R001")).toEqual({ enabled: true, severity: "error", overridden: false });
  });

  test("'on' enables but does NOT mark severity overridden", () => {
    const { map } = resolveEffectiveRules(cfg({ rules: { package: "minimal", overrides: { "body-size": "on" } } }));
    expect(map.get("R007")).toEqual({ enabled: true, severity: "warning", overridden: false });
  });

  test("override key accepts a code too", () => {
    const { map } = resolveEffectiveRules(cfg({ rules: { package: "recommended", overrides: { R007: "off" } } }));
    expect(map.get("R007")?.enabled).toBe(false);
  });

  test("locked rule cannot be disabled; warns", () => {
    const { map, warnings } = resolveEffectiveRules(cfg({ rules: { package: "recommended", overrides: { "no-injection": "off" } } }));
    expect(map.get("R003")?.enabled).toBe(true);
    expect(warnings.some((w) => w.includes("R003"))).toBe(true);
  });

  test("locked rule cannot be demoted to fyi; warns", () => {
    const { map, warnings } = resolveEffectiveRules(cfg({ rules: { package: "strict", overrides: { "script-security": "fyi" } } }));
    expect(map.get("R020")?.severity).toBe("warning");
    expect(warnings.some((w) => w.includes("R020"))).toBe(true);
  });

  test("project package replaces global base; project override wins", () => {
    const config = cfg({
      rules: { package: "strict" },
      journal: {
        repo: "",
        projects: {
          proj: {
            remote_path: "",
            local_path: "",
            source_dir: "/repo",
            rules: { package: "minimal", overrides: { "body-present": "off" } },
          },
        },
      },
    });
    const { map } = resolveEffectiveRules(config, "/repo");
    expect(map.get("R001")?.enabled).toBe(true);
    expect(map.get("R006")?.enabled).toBe(false);
    expect(map.get("R007")?.enabled).toBe(false);
  });

  test("unregistered cwd -> only global rules apply", () => {
    const config = cfg({ rules: { package: "minimal" } });
    const { map } = resolveEffectiveRules(config, "/not/registered");
    expect(map.get("R007")?.enabled).toBe(false);
    expect(map.get("R001")?.enabled).toBe(true);
  });
});
