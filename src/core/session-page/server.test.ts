import { describe, expect, test } from "bun:test";
import { startSessionPage } from "./server.ts";

describe("startSessionPage", () => {
  test("serves the page on loopback and rejects a missing folder", async () => {
    const server = startSessionPage(0);
    try {
      const page = await fetch(`http://127.0.0.1:${server.port}/`);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain("Grok sessions");
      const missing = await fetch(`http://127.0.0.1:${server.port}/api/sessions?root=/no/such/doraval-folder`);
      expect(missing.status).toBe(404);
    } finally {
      server.stop(true);
    }
  });
});
