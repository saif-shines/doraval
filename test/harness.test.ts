import { dirname, join } from "path";
import { existsSync } from "fs";
import { spawnSync } from "bun";
import { describe, expect, test } from "bun:test";
import { runDoraval } from "./helpers/spawn-cli.js";

/** PATH that can run bun but has no `hermes` binary. */
function pathWithoutHermes(): string {
  const bun = spawnSync(["which", "bun"], { stdout: "pipe", stderr: "pipe" }).stdout.toString().trim();
  const keep = new Set([dirname(bun), "/usr/bin", "/bin", "/usr/sbin", "/sbin"]);
  return (process.env.PATH ?? "")
    .split(":")
    .filter((dir) => keep.has(dir) || (dir && !existsSync(join(dir, "hermes"))))
    .join(":");
}

describe("dora harness", () => {
  test("dora harness --help lists the verbs", () => {
    const { exitCode, stdout, stderr } = runDoraval(["harness", "--help"]);
    const out = stdout + stderr;
    expect(exitCode).toBe(0);
    for (const verb of ["new", "boot", "pause", "resume", "list", "open"]) {
      expect(out).toContain(verb);
    }
  });

  test("dora --help names harness", () => {
    const { exitCode, stdout } = runDoraval(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("harness");
  });

  test("dora --help --json names harness", () => {
    const { exitCode, stdout } = runDoraval(["--help", "--json"]);
    expect(exitCode).toBe(0);
    const m = JSON.parse(stdout);
    expect(m.commands.some((c: { name: string }) => c.name === "harness")).toBe(true);
  });

  test("empty dora harness list reports no routines", () => {
    const { exitCode, stdout, stderr } = runDoraval(["harness", "list"]);
    expect(exitCode).toBe(0);
    expect(stdout + stderr).toMatch(/no routines/i);
  });

  for (const verb of ["boot", "pause", "resume"] as const) {
    test(`missing Hermes: ${verb} prints official install steps and stops`, () => {
      const { exitCode, stdout, stderr } = runDoraval(["harness", verb], {
        env: { PATH: pathWithoutHermes() },
      });
      const out = stdout + stderr;
      expect(exitCode).not.toBe(0);
      expect(out).toContain("https://hermes-agent.nousresearch.com/install.sh");
      expect(out.toLowerCase()).not.toMatch(/started|job started|booted/);
    });
  }
});
