import { describe, expect, test } from "bun:test";
import { isRecentInstall, isRemoveCandidate } from "./skill-remove.js";
import { SESSION_MAX_AGE_DAYS } from "./session-adapters/types.js";

describe("isRemoveCandidate", () => {
  test("Authored + never invoked + not a Recent install is a Remove candidate", () => {
    expect(isRemoveCandidate({ origin: "authored", invoked: false, recentInstall: false })).toBe(true);
  });

  test("Recent install is not a Remove candidate", () => {
    expect(isRemoveCandidate({ origin: "authored", invoked: false, recentInstall: true })).toBe(false);
  });

  test("Global is not a Remove candidate", () => {
    expect(isRemoveCandidate({ origin: "global", invoked: false, recentInstall: false })).toBe(false);
  });

  test("Invoked Authored Skill is not a Remove candidate", () => {
    expect(isRemoveCandidate({ origin: "authored", invoked: true, recentInstall: false })).toBe(false);
  });

  test("Imported is not a Remove candidate", () => {
    expect(isRemoveCandidate({ origin: "imported", invoked: false, recentInstall: false })).toBe(false);
  });
});

describe("isRecentInstall", () => {
  const day = 24 * 60 * 60 * 1000;
  const now = 1_700_000_000_000;

  test("mtime inside the Review window is a Recent install", () => {
    expect(isRecentInstall(now - day, now)).toBe(true);
  });

  test("mtime older than the Review window is not a Recent install", () => {
    expect(isRecentInstall(now - (SESSION_MAX_AGE_DAYS + 1) * day, now)).toBe(false);
  });
});
