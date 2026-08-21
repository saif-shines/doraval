import type { SkillOrigin } from "./skill-classify.js";
import { withinWindow } from "./session-adapters/types.js";

export function isRecentInstall(mtimeMs: number, nowMs: number = Date.now()): boolean {
  return withinWindow(mtimeMs, nowMs);
}

export function isRemoveCandidate(input: {
  origin: SkillOrigin;
  invoked: boolean;
  recentInstall: boolean;
}): boolean {
  return input.origin === "authored" && !input.invoked && !input.recentInstall;
}
