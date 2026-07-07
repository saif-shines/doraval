/**
 * Scan depth resolution (plan item B4, founding decision "smart default").
 * Scan from cwd; walk up to the git root for context. Never require --cwd for humans.
 */
import { existsSync } from "fs";
import { homedir } from "os";
import { dirname, join, resolve } from "path";

export interface ScanScope {
  scanRoot: string;
  gitRoot: string | null;
  isMonorepoSubdir: boolean;
  isHomeDir: boolean;
  /** Agent files that live at the git root but outside scanRoot (AGENTS.md, .mcp.json, CLAUDE.md) */
  rootAgentFiles: string[];
}

const ROOT_AGENT_FILES = ["AGENTS.md", "CLAUDE.md", ".mcp.json"];

function findGitRoot(start: string): string | null {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function resolveScanScope(cwd: string, home: string = homedir()): ScanScope {
  const scanRoot = resolve(cwd);
  const gitRoot = findGitRoot(scanRoot);
  const isMonorepoSubdir = gitRoot !== null && gitRoot !== scanRoot;
  const rootAgentFiles =
    isMonorepoSubdir && gitRoot
      ? ROOT_AGENT_FILES.filter((f) => existsSync(join(gitRoot, f)))
      : [];
  return {
    scanRoot,
    gitRoot,
    isMonorepoSubdir,
    isHomeDir: scanRoot === resolve(home),
    rootAgentFiles,
  };
}
