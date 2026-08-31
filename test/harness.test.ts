import { dirname, join } from "path";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
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
    const { exitCode, stdout, stderr } = runDoraval(["harness", "list"], {
      env: { HOME: home, PATH: pathWithoutHermes() },
    });
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
    const { exitCode, stdout, stderr } = runDoraval(["harness", "list"], {
      env: { HOME: home, PATH: pathWithoutHermes() },
    });
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
      const home = mkdtempSync(join(tmpdir(), "dora-harness-nohermes-"));
      writeRoutine(home, {
        slug: "night-pass",
        prompt: "Check.",
        skillsRun: [],
        skillsRefer: [],
        mcpUrl: "https://gw.example/mcp",
      });
      const { exitCode, stdout, stderr } = runDoraval(["harness", verb, "night-pass"], {
        env: { HOME: home, PATH: pathWithoutHermes() },
      });
      const out = stdout + stderr;
      expect(exitCode).not.toBe(0);
      expect(out).toContain("https://hermes-agent.nousresearch.com/install.sh");
      expect(out.toLowerCase()).not.toMatch(/started|job started|booted/);
      rmSync(home, { recursive: true, force: true });
    });
  }

  test("dora review --quick on the grill skill exits 0", () => {
    const { exitCode } = runDoraval(["review", "skills/grill-routine", "--quick"]);
    expect(exitCode).toBe(0);
  });

  test("grill skill names the gate and the one-pass-then-save order", () => {
    const text = readFileSync(join(import.meta.dir, "../skills/grill-routine/SKILL.md"), "utf8");
    expect(text).toMatch(/skills to \*\*run\*\*/i);
    expect(text).toMatch(/skills to \*\*refer to\*\*/i);
    expect(text).toMatch(/MCP URL/i);
    expect(text).toMatch(/one pass/i);
    expect(text).toMatch(/Write the routine folder only after/i);
    expect(text).not.toMatch(/You are/);
    expect(text).not.toContain("—");
  });

  test("dora harness new starts the grill skill", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-grill-"));
    const { exitCode, stdout, stderr } = runDoraval(["harness", "new"], { env: { HOME: home } });
    const out = stdout + stderr;
    expect(exitCode).toBe(0);
    expect(out).toContain("grill-routine");
    expect(out).toMatch(/skills to run/i);
    expect(out).toMatch(/MCP URL/i);
    expect(out).toMatch(/one pass/i);
    expect(existsSync(join(home, ".dora", "harness"))).toBe(false);
    rmSync(home, { recursive: true, force: true });
  });

  test("new --accept with missing Hermes prints install steps, writes after accept, does not fake a pass", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-accept-"));
    const { exitCode, stdout, stderr } = runDoraval(
      [
        "harness",
        "new",
        "--accept",
        "--yes",
        "--slug",
        "night-pass",
        "--prompt",
        "Check the inbox.",
        "--mcp-url",
        "https://gw.example/mcp",
        "--skills-run",
        "/skills/run",
      ],
      { env: { HOME: home, PATH: pathWithoutHermes() } },
    );
    const out = stdout + stderr;
    expect(exitCode).toBe(0);
    expect(out).toContain("https://hermes-agent.nousresearch.com/install.sh");
    expect(out).toContain("hermes chat --toolsets mcp-scalekit --oneshot --run-budget 600");
    expect(out.toLowerCase()).not.toMatch(/test run (passed|succeeded)|faked/);
    expect(existsSync(join(home, ".dora", "harness", "night-pass", "prompt.md"))).toBe(true);
    expect(readFileSync(join(home, ".dora", "default-mcp-url"), "utf8").trim()).toBe("https://gw.example/mcp");
    rmSync(home, { recursive: true, force: true });
  });

  test("new --run-one-pass without Hermes does not write and does not fake success", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-fake-"));
    const { exitCode, stdout, stderr } = runDoraval(
      [
        "harness",
        "new",
        "--run-one-pass",
        "--slug",
        "night-pass",
        "--prompt",
        "Check the inbox.",
        "--mcp-url",
        "https://gw.example/mcp",
      ],
      { env: { HOME: home, PATH: pathWithoutHermes() } },
    );
    const out = stdout + stderr;
    expect(exitCode).not.toBe(0);
    expect(out).toMatch(/will not fake/i);
    expect(existsSync(join(home, ".dora", "harness", "night-pass"))).toBe(false);
    rmSync(home, { recursive: true, force: true });
  });

  test("boot with Hermes present runs gateway install and cron create, then exits", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-boot-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check the inbox.",
      skillsRun: ["/skills/run"],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const { bin, log } = fakeHermes(home);
    const { exitCode, stdout, stderr } = runDoraval(["harness", "boot", "night-pass"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(0);
    const logText = readFileSync(log, "utf8");
    expect(logText).toContain("gateway install");
    expect(logText).toContain("gateway start");
    expect(logText).toContain("cron create");
    expect(logText).toContain("mcp add scalekit");
    expect(logText).toContain("mcp test scalekit");
    expect(logText).toContain("tools enable mcp-scalekit --platform cron");
    expect(stdout + stderr).toMatch(/booted/i);
    expect(stdout + stderr).toContain("hermes mcp login scalekit");
    expect(stdout + stderr).toMatch(/fire on wake/i);
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("boot stops when mcp add and mcp test both fail", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-mcpfail-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check the inbox.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const { bin, log } = fakeHermes(home, "[active] night-pass\n", { failMcp: true });
    const { exitCode, stdout, stderr } = runDoraval(["harness", "boot", "night-pass"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).not.toBe(0);
    const out = stdout + stderr;
    expect(out).toContain("hermes mcp login scalekit");
    expect(out).toMatch(/provider link/i);
    expect(out.toLowerCase()).not.toMatch(/booted/);
    const logText = readFileSync(log, "utf8");
    expect(logText).not.toContain("cron create");
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("new --accept refuses to overwrite an existing routine", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-ow-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "First.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const { exitCode, stdout, stderr } = runDoraval(
      [
        "harness",
        "new",
        "--accept",
        "--yes",
        "--slug",
        "night-pass",
        "--prompt",
        "Second.",
        "--mcp-url",
        "https://gw.example/mcp",
      ],
      { env: { HOME: home, PATH: pathWithoutHermes() } },
    );
    expect(exitCode).not.toBe(0);
    expect(stdout + stderr).toMatch(/already exists/i);
    expect(readFileSync(join(home, ".dora", "harness", "night-pass", "prompt.md"), "utf8")).toBe("First.\n");
    rmSync(home, { recursive: true, force: true });
  });

  test("pause and resume call hermes cron for that slug only", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-pr-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const { bin, log } = fakeHermes(home);
    const pause = runDoraval(["harness", "pause", "night-pass"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    const resume = runDoraval(["harness", "resume", "night-pass"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(pause.exitCode).toBe(0);
    expect(resume.exitCode).toBe(0);
    const logText = readFileSync(log, "utf8");
    expect(logText).toContain("cron pause night-pass");
    expect(logText).toContain("cron resume night-pass");
    expect(logText).not.toContain("gateway stop");
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("list shows running or paused from hermes cron list", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-state-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const { bin } = fakeHermes(home, "[paused] night-pass\n");
    const { exitCode, stdout, stderr } = runDoraval(["harness", "list"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(0);
    expect(stdout + stderr).toMatch(/night-pass\s+paused/);
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("bare boot lists routines and does not pick one for an agent", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-bareboot-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const { exitCode, stdout, stderr } = runDoraval(["harness", "boot"], {
      env: { HOME: home, PATH: pathWithoutHermes() },
    });
    expect(exitCode).toBe(2);
    expect(stdout + stderr).toContain("night-pass");
    expect(stdout + stderr).toContain("dora harness boot");
    expect(stdout + stderr).toContain("dora harness new");
    rmSync(home, { recursive: true, force: true });
  });
});

function fakeHermes(
  home: string,
  listOut = "[active] night-pass\n",
  opts: { failMcp?: boolean } = {},
): { bin: string; log: string } {
  const bin = mkdtempSync(join(tmpdir(), "dora-hermes-bin-"));
  const log = join(home, "hermes-log");
  mkdirSync(home, { recursive: true });
  const failMcp = opts.failMcp
    ? `
if [ "$1" = mcp ]; then
  echo "mcp failed" >&2
  exit 1
fi
`
    : "";
  writeFileSync(
    join(bin, "hermes"),
    `#!/bin/sh
echo "$@" >> "${log}"
if [ "$1" = cron ] && [ "$2" = list ]; then
  printf '%s' '${listOut.replace(/'/g, "")}'
fi
${failMcp}
exit 0
`,
  );
  chmodSync(join(bin, "hermes"), 0o755);
  return { bin, log };
}
