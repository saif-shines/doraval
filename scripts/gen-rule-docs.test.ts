import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GEN_START } from "../src/core/rules/docs.js";
import { RULES } from "../src/core/rules/registry.js";
import { generateRuleDocs } from "./gen-rule-docs.js";

const TMP = join(import.meta.dir, "__gen_tmp__");

afterEach(async () => {
  await rm(TMP, { recursive: true, force: true });
});

describe("generateRuleDocs", () => {
  test("writes catalog + one page per rule", async () => {
    const { written, catalog } = await generateRuleDocs({ dir: TMP });
    expect(written.some((path) => path.endsWith("index.mdx"))).toBe(true);
    for (const rule of RULES) {
      expect(written.some((path) => path.endsWith(`${rule.code}.mdx`))).toBe(true);
    }
    expect(catalog).toContain("/reference/rules/R001");
  });

  test("preserves hand-written prose on regen", async () => {
    await generateRuleDocs({ dir: TMP });
    const page = join(TMP, "R001.mdx");
    const body = (await readFile(page, "utf8")).replace(
      "<!-- describe what this rule checks -->",
      "HAND WRITTEN CLARITY",
    );
    await writeFile(page, body);
    await generateRuleDocs({ dir: TMP });
    const after = await readFile(page, "utf8");
    expect(after).toContain("HAND WRITTEN CLARITY");
    expect(after).toContain(GEN_START);
  });

  test("throws on a page missing markers", async () => {
    await mkdir(TMP, { recursive: true });
    await writeFile(join(TMP, "R001.mdx"), "no markers at all");
    await expect(generateRuleDocs({ dir: TMP })).rejects.toThrow(/marker/i);
  });
});
