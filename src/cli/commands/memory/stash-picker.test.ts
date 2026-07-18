import { describe, expect, test } from "bun:test";
import { pickStashWithFzf, STASH_PICKER_CAP } from "./stash-picker.js";

const candidates = [
  { relativePath: "notes/a.md", status: "untracked" },
  { relativePath: "notes/b.md", status: "ignored" },
  { relativePath: "plans/x.md", status: "untracked" },
];

describe("STASH_PICKER_CAP", () => {
  test("is 20 (B34)", () => {
    expect(STASH_PICKER_CAP).toBe(20);
  });
});

describe("pickStashWithFzf", () => {
  test("throws when fzf missing", () => {
    expect(() =>
      pickStashWithFzf(candidates, {
        whichFzf: () => false,
        runFzf: () => ({ stdout: "", exitCode: 0 }),
      }),
    ).toThrow(/fzf not found/i);
  });

  test("parses tab-separated selected lines", () => {
    const selected = pickStashWithFzf(candidates, {
      whichFzf: () => true,
      runFzf: (input) => {
        expect(input).toContain("notes/a.md");
        expect(input).toContain("plans/x.md");
        return {
          stdout: "notes/a.md\t(untracked)\nplans/x.md\t(untracked)\n",
          exitCode: 0,
        };
      },
    });
    expect(selected).toEqual(["notes/a.md", "plans/x.md"]);
  });

  test("cancel / non-zero exit → empty selection", () => {
    expect(
      pickStashWithFzf(candidates, {
        whichFzf: () => true,
        runFzf: () => ({ stdout: "", exitCode: 130 }),
      }),
    ).toEqual([]);
    expect(
      pickStashWithFzf(candidates, {
        whichFzf: () => true,
        runFzf: () => ({ stdout: "", exitCode: 1 }),
      }),
    ).toEqual([]);
  });
});
