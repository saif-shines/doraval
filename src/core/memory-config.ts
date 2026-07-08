import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getDoravalDir } from "./journal-config.js";

// ── Paths ──────────────────────────────────────────────────────────

export function getMemoryDir(): string {
  return join(getDoravalDir(), "memory");
}

export function getGlobalPrinciplesPath(): string {
  return join(getMemoryDir(), "repo", "global", "principles.md");
}

export function getProjectPrinciplesPath(slug: string): string {
  return join(getMemoryDir(), "repo", "projects", slug, "principles.md");
}

export function getProjectSlug(cwd: string): string {
  // git-root basename + short path hash (collision-safe)
  const basename = cwd.split("/").pop() ?? "unknown";
  const hash = shortHash(cwd);
  // sanitize() can return "" for a degenerate basename (cwd is "/", or all
  // special chars) — fall back rather than emit a leading-hyphen path segment.
  const safeName = sanitize(basename) || "project";
  return `${safeName}-${hash}`;
}

// ── Internal helpers ───────────────────────────────────────────────

export function shortHash(s: string): string {
  // Simple djb2 hash, 6 hex chars
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).slice(0, 6);
}

export function sanitize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

// ── Ensure dirs ────────────────────────────────────────────────────

export function ensureMemoryDirs(slug?: string): void {
  const base = getMemoryDir();
  const dirs = [base, join(base, "repo", "global")];
  if (slug) dirs.push(join(base, "repo", "projects", slug));
  for (const d of dirs) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}
