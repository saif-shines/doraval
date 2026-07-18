import { describe, expect, test } from "bun:test";
import {
  shouldEmitProgress,
  scanPreflightMessage,
  reviewPreflightMessage,
  reconcilePreflightMessage,
  memorySyncPreflightMessage,
} from "./preflight.js";

describe("shouldEmitProgress", () => {
  test("silent in json mode", () => {
    expect(shouldEmitProgress({ format: "json" })).toBe(false);
  });
  test("emits in table mode", () => {
    expect(shouldEmitProgress({ format: "table" })).toBe(true);
  });
});

describe("message builders", () => {
  test("scan is read-only, no LLM", () => {
    const m = scanPreflightMessage();
    expect(m).toContain("Scanning agent context");
    expect(m.toLowerCase()).toContain("no llm");
    expect(m.toLowerCase()).toMatch(/read-only|no writes/);
  });

  test("scan message names target dir when given", () => {
    const m = scanPreflightMessage("/tmp/my-proj");
    expect(m).toContain("/tmp/my-proj");
    expect(m).toContain("Scanning agent context");
  });

  test("review quick excludes LLM", () => {
    const m = reviewPreflightMessage({ quick: true });
    expect(m.toLowerCase()).toContain("structure");
    expect(m.toLowerCase()).toMatch(/no llm|without llm|tiers 1/);
  });

  test("review default mentions LLM may run", () => {
    const m = reviewPreflightMessage({ quick: false, deep: false });
    expect(m.toLowerCase()).toMatch(/llm|judge/);
  });

  test("review deep requires LLM", () => {
    const m = reviewPreflightMessage({ deep: true });
    expect(m.toLowerCase()).toMatch(/llm|judge|require/);
  });

  test("reconcile dry-run is plan-only", () => {
    const m = reconcilePreflightMessage({ dryRun: true });
    expect(m.toLowerCase()).toMatch(/dry|no write|plan/);
  });

  test("reconcile apply may write", () => {
    const m = reconcilePreflightMessage({ apply: true });
    expect(m.toLowerCase()).toMatch(/write|apply/);
  });

  test("memory sync mentions network", () => {
    const m = memorySyncPreflightMessage();
    expect(m.toLowerCase()).toMatch(/network|gh|sync/);
  });
});
