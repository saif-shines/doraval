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
    site: "https://doraval.thehacksmith.dev",
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
  redirects: redirs([
    ["/get-started/quickstart-distributors", "/get-started/quickstart/"],
    ["/get-started/quickstart-orchestrators", "/get-started/quickstart/"],
    ["/commands/journal-add", "/commands/memory/"],
    ["/commands/journal-list", "/commands/memory/"],
    ["/commands/journal-sync", "/commands/memory/"],
    ["/commands/journal-update", "/commands/memory/"],
    ["/commands/journal-init", "/concepts/memory/"],
    ["/concepts/agent-journal", "/concepts/memory/"],
    ["/concepts/journal-rationale", "/concepts/memory/"],
    ["/commands/validate", "/commands/review/"],
    ["/commands/lint", "/commands/review/"],
    ["/commands/drift", "/commands/review/"],
    ["/commands/eval", "/commands/review/"],
    ["/commands/evals-setup", "/commands/review/"],
    ["/commands/judge", "/commands/review/"],
    ["/commands/init", "/commands/new/"],
    ["/commands/claude-new", "/commands/new/"],
    ["/commands/codex-new", "/commands/new/"],
    ["/commands/cursor-new", "/commands/new/"],
    ["/commands/copilot-new", "/commands/new/"],
    ["/commands/ui", "/"],
    ["/commands/memory-add", "/commands/memory/"],
    ["/commands/memory-list", "/commands/memory/"],
    ["/commands/memory-context", "/commands/memory/"],
    ["/commands/memory-promote", "/commands/memory/"],
    ["/commands/memory-stash", "/commands/memory/"],
    ["/commands/memory-restore", "/commands/memory/"],
    ["/commands/memory-sync", "/commands/memory/"],
    ["/concepts/three-tier-verification", "/concepts/review-tiers/"],
  ]),
});
