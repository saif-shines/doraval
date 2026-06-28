import { defineConfig, passthroughImageService } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightThemeTerminal from "starlight-theme-terminal";

export default defineConfig({
  site: "https://doraval.thehacksmith.dev",
  redirects: {
    "/get-started/quickstart-distributors": "/get-started/quickstart/",
    "/get-started/quickstart-orchestrators": "/get-started/quickstart/",
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
          label: "Decision journal",
          items: [
            "commands/journal-init",
            "commands/journal-list",
            "commands/journal-add",
            "commands/journal-sync",
            "commands/journal-update",
          ],
        },
        {
          label: "CLI reference",
          items: [
            "commands/ui",
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