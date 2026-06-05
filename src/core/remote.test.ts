import { describe, expect, test } from "bun:test";
import { parseRemoteUrl } from "./remote.js";

describe("parseRemoteUrl", () => {
  // ── GitHub URLs ────────────────────────────────────────────────

  test("parses full GitHub URL", () => {
    const r = parseRemoteUrl("https://github.com/obra/superpowers");
    expect(r).not.toBeNull();
    expect(r!.ghRepo).toBe("obra/superpowers");
    expect(r!.gitUrl).toBe("https://github.com/obra/superpowers.git");
    expect(r!.ref).toBeUndefined();
    expect(r!.subpath).toBeUndefined();
  });

  test("parses GitHub URL with .git suffix", () => {
    const r = parseRemoteUrl("https://github.com/obra/superpowers.git");
    expect(r).not.toBeNull();
    expect(r!.ghRepo).toBe("obra/superpowers");
    expect(r!.gitUrl).toBe("https://github.com/obra/superpowers.git");
  });

  test("parses GitHub URL with branch", () => {
    const r = parseRemoteUrl("https://github.com/obra/superpowers/tree/v2");
    expect(r).not.toBeNull();
    expect(r!.ghRepo).toBe("obra/superpowers");
    expect(r!.ref).toBe("v2");
    expect(r!.subpath).toBeUndefined();
  });

  test("parses GitHub URL with branch and subpath", () => {
    const r = parseRemoteUrl(
      "https://github.com/obra/superpowers/tree/main/plugins/caveman"
    );
    expect(r).not.toBeNull();
    expect(r!.ghRepo).toBe("obra/superpowers");
    expect(r!.ref).toBe("main");
    expect(r!.subpath).toBe("plugins/caveman");
  });

  test("parses GitHub /blob/ URL same as /tree/", () => {
    const r = parseRemoteUrl(
      "https://github.com/obra/superpowers/blob/main/devex-kit"
    );
    expect(r).not.toBeNull();
    expect(r!.ghRepo).toBe("obra/superpowers");
    expect(r!.ref).toBe("main");
    expect(r!.subpath).toBe("devex-kit");
  });

  test("parses GitHub shorthand (no scheme)", () => {
    const r = parseRemoteUrl("github.com/obra/superpowers");
    expect(r).not.toBeNull();
    expect(r!.ghRepo).toBe("obra/superpowers");
    expect(r!.gitUrl).toBe("https://github.com/obra/superpowers.git");
  });

  // ── Non-GitHub URLs ────────────────────────────────────────────

  test("parses GitLab URL (no ghRepo)", () => {
    const r = parseRemoteUrl("https://gitlab.com/user/repo");
    expect(r).not.toBeNull();
    expect(r!.ghRepo).toBeUndefined();
    expect(r!.gitUrl).toBe("https://gitlab.com/user/repo.git");
  });

  test("parses Bitbucket URL", () => {
    const r = parseRemoteUrl("https://bitbucket.org/user/repo");
    expect(r).not.toBeNull();
    expect(r!.ghRepo).toBeUndefined();
    expect(r!.gitUrl).toBe("https://bitbucket.org/user/repo.git");
  });

  // ── Local paths ────────────────────────────────────────────────

  test("returns null for dot path", () => {
    expect(parseRemoteUrl(".")).toBeNull();
  });

  test("returns null for relative path", () => {
    expect(parseRemoteUrl("./my-plugin")).toBeNull();
  });

  test("returns null for absolute path", () => {
    expect(parseRemoteUrl("/Users/saif/projects/plugin")).toBeNull();
  });

  test("returns null for home-relative path", () => {
    expect(parseRemoteUrl("~/projects/plugin")).toBeNull();
  });

  // ── Edge cases ─────────────────────────────────────────────────

  test("preserves original input", () => {
    const input = "https://github.com/obra/superpowers/tree/main/plugins/caveman";
    const r = parseRemoteUrl(input);
    expect(r!.original).toBe(input);
  });
});