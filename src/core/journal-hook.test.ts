import { describe, expect, test } from "bun:test";
import {
  LEGACY_JOURNAL_HOOK_COMMAND,
  buildJournalHookCommand,
  isJournalHookCommand,
  resolveDoraBinary,
} from "./journal-hook.js";

describe("journal-hook", () => {
  test("isJournalHookCommand matches legacy and modern commands", () => {
    expect(isJournalHookCommand(LEGACY_JOURNAL_HOOK_COMMAND)).toBe(true);
    expect(isJournalHookCommand("/usr/bin/dora journal context --json")).toBe(true);
    expect(isJournalHookCommand("echo hello")).toBe(false);
  });

  test("buildJournalHookCommand uses absolute path and --json by default", () => {
    const cmd = buildJournalHookCommand({ doraPath: "/opt/dora" });
    expect(cmd).toBe("/opt/dora journal context --json");
    expect(cmd).not.toContain("2>/dev/null");
  });

  test("buildJournalHookCommand quiet wraps errors", () => {
    const cmd = buildJournalHookCommand({ doraPath: "/opt/dora", quiet: true });
    expect(cmd).toContain("2>/dev/null || true");
    expect(cmd).toContain("--quiet");
  });

  test("resolveDoraBinary returns a non-empty string", () => {
    const bin = resolveDoraBinary();
    expect(bin.length).toBeGreaterThan(0);
    expect(bin === "dora" || bin.includes("dora")).toBe(true);
  });
});