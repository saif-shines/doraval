import { defineConfig, passthroughImageService } from "astro/config";
import starlight from "@astrojs/starlight";
import lucode from "lucode-starlight";

export default defineConfig({
  site: "https://thehacksmith.dev",
  image: {
    service: passthroughImageService(),
  },
  integrations: [
    starlight({
      plugins: [lucode()],
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
        "The context engineering toolkit for coding agents",
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
          autogenerate: { directory: "get-started" },
        },
        {
          label: "Validate & check",
          items: [
            "commands/validate",
            "commands/drift",
            "commands/judge",
          ],
        },
        {
          label: "Scaffold for agents",
          items: [
            { label: "claude new (codex new)", link: "/commands/claude-new/" }
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
          label: "Keep doraval current",
          items: [
            { label: "update", link: "/commands/update/" },
          ],
        },
        {
          label: "Concepts",
          autogenerate: { directory: "concepts" },
        },
      ],
    }),
  ],
});