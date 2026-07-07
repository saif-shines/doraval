/**
 * Skill origin classification (plan item B3).
 * authored → full quality loop · imported → read-only scan · global → light checks, softer tone.
 */
import { homedir } from "os";
import { resolve, sep } from "path";

export type SkillOrigin = "authored" | "imported" | "global";

const IMPORTED_MARKERS = [`${sep}node_modules${sep}`, `${sep}.claude${sep}plugins${sep}cache${sep}`];

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
