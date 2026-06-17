export type InstallMethod =
  | { type: 'homebrew' }
  | { type: 'npm' }
  | { type: 'bun' }
  | { type: 'transient'; via: 'npx' | 'bunx' };

export interface VersionInfo {
  version: string;
  summary: string;
}

export async function detectInstallMethod(options?: { force?: string }): Promise<InstallMethod> {
  // Layered detection: auto -> marker -> prompt/flag
  // Implemented in later tasks
  throw new Error('Not implemented');
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
  return null;
}

export async function writeInstallMarker(method: InstallMethod): Promise<void> {}
