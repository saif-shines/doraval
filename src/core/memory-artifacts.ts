import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from "fs";
import { join, relative, dirname, sep } from "path";
import { spawnSync } from "bun";
import { YAML } from "bun";
import { getArtifactsDir, getManifestPath, ensureArtifactsDir } from "./memory-config.js";

// ── Types ──────────────────────────────────────────────────────────

export interface ManifestEntry {
  source: string;
  stashedAt: string;
  sha256: string;
  bytes: number;
}

export type Manifest = Record<string, ManifestEntry>;

export interface StashCandidate {
  relativePath: string;
  status: "untracked" | "ignored";
}

export type StashResult =
  | { ok: true; relativePath: string; warn?: string }
  | { ok: false; error: string };

export type RestorePlan =
  | { ok: true; relativePath: string; destPath: string; diff: string; isNew: boolean }
  | { ok: false; error: string };

// ── Size limits ────────────────────────────────────────────────────

export const WARN_BYTES = 5 * 1024 * 1024;
export const REFUSE_BYTES = 50 * 1024 * 1024;

export function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

// ── Manifest I/O ───────────────────────────────────────────────────

export function loadManifest(slug: string): Manifest {
  const path = getManifestPath(slug);
  if (!existsSync(path)) return {};
  const parsed = YAML.parse(readFileSync(path, "utf-8"));
  return (parsed as Manifest) ?? {};
}

export function saveManifest(slug: string, manifest: Manifest): void {
  ensureArtifactsDir(slug);
  writeFileSync(getManifestPath(slug), YAML.stringify(manifest), "utf-8");
}

// ── Hashing ────────────────────────────────────────────────────────

export function sha256File(path: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(readFileSync(path));
  return hasher.digest("hex");
}

// ── Candidate discovery ────────────────────────────────────────────

const DOC_LIKE_EXTENSIONS = [".md", ".txt", ".yaml", ".yml", ".json"];

function isDocLike(relativePath: string): boolean {
  return DOC_LIKE_EXTENSIONS.some((ext) => relativePath.endsWith(ext));
}

/**
 * Lists gitignored-but-present and untracked files as stash candidates.
 * Directory entries (git collapses a wholly-untracked/ignored directory to
 * a single trailing-slash line) are skipped — stash targets individual
 * files; stash the files inside a directory explicitly.
 */
export function listStashCandidates(cwd: string): StashCandidate[] {
  const result = spawnSync(["git", "-C", cwd, "status", "--ignored", "--porcelain"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) return [];

  const candidates: StashCandidate[] = [];
  const lines = result.stdout.toString().split("\n").filter(Boolean);
  for (const line of lines) {
    const code = line.slice(0, 2);
    const relativePath = line.slice(3);
    if (relativePath.endsWith("/")) continue; // directory entry, skip
    if (code === "??") candidates.push({ relativePath, status: "untracked" });
    else if (code === "!!") candidates.push({ relativePath, status: "ignored" });
  }

  candidates.sort((a, b) => {
    const aDoc = isDocLike(a.relativePath);
    const bDoc = isDocLike(b.relativePath);
    if (aDoc !== bDoc) return aDoc ? -1 : 1;
    return a.relativePath.localeCompare(b.relativePath);
  });
  return candidates;
}

// ── Stash ──────────────────────────────────────────────────────────

export function stashFile(cwd: string, slug: string, absPath: string): StashResult {
  const relativePath = relative(cwd, absPath).split(sep).join("/");
  if (relativePath.startsWith("..") || relativePath === "") {
    return { ok: false, error: `${absPath} is outside the project root (${cwd})` };
  }
  if (!existsSync(absPath)) {
    return { ok: false, error: `No such file: ${absPath}` };
  }

  const stat = statSync(absPath);
  if (stat.size > REFUSE_BYTES) {
    return {
      ok: false,
      error: `${relativePath} is ${formatBytes(stat.size)} — refuses files over ${formatBytes(REFUSE_BYTES)}, use git-lfs instead`,
    };
  }

  ensureArtifactsDir(slug);
  const destPath = join(getArtifactsDir(slug), relativePath);
  mkdirSync(dirname(destPath), { recursive: true });
  copyFileSync(absPath, destPath);

  const manifest = loadManifest(slug);
  manifest[relativePath] = {
    source: relativePath,
    stashedAt: new Date().toISOString(),
    sha256: sha256File(absPath),
    bytes: stat.size,
  };
  saveManifest(slug, manifest);

  const warn =
    stat.size > WARN_BYTES
      ? `${relativePath} is ${formatBytes(stat.size)} — consider git-lfs for large files`
      : undefined;
  return { ok: true, relativePath, warn };
}

// ── Restore ────────────────────────────────────────────────────────

function generateArtifactDiff(before: string, after: string, file: string): string {
  const lines: string[] = [`--- a/${file}`, `+++ b/${file}`];
  for (const l of before.split("\n")) lines.push(`-${l}`);
  for (const l of after.split("\n")) lines.push(`+${l}`);
  return lines.join("\n");
}

export function planRestore(cwd: string, slug: string, relativePath: string): RestorePlan {
  const manifest = loadManifest(slug);
  const entry = manifest[relativePath];
  if (!entry) return { ok: false, error: `No stashed artifact for "${relativePath}"` };

  const artifactPath = join(getArtifactsDir(slug), relativePath);
  if (!existsSync(artifactPath)) {
    return { ok: false, error: `Artifact file missing on disk: ${artifactPath}` };
  }

  const destPath = join(cwd, relativePath);
  const newContent = readFileSync(artifactPath, "utf-8");
  const isNew = !existsSync(destPath);
  const oldContent = isNew ? "" : readFileSync(destPath, "utf-8");
  const diff = generateArtifactDiff(oldContent, newContent, relativePath);

  return { ok: true, relativePath, destPath, diff, isNew };
}

export function applyRestore(cwd: string, slug: string, relativePath: string): void {
  const artifactPath = join(getArtifactsDir(slug), relativePath);
  const destPath = join(cwd, relativePath);
  mkdirSync(dirname(destPath), { recursive: true });
  copyFileSync(artifactPath, destPath);
}
