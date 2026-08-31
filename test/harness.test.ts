import { dirname, join } from "path";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { spawnSync } from "bun";
import { describe, expect, test } from "bun:test";
import { runDoraval } from "./helpers/spawn-cli.js";
import { writeRoutine } from "../src/core/routine.js";

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
    const home = mkdtempSync(join(tmpdir(), "dora-harness-empty-"));
    const { exitCode, stdout, stderr } = runDoraval(["harness", "list"], { env: { HOME: home } });
    expect(exitCode).toBe(0);
    expect(stdout + stderr).toMatch(/no routines/i);
    rmSync(home, { recursive: true, force: true });
  });

  test("dora harness list names existing slugs", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-list-"));
    writeRoutine(home, {
      slug: "ooo-calendar",
      prompt: "Check OOO.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const { exitCode, stdout, stderr } = runDoraval(["harness", "list"], { env: { HOME: home } });
    expect(exitCode).toBe(0);
    expect(stdout + stderr).toContain("ooo-calendar");
    rmSync(home, { recursive: true, force: true });
  });

  test("dora harness open without a slug exits non-zero", () => {
    const { exitCode, stdout, stderr } = runDoraval(["harness", "open"]);
    expect(exitCode).not.toBe(0);
    expect(stdout + stderr).toMatch(/slug/i);
  });

  test("dora harness open prints the routine folder", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-opened-"));
    const dir = writeRoutine(home, {
      slug: "ooo-calendar",
      prompt: "Check OOO.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const bin = mkdtempSync(join(tmpdir(), "dora-open-bin-"));
    for (const name of ["open", "xdg-open", "explorer"]) {
      writeFileSync(join(bin, name), "#!/bin/sh\nexit 0\n");
      chmodSync(join(bin, name), 0o755);
    }
    const { exitCode, stdout, stderr } = runDoraval(["harness", "open", "ooo-calendar"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(0);
    expect(stdout + stderr).toContain(dir);
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("dora harness open unknown slug exits non-zero", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-open-"));
    const { exitCode, stdout, stderr } = runDoraval(["harness", "open", "missing-slug"], {
      env: { HOME: home },
    });
    expect(exitCode).not.toBe(0);
    expect(stdout + stderr).toContain("missing-slug");
    expect(stdout + stderr.toLowerCase()).not.toMatch(/opened|started/);
    rmSync(home, { recursive: true, force: true });
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
