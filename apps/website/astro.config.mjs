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
        "Lint and measure drift for AI agent skills and plugins",
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
          label: "Get Started",
          autogenerate: { directory: "get-started" },
        },
        {
          label: "Commands",
          autogenerate: { directory: "commands" },
        },
        {
          label: "Concepts",
          autogenerate: { directory: "concepts" },
        },
      ],
    }),
  ],
});