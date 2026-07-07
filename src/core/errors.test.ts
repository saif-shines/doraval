import { describe, expect, test } from "bun:test";
import {
  DoravalError,
  ValidationError,
  ConfigError,
  NetworkError,
  PrerequisiteError,
  ScaffoldError,
  isDoravalError,
  errorToJson,
} from "./errors.js";

describe("DoravalError", () => {
  test("carries code, suggestion, docUrl, context", () => {
    const err = new DoravalError({
      code: "E-CFG-001",
      message: "config.yml is not valid YAML",
      suggestion: "Fix the syntax or delete ~/.doraval/config.yml to reset",
      docUrl: "https://doraval.dev/errors#e-cfg-001",
      context: "reading ~/.doraval/config.yml",
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("E-CFG-001");
    expect(err.message).toBe("config.yml is not valid YAML");
    expect(err.suggestion).toContain("Fix the syntax");
    expect(err.docUrl).toContain("#e-cfg-001");
    expect(err.context).toBe("reading ~/.doraval/config.yml");
  });

  test("subclasses enforce their code family prefix", () => {
    expect(() => new ValidationError({ code: "E-CFG-001", message: "x" })).toThrow(
      /ValidationError requires an E-VAL code/
    );
    expect(new ValidationError({ code: "E-VAL-003", message: "x" }).code).toBe("E-VAL-003");
    expect(new ConfigError({ code: "E-CFG-002", message: "x" }).code).toBe("E-CFG-002");
    expect(new NetworkError({ code: "E-NET-001", message: "x" }).code).toBe("E-NET-001");
    expect(new PrerequisiteError({ code: "E-PRE-001", message: "x" }).code).toBe("E-PRE-001");
    expect(new ScaffoldError({ code: "E-SCF-001", message: "x" }).code).toBe("E-SCF-001");
  });

  test("isDoravalError narrows correctly", () => {
    expect(isDoravalError(new DoravalError({ code: "E-VAL-001", message: "x" }))).toBe(true);
    expect(isDoravalError(new Error("plain"))).toBe(false);
    expect(isDoravalError("string")).toBe(false);
  });

  test("errorToJson produces the stderr JSON contract shape", () => {
    const err = new ValidationError({
      code: "E-VAL-003",
      message: 'unknown field "scope"',
      suggestion: 'Rename to "paths"',
    });
    expect(errorToJson(err)).toEqual({
      error: {
        code: "E-VAL-003",
        message: 'unknown field "scope"',
        suggestion: 'Rename to "paths"',
      },
    });
  });
});
