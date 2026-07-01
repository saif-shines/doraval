/**
 * Project/repo status snapshot.
 * Consumed by: dora ui /api/status, TUI Home pane.
 */
import {
  readConfig,
  resolveProjectName,
  getDoravalDir,
  getJournalsDir,
  sanitizeProjectName,
} from "../journal-config.js";

export interface ProjectStatus {
  project: string | null;
  doravalRoot: string;
  journalsDir: string;
  hasConfig: boolean;
  repo: string | null;
}

export async function loadProjectStatus(): Promise<ProjectStatus> {
  const config = await readConfig();
  let project = resolveProjectName(config) ?? null;
  if (project) {
    try {
      project = sanitizeProjectName(project);
    } catch {
      project = null;
    }
  }
  return {
    project,
    doravalRoot: getDoravalDir(),
    journalsDir: getJournalsDir(),
    hasConfig: !!config,
    repo: config?.journal?.repo ?? null,
  };
}
