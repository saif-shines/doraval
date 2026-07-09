import { describe, expect, test } from "bun:test";
import {
  getMemoryDir,
  getMemoryRepoDir,
  getMemoryRemoteConfigPath,
  getProjectSlug,
  sanitize,
  shortHash,
  getGlobalPrinciplesPath,
  getProjectPrinciplesPath,
  getArtifactsDir,
  getManifestPath,
} from "./memory-config.js";
import { getDoravalDir } from "./journal-config.js";
import { join } from "path";

describe("getMemoryDir", () => {
  test("returns memory/ under doraval dir", () => {
    const result = getMemoryDir();
    expect(result).toBe(join(getDoravalDir(), "memory"));
  });
});

describe("getMemoryRepoDir", () => {
  test("returns memory/repo under doraval dir", () => {
    expect(getMemoryRepoDir()).toBe(join(getDoravalDir(), "memory", "repo"));
  });
});

describe("getMemoryRemoteConfigPath", () => {
  test("returns memory/config.yml under doraval dir", () => {
    expect(getMemoryRemoteConfigPath()).toBe(join(getDoravalDir(), "memory", "config.yml"));
  });
});

describe("getGlobalPrinciplesPath", () => {
  test("returns path under memory/repo/global", () => {
    const result = getGlobalPrinciplesPath();
    expect(result).toBe(join(getDoravalDir(), "memory", "repo", "global", "principles.md"));
  });
});

describe("getProjectPrinciplesPath", () => {
  test("returns path under memory/repo/projects/<slug>", () => {
    const result = getProjectPrinciplesPath("my-project-abc123");
    expect(result).toBe(
      join(getDoravalDir(), "memory", "repo", "projects", "my-project-abc123", "principles.md"),
    );
  });
});

describe("getArtifactsDir", () => {
  test("returns path under memory/repo/projects/<slug>/artifacts", () => {
    const result = getArtifactsDir("my-project-abc123");
    expect(result).toBe(
      join(getDoravalDir(), "memory", "repo", "projects", "my-project-abc123", "artifacts"),
    );
  });
});

describe("getManifestPath", () => {
  test("returns manifest.yml inside the artifacts dir", () => {
    const result = getManifestPath("my-project-abc123");
    expect(result).toBe(
      join(getDoravalDir(), "memory", "repo", "projects", "my-project-abc123", "artifacts", "manifest.yml"),
    );
  });
});

describe("getProjectSlug", () => {
  test("returns consistent slug for same path", () => {
    const slug1 = getProjectSlug("/Users/dev/my-project");
    const slug2 = getProjectSlug("/Users/dev/my-project");
    expect(slug1).toBe(slug2);
  });

  test("different paths produce different slugs", () => {
    const slug1 = getProjectSlug("/Users/dev/project-alpha");
    const slug2 = getProjectSlug("/Users/dev/project-beta");
    expect(slug1).not.toBe(slug2);
  });

  test("slug contains sanitized basename and hash", () => {
    const slug = getProjectSlug("/Users/dev/my-project");
    expect(slug).toMatch(/^my-project-[a-f0-9]+$/);
  });

  test("never produces a leading hyphen when the basename sanitizes to empty", () => {
    // cwd "/" -> basename "" -> sanitize("") -> "" -> would otherwise yield "-<hash>",
    // a leading-hyphen path segment that some shells/CLIs misparse as a flag.
    const slug = getProjectSlug("/");
    expect(slug.startsWith("-")).toBe(false);
    expect(slug).toMatch(/^project-[a-f0-9]+$/);
  });

  test("falls back to 'project' when basename is all-special-chars", () => {
    const slug = getProjectSlug("/Users/dev/___");
    expect(slug).toMatch(/^project-[a-f0-9]+$/);
  });

  test("handles paths with trailing slashes", () => {
    // path.split("/").pop() on trailing slash gives empty string → "unknown"
    const slug = getProjectSlug("/Users/dev/project/");
    expect(slug).toContain("-");
    expect(slug.length).toBeGreaterThan(1);
  });
});

describe("sanitize", () => {
  test("lowercases input", () => {
    expect(sanitize("MyProject")).toBe("myproject");
  });

  test("replaces special characters with hyphens", () => {
    expect(sanitize("my_proj@ect!")).toBe("my-proj-ect");
  });

  test("collapses consecutive hyphens", () => {
    expect(sanitize("a---b")).toBe("a-b");
  });

  test("strips leading and trailing hyphens", () => {
    expect(sanitize("-hello-")).toBe("hello");
  });

  test("truncates to 32 characters", () => {
    const long = "a".repeat(50);
    expect(sanitize(long).length).toBeLessThanOrEqual(32);
  });

  test("handles empty string", () => {
    expect(sanitize("")).toBe("");
  });
});

describe("shortHash", () => {
  test("returns consistent hash for same input", () => {
    expect(shortHash("hello")).toBe(shortHash("hello"));
  });

  test("returns different hashes for different input", () => {
    expect(shortHash("hello")).not.toBe(shortHash("world"));
  });

  test("returns at most 6 hex chars", () => {
    const h = shortHash("/Users/dev/long/path/to/project");
    expect(h.length).toBeLessThanOrEqual(6);
    expect(h).toMatch(/^[a-f0-9]+$/);
  });
});
