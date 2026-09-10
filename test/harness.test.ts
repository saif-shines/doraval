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
    for (const verb of ["new", "apply", "boot", "pause", "resume", "list", "show", "logs", "models", "rm", "open"]) {
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
    expect(stdout + stderr).toContain("hermes logs");
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
    const out = stdout + stderr;
    expect(out).toContain("ooo-calendar");
    expect(out).toMatch(/none/);
    expect(out).toContain("1h");
    expect(out).toContain("dora harness show");
    rmSync(home, { recursive: true, force: true });
  });

  test("dora harness models lists Hermes defaults and providers from disk", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-models-"));
    mkdirSync(join(home, ".hermes"), { recursive: true });
    writeFileSync(
      join(home, ".hermes", "config.yaml"),
      "model:\n  default: grok-4.6\n  provider: xai-oauth\n",
    );
    writeFileSync(
      join(home, ".hermes", "provider_models_cache.json"),
      JSON.stringify({
        "xai-oauth": { models: ["grok-4.6"] },
        anthropic: { models: ["claude-sonnet-4"] },
      }),
    );
    const { exitCode, stdout } = runDoraval(["harness", "models", "--json"], {
      env: { HOME: home, PATH: pathWithoutHermes() },
    });
    expect(exitCode).toBe(0);
    const cat = JSON.parse(stdout) as {
      defaultModel: string;
      defaultProvider: string;
      reasoning: string[];
      providers: { name: string; models: string[] }[];
    };
    expect(cat.defaultModel).toBe("grok-4.6");
    expect(cat.defaultProvider).toBe("xai-oauth");
    expect(cat.reasoning).toContain("xhigh");
    expect(cat.providers).toEqual([
      { name: "anthropic", models: ["claude-sonnet-4"] },
      { name: "xai-oauth", models: ["grok-4.6"] },
    ]);
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
    expect(stdout + stderr).not.toContain("hermes cron list");
    expect(stdout + stderr).not.toContain("hermes logs");
    expect(stdout + stderr).not.toContain("hermes dashboard");
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

  for (const verb of ["apply", "boot", "pause", "resume", "logs"] as const) {
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
    const r = runDoraval(["review", "skills/grilling-for-routine", "--quick", "--format", "json"]);
    expect(r.exitCode).toBe(0);
    const rows = JSON.parse(r.stdout) as Array<{ path: string; summary: { errors: number } }>;
    const skillRow = rows.find((row) => row.path.replace(/\\/g, "/").endsWith("skills/grilling-for-routine"));
    expect(skillRow).toBeDefined();
    expect(skillRow!.summary.errors).toBe(0);
  });

  test("grill skill names loop-able first, the gate, and the one-pass-then-save order", () => {
    const text = readFileSync(join(import.meta.dir, "../skills/grilling-for-routine/SKILL.md"), "utf8");
    expect(text).toMatch(/^name:\s*grilling-for-routine/m);
    expect(text).toMatch(/loop-able/i);
    expect(text).toMatch(/skills to \*\*run\*\*/i);
    expect(text).toMatch(/skills to \*\*refer to\*\*/i);
    expect(text).toMatch(/MCP URL/i);
    expect(text).toMatch(/discover-connectors/);
    expect(text).toMatch(/webhook/i);
    expect(text).toMatch(/one pass/i);
    expect(text).toMatch(/Write the routine folder only after/i);
    expect(text).toMatch(/internal teammate/i);
    expect(text).toMatch(/writing-for-routine/);
    expect(text).toMatch(/reuse/i);
    expect(text).toMatch(/project `skills\/`/);
    expect(text).toMatch(/home skills/i);
    expect(text).toMatch(/GitHub URL/);
    expect(text).toMatch(/registry/i);
    expect(text).toMatch(/copies each skill folder into the routine/i);
    expect(text).toMatch(/dora review --quick/);
    expect(text).toMatch(/skip/i);
    expect(text).toMatch(/Say \*\*none\*\* if no extra Skill is needed/);
    expect(text).toMatch(/A connector is not a skill/);
    expect(text).toMatch(/MUST accept none for skills to run and skills to refer/);
    expect(text).toMatch(/MUST NOT require a skill because a connector exists/);
    expect(text).toMatch(/hermes mcp add scalekit/);
    expect(text).toMatch(/MUST register scalekit with apply, boot, or `hermes mcp add` before `hermes mcp login scalekit`/);
    expect(text).toMatch(/MUST NOT edit Hermes config/);
    expect(text).toContain("hermes config get delegation.subagent_auto_approve");
    expect(text).toContain("hermes config set delegation.subagent_auto_approve true");
    expect(text).toMatch(/MUST NOT run that set/);
    expect(text).not.toMatch(/You are/);
    expect(text).not.toContain("—");
    expect(text).not.toMatch(/matt|pocock|writing-for-agents/i);
    expect(existsSync(join(import.meta.dir, "../skills/grill-routine/SKILL.md"))).toBe(false);
  });

  test("dora harness new starts ask-dora / grilling-for-routine", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-grill-"));
    const { exitCode, stdout, stderr } = runDoraval(["harness", "new"], { env: { HOME: home } });
    const out = stdout + stderr;
    expect(exitCode).toBe(0);
    expect(out).toContain("ask-dora");
    expect(out).toContain("grilling-for-routine");
    expect(out).not.toMatch(/skills\/grill-routine/);
    expect(out).not.toMatch(/skills\/doraval/);
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
      ],
      { env: { HOME: home, PATH: pathWithoutHermes() } },
    );
    const out = stdout + stderr;
    expect(exitCode).toBe(0);
    expect(out).toContain("https://hermes-agent.nousresearch.com/install.sh");
    expect(out).toContain("hermes chat --oneshot --run-budget 600");
    expect(out).not.toContain("--toolsets");
    expect(out.toLowerCase()).not.toMatch(/test run (passed|succeeded)|faked/);
    expect(existsSync(join(home, ".dora", "harness", "night-pass", "prompt.md"))).toBe(true);
    expect(readFileSync(join(home, ".dora", "default-mcp-url"), "utf8").trim()).toBe("https://gw.example/mcp");
    expect(out).not.toContain("hermes cron list");
    expect(out).not.toContain("hermes logs");
    expect(out).not.toContain("hermes dashboard");
    rmSync(home, { recursive: true, force: true });
  });

  test("new --accept --mcp-url none writes a routine and omits mcp-scalekit", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-nomcp-"));
    const { exitCode, stdout, stderr } = runDoraval(
      [
        "harness",
        "new",
        "--accept",
        "--yes",
        "--slug",
        "lp-copy",
        "--prompt",
        "Author one connector page.",
        "--mcp-url",
        "none",
      ],
      { env: { HOME: home, PATH: pathWithoutHermes() } },
    );
    const out = stdout + stderr;
    expect(exitCode).toBe(0);
    expect(out).not.toContain("--toolsets mcp-scalekit");
    expect(existsSync(join(home, ".dora", "harness", "lp-copy", "prompt.md"))).toBe(true);
    expect(readFileSync(join(home, ".dora", "harness", "lp-copy", "routine.yml"), "utf8")).toContain('mcp_url: ""');
    expect(existsSync(join(home, ".dora", "default-mcp-url"))).toBe(false);
    rmSync(home, { recursive: true, force: true });
  });

  test("new --accept copies a named skill into the routine and leaves the original", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-copy-"));
    const cwd = mkdtempSync(join(tmpdir(), "dora-harness-copy-cwd-"));
    const src = join(cwd, "skills", "inbox");
    mkdirSync(src, { recursive: true });
    const original = "---\nname: inbox\ndescription: poll the inbox\n---\n\n# inbox\n";
    writeFileSync(join(src, "SKILL.md"), original);
    const { exitCode } = runDoraval(
      [
        "harness",
        "new",
        "--accept",
        "--yes",
        "--slug",
        "night-inbox",
        "--prompt",
        "Poll.",
        "--mcp-url",
        "https://gw.example/mcp",
        "--skills-run",
        "inbox",
      ],
      { env: { HOME: home, PATH: pathWithoutHermes() }, cwd },
    );
    expect(exitCode).toBe(0);
    const copy = join(home, ".dora", "harness", "night-inbox", "skills", "inbox", "SKILL.md");
    expect(readFileSync(copy, "utf8")).toBe(original);
    writeFileSync(copy, "tuned\n");
    expect(readFileSync(join(src, "SKILL.md"), "utf8")).toBe(original);
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });

  test("new --accept with a missing skill name asks and does not write", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-ask-"));
    const cwd = mkdtempSync(join(tmpdir(), "dora-harness-ask-cwd-"));
    const { exitCode, stdout, stderr } = runDoraval(
      [
        "harness",
        "new",
        "--accept",
        "--yes",
        "--slug",
        "nope",
        "--prompt",
        "x",
        "--mcp-url",
        "https://gw.example/mcp",
        "--skills-run",
        "missing-skill",
      ],
      { env: { HOME: home, PATH: pathWithoutHermes() }, cwd },
    );
    expect(exitCode).not.toBe(0);
    expect(stdout + stderr).toMatch(/path or a GitHub URL/i);
    expect(stdout + stderr.toLowerCase()).not.toMatch(/registry/);
    expect(existsSync(join(home, ".dora", "harness", "nope", "prompt.md"))).toBe(false);
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
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

  test("new --run-one-pass MCP fail prints login and watch, writes nothing", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-newmcp-"));
    const { bin } = fakeHermes(home, "", { failMcp: true });
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
      { env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` } },
    );
    const out = stdout + stderr;
    expect(exitCode).not.toBe(0);
    expect(out).toContain("hermes mcp login scalekit");
    for (const cmd of ["hermes cron list", "hermes cron runs", "hermes logs", "hermes dashboard"]) {
      expect(out).toContain(cmd);
    }
    expect(existsSync(join(home, ".dora", "harness", "night-pass"))).toBe(false);
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("boot with Hermes present runs gateway install and cron create, then exits", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-boot-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check the inbox.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const { bin, log } = fakeHermes(home, "");
    const { exitCode, stdout, stderr } = runDoraval(["harness", "boot", "night-pass", "--yes"], {
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
    expect(stdout + stderr).toMatch(/applied/i);
    expect(readFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), "utf8")).toContain(
      'job_id: "fedcba654321"',
    );
    expect(stdout + stderr).toContain("hermes mcp login scalekit");
    expect(stdout + stderr).toMatch(/fire on wake/i);
    for (const cmd of ["hermes cron list", "hermes cron runs", "hermes logs", "hermes dashboard"]) {
      expect(stdout + stderr).toContain(cmd);
    }
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
    const { bin, log } = fakeHermes(home, "", { failMcp: true });
    const { exitCode, stdout, stderr } = runDoraval(["harness", "boot", "night-pass", "--yes"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).not.toBe(0);
    const out = stdout + stderr;
    expect(out).toContain("hermes mcp login scalekit");
    expect(out).toMatch(/provider link/i);
    expect(out.toLowerCase()).not.toMatch(/booted/);
    for (const cmd of ["hermes cron list", "hermes cron runs", "hermes logs", "hermes dashboard"]) {
      expect(out).toContain(cmd);
    }
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

  test("pause and resume call hermes cron with the stored job id", () => {
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
    expect(logText).toContain("cron pause abcdef123456");
    expect(logText).toContain("cron resume abcdef123456");
    expect(logText).not.toContain("cron pause night-pass");
    expect(logText).not.toContain("gateway stop");
    expect(pause.stdout + pause.stderr).toContain("dora harness resume night-pass");
    expect(resume.stdout + resume.stderr).toContain("dora harness list");
    for (const cmd of ["hermes cron list", "hermes cron runs", "hermes logs", "hermes dashboard"]) {
      expect(pause.stdout + pause.stderr).toContain(cmd);
      expect(resume.stdout + resume.stderr).toContain(cmd);
    }
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("list shows slug, state, interval, and last run from the Runtime list", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-state-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
      interval: "15m",
    });
    const { bin } = fakeHermes(home, cronListBlock("abcdef123456", "night-pass", "paused", "2026-09-04T21:30:19+05:30"));
    const { exitCode, stdout, stderr } = runDoraval(["harness", "list"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(0);
    const out = stdout + stderr;
    expect(out).toContain("night-pass");
    expect(out).toContain("paused");
    expect(out).toContain("15m");
    expect(out).toContain("2026-09-04T21:30:19+05:30");
    expect(out).not.toContain("abcdef123456");
    expect(out).toContain("dora harness show");
    expect(readFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), "utf8")).toContain(
      'job_id: "abcdef123456"',
    );
    for (const cmd of ["hermes cron list", "hermes cron runs", "hermes logs", "hermes dashboard"]) {
      expect(out).toContain(cmd);
    }
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("show prints the card and hides the prompt and job id", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-show-"));
    const dir = writeRoutine(home, {
      slug: "night-pass",
      prompt: "SECRET PROMPT TEXT",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
      interval: "15m",
      maxTick: "2m",
    });
    const { bin } = fakeHermes(home, cronListBlock("abcdef123456", "night-pass", "active", "2026-09-04T21:30:19+05:30"));
    const { exitCode, stdout, stderr } = runDoraval(["harness", "show", "night-pass"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(0);
    const out = stdout + stderr;
    expect(out).toContain("night-pass");
    expect(out).toContain("running");
    expect(out).toContain("15m");
    expect(out).toContain("2m");
    expect(out).toMatch(/\byes\b/);
    expect(out).toContain("2026-09-04T21:30:19+05:30");
    expect(out).toContain(dir);
    expect(out).not.toContain("SECRET PROMPT TEXT");
    expect(out).not.toContain("abcdef123456");
    expect(out).toContain("dora harness list");
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("list <slug> is the same as show", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-listslug-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "",
    });
    const { bin } = fakeHermes(home);
    const show = runDoraval(["harness", "show", "night-pass"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    const listed = runDoraval(["harness", "list", "night-pass"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(show.exitCode).toBe(0);
    expect(listed.exitCode).toBe(0);
    expect(listed.stdout + listed.stderr).toContain("night-pass");
    expect(listed.stdout + listed.stderr).toMatch(/\bnone\b/);
    expect(listed.stdout).toBe(show.stdout);
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("pause with a dead stored id says the job is gone", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-dead-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    writeFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), [
      "skills_run: []",
      "skills_refer: []",
      'mcp_url: "https://gw.example/mcp"',
      'interval: "1h"',
      'max_tick: "10m"',
      'job_id: "deaddeaddead"',
      "",
    ].join("\n"));
    const { bin, log } = fakeHermes(home);
    const { exitCode, stdout, stderr } = runDoraval(["harness", "pause", "night-pass"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(1);
    expect(stdout + stderr).toMatch(/gone/i);
    expect(readFileSync(log, "utf8")).not.toContain("cron pause");
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("pause with a stored id still hits that id when cron list fails", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-listfail-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    writeFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), [
      "skills_run: []",
      "skills_refer: []",
      'mcp_url: "https://gw.example/mcp"',
      'interval: "1h"',
      'max_tick: "10m"',
      'job_id: "abcdef123456"',
      "",
    ].join("\n"));
    const { bin, log } = fakeHermes(home, "", { failList: true });
    const { exitCode } = runDoraval(["harness", "pause", "night-pass"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(0);
    expect(readFileSync(log, "utf8")).toContain("cron pause abcdef123456");
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("bare show, pause, and resume print slugs and exit 2 without a TTY", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-pick-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    for (const verb of ["show", "pause", "resume", "logs"] as const) {
      const { exitCode, stdout, stderr } = runDoraval(["harness", verb], {
        env: { HOME: home, PATH: pathWithoutHermes() },
      });
      expect(exitCode).toBe(2);
      expect(stdout + stderr).toContain("night-pass");
      expect(stdout + stderr).toContain(`dora harness ${verb} night-pass`);
    }
    rmSync(home, { recursive: true, force: true });
  });

  test("reads accept --json; help map names show", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-json-"));
    const dir = writeRoutine(home, {
      slug: "night-pass",
      prompt: "SECRET PROMPT TEXT",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const { bin } = fakeHermes(home);
    const list = runDoraval(["harness", "list", "--json"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(list.exitCode).toBe(0);
    const rows = JSON.parse(list.stdout) as Array<Record<string, unknown>>;
    expect(rows).toEqual([
      {
        slug: "night-pass",
        state: "running",
        interval: "1h",
        lastRun: "2026-09-04T21:30:19+05:30",
      },
    ]);
    const show = runDoraval(["harness", "show", "night-pass", "--json"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(show.exitCode).toBe(0);
    const card = JSON.parse(show.stdout) as Record<string, unknown>;
    expect(card).toMatchObject({
      slug: "night-pass",
      state: "running",
      interval: "1h",
      maxTick: "10m",
      reasoningEffort: "xhigh",
      mcp: "yes",
      lastRun: "2026-09-04T21:30:19+05:30",
      folder: dir,
      jobId: "abcdef123456",
    });
    expect(JSON.stringify(card)).not.toContain("SECRET PROMPT TEXT");
    const help = runDoraval(["--help", "--json"]);
    expect(help.exitCode).toBe(0);
    const blob = JSON.stringify(JSON.parse(help.stdout).commands.find((c: { name: string }) => c.name === "harness"));
    expect(blob).toContain("dora harness show <slug>");
    expect(blob).toContain("dora harness list --json");
    expect(blob).toContain("dora harness pause <slug> --json");
    expect(blob).toContain("dora harness resume <slug> --json");
    expect(blob).toContain("dora harness logs <slug>");
    expect(blob).toContain("dora harness logs <slug> --json");
    expect(blob).toContain("dora harness models");
    expect(blob).toContain("dora harness models --json");
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("logs <slug> prints that job's run history via the Runtime runs command", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-logs-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "SECRET PROMPT TEXT",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    writeFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), [
      "skills_run: []",
      "skills_refer: []",
      'mcp_url: "https://gw.example/mcp"',
      'interval: "1h"',
      'max_tick: "10m"',
      'job_id: "abcdef123456"',
      "",
    ].join("\n"));
    const runsOut =
      "9a1dbe9fc3d84b048233ee05388db4d4  completed  job=abcdef123456  source=builtin  2026-09-04T23:22:14+05:30\n";
    const { bin, log } = fakeHermes(home, cronListBlock("abcdef123456", "night-pass", "active"), { runsOut });
    const { exitCode, stdout, stderr } = runDoraval(["harness", "logs", "night-pass"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(0);
    const logText = readFileSync(log, "utf8");
    expect(logText).toContain("cron runs abcdef123456");
    expect(logText).not.toMatch(/^logs(?: |$)/m);
    const out = stdout + stderr;
    expect(out).toContain("9a1dbe9fc3d84b048233ee05388db4d4");
    expect(out).toContain("dora harness show night-pass");
    expect(out).not.toContain("SECRET PROMPT TEXT");
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("logs with a dead stored id says the job is gone", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-logdead-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    writeFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), [
      "skills_run: []",
      "skills_refer: []",
      'mcp_url: "https://gw.example/mcp"',
      'interval: "1h"',
      'max_tick: "10m"',
      'job_id: "deaddeaddead"',
      "",
    ].join("\n"));
    const { bin, log } = fakeHermes(home);
    const { exitCode, stdout, stderr } = runDoraval(["harness", "logs", "night-pass"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(1);
    expect(stdout + stderr).toMatch(/gone/i);
    expect(stdout + stderr).not.toMatch(/^logs(?: |$)/m);
    expect(readFileSync(log, "utf8")).not.toContain("cron runs");
    expect(readFileSync(log, "utf8")).not.toMatch(/^logs(?: |$)/m);
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("logs --json is one object on stdout", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-logjson-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "SECRET PROMPT TEXT",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    writeFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), [
      "skills_run: []",
      "skills_refer: []",
      'mcp_url: "https://gw.example/mcp"',
      'interval: "1h"',
      'max_tick: "10m"',
      'job_id: "abcdef123456"',
      "",
    ].join("\n"));
    const runsOut =
      "9a1dbe9fc3d84b048233ee05388db4d4  completed  job=abcdef123456  source=builtin  2026-09-04T23:22:14+05:30\n";
    const { bin } = fakeHermes(home, cronListBlock("abcdef123456", "night-pass", "active"), { runsOut });
    const { exitCode, stdout } = runDoraval(["harness", "logs", "night-pass", "--json"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toEqual({
      slug: "night-pass",
      jobId: "abcdef123456",
      output: runsOut,
    });
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
    expect(stdout + stderr).toContain("dora harness boot night-pass");
    rmSync(home, { recursive: true, force: true });
  });

  test("apply creates on first push and stores the job id", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-apply-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check the inbox.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const { bin, log } = fakeHermes(home, "");
    const { exitCode, stdout, stderr } = runDoraval(["harness", "apply", "night-pass", "--yes"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(0);
    const logText = readFileSync(log, "utf8");
    expect(logText).toContain("cron create");
    expect(logText).not.toContain("cron edit");
    expect(readFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), "utf8")).toContain(
      'job_id: "fedcba654321"',
    );
    expect(existsSync(join(home, ".dora", "hooks", "stamp-pocket-footer.py"))).toBe(true);
    expect(readFileSync(join(home, ".hermes", "config.yaml"), "utf8")).toContain("pre_tool_call");
    expect(readFileSync(join(home, ".dora", "hooks", "job-slugs.json"), "utf8")).toContain("night-pass");
    expect(stdout + stderr).toContain("dora harness show night-pass");
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("later apply edits the stored id and does not create", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-edit-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check the inbox.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
      interval: "15m",
    });
    writeFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), [
      "skills_run: []",
      "skills_refer: []",
      'mcp_url: "https://gw.example/mcp"',
      'interval: "15m"',
      'max_tick: "10m"',
      'job_id: "abcdef123456"',
      "",
    ].join("\n"));
    const { bin, log } = fakeHermes(home);
    const { exitCode } = runDoraval(["harness", "apply", "night-pass", "--yes"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(0);
    const logText = readFileSync(log, "utf8");
    expect(logText).toContain("cron edit abcdef123456");
    expect(logText).toContain("--schedule");
    expect(logText).not.toContain("cron create");
    expect(readFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), "utf8")).toContain(
      'job_id: "abcdef123456"',
    );
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("apply with no stored id edits a Runtime job whose name matches the slug", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-name-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const { bin, log } = fakeHermes(home);
    const { exitCode } = runDoraval(["harness", "apply", "night-pass", "--yes"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(0);
    expect(readFileSync(log, "utf8")).toContain("cron edit abcdef123456");
    expect(readFileSync(log, "utf8")).not.toContain("cron create");
    expect(readFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), "utf8")).toContain(
      'job_id: "abcdef123456"',
    );
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("dead stored id with a name match edits that job, does not create", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-deadname-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    writeFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), [
      "skills_run: []",
      "skills_refer: []",
      'mcp_url: "https://gw.example/mcp"',
      'interval: "1h"',
      'max_tick: "10m"',
      'job_id: "deaddeaddead"',
      "",
    ].join("\n"));
    const { bin, log } = fakeHermes(home);
    const { exitCode } = runDoraval(["harness", "apply", "night-pass", "--yes"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(0);
    const logText = readFileSync(log, "utf8");
    expect(logText).toContain("cron edit abcdef123456");
    expect(logText).not.toContain("cron create");
    expect(readFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), "utf8")).toContain(
      'job_id: "abcdef123456"',
    );
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("dead stored id creates again and stores the new id", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-deadapply-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    writeFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), [
      "skills_run: []",
      "skills_refer: []",
      'mcp_url: "https://gw.example/mcp"',
      'interval: "1h"',
      'max_tick: "10m"',
      'job_id: "deaddeaddead"',
      "",
    ].join("\n"));
    const { bin, log } = fakeHermes(home, "");
    const { exitCode } = runDoraval(["harness", "apply", "night-pass", "--yes"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(0);
    expect(readFileSync(log, "utf8")).toContain("cron create");
    expect(readFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), "utf8")).toContain(
      'job_id: "fedcba654321"',
    );
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("apply still succeeds when Hermes config is invalid", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-badyml-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    mkdirSync(join(home, ".hermes"), { recursive: true });
    writeFileSync(join(home, ".hermes", "config.yaml"), "{\n");
    const { bin } = fakeHermes(home, "");
    const { exitCode } = runDoraval(["harness", "apply", "night-pass", "--yes"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(0);
    expect(readFileSync(join(home, ".hermes", "config.yaml"), "utf8")).toBe("{\n");
    expect(existsSync(join(home, ".dora", "hooks", "stamp-pocket-footer.py"))).toBe(true);
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("apply --dry-run prints Runtime commands and writes nothing", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-dry-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const { bin, log } = fakeHermes(home, "");
    const { exitCode, stdout, stderr } = runDoraval(["harness", "apply", "night-pass", "--dry-run"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}`, CLAUDECODE: "1" },
    });
    expect(exitCode).toBe(0);
    const out = stdout + stderr;
    expect(out).toContain("hermes gateway install");
    expect(out).toContain("hermes cron create");
    expect(readFileSync(log, "utf8")).not.toContain("cron create");
    expect(readFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), "utf8")).not.toContain("job_id");
    expect(existsSync(join(home, ".dora", "hooks", "stamp-pocket-footer.py"))).toBe(false);
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("apply refreshes an upstream copy and keep-copies skips it", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-refresh-"));
    const cwd = mkdtempSync(join(tmpdir(), "dora-harness-refresh-cwd-"));
    const src = join(cwd, "vendor", "skillkit", "plugins", "docs", "skills", "api-reference");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "SKILL.md"), "---\nname: api-reference\ndescription: v1\n---\n\nv1\n");
    writeRoutine(
      home,
      {
        slug: "docs-job",
        prompt: "Review.",
        skillsRun: [src],
        skillsRefer: [],
        mcpUrl: "https://gw.example/mcp",
      },
      { cwd },
    );
    const copy = join(home, ".dora", "harness", "docs-job", "skills", "api-reference", "SKILL.md");
    writeFileSync(copy, "stale\n");
    writeFileSync(join(src, "SKILL.md"), "---\nname: api-reference\ndescription: dirty clone\n---\n\ndirty clone\n");
    const fetched = join(cwd, "fetched-kit", "plugins", "docs", "skills", "api-reference");
    mkdirSync(fetched, { recursive: true });
    writeFileSync(join(fetched, "SKILL.md"), "---\nname: api-reference\ndescription: v2\n---\n\nv2\n");
    const { bin, log } = fakeHermes(home, "");
    writeFakeGit(bin, join(cwd, "fetched-kit"));
    const keep = runDoraval(["harness", "apply", "docs-job", "--keep-copies", "--yes"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
      cwd,
    });
    expect(keep.exitCode).toBe(0);
    expect(readFileSync(copy, "utf8")).toBe("stale\n");
    const applied = runDoraval(["harness", "apply", "docs-job", "--yes"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
      cwd,
    });
    expect(applied.exitCode).toBe(0);
    expect(readFileSync(copy, "utf8")).toContain("v2");
    expect(readFileSync(join(src, "SKILL.md"), "utf8")).toContain("dirty clone");
    expect(applied.stdout + applied.stderr).toMatch(/refreshed api-reference/i);
    expect(readFileSync(log, "utf8")).toContain("cron create");
    expect(readFileSync(join(home, ".dora", "harness", "docs-job", "routine.yml"), "utf8")).toContain(
      "https://github.com/scalekit-inc/skillkit/tree/main/plugins/docs/skills/api-reference",
    );
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("apply says a local origin is disk only", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-localorig-"));
    const cwd = mkdtempSync(join(tmpdir(), "dora-harness-localorig-cwd-"));
    const src = join(cwd, "skills", "inbox");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "SKILL.md"), "---\nname: inbox\ndescription: poll\n---\n\npoll\n");
    writeRoutine(
      home,
      {
        slug: "local-job",
        prompt: "Poll.",
        skillsRun: ["inbox"],
        skillsRefer: [],
        mcpUrl: "https://gw.example/mcp",
      },
      { cwd },
    );
    const { bin } = fakeHermes(home, "");
    const { exitCode, stdout, stderr } = runDoraval(["harness", "apply", "local-job", "--yes"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
      cwd,
    });
    expect(exitCode).toBe(0);
    expect(stdout + stderr).toMatch(/local origin \(disk only, not fetched\): inbox/i);
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("apply without --yes refuses a detected agent", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-agent-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const { bin, log } = fakeHermes(home, "");
    const { exitCode, stdout, stderr } = runDoraval(["harness", "apply", "night-pass"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}`, CLAUDECODE: "1", CI: "1" },
    });
    expect(exitCode).toBe(2);
    expect(stdout + stderr).toMatch(/--yes|--dry-run/);
    if (existsSync(log)) expect(readFileSync(log, "utf8")).not.toContain("cron create");
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("help --json leads with apply and still names boot", () => {
    const { exitCode, stdout } = runDoraval(["--help", "--json"]);
    expect(exitCode).toBe(0);
    const blob = JSON.stringify(JSON.parse(stdout).commands.find((c: { name: string }) => c.name === "harness"));
    expect(blob.indexOf("dora harness apply")).toBeGreaterThan(-1);
    expect(blob.indexOf("dora harness apply")).toBeLessThan(blob.indexOf("dora harness boot"));
    expect(blob).toContain("dora harness apply <slug> --yes");
    expect(blob).toContain("dora harness apply <slug> --dry-run");
    expect(blob).toContain("dora harness apply <slug> --keep-copies --yes");
    expect(blob).toContain("dora harness apply <slug> --from <path|url> --yes");
    expect(blob).toContain("dora harness rm <slug> --yes");
    expect(blob).toContain("dora harness rm <slug> --dry-run");
  });

  test("rm --yes stops the job then deletes the folder", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-rm-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    writeFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), [
      "skills_run: []",
      "skills_refer: []",
      'mcp_url: "https://gw.example/mcp"',
      'interval: "1h"',
      'max_tick: "10m"',
      'job_id: "abcdef123456"',
      "",
    ].join("\n"));
    const { bin, log } = fakeHermes(home);
    const { exitCode, stdout, stderr } = runDoraval(["harness", "rm", "night-pass", "--yes"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(0);
    expect(readFileSync(log, "utf8")).toContain("cron remove abcdef123456");
    expect(existsSync(join(home, ".dora", "harness", "night-pass"))).toBe(false);
    expect(stdout + stderr).toContain("dora harness list");
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("rm with a dead stored id still removes a same-name Runtime job", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-rmname-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    writeFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), [
      "skills_run: []",
      "skills_refer: []",
      'mcp_url: "https://gw.example/mcp"',
      'interval: "1h"',
      'max_tick: "10m"',
      'job_id: "deaddeaddead"',
      "",
    ].join("\n"));
    const { bin, log } = fakeHermes(home);
    const { exitCode, stdout } = runDoraval(["harness", "rm", "night-pass", "--yes", "--json"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(0);
    expect(readFileSync(log, "utf8")).toContain("cron remove abcdef123456");
    expect(existsSync(join(home, ".dora", "harness", "night-pass"))).toBe(false);
    expect(JSON.parse(stdout)).toEqual({ slug: "night-pass", removed: true, job: "removed" });
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("rm deletes the folder when the job is already gone", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-rmgone-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    writeFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), [
      "skills_run: []",
      "skills_refer: []",
      'mcp_url: "https://gw.example/mcp"',
      'interval: "1h"',
      'max_tick: "10m"',
      'job_id: "deaddeaddead"',
      "",
    ].join("\n"));
    const { bin, log } = fakeHermes(home, "");
    const { exitCode } = runDoraval(["harness", "rm", "night-pass", "--yes"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(0);
    expect(readFileSync(log, "utf8")).not.toContain("cron remove");
    expect(existsSync(join(home, ".dora", "harness", "night-pass"))).toBe(false);
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("rm keeps the folder when remove fails and the job is still there", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-rmfail-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    writeFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), [
      "skills_run: []",
      "skills_refer: []",
      'mcp_url: "https://gw.example/mcp"',
      'interval: "1h"',
      'max_tick: "10m"',
      'job_id: "abcdef123456"',
      "",
    ].join("\n"));
    const { bin } = fakeHermes(home, undefined, { failRemove: true });
    const { exitCode } = runDoraval(["harness", "rm", "night-pass", "--yes"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(1);
    expect(existsSync(join(home, ".dora", "harness", "night-pass", "prompt.md"))).toBe(true);
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("rm --dry-run prints the plan and deletes nothing", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-rmdry-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    writeFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), [
      "skills_run: []",
      "skills_refer: []",
      'mcp_url: "https://gw.example/mcp"',
      'interval: "1h"',
      'max_tick: "10m"',
      'job_id: "abcdef123456"',
      "",
    ].join("\n"));
    const { bin, log } = fakeHermes(home);
    const { exitCode, stdout, stderr } = runDoraval(["harness", "rm", "night-pass", "--dry-run"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}`, CLAUDECODE: "1" },
    });
    expect(exitCode).toBe(0);
    expect(stdout + stderr).toContain("hermes cron remove abcdef123456");
    expect(stdout + stderr).toMatch(/delete /);
    expect(readFileSync(log, "utf8")).not.toContain("cron remove");
    expect(existsSync(join(home, ".dora", "harness", "night-pass", "prompt.md"))).toBe(true);
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("rm without --yes refuses a detected agent", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-rmagent-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const { exitCode, stdout, stderr } = runDoraval(["harness", "rm", "night-pass"], {
      env: { HOME: home, PATH: pathWithoutHermes(), CLAUDECODE: "1", CI: "1" },
    });
    expect(exitCode).toBe(2);
    expect(stdout + stderr).toMatch(/--yes|--dry-run/);
    expect(existsSync(join(home, ".dora", "harness", "night-pass", "prompt.md"))).toBe(true);
    rmSync(home, { recursive: true, force: true });
  });

  test("bare rm prints slugs and the next command with --yes", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-rmbare-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const { exitCode, stdout, stderr } = runDoraval(["harness", "rm"], {
      env: { HOME: home, PATH: pathWithoutHermes() },
    });
    expect(exitCode).toBe(2);
    expect(stdout + stderr).toContain("night-pass");
    expect(stdout + stderr).toContain("dora harness rm night-pass --yes");
    expect(existsSync(join(home, ".dora", "harness", "night-pass", "prompt.md"))).toBe(true);
    rmSync(home, { recursive: true, force: true });
  });

  test("rm with a stored id and no Hermes prints install steps and keeps the folder", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-rmnohermes-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    writeFileSync(join(home, ".dora", "harness", "night-pass", "routine.yml"), [
      "skills_run: []",
      "skills_refer: []",
      'mcp_url: "https://gw.example/mcp"',
      'interval: "1h"',
      'max_tick: "10m"',
      'job_id: "abcdef123456"',
      "",
    ].join("\n"));
    const { exitCode, stdout, stderr } = runDoraval(["harness", "rm", "night-pass", "--yes"], {
      env: { HOME: home, PATH: pathWithoutHermes() },
    });
    expect(exitCode).toBe(2);
    expect(stdout + stderr).toContain("https://hermes-agent.nousresearch.com/install.sh");
    expect(existsSync(join(home, ".dora", "harness", "night-pass", "prompt.md"))).toBe(true);
    rmSync(home, { recursive: true, force: true });
  });

  test("rm keeps the folder when list fails and there is no stored id", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-rmlistfail-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const { bin, log } = fakeHermes(home, undefined, { failList: true });
    const { exitCode } = runDoraval(["harness", "rm", "night-pass", "--yes"], {
      env: { HOME: home, PATH: `${bin}:${pathWithoutHermes()}` },
    });
    expect(exitCode).toBe(2);
    expect(existsSync(join(home, ".dora", "harness", "night-pass", "prompt.md"))).toBe(true);
    expect(readFileSync(log, "utf8")).not.toContain("cron remove");
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  test("rm deletes the folder when Hermes is missing and there is no stored id", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-harness-rmgone-nohermes-"));
    writeRoutine(home, {
      slug: "night-pass",
      prompt: "Check.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const { exitCode } = runDoraval(["harness", "rm", "night-pass", "--yes"], {
      env: { HOME: home, PATH: pathWithoutHermes() },
    });
    expect(exitCode).toBe(0);
    expect(existsSync(join(home, ".dora", "harness", "night-pass"))).toBe(false);
    rmSync(home, { recursive: true, force: true });
  });
});

function writeFakeGit(bin: string, fixtureRepo: string): void {
  writeFileSync(
    join(bin, "git"),
    `#!/bin/sh
if [ "$1" = clone ]; then
  dest=""
  for a in "$@"; do dest="$a"; done
  mkdir -p "$dest"
  cp -R "${fixtureRepo}/." "$dest/"
  exit 0
fi
exit 0
`,
  );
  chmodSync(join(bin, "git"), 0o755);
}

function cronListBlock(id: string, name: string, state: "active" | "paused", lastRun?: string): string {
  return `  ${id} [${state}]\n    Name:      ${name}\n    Last run:  ${lastRun ?? "never"}\n`;
}

function fakeHermes(
  home: string,
  listOut = cronListBlock("abcdef123456", "night-pass", "active", "2026-09-04T21:30:19+05:30"),
  opts: { failMcp?: boolean; failList?: boolean; failRemove?: boolean; runsOut?: string } = {},
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
  const failList = opts.failList
    ? `
if [ "$1" = cron ] && [ "$2" = list ]; then
  echo "list failed" >&2
  exit 1
fi
`
    : "";
  const failRemove = opts.failRemove
    ? `
if [ "$1" = cron ] && [ "$2" = remove ]; then
  echo "remove failed" >&2
  exit 1
fi
`
    : "";
  writeFileSync(
    join(bin, "hermes"),
    `#!/bin/sh
echo "$@" >> "${log}"
${failList}
if [ "$1" = cron ] && [ "$2" = list ]; then
  printf '%s' '${listOut.replace(/'/g, "")}'
fi
if [ "$1" = cron ] && [ "$2" = create ]; then
  echo "Created job: fedcba654321"
fi
if [ "$1" = cron ] && [ "$2" = runs ]; then
  printf '%s' '${(opts.runsOut ?? "").replace(/'/g, "")}'
fi
${failRemove}
${failMcp}
exit 0
`,
  );
  chmodSync(join(bin, "hermes"), 0o755);
  return { bin, log };
}
