import { describe, expect, test } from "bun:test";
import { bootArgs, hermesSchedule, hermesTimeoutSec, onePassCommand, parseCronList, pauseArgs, resumeArgs, watchCommands } from "./hermes.js";
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
    expect(cmds[5]).toEqual([
      "cron",
      "create",
      "every 1h",
      "Check the inbox.\n\nHuman-visible messages end with: Sent by pocket agent night-pass",
      "--name",
      "night-pass",
      "--skill",
      "/skills/run",
    ]);
    expect(JSON.stringify(cmds)).not.toContain("--timeout");
    expect(JSON.stringify(cmds)).not.toContain("--toolsets");
  });

  test("pause and resume target that job name only", () => {
    expect(pauseArgs("night-pass")).toEqual(["cron", "pause", "night-pass"]);
    expect(resumeArgs("night-pass")).toEqual(["cron", "resume", "night-pass"]);
  });

  test("one-pass command uses the MCP toolset, skills, and run-budget", () => {
    const cmd = onePassCommand(routine);
    expect(cmd).toContain("hermes chat --toolsets mcp-scalekit --oneshot --run-budget 600");
    expect(cmd).toContain("--skills /skills/run");
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
    expect(cmds.map((c) => c[0])).toEqual(["gateway", "gateway", "cron"]);
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
  test("reads paused and active names", () => {
    const states = parseCronList("[active] night-pass\n[paused] other-job\n");
    expect(states.get("night-pass")).toBe("running");
    expect(states.get("other-job")).toBe("paused");
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
