import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { runDoraval } from "./helpers/spawn-cli.js";

describe("dora wire", () => {
  test("help and the docs name the start command", () => {
    const help = runDoraval(["--help"]);
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("wire");
    const json = JSON.parse(runDoraval(["--help", "--json"]).stdout) as { commands: { name: string; examples: string[] }[] };
    const wire = json.commands.find((command) => command.name === "wire");
    expect(wire?.examples).toContain("dora wire --for claude --run");
    const readme = readFileSync("README.md", "utf8");
    const page = readFileSync("apps/website/content/commands/index.mdx", "utf8");
    for (const file of [readme, page]) {
      expect(file).toContain("dora wire --for claude --run");
      expect(file).toContain("dora wire --for codex --run --chatgpt");
    }
    expect(page).toContain("Each POST, except a token-count call");
    expect(page).not.toContain("Each real turn");
    expect(page).toContain("more than 20 times in 2 seconds");
    expect(page).toContain("cookie");
    expect(page).toContain("The text files keep the raw body.");
    expect(page).not.toContain("are not in the text files");
    expect(page).toContain("The agent exited with that code.");
    const ask = readFileSync("skills/ask-dora/SKILL.md", "utf8");
    expect(ask).not.toContain("Cursor has no wire command");
    expect(ask).toContain("dora wire exits 2");
    const catalog = readFileSync("skills/review-with-dora/references/commands.md", "utf8");
    expect(catalog).toContain("--for codex --run --api-key");
    expect(catalog).toContain("`dora wire` takes `--run`");
  });

  test("cursor and a missing --run exit 2 before listening", () => {
    const cursor = runDoraval(["wire", "--for", "cursor", "--run"]);
    expect(cursor.exitCode).toBe(2);
    expect(cursor.stderr).toContain("dora session open");
    const missing = runDoraval(["wire", "--for", "claude"]);
    expect(missing.exitCode).toBe(2);
    expect(missing.stderr).toContain("--run");
  });
});
