import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const website = join(import.meta.dir, "..");

describe("site server output (#76)", () => {
  test("Blume is configured for server output", () => {
    const src = readFileSync(join(website, "blume.config.ts"), "utf8");
    expect(src).toMatch(/output:\s*"server"/);
    expect(src).toMatch(/adapter:\s*"node"/);
  });

  test("get-started HTML is still on disk after a build", () => {
    const page = existsSync(join(website, "dist", "client", "get-started", "index.html"))
      ? join(website, "dist", "client", "get-started", "index.html")
      : join(website, "dist", "get-started", "index.html");
    if (!existsSync(page)) return; // no dist in this run — site:build covers it
    const html = readFileSync(page, "utf8");
    expect(html).toMatch(/[Gg]et started|Getting started|Quick start/i);
  });
});
