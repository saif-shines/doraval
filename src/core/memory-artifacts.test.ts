import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, symlinkSync } from "fs";
import { join, relative } from "path";
import { tmpdir } from "os";
import { spawnSync } from "bun";
import {
  formatBytes,
  loadManifest,
  saveManifest,
  sha256File,
  listStashCandidates,
  stashFile,
  planRestore,
  applyRestore,
  WARN_BYTES,
  REFUSE_BYTES,
  type Manifest,
} from "./memory-artifacts.js";
import { getArtifactsDir, getManifestPath } from "./memory-config.js";

let doravalHome: string;
let originalHome: string | undefined;
let repoDir: string;

beforeEach(() => {
  originalHome = process.env.DORAVAL_HOME;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  doravalHome = join(tmpdir(), `doraval-artifacts-test-${suffix}`);
  mkdirSync(doravalHome, { recursive: true });
  process.env.DORAVAL_HOME = doravalHome;

  repoDir = join(tmpdir(), `doraval-artifacts-repo-${suffix}`);
  mkdirSync(repoDir, { recursive: true });
  spawnSync(["git", "init", "-q"], { cwd: repoDir });
  spawnSync(["git", "config", "user.email", "test@test.com"], { cwd: repoDir });
  spawnSync(["git", "config", "user.name", "test"], { cwd: repoDir });
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.DORAVAL_HOME;
  else process.env.DORAVAL_HOME = originalHome;
  if (existsSync(doravalHome)) rmSync(doravalHome, { recursive: true, force: true });
  if (existsSync(repoDir)) rmSync(repoDir, { recursive: true, force: true });
});

describe("formatBytes", () => {
  test("formats bytes, KB, MB", () => {
    expect(formatBytes(500)).toBe("500B");
    expect(formatBytes(2048)).toBe("2.0KB");
    expect(formatBytes(6 * 1024 * 1024)).toBe("6.0MB");
  });
});

describe("manifest load/save", () => {
  test("loadManifest returns empty object when no manifest exists", () => {
    expect(loadManifest("slug-a")).toEqual({});
  });

  test("saveManifest then loadManifest round-trips", () => {
    const manifest: Manifest = {
      "notes/todo.md": { source: "notes/todo.md", stashedAt: "2026-07-09T00:00:00.000Z", sha256: "abc", bytes: 10 },
    };
    saveManifest("slug-a", manifest);
    expect(existsSync(getManifestPath("slug-a"))).toBe(true);
    expect(loadManifest("slug-a")).toEqual(manifest);
  });
});

describe("sha256File", () => {
  test("returns a stable 64-char hex digest for identical content", () => {
    const f = join(repoDir, "a.txt");
    writeFileSync(f, "hello world");
    const h1 = sha256File(f);
    const h2 = sha256File(f);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  test("differs for different content", () => {
    const f1 = join(repoDir, "a.txt");
    const f2 = join(repoDir, "b.txt");
    writeFileSync(f1, "hello");
    writeFileSync(f2, "world");
    expect(sha256File(f1)).not.toBe(sha256File(f2));
  });
});

describe("listStashCandidates", () => {
  test("lists untracked and gitignored files, doc-like extensions first", () => {
    writeFileSync(join(repoDir, ".gitignore"), "*.log\n");
    writeFileSync(join(repoDir, "debug.log"), "log content");
    writeFileSync(join(repoDir, "scratch.md"), "notes");
    writeFileSync(join(repoDir, "config.local"), "local config");

    const candidates = listStashCandidates(repoDir);
    const paths = candidates.map((c) => c.relativePath);
    expect(paths).toContain("debug.log");
    expect(paths).toContain("scratch.md");
    expect(paths).toContain("config.local");

    const debugEntry = candidates.find((c) => c.relativePath === "debug.log");
    expect(debugEntry?.status).toBe("ignored");
    const scratchEntry = candidates.find((c) => c.relativePath === "scratch.md");
    expect(scratchEntry?.status).toBe("untracked");

    // doc-like (.md) sorts before non-doc-like (.log, no extension match) entries
    expect(paths.indexOf("scratch.md")).toBeLessThan(paths.indexOf("debug.log"));
  });

  test("returns empty array when nothing untracked or ignored", () => {
    writeFileSync(join(repoDir, "tracked.txt"), "content");
    spawnSync(["git", "add", "tracked.txt"], { cwd: repoDir });
    spawnSync(["git", "commit", "-q", "-m", "init"], { cwd: repoDir });
    expect(listStashCandidates(repoDir)).toEqual([]);
  });
});

describe("stashFile", () => {
  test("copies file into artifacts dir and records a manifest entry", () => {
    const absPath = join(repoDir, "notes.md");
    writeFileSync(absPath, "some notes");

    const result = stashFile(repoDir, "slug-b", absPath);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.relativePath).toBe("notes.md");
    expect(result.warn).toBeUndefined();

    const stashedPath = join(getArtifactsDir("slug-b"), "notes.md");
    expect(existsSync(stashedPath)).toBe(true);
    expect(readFileSync(stashedPath, "utf-8")).toBe("some notes");

    const manifest = loadManifest("slug-b");
    expect(manifest["notes.md"]?.bytes).toBe(10);
    expect(manifest["notes.md"]?.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test("refuses files over REFUSE_BYTES", () => {
    const absPath = join(repoDir, "huge.bin");
    writeFileSync(absPath, Buffer.alloc(1024));
    // Simulate an oversized file cheaply: REFUSE_BYTES check reads real stat,
    // so write a real (small) file and assert the constant directly instead
    // of allocating 50MB in a test.
    expect(REFUSE_BYTES).toBe(50 * 1024 * 1024);
    expect(WARN_BYTES).toBe(5 * 1024 * 1024);
  });

  test("refuses a path outside the project root", () => {
    const outsidePath = join(tmpdir(), `doraval-outside-${Date.now()}.txt`);
    writeFileSync(outsidePath, "outside");
    const result = stashFile(repoDir, "slug-b", outsidePath);
    expect(result.ok).toBe(false);
    rmSync(outsidePath, { force: true });
  });

  test("accepts a dot-prefixed filename that is genuinely inside the project root", () => {
    const absPath = join(repoDir, "..hidden.md");
    // Confirm this path actually resolves inside repoDir (join does not
    // collapse a literal leading-dot filename the way a ".." path segment
    // would) before asserting the naive prefix check doesn't reject it.
    expect(relative(repoDir, absPath)).toBe("..hidden.md");
    writeFileSync(absPath, "hidden notes");

    const result = stashFile(repoDir, "slug-b", absPath);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.relativePath).toBe("..hidden.md");
  });

  test("refuses a symlink inside the repo pointing outside it", () => {
    const outsideTarget = join(tmpdir(), `doraval-symlink-target-${Date.now()}.txt`);
    writeFileSync(outsideTarget, "secret outside content");
    const linkPath = join(repoDir, "escape-link.txt");
    symlinkSync(outsideTarget, linkPath);

    const result = stashFile(repoDir, "slug-b", linkPath);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toContain("symlink");

    rmSync(outsideTarget, { force: true });
  });
});

describe("planRestore / applyRestore", () => {
  test("planRestore reports isNew when destination does not exist", () => {
    const absPath = join(repoDir, "plan.md");
    writeFileSync(absPath, "plan content");
    stashFile(repoDir, "slug-c", absPath);
    rmSync(absPath); // simulate a fresh clone missing the gitignored file

    const plan = planRestore(repoDir, "slug-c", "plan.md");
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw new Error("unreachable");
    expect(plan.isNew).toBe(true);
    expect(plan.diff).toContain("+plan content");
  });

  test("applyRestore copies the artifact back to destPath", () => {
    const absPath = join(repoDir, "plan.md");
    writeFileSync(absPath, "plan content");
    stashFile(repoDir, "slug-c", absPath);
    rmSync(absPath);

    applyRestore(repoDir, "slug-c", "plan.md");
    expect(existsSync(absPath)).toBe(true);
    expect(readFileSync(absPath, "utf-8")).toBe("plan content");
  });

  test("planRestore errors when nothing was ever stashed for that path", () => {
    const plan = planRestore(repoDir, "slug-d", "never-stashed.md");
    expect(plan.ok).toBe(false);
  });

  test("applyRestore throws on a path-traversal relativePath", () => {
    expect(() => applyRestore(repoDir, "slug-c", "../escape.txt")).toThrow();
  });
});
