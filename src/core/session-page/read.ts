import type { Dirent } from "node:fs";
import { open, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { countNeedle, listFolder, openFolder, type FolderEntry, type FolderStorage, type OpenedFile } from "./folder.ts";
import { isHiddenCwd, isHiddenSession } from "./hide.ts";

export { isHiddenCwd, isHiddenSession };
export type { SessionRow } from "./folder.ts";
export type { ViewFacts as SessionFacts } from "./from-events.ts";

const CHUNK = 1024 * 1024;

export function defaultGrokHome(): string {
  return join(homedir(), ".grok");
}

/** Count `turn_completed` without parsing the log into objects. */
export async function countTurnCompleted(path: string): Promise<number> {
  return countNeedle(streamPath(path));
}

export async function listSessions(root: string) {
  const listed = await listFolder(root, nodeStorage(), (hit) => hit.label);
  return "rows" in listed ? listed.rows : [];
}

export async function loadTurns(root: string, id: string) {
  return openFolder(root, id, nodeStorage(), (hit) => hit.label);
}

function nodeStorage(): FolderStorage<string> {
  return {
    async list(dir) {
      let dirents: Dirent[];
      try {
        dirents = await readdir(dir, { withFileTypes: true });
      } catch {
        return [];
      }
      const entries: FolderEntry[] = [];
      for (const entry of dirents) {
        if (entry.isDirectory()) entries.push({ name: entry.name, kind: "directory" });
        else if (entry.isFile()) entries.push({ name: entry.name, kind: "file" });
        else {
          const info = await stat(join(dir, entry.name)).catch(() => null);
          if (!info) continue;
          entries.push({ name: entry.name, kind: info.isDirectory() ? "directory" : "file" });
        }
      }
      return entries;
    },
    async openDir(dir, name) {
      const path = join(dir, name);
      const info = await stat(path).catch(() => null);
      return info?.isDirectory() ? path : null;
    },
    async openFile(dir, name) {
      const path = join(dir, name);
      const info = await stat(path).catch(() => null);
      if (!info?.isFile()) return null;
      const file: OpenedFile = {
        size: info.size,
        mtimeMs: info.mtimeMs,
        label: path,
        stream: () => streamPath(path),
      };
      return file;
    },
  };
}

async function* streamPath(path: string): AsyncIterable<Uint8Array> {
  const fh = await open(path, "r");
  const buf = Buffer.alloc(CHUNK);
  try {
    while (true) {
      const { bytesRead } = await fh.read(buf, 0, buf.length, null);
      if (bytesRead <= 0) return;
      yield Uint8Array.from(buf.subarray(0, bytesRead));
    }
  } finally {
    await fh.close();
  }
}
