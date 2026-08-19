import {
  ensureDoravalDirs,
  readConfig,
  writeConfig,
  type JournalConfig,
} from "../../core/journal-config.js";
import {
  validateRulesConfig,
  type ConfigResult,
  type RuleRow,
  type RuleTier,
} from "../../core/rules/index.js";

export { readConfig };
export {
  applyOverride,
  applyPackage,
  buildListRows,
  displaySeverity,
  explainRule,
  readScopeRules,
  resolveListPackageName,
  resolveScope,
  validatePackagePreview,
  type MutationResult,
  type Scope,
} from "../../core/rules/index.js";

export async function persist(config: JournalConfig): Promise<void> {
  ensureDoravalDirs();
  await writeConfig(config);
}

export async function readRulesConfig(): Promise<ConfigResult> {
  let config: unknown;
  try {
    config = await readConfig();
  } catch (error) {
    return {
      ok: false,
      error: `Invalid doraval config: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (config === null) return { ok: true, config: null };
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { ok: false, error: "Invalid doraval config: expected a YAML object." };
  }

  const journal = (config as Record<string, unknown>).journal;
  if (!journal || typeof journal !== "object" || Array.isArray(journal)) {
    return { ok: false, error: "Invalid doraval config: journal must be an object." };
  }
  const root = config as Record<string, unknown>;
  const globalRulesError = validateRulesConfig(root.rules, "rules");
  if (globalRulesError) return { ok: false, error: globalRulesError };

  const projects = (journal as Record<string, unknown>).projects;
  if (!projects || typeof projects !== "object" || Array.isArray(projects)) {
    return { ok: false, error: "Invalid doraval config: journal.projects must be an object." };
  }
  for (const [name, project] of Object.entries(projects)) {
    if (!project || typeof project !== "object" || Array.isArray(project)) {
      return { ok: false, error: `Invalid doraval config: project "${name}" must be an object.` };
    }
    const projectRulesError = validateRulesConfig(
      (project as Record<string, unknown>).rules,
      `journal.projects.${name}.rules`,
    );
    if (projectRulesError) return { ok: false, error: projectRulesError };
  }

  return { ok: true, config: config as JournalConfig };
}

/** Human severity column: disabled rules show `off`, not a leftover FYI/error. */
export function listSeverityLabel(row: Pick<RuleRow, "enabled" | "severity">): string {
  return row.enabled ? row.severity : "off";
}

const TIER_ORDER: readonly RuleTier[] = ["structure", "heuristic", "llm", "session"];
const TIER_LABEL: Record<RuleTier, string> = {
  structure: "Structure",
  heuristic: "Heuristic",
  llm: "LLM",
  session: "Session",
};

/** Grouped human table for `dora rules list`. */
export function formatRulesListHuman(
  rows: RuleRow[],
  meta: { packageName: string; scopeLabel: string },
): string[] {
  const on = rows.filter((row) => row.enabled).length;
  const off = rows.length - on;
  const slugWidth = Math.max(12, ...rows.map((row) => row.slug.length));
  const lines: string[] = [
    `package: ${meta.packageName} · ${meta.scopeLabel} · ${on} on · ${off} off`,
    "",
  ];

  for (const tier of TIER_ORDER) {
    const group = rows.filter((row) => row.tier === tier);
    if (group.length === 0) continue;
    lines.push(TIER_LABEL[tier]);
    for (const row of group) {
      const mark = row.enabled ? "[x]" : "[ ]";
      const severity = listSeverityLabel(row).padEnd(8);
      const lock = row.locked ? " 🔒" : "";
      lines.push(`${mark} ${row.code}  ${row.slug.padEnd(slugWidth)}  ${severity}${lock}`);
    }
    lines.push("");
  }

  if (lines.at(-1) === "") lines.pop();
  return lines;
}
