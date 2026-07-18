import { describe, expect, test } from "bun:test";
import { shouldConfirmScan } from "./scan.js";

describe("shouldConfirmScan", () => {
  test("prompts on interactive table mode", () => {
    expect(
      shouldConfirmScan({ format: "table", yes: false, stdinTty: true, stderrTty: true })
    ).toBe(true);
  });

  test("skips for json", () => {
    expect(
      shouldConfirmScan({ format: "json", yes: false, stdinTty: true, stderrTty: true })
    ).toBe(false);
  });

  test("skips for --yes", () => {
    expect(
      shouldConfirmScan({ format: "table", yes: true, stdinTty: true, stderrTty: true })
    ).toBe(false);
  });

  test("skips when not a TTY", () => {
    expect(
      shouldConfirmScan({ format: "table", yes: false, stdinTty: false, stderrTty: true })
    ).toBe(false);
    expect(
      shouldConfirmScan({ format: "table", yes: false, stdinTty: true, stderrTty: false })
    ).toBe(false);
  });
});
