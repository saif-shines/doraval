import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GEN_START } from "../src/core/rules/docs.js";
import { RULES } from "../src/core/rules/registry.js";
import { checkRuleDocs, generateRuleDocs } from "./gen-rule-docs.js";

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

  test("refreshes registry frontmatter and preserves hand-written prose on regen", async () => {
    await generateRuleDocs({ dir: TMP });
    const page = join(TMP, "R001.mdx");
    const body = (await readFile(page, "utf8"))
      .replace("title: R001 · frontmatter-presence", "title: stale")
      .replace('description: "Frontmatter block present"', 'description: "stale"')
      .replace("label: R001 frontmatter-presence", "label: stale")
      .replace("{/* describe what this rule checks */}", "HAND WRITTEN CLARITY");
    await writeFile(page, body);
    await generateRuleDocs({ dir: TMP });
    const after = await readFile(page, "utf8");
    expect(after).toContain("title: R001 · frontmatter-presence");
    expect(after).toContain('description: "Frontmatter block present"');
    expect(after).toContain("label: R001 frontmatter-presence");
    expect(after).toContain("HAND WRITTEN CLARITY");
    expect(after).toContain(GEN_START);
  });

  test("throws on a page missing markers", async () => {
    await mkdir(TMP, { recursive: true });
    await writeFile(join(TMP, "R001.mdx"), "---\ntitle: stale\n---\n\nno markers at all");
    await expect(generateRuleDocs({ dir: TMP })).rejects.toThrow(/marker/i);
  });

  test("check accepts exact generated output", async () => {
    await generateRuleDocs({ dir: TMP });
    await expect(checkRuleDocs({ dir: TMP })).resolves.toBeUndefined();
  });

  test("check rejects missing, extra, stale catalog, stale nav, and stale page metadata", async () => {
    const cases: Array<[string, () => Promise<void>]> = [
      ["missing", async () => rm(join(TMP, "R001.mdx"))],
      ["unexpected", async () => writeFile(join(TMP, "R999.mdx"), "extra")],
      ["index.mdx", async () => writeFile(join(TMP, "index.mdx"), "stale catalog")],
      ["meta.ts", async () => writeFile(join(TMP, "meta.ts"), "stale nav")],
      ["R001.mdx", async () => {
        const path = join(TMP, "R001.mdx");
        await writeFile(path, (await readFile(path, "utf8")).replace("title: R001 · frontmatter-presence", "title: stale"));
      }],
      ["R002.mdx", async () => {
        const path = join(TMP, "R002.mdx");
        await writeFile(path, (await readFile(path, "utf8")).replace("**Tier:** structure", "**Tier:** stale"));
      }],
    ];

    for (const [message, mutate] of cases) {
      await rm(TMP, { recursive: true, force: true });
      await generateRuleDocs({ dir: TMP });
      await mutate();
      await expect(checkRuleDocs({ dir: TMP })).rejects.toThrow(message);
    }
  });
});
