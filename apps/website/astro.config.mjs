import { defineConfig, passthroughImageService } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightThemeTerminal from "starlight-theme-terminal";

export default defineConfig({
  site: "https://doraval.thehacksmith.dev",
  redirects: {
    "/get-started/quickstart": "/get-started/",
  },
  image: {
    service: passthroughImageService(),
  },
  integrations: [
    starlight({
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
        "The context engineering toolkit for coding agent orchestrators",
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
            "get-started/quickstart-distributors",
            "get-started/quickstart-orchestrators",
          ],
        },
        {
          label: "Validate & check",
          items: [
            "commands/validate",
            "commands/drift",
            "commands/eval",
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