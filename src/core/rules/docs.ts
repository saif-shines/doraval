import { BUILTIN_PACKAGES } from "./packages.js";
import { RULE_DOC_BASE, RULES, type Rule, type RuleSeverity } from "./registry.js";

export const GEN_START = "{/* <!-- DORA:GENERATED:START --> */}";
export const GEN_END = "{/* <!-- DORA:GENERATED:END --> */}";

const RULE_DOC_PATH = new URL(RULE_DOC_BASE).pathname;

export function severityLabel(severity: RuleSeverity): string {
  return severity === "info" ? "FYI" : severity;
}

export function packagesForRule(code: string): string[] {
  return Object.values(BUILTIN_PACKAGES)
    .filter((pkg) => pkg.rules.includes(code))
    .map((pkg) => pkg.name)
    .sort();
}

export function renderCatalog(rules: readonly Rule[] = RULES): string {
  const rows = rules.map((rule) => {
    const lock = rule.locked ? " 🔒" : "";
    const packages = packagesForRule(rule.code).join(", ") || "—";
    return `| ${rule.code}${lock} ([docs](${RULE_DOC_PATH}/${rule.code})) | \`${rule.slug}\` | ${rule.tier} | ${severityLabel(rule.defaultSeverity)} | ${packages} | ${rule.title} |`;
  });

  return [
    "| Code | Slug | Tier | Default | Packages | Summary |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

export function renderGeneratedBlock(rule: Rule): string {
  const packages = packagesForRule(rule.code).join(", ") || "—";
  return [
    `- **Code:** ${rule.code}`,
    `- **Slug:** \`${rule.slug}\``,
    `- **Tier:** ${rule.tier}`,
    `- **Default severity:** ${severityLabel(rule.defaultSeverity)}`,
    `- **Packages:** ${packages}`,
    `- **Locked:** ${rule.locked ? "Yes (safety: cannot be disabled or demoted)" : "No"}`,
    `- **Doc:** ${rule.docUrl}`,
  ].join("\n");
}

export function spliceGeneratedRegion(existing: string, block: string): string {
  const start = existing.indexOf(GEN_START);
  const end = existing.indexOf(GEN_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Missing ${GEN_START} / ${GEN_END} marker pair; refusing to overwrite`);
  }
  if (existing.indexOf(GEN_START, start + GEN_START.length) !== -1
    || existing.indexOf(GEN_END, end + GEN_END.length) !== -1) {
    throw new Error("Duplicate generated marker; refusing to overwrite");
  }

  return `${existing.slice(0, start + GEN_START.length)}\n${block}\n${existing.slice(end)}`;
}

export function renderRuleFrontmatter(rule: Rule): string {
  // Individual rule pages stay addressable for CLI docUrl deep-links, but they
  // must not flood the sidebar — the catalog is the only nav entry (Blume
  // honors sidebar.hidden for filesystem nav).
  return [
    "---",
    `title: ${rule.code} · ${rule.slug}`,
    `description: ${JSON.stringify(rule.title)}`,
    "sidebar:",
    `  label: ${rule.code} ${rule.slug}`,
    "  hidden: true",
    "---",
  ].join("\n");
}

export function refreshRulePage(existing: string, rule: Rule): string {
  if (!existing.startsWith("---\n")) throw new Error(`Missing frontmatter for ${rule.code}`);
  const frontmatterEnd = existing.indexOf("\n---", 4);
  if (frontmatterEnd === -1) throw new Error(`Missing frontmatter delimiter for ${rule.code}`);
  const withFrontmatter = `${renderRuleFrontmatter(rule)}${existing.slice(frontmatterEnd + 4)}`;
  return spliceGeneratedRegion(withFrontmatter, renderGeneratedBlock(rule));
}

export function scaffoldRulePage(rule: Rule): string {
  return [
    renderRuleFrontmatter(rule),
    "",
    GEN_START,
    renderGeneratedBlock(rule),
    GEN_END,
    "",
    "## What",
    "",
    "{/* describe what this rule checks */}",
    "",
    "## Why",
    "",
    "{/* explain why it matters */}",
    "",
    "## How to fix",
    "",
    "{/* concrete remediation steps */}",
    "",
  ].join("\n");
}
