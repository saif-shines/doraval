const SKILL_TITLE_RE = /^Skill\s+(\S+)/i;
const SKILL_PATH_RE = /[/\\]skills[/\\]([^/\\]+)[/\\]SKILL\.md/i;

/** Skill names from ACP tool titles, paths, and raw inputs. No filesystem access. */
export function extractSkillsFromUpdate(u: Record<string, unknown>): string[] {
  const out: string[] = [];
  const title = typeof u.title === "string" ? u.title : "";
  const titled = title.match(SKILL_TITLE_RE);
  if (titled?.[1]) out.push(titled[1]);

  const blobs: string[] = [title];
  for (const key of ["rawInput", "input", "args"] as const) {
    const value = u[key];
    if (value && typeof value === "object") blobs.push(JSON.stringify(value));
    else if (typeof value === "string") blobs.push(value);
  }
  if (Array.isArray(u.locations)) blobs.push(JSON.stringify(u.locations));

  for (const blob of blobs) {
    const re = new RegExp(SKILL_PATH_RE.source, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(blob)) !== null) {
      if (match[1]) out.push(match[1]);
    }
  }
  return out;
}
