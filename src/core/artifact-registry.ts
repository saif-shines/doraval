import type { SessionPrimitives } from "./session-parse.js";
import { loadSkillFromDir } from "./skill-validate.js";
import { PLATFORM_CONTEXT } from "./skill-lint.js";

export interface ArtifactType {
  type: string;
  load(path: string): Promise<{ ok: true; content: string; name: string } | { ok: false; error: string }>;
  detectUsageInSession(session: SessionPrimitives, name: string): boolean;
  defaultRubric(platform?: string): string;
}

const REGISTRY = new Map<string, ArtifactType>();

export function registerArtifactType(def: ArtifactType): void {
  REGISTRY.set(def.type, def);
}

export function getArtifactType(type: string): ArtifactType | undefined {
  return REGISTRY.get(type);
}

export function listArtifactTypes(): string[] {
  return [...REGISTRY.keys()];
}

// Register the skill type (the only v1 type)
registerArtifactType({
  type: "skill",
  async load(path) {
    const result = await loadSkillFromDir(path);
    if (!result.ok) return { ok: false, error: result.error };
    const name = String(result.model.data.name ?? path);
    return { ok: true, content: result.model.content, name };
  },
  detectUsageInSession(session, name) {
    return session.skillsInvoked.some(s =>
      s === name || s.endsWith(`:${name}`) || s.endsWith(`/${name}`)
    );
  },
  defaultRubric(platform = "claude") {
    return PLATFORM_CONTEXT[platform] ?? PLATFORM_CONTEXT["claude"] ?? "";
  },
});
