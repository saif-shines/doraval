import { describe, expect, test } from "bun:test";
import { SECTION_LINES_WARN, findDisclosureCandidates } from "./progressive-disclosure.js";

function repeat(text: string, n: number): string {
  return Array.from({ length: n }, () => text).join("\n");
}

describe("findDisclosureCandidates", () => {
  test("long section with a fenced code block is a candidate", () => {
    const filler = repeat("Some reference detail line.", SECTION_LINES_WARN + 20);
    const content = `## Setup steps\n\n${filler}\n\n\`\`\`bash\necho hi\n\`\`\`\n`;
    const candidates = findDisclosureCandidates("CLAUDE.md", content);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.heading).toBe("## Setup steps");
    expect(candidates[0]!.reason).toMatch(/code block/);
  });

  test("long section with a markdown table is a candidate", () => {
    const filler = repeat("Filler line for length padding here.", SECTION_LINES_WARN + 10);
    const content = `## Config options\n\n${filler}\n\n| Key | Value |\n| --- | --- |\n| a | b |\n`;
    const candidates = findDisclosureCandidates("CLAUDE.md", content);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.heading).toBe("## Config options");
    expect(candidates[0]!.reason).toMatch(/table/);
  });

  test("short imperative section is not a candidate", () => {
    const content = [
      "## House rules",
      "",
      "Always run tests before committing.",
      "Never bump the version without asking.",
      "Keep functions small.",
      "Prefer composition over inheritance.",
      "Write one test per non-trivial change.",
      "Delete dead code eagerly.",
      "Ask before adding a dependency.",
      "Document surprising decisions inline.",
    ].join("\n");
    const candidates = findDisclosureCandidates("CLAUDE.md", content);
    expect(candidates).toHaveLength(0);
  });

  test("headings inside a fenced code block do not split the section", () => {
    const filler = repeat("Reference line describing behavior.", SECTION_LINES_WARN + 10);
    const content = [
      "## Recovery procedure",
      "",
      filler,
      "",
      "```bash",
      "# ## this looks like a heading but is inside a fence",
      "# ### so does this",
      "echo done",
      "```",
      "",
    ].join("\n");
    const candidates = findDisclosureCandidates("CLAUDE.md", content);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.heading).toBe("## Recovery procedure");
  });

  test("orders candidates largest first", () => {
    const small = repeat("Reference detail line for the smaller section.", SECTION_LINES_WARN + 5);
    const big = repeat("Reference detail line for the bigger section.", SECTION_LINES_WARN + 30);
    const content = [
      "## Troubleshooting A",
      "",
      small,
      "",
      "```bash",
      "echo a",
      "```",
      "",
      "## Troubleshooting B",
      "",
      big,
      "",
      "```bash",
      "echo b",
      "```",
      "",
    ].join("\n");
    const candidates = findDisclosureCandidates("CLAUDE.md", content);
    expect(candidates.length).toBe(2);
    expect(candidates[0]!.heading).toBe("## Troubleshooting B");
    expect(candidates[0]!.lines).toBeGreaterThan(candidates[1]!.lines);
  });
});
