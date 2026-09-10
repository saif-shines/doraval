import { describe, expect, test } from "bun:test";
import { bootArgs, editArgs, formatHermesCatalog, hermesSchedule, hermesTimeoutSec, onePassCommand, parseCreatedJobId, parseCronList, parseHermesModelConfig, parseProviderModelsCache, pauseArgs, removeArgs, resumeArgs, runsArgs, watchCommands } from "./hermes.js";
import type { Routine } from "./routine.js";

const routine: Routine = {
  slug: "night-pass",
  dir: "/tmp/night-pass",
  prompt: "Check the inbox.",
  skillsRun: ["/skills/run"],
  skillsRefer: ["/skills/refer"],
  mcpUrl: "https://gw.example/mcp",
  interval: "1h",
  maxTick: "10m",
};

describe("hermes command builders", () => {
  test("boot starts the gateway, adds MCP, enables mcp-scalekit on cron, then creates the job", () => {
    const cmds = bootArgs(routine);
    expect(cmds[0]).toEqual(["gateway", "install"]);
    expect(cmds[1]).toEqual(["gateway", "start"]);
    expect(cmds[2]).toEqual(["mcp", "add", "scalekit", "--url", "https://gw.example/mcp", "--auth", "oauth"]);
    expect(cmds[3]).toEqual(["mcp", "test", "scalekit"]);
    expect(cmds[4]).toEqual(["tools", "enable", "mcp-scalekit", "--platform", "cron"]);
    expect(cmds[5]).toEqual(["skills", "trust", "/tmp/night-pass"]);
    expect(cmds[6]).toEqual([
      "cron",
      "create",
      "every 1h",
      "Check the inbox.\n\nHuman-visible messages end with: Sent by pocket agent night-pass",
      "--name",
      "night-pass",
      "--reasoning-effort",
      "xhigh",
      "--workdir",
      "/tmp/night-pass",
    ]);
    expect(JSON.stringify(cmds)).not.toContain("--skill");
    expect(JSON.stringify(cmds)).not.toContain("--timeout");
    expect(JSON.stringify(cmds)).not.toContain("--toolsets");
  });

  test("pause and resume target that job id only", () => {
    expect(pauseArgs("abcdef123456")).toEqual(["cron", "pause", "abcdef123456"]);
    expect(resumeArgs("abcdef123456")).toEqual(["cron", "resume", "abcdef123456"]);
  });

  test("runs asks the Runtime for that job id only", () => {
    expect(runsArgs("abcdef123456")).toEqual(["cron", "runs", "abcdef123456"]);
  });

  test("remove targets that job id only", () => {
    expect(removeArgs("abcdef123456")).toEqual(["cron", "remove", "abcdef123456"]);
  });

  test("edit pushes schedule, prompt, and skills onto that job id", () => {
    expect(editArgs(routine, "abcdef123456")).toEqual([
      "cron",
      "edit",
      "abcdef123456",
      "--schedule",
      "every 1h",
      "--prompt",
      "Check the inbox.\n\nHuman-visible messages end with: Sent by pocket agent night-pass",
      "--reasoning-effort",
      "xhigh",
      "--clear-skills",
      "--workdir",
      "/tmp/night-pass",
    ]);
    expect(editArgs({ ...routine, skillsRun: [], skillsRefer: [] }, "abcdef123456")).toContain("--clear-skills");
    expect(JSON.stringify(editArgs({ ...routine, skillsRun: [], skillsRefer: [] }, "abcdef123456"))).not.toContain(
      "--workdir",
    );
  });

  test("create, edit, and one-pass pin reasoning from the folder", () => {
    const low = { ...routine, reasoningEffort: "low" };
    expect(bootArgs(low).at(-1)).toContain("low");
    expect(editArgs(low, "abcdef123456")).toEqual(expect.arrayContaining(["--reasoning-effort", "low"]));
    expect(onePassCommand(low)).toContain("--reasoning low");
  });

  test("create, edit, and one-pass pin model and provider when set", () => {
    const pinned = { ...routine, model: "claude-sonnet-4", provider: "anthropic" };
    expect(bootArgs(pinned).at(-1)).toEqual(expect.arrayContaining(["--model", "claude-sonnet-4", "--provider", "anthropic"]));
    expect(editArgs(pinned, "abcdef123456")).toEqual(
      expect.arrayContaining(["--model", "claude-sonnet-4", "--provider", "anthropic"]),
    );
    expect(onePassCommand(pinned)).toContain("-m claude-sonnet-4");
    expect(onePassCommand(pinned)).toContain("--provider anthropic");
    expect(JSON.stringify(bootArgs(routine))).not.toContain("--model");
    expect(editArgs({ ...routine, model: "", provider: "" }, "abcdef123456")).toEqual(
      expect.arrayContaining(["--model", "", "--provider", ""]),
    );
  });

  test("catalog parse reads Hermes cache and config shapes", () => {
    const providers = parseProviderModelsCache({
      "xai-oauth": { models: ["grok-4.6", "grok-4.5"] },
      anthropic: { models: ["claude-sonnet-4"] },
    });
    expect(providers.map((p) => p.name)).toEqual(["anthropic", "xai-oauth"]);
    expect(parseHermesModelConfig({ model: { default: "grok-4.6", provider: "xai-oauth" } })).toEqual({
      defaultModel: "grok-4.6",
      defaultProvider: "xai-oauth",
    });
    const lines = formatHermesCatalog({
      defaultModel: "grok-4.6",
      defaultProvider: "xai-oauth",
      reasoning: ["xhigh"],
      providers,
    });
    expect(lines[0]).toContain("grok-4.6");
    expect(lines.join("\n")).toContain("anthropic");
    expect(lines.join("\n")).toContain("claude-sonnet-4");
  });

  test("parseCreatedJobId reads the hex id from create output", () => {
    expect(parseCreatedJobId("Created job: fedcba654321\n  Schedule: every 1h\n")).toBe("fedcba654321");
    expect(parseCreatedJobId("nope")).toBeUndefined();
  });

  test("one-pass command uses the MCP toolset, skills, and run-budget", () => {
    const cmd = onePassCommand(routine, "/tmp/night-pass");
    expect(cmd).toContain("hermes skills trust /tmp/night-pass");
    expect(cmd).toContain("hermes chat --oneshot --run-budget 600 --reasoning xhigh");
    expect(cmd).not.toContain("--toolsets");
    expect(cmd).not.toContain("--skills");
    expect(cmd).toContain("--in /tmp/night-pass");
    expect(cmd).toContain("-q");
    expect(cmd).toContain(JSON.stringify("Check the inbox.\n\nHuman-visible messages end with: Sent by pocket agent night-pass"));
    expect(cmd).not.toContain("cron");
    expect(cmd).not.toContain("--timeout");
  });

  test("no MCP omits the toolset and skips mcp add on boot", () => {
    const local: Routine = { ...routine, mcpUrl: "" };
    const cmd = onePassCommand(local);
    expect(cmd).toContain("hermes chat --oneshot --run-budget 600");
    expect(cmd).not.toContain("--toolsets");
    const cmds = bootArgs(local);
    expect(cmds.map((c) => c[0])).toEqual(["gateway", "gateway", "skills", "cron"]);
    expect(JSON.stringify(cmds)).not.toContain("mcp");
  });
});

describe("schedule and timeout", () => {
  test("maps 1h to every 1h and 10m to 600s", () => {
    expect(hermesSchedule("1h")).toBe("every 1h");
    expect(hermesSchedule("every 15m")).toBe("every 15m");
    expect(hermesTimeoutSec("10m")).toBe(600);
    expect(hermesTimeoutSec("2m")).toBe(120);
  });
});

describe("parseCronList", () => {
  test("reads hex id, name, state, and last run from live Runtime list", () => {
    const jobs = parseCronList(`
  efcc4a8048dd [active]
    Name:      night-pass
    Schedule:  every 1h
    Last run:  2026-09-04T21:30:19.973770+05:30  ok

  06c08aa2062c [paused]
    Name:      other-job
    Last run:  never
`);
    expect(jobs).toEqual([
      {
        id: "efcc4a8048dd",
        name: "night-pass",
        state: "running",
        lastRun: "2026-09-04T21:30:19.973770+05:30",
      },
      { id: "06c08aa2062c", name: "other-job", state: "paused" },
    ]);
  });
});

describe("watchCommands", () => {
  test("returns today's Hermes watch strings", () => {
    expect(watchCommands()).toEqual([
      "hermes cron list",
      "hermes cron runs",
      "hermes logs",
      "hermes dashboard",
    ]);
  });
});
