import { execSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

export type InstallMethod =
  | { type: 'homebrew'; source: 'path' | 'probe' | 'marker' }
  | { type: 'npm'; source: 'path' | 'probe' | 'marker' }
  | { type: 'bun'; source: 'path' | 'probe' | 'marker' }
  | { type: 'transient'; via: 'npx' | 'bunx'; source: 'path' }
  | { type: 'unknown'; reason: string };

export interface VersionInfo {
  version: string;
  summary: string;
}

export interface DetectCtx {
  entrypoint?: string;
  argv?: string[];
  env?: Record<string, string | undefined>;
  homeDir: string;
  realpath(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
  run(cmd: string, args: string[]): Promise<{ ok: boolean; stdout: string }>;
  readMarker(): Promise<InstallMarker | null>;
}

export interface InstallMarker {
  type: 'homebrew' | 'npm' | 'bun';
  packageRoot?: string;
  entrypointRealpath?: string;
  version?: string;
  writtenAt: string;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '');
}

function isInside(child: string, parent: string): boolean {
  const c = normalizePath(child);
  const p = normalizePath(parent);
  return c === p || c.startsWith(`${p}/`);
}

async function realpathOrSelf(ctx: DetectCtx, p: string): Promise<string> {
  try {
    return await ctx.realpath(p);
  } catch {
    return p;
  }
}

function markerMatchesCurrentInstall(marker: InstallMarker, realEntry: string): boolean {
  if (marker.entrypointRealpath && normalizePath(marker.entrypointRealpath) === realEntry) {
    return true;
  }
  if (marker.packageRoot && isInside(realEntry, normalizePath(marker.packageRoot))) {
    return true;
  }
  return false;
}

function isInPath(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function detectHomebrew(ctx: DetectCtx, entry: string, realEntry: string): Promise<InstallMethod | null> {
  const prefix = await ctx.run('brew', ['--prefix', 'doraval']);
  if (!prefix.ok) return null;

  const brewPrefix = normalizePath(await realpathOrSelf(ctx, prefix.stdout.trim()));
  if (isInside(realEntry, brewPrefix) || realEntry.includes('/Cellar/doraval/')) {
    return { type: 'homebrew', source: 'probe' };
  }
  return null;
}

async function detectNpmGlobal(ctx: DetectCtx, entry: string, realEntry: string): Promise<InstallMethod | null> {
  const root = await ctx.run('npm', ['root', '-g']);
  if (root.ok) {
    const npmRoot = normalizePath(await realpathOrSelf(ctx, root.stdout.trim()));
    if (isInside(realEntry, `${npmRoot}/@hacksmith/doraval`)) {
      return { type: 'npm', source: 'probe' };
    }
  }

  if (realEntry.includes('/lib/node_modules/@hacksmith/doraval/')) {
    return { type: 'npm', source: 'path' };
  }
  return null;
}

async function detectBunGlobal(ctx: DetectCtx, entry: string, realEntry: string): Promise<InstallMethod | null> {
  const bunBin = await ctx.run('bun', ['pm', 'bin', '-g']);
  if (bunBin.ok) {
    for (const name of ['doraval', 'dora']) {
      const shim = normalizePath(`${bunBin.stdout.trim()}/${name}`);
      if (await ctx.exists(shim)) {
        const realShim = normalizePath(await realpathOrSelf(ctx, shim));
        if (realShim === realEntry || shim === entry) {
          return { type: 'bun', source: 'probe' };
        }
      }
    }
  }

  if (realEntry.includes('/.bun/install/global/node_modules/@hacksmith/doraval/')) {
    return { type: 'bun', source: 'path' };
  }
  return null;
}

function detectTransient(entry: string, realEntry: string): InstallMethod | null {
  if (realEntry.includes('/_npx/') && realEntry.includes('/node_modules/@hacksmith/doraval/')) {
    return { type: 'transient', via: 'npx', source: 'path' };
  }
  if (realEntry.includes('/.bun/install/cache/')) {
    return { type: 'transient', via: 'bunx', source: 'path' };
  }
  return null;
}

export async function detectInstallMethod(ctx: DetectCtx, options?: { force?: string }): Promise<InstallMethod> {
  const env = ctx.env || {};
  if (env.DORAVAL_TEST) {
    return { type: "npm", source: "probe" };
  }

  if (options?.force) {
    const f = options.force;
    if (['homebrew', 'npm', 'bun'].includes(f)) {
      return { type: f as any, source: 'probe' };
    }
    if (f === 'npx' || f === 'bunx') {
      return { type: 'transient', via: f as any, source: 'path' };
    }
  }

  const rawEntry = ctx.entrypoint ?? ctx.argv?.[1];
  if (!rawEntry) {
    return { type: 'unknown', reason: 'No CLI entrypoint path available' };
  }

  const entry = normalizePath(rawEntry);
  const realEntry = normalizePath(await realpathOrSelf(ctx, rawEntry));

  // 1. Current entrypoint path + package manager ownership probes
  const owners = await Promise.all([
    detectHomebrew(ctx, entry, realEntry),
    detectNpmGlobal(ctx, entry, realEntry),
    detectBunGlobal(ctx, entry, realEntry),
  ]);
  const owned = owners.filter(Boolean) as InstallMethod[];
  if (owned.length === 1) return owned[0]!;

  // 2. Transient cache path detection (after global checks to avoid cache symlinks)
  const transient = detectTransient(entry, realEntry);
  if (transient) return transient;

  // 3. Path-validated marker
  const marker = await ctx.readMarker();
  if (marker && markerMatchesCurrentInstall(marker, realEntry)) {
    return { type: marker.type, source: 'marker' } as InstallMethod;
  }

  if (owned.length > 1) {
    return { type: 'unknown', reason: 'Multiple package managers appear to own this path' };
  }

  return { type: 'unknown', reason: 'Could not determine install method' };
}

export async function fetchLatestVersionInfo(): Promise<VersionInfo> {
  const npmRes = await fetch('https://registry.npmjs.org/@hacksmith/doraval/latest');
  if (!npmRes.ok) throw new Error('Failed to fetch from npm');
  const npmData = await npmRes.json();
  const version = npmData.version;

  let summary = 'New release available.';
  try {
    const ghRes = await fetch('https://api.github.com/repos/saif-shines/doraval/releases/latest', {
      headers: { 'User-Agent': 'doraval-update' }
    });
    if (ghRes.ok) {
      const ghData = await ghRes.json();
      const body = (ghData.body || '').trim();
      const lines = body.split('\n').filter((l: string) => l.trim().startsWith('-') || l.trim().startsWith('*')).slice(0, 2);
      if (lines.length) summary = lines.join(' ').slice(0, 200);
      else if (body) summary = body.split('\n')[0].slice(0, 150);
    }
  } catch {
    // intentional: release notes are optional polish
  }

  return { version, summary };
}

export function buildUpgradeCommand(method: InstallMethod): string[] {
  if (method.type === 'transient' || method.type === 'unknown') {
    throw new Error('Cannot build upgrade command for transient or unknown installs');
  }
  switch (method.type) {
    case 'homebrew':
      return ['brew', 'upgrade', 'doraval'];
    case 'npm':
      return ['npm', 'install', '-g', '@hacksmith/doraval@latest'];
    case 'bun':
      return ['bun', 'add', '-g', '@hacksmith/doraval@latest'];
  }
}

export function shouldUpdate(current: string, latest: string): boolean {
  if (current === latest) return false;
  const c = current.split('.').map(Number);
  const l = latest.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

const MARKER_PATH = resolve(homedir(), '.doraval', 'install.json');

export async function readMarker(): Promise<InstallMarker | null> {
  try {
    const { readFile } = await import('node:fs/promises');
    const data = await readFile(MARKER_PATH, 'utf8');
    return JSON.parse(data) as InstallMarker;
  } catch {
    return null;
  }
}

export async function writeMarker(marker: InstallMarker): Promise<void> {
  try {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const { dirname } = await import('node:path');
    await mkdir(dirname(MARKER_PATH), { recursive: true });
    await writeFile(MARKER_PATH, JSON.stringify(marker, null, 2));
  } catch {
    // intentional: marker write failure must not break upgrade flow
  }
}
