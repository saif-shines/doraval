import { defineConfig, passthroughImageService } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightThemeTerminal from "starlight-theme-terminal";

export default defineConfig({
  site: "https://doraval.thehacksmith.dev",
  redirects: {
    "/get-started/quickstart-distributors": "/get-started/quickstart/",
    "/get-started/quickstart-orchestrators": "/get-started/quickstart/",
    "/commands/journal-add": "/commands/memory-add/",
    "/commands/journal-list": "/commands/memory-list/",
    "/commands/journal-sync": "/commands/memory-sync/",
    "/commands/journal-update": "/commands/memory-sync/",
    "/commands/journal-init": "/concepts/memory/",
    "/concepts/agent-journal": "/concepts/memory/",
    "/concepts/journal-rationale": "/concepts/memory/",
  },
  image: {
    service: passthroughImageService(),
  },
  integrations: [
    starlight({
      components: {
        Hero: "./src/components/Hero.astro",
      },
      plugins: [starlightThemeTerminal()],
      expressiveCode: {
        themes: ["github-dark", "github-light"],
        styleOverrides: {
          frames: {
            tooltipSuccessBackground: "#22c55e",
          },
        },
      },
      title: "doraval",
      description:
        "Scale your AI context for coding agents. Make your next context work (skills, plugins & more) for your team, community, or self. Context engineering toolkit for AI coding agents.",
      customCss: ["./src/styles/custom.css"],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/saif-shines/doraval",
        },
      ],
      sidebar: [
        {
          label: "Get started",
          items: [
            "get-started",
            "get-started/installation",
            "get-started/quickstart",
          ],
        },
        {
          label: "Validate & check",
          items: [
            "commands/validate",
            "commands/lint",
            "commands/drift",
            "commands/eval",
            "commands/evals-setup",
            "commands/judge",
            "commands/providers",
          ],
        },
        {
          label: "Scaffold for agents",
          items: [
            { label: "claude / codex / cursor / copilot new", link: "/commands/claude-new/" },
            "commands/init",
          ],
        },
        {
          label: "Memory",
          items: [
            "concepts/memory",
            "commands/memory-add",
            "commands/memory-list",
            "commands/memory-context",
            "commands/memory-promote",
            "commands/memory-stash",
            "commands/memory-restore",
            "commands/memory-sync",
          ],
        },
        {
          label: "CLI reference",
          items: [
            "commands/ui",
            "commands/config",
            "commands/bump",
            "commands/completion",
            { label: "update", link: "/commands/update/" },
          ],
        },
        {
          label: "Concepts",
          items: [{ autogenerate: { directory: "concepts" } }],
        },
      ],
    }),
  ],
});