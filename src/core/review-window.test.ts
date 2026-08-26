import { describe, expect, test } from "bun:test";
import { resolveReviewWindow } from "./review-window.js";

describe("resolveReviewWindow", () => {
  test("defaults are last 30 and 90 days", () => {
    expect(resolveReviewWindow()).toEqual({ last: 30, maxAgeDays: 90 });
    expect(resolveReviewWindow({ config: null })).toEqual({ last: 30, maxAgeDays: 90 });
  });

  test("config overrides defaults", () => {
    expect(resolveReviewWindow({
      config: { review_window: { last: 5, max_age_days: 14 } },
    })).toEqual({ last: 5, maxAgeDays: 14 });
  });

  test("flags override config", () => {
    expect(resolveReviewWindow({
      last: 3,
      maxAgeDays: 7,
      config: { review_window: { last: 5, max_age_days: 14 } },
    })).toEqual({ last: 3, maxAgeDays: 7 });
  });

  test("invalid values fall back", () => {
    expect(resolveReviewWindow({ last: 0, maxAgeDays: -1 })).toEqual({ last: 30, maxAgeDays: 90 });
  });

  test("numeric strings from YAML count", () => {
    expect(resolveReviewWindow({
      config: { review_window: { last: "8" as unknown as number, max_age_days: "21" as unknown as number } },
    })).toEqual({ last: 8, maxAgeDays: 21 });
  });
});
