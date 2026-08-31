import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { basename, join } from "path";
import { describe, expect, test } from "bun:test";
import {
  listRoutineSlugs,
  openRoutine,
  readDefaultMcpUrl,
  readRoutine,
  resolveSkillRef,
  writeDefaultMcpUrl,
  writeRoutine,
} from "./routine.js";

function tmpHome(): string {
  return mkdtempSync(join(tmpdir(), "dora-routine-"));
}

function writeSkill(root: string, rel: string, body = "do the thing"): string {
  const dir = join(root, rel);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "SKILL.md"),
    `---\nname: ${basename(dir)}\ndescription: ${body}\n---\n\n# ${basename(dir)}\n\n${body}\n`,
  );
  return dir;
}

describe("writeRoutine", () => {
  test("writes ~/.dora/harness/<slug>/ with the folder contract", () => {
    const home = tmpHome();
    const dir = writeRoutine(home, {
      slug: "ooo-calendar",
      prompt: "Check the OOO calendar.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });

    expect(dir).toBe(join(home, ".dora", "harness", "ooo-calendar"));
    expect(readFileSync(join(dir, "prompt.md"), "utf8")).toBe("Check the OOO calendar.\n");
    const yaml = readFileSync(join(dir, "routine.yml"), "utf8");
    expect(yaml).toContain("skills_run: []");
    expect(yaml).toContain("skills_refer: []");
    expect(yaml).toContain('mcp_url: "https://gw.example/mcp"');
    expect(yaml).toContain('interval: "1h"');
    expect(yaml).toContain('max_tick: "10m"');
    expect(readdirSync(dir).sort()).toEqual(["prompt.md", "routine.yml"]);

    rmSync(home, { recursive: true, force: true });
  });

  test("refuses to overwrite an existing routine", () => {
    const home = tmpHome();
    const input = {
      slug: "ooo-calendar",
      prompt: "First.",
      skillsRun: [] as string[],
      skillsRefer: [] as string[],
      mcpUrl: "https://gw.example/mcp",
    };
    writeRoutine(home, input);
    expect(() => writeRoutine(home, { ...input, prompt: "Second." })).toThrow(/already exists/i);
    expect(readFileSync(join(home, ".dora", "harness", "ooo-calendar", "prompt.md"), "utf8")).toBe("First.\n");
    rmSync(home, { recursive: true, force: true });
  });

  test("interval and max tick can be set per routine", () => {
    const home = tmpHome();
    const dir = writeRoutine(home, {
      slug: "tight-job",
      prompt: "Ping.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
      interval: "15m",
      maxTick: "2m",
    });
    const yaml = readFileSync(join(dir, "routine.yml"), "utf8");
    expect(yaml).toContain('interval: "15m"');
    expect(yaml).toContain('max_tick: "2m"');
    expect(yaml).not.toContain('interval: "1h"');
    expect(yaml).not.toContain('max_tick: "10m"');
    rmSync(home, { recursive: true, force: true });
  });

  test("does not write a secrets file", () => {
    const home = tmpHome();
    const dir = writeRoutine(home, {
      slug: "clean",
      prompt: "Work.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const names = readdirSync(dir);
    expect(names.some((n) => /secret|\.env|token|credential/i.test(n))).toBe(false);
    const yaml = readFileSync(join(dir, "routine.yml"), "utf8");
    expect(yaml).not.toMatch(/api_key|token|password|secret/i);
    rmSync(home, { recursive: true, force: true });
  });

  test("quotes yaml values so a newline cannot add keys", () => {
    const home = tmpHome();
    const dir = writeRoutine(home, {
      slug: "quoted",
      prompt: "x",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp\nevil: true",
    });
    const yaml = readFileSync(join(dir, "routine.yml"), "utf8");
    expect(yaml).not.toMatch(/^evil:/m);
    expect(yaml).toContain("\\nevil: true");
    rmSync(home, { recursive: true, force: true });
  });
});

describe("readRoutine", () => {
  test("reads the folder contract back", () => {
    const home = tmpHome();
    writeRoutine(home, {
      slug: "ooo-calendar",
      prompt: "Check the OOO calendar.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const r = readRoutine(home, "ooo-calendar");
    expect(r.slug).toBe("ooo-calendar");
    expect(r.prompt).toBe("Check the OOO calendar.\n");
    expect(r.skillsRun).toEqual([]);
    expect(r.skillsRefer).toEqual([]);
    expect(r.mcpUrl).toBe("https://gw.example/mcp");
    expect(r.interval).toBe("1h");
    expect(r.maxTick).toBe("10m");
    rmSync(home, { recursive: true, force: true });
  });
});

describe("default MCP URL", () => {
  test("saves a shared URL outside the routine folder", () => {
    const home = tmpHome();
    expect(readDefaultMcpUrl(home)).toBeUndefined();
    writeDefaultMcpUrl(home, "https://gw.example/mcp");
    expect(readDefaultMcpUrl(home)).toBe("https://gw.example/mcp");
    writeRoutine(home, {
      slug: "odd-job",
      prompt: "x",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://other.example/mcp",
    });
    expect(readDefaultMcpUrl(home)).toBe("https://gw.example/mcp");
    rmSync(home, { recursive: true, force: true });
  });
});

describe("listRoutineSlugs", () => {
  test("names existing slugs", () => {
    const home = tmpHome();
    expect(listRoutineSlugs(home)).toEqual([]);
    writeRoutine(home, {
      slug: "nightly-review",
      prompt: "Review.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    writeRoutine(home, {
      slug: "ooo-calendar",
      prompt: "Check OOO.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    expect(listRoutineSlugs(home)).toEqual(["nightly-review", "ooo-calendar"]);
    rmSync(home, { recursive: true, force: true });
  });
});

describe("openRoutine", () => {
  test("opens the routine folder", () => {
    const home = tmpHome();
    const dir = writeRoutine(home, {
      slug: "ooo-calendar",
      prompt: "Check OOO.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const opened: string[] = [];
    expect(openRoutine(home, "ooo-calendar", (p) => opened.push(p))).toBe(dir);
    expect(opened).toEqual([dir]);
    rmSync(home, { recursive: true, force: true });
  });

  test("throws when the slug is missing", () => {
    const home = tmpHome();
    expect(() => openRoutine(home, "nope", () => {})).toThrow(/nope/);
    rmSync(home, { recursive: true, force: true });
  });
});

describe("slug", () => {
  test("rejects a path that leaves the harness root", () => {
    const home = tmpHome();
    expect(() =>
      writeRoutine(home, {
        slug: "../escape",
        prompt: "x",
        skillsRun: [],
        skillsRefer: [],
        mcpUrl: "https://gw.example/mcp",
      }),
    ).toThrow(/slug/i);
    rmSync(home, { recursive: true, force: true });
  });
});

describe("routine copy", () => {
  test("copies a project skill name into the routine", () => {
    const home = tmpHome();
    const cwd = mkdtempSync(join(tmpdir(), "dora-copy-cwd-"));
    const src = writeSkill(cwd, "skills/inbox", "poll the inbox");
    const original = readFileSync(join(src, "SKILL.md"), "utf8");

    const dir = writeRoutine(
      home,
      {
        slug: "night-inbox",
        prompt: "Poll.",
        skillsRun: ["inbox"],
        skillsRefer: [],
        mcpUrl: "https://gw.example/mcp",
      },
      { cwd },
    );

    const copy = join(dir, "skills", "inbox");
    expect(readFileSync(join(copy, "SKILL.md"), "utf8")).toBe(original);
    expect(readRoutine(home, "night-inbox").skillsRun).toEqual([copy]);
    writeFileSync(join(copy, "SKILL.md"), "tuned copy\n");
    expect(readFileSync(join(src, "SKILL.md"), "utf8")).toBe(original);

    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });

  test("name lookup uses project skills before home skills", () => {
    const home = tmpHome();
    const cwd = mkdtempSync(join(tmpdir(), "dora-copy-lookup-"));
    writeSkill(cwd, "cal", "cwd root");
    writeSkill(cwd, "skills/cal", "project cal");
    writeSkill(home, ".claude/skills/cal", "home cal");

    expect(resolveSkillRef("cal", { cwd, home })).toEqual({
      kind: "found",
      dir: join(cwd, "skills", "cal"),
      name: "cal",
    });

    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });

  test("name lookup falls back to home skills, then asks", () => {
    const home = tmpHome();
    const cwd = mkdtempSync(join(tmpdir(), "dora-copy-home-"));
    const homeDir = writeSkill(home, ".agents/skills/cal", "home cal");

    expect(resolveSkillRef("cal", { cwd, home })).toEqual({
      kind: "found",
      dir: homeDir,
      name: "cal",
    });
    expect(resolveSkillRef("missing-skill", { cwd, home })).toEqual({
      kind: "ask",
      ref: "missing-skill",
    });
    expect(() =>
      writeRoutine(
        home,
        {
          slug: "nope",
          prompt: "x",
          skillsRun: ["missing-skill"],
          skillsRefer: [],
          mcpUrl: "https://gw.example/mcp",
        },
        { cwd },
      ),
    ).toThrow(/path or a GitHub URL/i);
    expect(existsSync(join(home, ".dora", "harness", "nope", "prompt.md"))).toBe(false);

    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });

  test("a local path is a source", () => {
    const home = tmpHome();
    const cwd = mkdtempSync(join(tmpdir(), "dora-copy-path-"));
    const src = writeSkill(cwd, "vendor/holiday", "holiday");

    const dir = writeRoutine(
      home,
      {
        slug: "holidays",
        prompt: "Scan.",
        skillsRun: [src],
        skillsRefer: [],
        mcpUrl: "https://gw.example/mcp",
      },
      { cwd },
    );

    expect(readFileSync(join(dir, "skills", "holiday", "SKILL.md"), "utf8")).toContain("holiday");
    expect(readFileSync(join(src, "SKILL.md"), "utf8")).toContain("holiday");

    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });

  test("a GitHub URL is a source without a live clone", () => {
    const home = tmpHome();
    const cwd = mkdtempSync(join(tmpdir(), "dora-copy-url-"));
    const fixture = writeSkill(cwd, "fetched/remote-cal", "remote cal");

    const dir = writeRoutine(
      home,
      {
        slug: "from-url",
        prompt: "Scan.",
        skillsRun: ["https://github.com/acme/remote-cal"],
        skillsRefer: [],
        mcpUrl: "https://gw.example/mcp",
      },
      { cwd, fetchRemote: (url) => {
        expect(url).toBe("https://github.com/acme/remote-cal");
        return fixture;
      } },
    );

    expect(readFileSync(join(dir, "skills", "remote-cal", "SKILL.md"), "utf8")).toContain("remote cal");

    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });

  test("does not copy secrets into the routine", () => {
    const home = tmpHome();
    const cwd = mkdtempSync(join(tmpdir(), "dora-copy-secret-"));
    const src = writeSkill(cwd, "skills/inbox", "poll");
    writeFileSync(join(src, ".env"), "TOKEN=secret\n");
    writeFileSync(join(src, "api.secret"), "nope\n");
    const leaked = join(cwd, "id_rsa");
    writeFileSync(leaked, "PRIVATE\n");
    symlinkSync(leaked, join(src, "id_rsa"));

    const dir = writeRoutine(
      home,
      {
        slug: "clean-copy",
        prompt: "Poll.",
        skillsRun: ["inbox"],
        skillsRefer: [],
        mcpUrl: "https://gw.example/mcp",
      },
      { cwd },
    );

    const names = readdirSync(join(dir, "skills", "inbox"));
    expect(names).toContain("SKILL.md");
    expect(names).not.toContain(".env");
    expect(names).not.toContain("api.secret");
    expect(names).not.toContain("id_rsa");
    expect(readFileSync(join(src, ".env"), "utf8")).toBe("TOKEN=secret\n");

    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });
});
