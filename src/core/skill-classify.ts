/**
 * Skill origin classification (plan item B3).
 * authored → full quality loop · imported → read-only scan · global → light checks, softer tone.
 */
import { existsSync } from "fs";
import { homedir } from "os";
import { join, resolve, sep } from "path";
import { GROK_MANIFEST_CANDIDATES, PROVIDER_SPECS } from "../providers/spec.js";

export type SkillOrigin = "authored" | "imported" | "global";

const IMPORTED_MARKERS = [`${sep}node_modules${sep}`, `${sep}.claude${sep}plugins${sep}cache${sep}`];

function pluginManifestRels(): string[] {
  const rels = new Set<string>(["plugin.json", ...GROK_MANIFEST_CANDIDATES]);
  for (const spec of Object.values(PROVIDER_SPECS)) {
    rels.add(spec.manifestPath);
    rels.add(spec.marketplacePath);
  }
  return [...rels];
}

/** Ancestor directory that holds a Plugin manifest, if any. `stopAt` (usually cwd) is the last dir checked. */
export function pluginRoot(skillDir: string, stopAt?: string): string | undefined {
  const stop = stopAt ? resolve(stopAt) : undefined;
  let dir = resolve(skillDir);
  const rels = pluginManifestRels();
  const underStop = (found: string) =>
    !stop || found === stop || found.startsWith(stop + sep);
  while (true) {
    if (rels.some((rel) => existsSync(join(dir, rel)))) {
      return underStop(dir) ? dir : undefined;
    }
    if (stop && dir === stop) return undefined;
    const parent = resolve(dir, "..");
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Skill lives inside a Plugin (ancestor has plugin.json or a provider marketplace file). */
export function isPluginOwned(skillDir: string, stopAt?: string): boolean {
  return pluginRoot(skillDir, stopAt) !== undefined;
}

export function classifySkillDir(
  skillDir: string,
  opts: { cwd: string; home?: string }
): SkillOrigin {
  const abs = resolve(skillDir) + sep;
  const cwd = resolve(opts.cwd) + sep;
  const home = resolve(opts.home ?? homedir()) + sep;

  if (IMPORTED_MARKERS.some((m) => abs.includes(m))) return "imported";
  if (abs.startsWith(cwd)) return "authored";
  if (abs.startsWith(home)) return "global";
  return "global";
}
