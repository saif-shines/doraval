import { YAML } from "bun";

export interface ParsedSkill {
  data: Record<string, unknown>;
  content: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseFrontmatter(raw: string): ParsedSkill {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { data: {}, content: raw };
  }
  const data = YAML.parse(match[1]) as Record<string, unknown>;
  return { data: data ?? {}, content: match[2] };
}
