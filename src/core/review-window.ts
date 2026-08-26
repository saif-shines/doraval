/** Default Review window: last 30 Sessions, 3 months. */

export const REVIEW_WINDOW_LAST = 30;
export const REVIEW_WINDOW_MAX_AGE_DAYS = 90;

export interface ReviewWindow {
  last: number;
  maxAgeDays: number;
}

export interface ReviewWindowConfig {
  review_window?: { last?: number; max_age_days?: number };
}

function positiveInt(n: unknown, fallback: number): number {
  const v = typeof n === "string" && n.trim() !== "" ? Number(n) : n;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

/** Flag > config > default. Invalid values fall back. */
export function resolveReviewWindow(opts?: {
  last?: number;
  maxAgeDays?: number;
  config?: ReviewWindowConfig | null;
}): ReviewWindow {
  const cfg = opts?.config?.review_window;
  return {
    last: positiveInt(opts?.last, positiveInt(cfg?.last, REVIEW_WINDOW_LAST)),
    maxAgeDays: positiveInt(opts?.maxAgeDays, positiveInt(cfg?.max_age_days, REVIEW_WINDOW_MAX_AGE_DAYS)),
  };
}
