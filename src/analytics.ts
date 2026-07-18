import { PostHog } from "posthog-node";
import { createHash } from "node:crypto";
import { hostname } from "node:os";

const apiKey = process.env.POSTHOG_API_KEY ?? "";
const host = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

export const posthog = new PostHog(apiKey, {
  host,
  flushAt: 1,
  flushInterval: 0,
  enableExceptionAutocapture: true,
});

/** Stable anonymous ID derived from the machine hostname. */
export const anonymousId = createHash("sha256").update(hostname()).digest("hex").slice(0, 32);
