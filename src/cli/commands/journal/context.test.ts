import { describe, expect, test } from "bun:test";
import { formatJournalHookJson } from "./context.js";

describe("journal context", () => {
  test("formatJournalHookJson emits Claude hook payload", () => {
    const raw = formatJournalHookJson("Decision one\n");
    const parsed = JSON.parse(raw);
    expect(parsed.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(parsed.hookSpecificOutput.additionalContext).toBe("Decision one\n");
  });
});