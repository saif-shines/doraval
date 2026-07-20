import { defineConfig } from "blume";

/** Exact-path redirects (Blume has no wildcards). One `from` per path; dual slash variants collide. */
function redirs(pairs: Array<[string, string]>) {
  return pairs.map(([from, to]) => ({
    from: from.replace(/\/$/, "") || "/",
    to: to === "/" ? "/" : to.endsWith("/") ? to : `${to}/`,
    status: 301 as const,
  }));
}

export default defineConfig({
  title: "doraval",
  description:
    "Make agent context work on every try. Context engineering toolkit for coding agents: scan, review, fix, and remember skills, plugins, and decisions across Claude, Cursor, Codex, Copilot, and Grok.",
  content: {
    root: "content",
  },
  github: {
    owner: "saif-shines",
    repo: "doraval",
    branch: "main",
  },
  theme: {
    accent: "oklch(58% 0.20 256)",
    radius: "sm",
    mode: "system",
    fonts: {
      display: "space-grotesk",
      body: "inter",
      mono: "jetbrains-mono",
    },
  },
  deployment: {
    site: "https://doraval.dev",
    output: "static",
  },
  ai: {
    llmsTxt: true,
  },
  analytics: {
    // phc_ is the PostHog project API key — public by design, safe to ship client-side.
    posthog: {
      key: "phc_qoiWD2nLqWXw2DmYVBsUb36GBMZyNNjvLoPxZY3vPkzB",
      host: "https://us.i.posthog.com",
    },
  },
  seo: {
    og: { enabled: true },
    sitemap: true,
    robots: true,
  },
  // Rule detail pages are sidebar.hidden (catalog is the only nav entry) but
  // still need to be findable when someone searches for a code or slug.
  search: {
    indexing: {
      includeHiddenPages: true,
    },
  },
  redirects: redirs([
    // Pre-rename leftovers only (journal → memory, validate → review, …)
    ["/get-started/quickstart-distributors", "/get-started/quickstart/"],
    ["/get-started/quickstart-orchestrators", "/get-started/quickstart/"],
    ["/commands/journal-add", "/commands/"],
    ["/commands/journal-list", "/commands/"],
    ["/commands/journal-sync", "/commands/"],
    ["/commands/journal-update", "/commands/"],
    ["/commands/journal-init", "/concepts/memory/"],
    ["/concepts/agent-journal", "/concepts/memory/"],
    ["/concepts/journal-rationale", "/concepts/memory/"],
    ["/commands/validate", "/commands/"],
    ["/commands/lint", "/commands/"],
    ["/commands/drift", "/commands/"],
    ["/commands/eval", "/commands/"],
    ["/commands/evals-setup", "/commands/"],
    ["/commands/judge", "/commands/"],
    ["/commands/init", "/commands/"],
    ["/commands/claude-new", "/commands/"],
    ["/commands/codex-new", "/commands/"],
    ["/commands/cursor-new", "/commands/"],
    ["/commands/copilot-new", "/commands/"],
    ["/commands/ui", "/"],
    ["/commands/memory-add", "/commands/"],
    ["/commands/memory-list", "/commands/"],
    ["/commands/memory-context", "/commands/"],
    ["/commands/memory-promote", "/commands/"],
    ["/commands/memory-stash", "/commands/"],
    ["/commands/memory-restore", "/commands/"],
    ["/commands/memory-sync", "/commands/"],
    ["/concepts/three-tier-verification", "/concepts/review-tiers/"],
  ]),

});
