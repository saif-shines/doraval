import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  renderCatalog,
  renderGeneratedBlock,
  scaffoldRulePage,
  spliceGeneratedRegion,
} from "../src/core/rules/docs.js";
import { RULES } from "../src/core/rules/registry.js";

const DEFAULT_DIR = resolve(import.meta.dir, "../apps/website/content/reference/rules");

export async function generateRuleDocs(options?: {
  dir?: string;
}): Promise<{ written: string[]; catalog: string }> {
  const dir = options?.dir ?? DEFAULT_DIR;
  await mkdir(dir, { recursive: true });

  const catalog = [
    "---",
    "title: Rules catalog",
    "description: Every rule dora can check, with code, tier, default severity, and package membership.",
    "sidebar:",
    "  label: Rules catalog",
    "  order: 0",
    "---",
    "",
    "The rules catalog lists every check from the rule registry and its default behavior.",
    "",
    "This page is generated. Edit the rule registry instead of editing this table.",
    "",
    renderCatalog(),
    "",
  ].join("\n");
  const pages = new Map<string, string>();

  for (const rule of RULES) {
    const path = join(dir, `${rule.code}.mdx`);
    const body = existsSync(path)
      ? spliceGeneratedRegion(await Bun.file(path).text(), renderGeneratedBlock(rule))
      : scaffoldRulePage(rule);
    pages.set(path, body);
  }

  const catalogPath = join(dir, "index.mdx");
  await Bun.write(catalogPath, catalog);
  for (const [path, body] of pages) await Bun.write(path, body);

  return { written: [catalogPath, ...pages.keys()], catalog };
}

if (import.meta.main) {
  const { written } = await generateRuleDocs();
  console.log(`Generated ${written.length} rule doc file(s).`);
}
