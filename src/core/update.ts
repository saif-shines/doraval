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
  // npm for version
  const npmRes = await fetch('https://registry.npmjs.org/@hacksmith/doraval/latest');
  if (!npmRes.ok) throw new Error('Failed to fetch from npm');
  const npmData = await npmRes.json();
  const version = npmData.version;

  // GitHub for summary
  let summary = 'New release available.';
  try {
    const ghRes = await fetch('https://api.github.com/repos/saif-shines/doraval/releases/latest', {
      headers: { 'User-Agent': 'doraval-update' }
    });
    if (ghRes.ok) {
      const ghData = await ghRes.json();
      const body = (ghData.body || '').trim();
      // Take first 1-2 bullet points or first paragraph
      const lines = body.split('\n').filter((l: string) => l.trim().startsWith('-') || l.trim().startsWith('*')).slice(0, 2);
      if (lines.length) summary = lines.join(' ').slice(0, 200);
      else if (body) summary = body.split('\n')[0].slice(0, 150);
    }
  } catch {}

  return { version, summary };
}

export function buildUpgradeCommand(method: InstallMethod): string[] {
  switch (method.type) {
    case 'homebrew':
      return ['brew', 'upgrade', 'doraval'];
    case 'npm':
      return ['npm', 'install', '-g', '@hacksmith/doraval@latest'];
    case 'bun':
      return ['bun', 'add', '-g', '@hacksmith/doraval@latest'];
    default:
      throw new Error('Cannot build upgrade command for transient installs');
  }
}

export function shouldUpdate(current: string, latest: string): boolean {
  if (current === latest) return false;
  // Basic semver compare (assumes clean x.y.z)
  const c = current.split('.').map(Number);
  const l = latest.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
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
