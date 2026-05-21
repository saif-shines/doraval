import { defineConfig, passthroughImageService } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightThemeGalaxy from "starlight-theme-galaxy";

export default defineConfig({
  site: "https://doraval.dev",
  redirects: {
    "/": "/get-started/",
  },
  image: {
    service: passthroughImageService(),
  },
  integrations: [
    starlight({
      plugins: [starlightThemeGalaxy()],
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
          label: "Guides",
          autogenerate: { directory: "guides" },
        },
      ],
    }),
  ],
});