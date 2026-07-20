import {
  resolveProjectName,
  type JournalConfig,
  type RulesConfig,
} from "../../core/journal-config.js";

export type Scope = { kind: "global" } | { kind: "project"; name: string };
export type ScopeResult = { ok: true; scope: Scope } | { ok: false; error: string };

const UNREGISTERED_PROJECT =
  "Not a registered project. Register it first (dora memory setup) or use --global.";

export function resolveScope(
  config: JournalConfig | null,
  opts: { global?: boolean; project?: boolean; cwd: string },
): ScopeResult {
  if (opts.global) return { ok: true, scope: { kind: "global" } };

  const name = resolveProjectName(config, opts.cwd);
  if (opts.project) {
    return name
      ? { ok: true, scope: { kind: "project", name } }
      : { ok: false, error: UNREGISTERED_PROJECT };
  }

  return name
    ? { ok: true, scope: { kind: "project", name } }
    : { ok: true, scope: { kind: "global" } };
}

export function readScopeRules(config: JournalConfig | null, scope: Scope): RulesConfig {
  if (!config) return {};
  return scope.kind === "global"
    ? config.rules ?? {}
    : config.journal.projects[scope.name]?.rules ?? {};
}
