import { defineConfig, passthroughImageService } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightThemeTerminal from "starlight-theme-terminal";

export default defineConfig({
  site: "https://thehacksmith.dev",
  redirects: {
    "/": "/get-started/",
  },
  image: {
    service: passthroughImageService(),
  },
  integrations: [
    starlight({
      plugins: [starlightThemeTerminal()],
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
      ],
    }),
  ],
});