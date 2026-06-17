import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

export type InstallMethod =
  | { type: 'homebrew' }
  | { type: 'npm' }
  | { type: 'bun' }
  | { type: 'transient'; via: 'npx' | 'bunx' };

export interface VersionInfo {
  version: string;
  summary: string;
}

function isInPath(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function autoDetect(): Promise<InstallMethod | null> {
  const execPath = process.execPath;
  const argv0 = process.argv[0] || '';

  // Homebrew typical locations
  if (execPath.includes('/Cellar/') || execPath.includes('/homebrew/') || execPath.includes('/opt/homebrew/')) {
    if (isInPath('brew')) return { type: 'homebrew' };
  }

  // npm global
  if (execPath.includes('/.npm/') || argv0.includes('npm')) {
    return { type: 'npm' };
  }

  // bun global
  if (execPath.includes('/.bun/') || argv0.includes('bun')) {
    return { type: 'bun' };
  }

  // Check common global bin dirs
  const home = homedir();
  const possibleGlobals = [
    resolve(home, '.npm-global/bin/doraval'),
    resolve(home, '.bun/bin/doraval'),
  ];
  for (const p of possibleGlobals) {
    if (existsSync(p)) {
      if (p.includes('.npm')) return { type: 'npm' };
      if (p.includes('.bun')) return { type: 'bun' };
    }
  }

  return null;
}

const MARKER_PATH = resolve(homedir(), '.doraval', 'install.json');

export async function detectInstallMethod(options?: { force?: string }): Promise<InstallMethod> {
  if (options?.force) {
    if (['homebrew', 'npm', 'bun'].includes(options.force)) {
      return { type: options.force as any };
    }
    if (options.force === 'npx' || options.force === 'bunx') {
      return { type: 'transient', via: options.force };
    }
  }

  // A: Auto-detect
  const auto = await autoDetect();
  if (auto) return auto;

  // B: Marker
  const marker = await readInstallMarker();
  if (marker) return marker;

  // C: Prompt or flag (for now return transient as safe default; CLI will handle prompt)
  // In CLI layer we will prompt if needed. For simplicity in core, return transient; CLI decides.
  return { type: 'transient', via: 'npx' };
}

export async function fetchLatestVersionInfo(): Promise<VersionInfo> {
  // npm + GitHub
  throw new Error('Not implemented');
}

export function buildUpgradeCommand(method: InstallMethod): string[] {
  // Returns [cmd, ...args]
  throw new Error('Not implemented');
}

export function shouldUpdate(current: string, latest: string): boolean {
  // Simple semver compare stub
  return current !== latest;
}

export async function readInstallMarker(): Promise<InstallMethod | null> {
  try {
    const { readFile } = await import('node:fs/promises');
    const data = await readFile(MARKER_PATH, 'utf8');
    const parsed = JSON.parse(data);
    if (parsed && parsed.type) return parsed as InstallMethod;
  } catch {}
  return null;
}

export async function writeInstallMarker(method: InstallMethod): Promise<void> {
  try {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const { dirname } = await import('node:path');
    await mkdir(dirname(MARKER_PATH), { recursive: true });
    await writeFile(MARKER_PATH, JSON.stringify(method, null, 2));
  } catch {}
}
