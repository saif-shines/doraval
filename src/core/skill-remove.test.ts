import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  applyRemove,
  applyRestore,
  isRecentInstall,
  isRemoveCandidate,
  listQuarantine,
  planRemove,
  planRestore,
  resolveSkillName,
} from "./skill-remove.js";
import { existsSync } from "fs";
import { SESSION_MAX_AGE_DAYS } from "./session-adapters/types.js";

function writeSkill(root: string, rel: string, name: string): string {
  const dir = join(root, rel);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: "Use when testing"\n---\n\n1. Do the thing\n`);
  return dir;
}

describe("isRemoveCandidate", () => {
  test("Authored + never invoked + not a Recent install is a Remove candidate", () => {
    expect(isRemoveCandidate({ origin: "authored", invoked: false, recentInstall: false })).toBe(true);
  });

  test("Recent install is not a Remove candidate", () => {
    expect(isRemoveCandidate({ origin: "authored", invoked: false, recentInstall: true })).toBe(false);
  });

  test("Global is not a Remove candidate", () => {
    expect(isRemoveCandidate({ origin: "global", invoked: false, recentInstall: false })).toBe(false);
  });

  test("Invoked Authored Skill is not a Remove candidate", () => {
    expect(isRemoveCandidate({ origin: "authored", invoked: true, recentInstall: false })).toBe(false);
  });

  test("Imported is not a Remove candidate", () => {
    expect(isRemoveCandidate({ origin: "imported", invoked: false, recentInstall: false })).toBe(false);
  });
});

describe("isRecentInstall", () => {
  const day = 24 * 60 * 60 * 1000;
  const now = 1_700_000_000_000;

  test("mtime inside the Review window is a Recent install", () => {
    expect(isRecentInstall(now - day, now)).toBe(true);
  });

  test("mtime older than the Review window is not a Recent install", () => {
    expect(isRecentInstall(now - (SESSION_MAX_AGE_DAYS + 1) * day, now)).toBe(false);
  });
});

describe("resolveSkillName", () => {
  test("unique Authored name resolves to that Skill", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const dir = writeSkill(cwd, ".claude/skills/ghost", "ghost");
    try {
      const r = resolveSkillName({ name: "ghost", cwd });
      expect(r.status).toBe("unique");
      if (r.status !== "unique") return;
      expect(r.match.dir).toBe(dir);
      expect(r.match.origin).toBe("authored");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("unknown name is none", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    try {
      expect(resolveSkillName({ name: "ghost", cwd }).status).toBe("none");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("same name in two agent roots is ambiguous", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    writeSkill(cwd, ".claude/skills/ghost", "ghost");
    writeSkill(cwd, ".grok/skills/ghost", "ghost");
    try {
      const r = resolveSkillName({ name: "ghost", cwd });
      expect(r.status).toBe("ambiguous");
      if (r.status !== "ambiguous") return;
      expect(r.matches).toHaveLength(2);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("--for claude picks the Claude copy", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const claude = writeSkill(cwd, ".claude/skills/ghost", "ghost");
    writeSkill(cwd, ".grok/skills/ghost", "ghost");
    try {
      const r = resolveSkillName({ name: "ghost", cwd, forAgent: "claude" });
      expect(r.status).toBe("unique");
      if (r.status !== "unique") return;
      expect(r.match.dir).toBe(claude);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("imported match is refused", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    writeSkill(cwd, ".claude/plugins/cache/pkg/ghost", "ghost");
    try {
      const r = resolveSkillName({ name: "ghost", cwd });
      expect(r.status).toBe("imported");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("Authored + Global same name is ambiguous", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const home = mkdtempSync(join(tmpdir(), "dora-home-"));
    writeSkill(cwd, ".claude/skills/ghost", "ghost");
    const globalDir = writeSkill(home, ".claude/skills/ghost", "ghost");
    try {
      const r = resolveSkillName({ name: "ghost", cwd, home });
      expect(r.status).toBe("ambiguous");
      if (r.status !== "ambiguous") return;
      expect(r.matches.some((m) => m.origin === "authored")).toBe(true);
      expect(r.matches.some((m) => m.origin === "global" && m.dir === globalDir)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("--global selects the Global copy", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const home = mkdtempSync(join(tmpdir(), "dora-home-"));
    writeSkill(cwd, ".claude/skills/ghost", "ghost");
    const globalDir = writeSkill(home, ".claude/skills/ghost", "ghost");
    try {
      const r = resolveSkillName({ name: "ghost", cwd, home, globalOnly: true });
      expect(r.status).toBe("unique");
      if (r.status !== "unique") return;
      expect(r.match.origin).toBe("global");
      expect(r.match.dir).toBe(globalDir);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("path wins over a name clash", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const a = writeSkill(cwd, ".claude/skills/ghost", "ghost");
    writeSkill(cwd, ".grok/skills/ghost", "ghost");
    try {
      const r = resolveSkillName({ name: a, cwd });
      expect(r.status).toBe("unique");
      if (r.status !== "unique") return;
      expect(r.match.dir).toBe(a);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("planRemove + applyRemove", () => {
  test("unique Authored plan deletes the directory", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const dir = writeSkill(cwd, ".claude/skills/ghost", "ghost");
    try {
      const resolved = resolveSkillName({ name: "ghost", cwd });
      const plan = planRemove(resolved);
      expect(plan).toMatchObject({ ok: true, action: "delete", dir, origin: "authored" });
      applyRemove(plan as Extract<typeof plan, { ok: true }>);
      expect(existsSync(dir)).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("imported and ambiguous plans do not delete", () => {
    expect(planRemove({ status: "none" }).ok).toBe(false);
    expect(planRemove({ status: "ambiguous", matches: [] }).ok).toBe(false);
    expect(planRemove({
      status: "imported",
      match: { name: "x", dir: "/x", origin: "imported" },
    }).ok).toBe(false);
  });

  test("unique Global plan Quarantines and Restore puts it back", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const home = mkdtempSync(join(tmpdir(), "dora-home-"));
    const doraHome = mkdtempSync(join(tmpdir(), "dora-qh-"));
    const dir = writeSkill(home, ".claude/skills/ghost", "ghost");
    const prev = process.env.DORAVAL_HOME;
    process.env.DORAVAL_HOME = doraHome;
    try {
      const resolved = resolveSkillName({ name: "ghost", cwd, home });
      const plan = planRemove(resolved);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      expect(plan.action).toBe("quarantine");
      applyRemove(plan);
      expect(existsSync(dir)).toBe(false);
      expect(listQuarantine().some((r) => r.name === "ghost")).toBe(true);
      const back = planRestore("ghost");
      expect(back.ok).toBe(true);
      if (!back.ok) return;
      applyRestore(back);
      expect(existsSync(join(dir, "SKILL.md"))).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.DORAVAL_HOME;
      else process.env.DORAVAL_HOME = prev;
      rmSync(cwd, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
      rmSync(doraHome, { recursive: true, force: true });
    }
  });

  test("Restore refuses an occupied original path", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const home = mkdtempSync(join(tmpdir(), "dora-home-"));
    const doraHome = mkdtempSync(join(tmpdir(), "dora-qh-"));
    const dir = writeSkill(home, ".claude/skills/ghost", "ghost");
    const prev = process.env.DORAVAL_HOME;
    process.env.DORAVAL_HOME = doraHome;
    try {
      applyRemove(planRemove(resolveSkillName({ name: "ghost", cwd, home })) as Extract<ReturnType<typeof planRemove>, { ok: true }>);
      writeSkill(home, ".claude/skills/ghost", "ghost");
      const back = planRestore("ghost");
      expect(back.ok).toBe(false);
      if (back.ok) return;
      expect(back.reason).toBe("occupied");
      expect(existsSync(dir)).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.DORAVAL_HOME;
      else process.env.DORAVAL_HOME = prev;
      rmSync(cwd, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
      rmSync(doraHome, { recursive: true, force: true });
    }
  });

  test("missing Quarantine name is not ok", () => {
    const doraHome = mkdtempSync(join(tmpdir(), "dora-qh-"));
    const prev = process.env.DORAVAL_HOME;
    process.env.DORAVAL_HOME = doraHome;
    try {
      const back = planRestore("nosuch");
      expect(back.ok).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.DORAVAL_HOME;
      else process.env.DORAVAL_HOME = prev;
      rmSync(doraHome, { recursive: true, force: true });
    }
  });
});
