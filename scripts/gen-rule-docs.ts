import { existsSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  refreshRulePage,
  renderCatalog,
  scaffoldRulePage,
} from "../src/core/rules/docs.js";
import { RULES } from "../src/core/rules/registry.js";

const DEFAULT_DIR = resolve(import.meta.dir, "../apps/website/content/reference/rules");

function renderCatalogPage(): string {
  return [
    "---",
    "title: Rules catalog",
    "description: Every rule dora can check, with code, tier, default severity, and package membership.",
    "sidebar:",
    "  label: Catalog",
    "  order: 0",
    "---",
    "",
    "Every check dora can raise has a stable code (`R012`) and a slug (`description-length`).",
    "Findings from `dora review` link here via `docUrl`. Each rule page opens with **What** and **Why** in a short table, then **How to fix**.",
    "",
    "This catalog table is generated from the rule registry — edit the registry, not the rows below.",
    "",
    renderCatalog(),
    "",
  ].join("\n");
}

function renderRulesMeta(): string {
  // Only the catalog belongs in the sidebar. Per-rule MDX files stay on disk
  // (and remain routes) but are sidebar.hidden — listing them here would re-pollute nav.
  return [
    'import { defineMeta } from "blume";',
    "",
    "export default defineMeta({",
    '  title: "Rules",',
    "  order: 1,",
    '  pages: ["index"],',
    "});",
    "",
  ].join("\n");
}

function expectedNames(): string[] {
  return ["index.mdx", "meta.ts", ...RULES.map((rule) => `${rule.code}.mdx`)].sort();
}

export async function generateRuleDocs(options?: {
  dir?: string;
}): Promise<{ written: string[]; catalog: string }> {
  const dir = options?.dir ?? DEFAULT_DIR;
  await mkdir(dir, { recursive: true });

  const catalog = renderCatalogPage();
  const pages = new Map<string, string>();
  for (const rule of RULES) {
    const path = join(dir, `${rule.code}.mdx`);
    pages.set(path, existsSync(path)
      ? refreshRulePage(await Bun.file(path).text(), rule)
      : scaffoldRulePage(rule));
  }

  const catalogPath = join(dir, "index.mdx");
  const metaPath = join(dir, "meta.ts");
  await Bun.write(catalogPath, catalog);
  await Bun.write(metaPath, renderRulesMeta());
  for (const [path, body] of pages) await Bun.write(path, body);

  return { written: [catalogPath, metaPath, ...pages.keys()], catalog };
}

export async function checkRuleDocs(options?: { dir?: string }): Promise<void> {
  const dir = options?.dir ?? DEFAULT_DIR;
  const actualNames = existsSync(dir) ? (await readdir(dir)).sort() : [];
  const expected = expectedNames();
  const missing = expected.filter((name) => !actualNames.includes(name));
  const extra = actualNames.filter((name) => !expected.includes(name));
  if (missing.length || extra.length) {
    throw new Error([
      missing.length && `missing: ${missing.join(", ")}`,
      extra.length && `unexpected: ${extra.join(", ")}`,
    ].filter(Boolean).join("; "));
  }

  const catalogPath = join(dir, "index.mdx");
  if (await Bun.file(catalogPath).text() !== renderCatalogPage()) {
    throw new Error("Stale generated rule docs: index.mdx");
  }

  const metaPath = join(dir, "meta.ts");
  if (await Bun.file(metaPath).text() !== renderRulesMeta()) {
    throw new Error("Stale generated rule docs: meta.ts");
  }

  for (const rule of RULES) {
    const path = join(dir, `${rule.code}.mdx`);
    const current = await Bun.file(path).text();
    if (refreshRulePage(current, rule) !== current) {
      throw new Error(`Stale generated rule docs: ${rule.code}.mdx`);
    }
  }
}

if (import.meta.main) {
  if (process.argv.includes("--check")) {
    await checkRuleDocs();
    console.log("Rule docs are in sync.");
  } else {
    const { written } = await generateRuleDocs();
    console.log(`Generated ${written.length} rule doc file(s).`);
  }
}
