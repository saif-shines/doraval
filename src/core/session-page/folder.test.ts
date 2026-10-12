import { expect, test } from "bun:test";
import { countNeedle, listFolder, type FolderStorage, type OpenedFile } from "./folder.ts";

type MemDir = Map<string, MemDir | Uint8Array>;

function memoryStorage(): FolderStorage<MemDir> {
  return {
    async list(dir) {
      return [...dir.entries()].map(([name, value]) => ({
        name,
        kind: value instanceof Uint8Array ? "file" as const : "directory" as const,
      }));
    },
    async openDir(dir, name) {
      const child = dir.get(name);
      if (!child || child instanceof Uint8Array) return null;
      return child;
    },
    async openFile(dir, name) {
      const child = dir.get(name);
      if (!(child instanceof Uint8Array)) return null;
      const file: OpenedFile = {
        size: child.byteLength,
        mtimeMs: 0,
        label: name,
        async *stream() {
          yield child;
        },
      };
      return file;
    },
  };
}

test("an unknown folder is unrecognized, an empty sessions directory is Grok, and a split needle counts once", async () => {
  const storage = memoryStorage();
  expect(await listFolder(new Map(), storage, () => "")).toEqual({ unrecognized: true });

  const sessions: MemDir = new Map();
  const root: MemDir = new Map([["sessions", sessions]]);
  expect(await listFolder(root, storage, () => "")).toEqual({ rows: [] });

  const needle = new TextEncoder().encode('"turn_completed"');
  async function* chunks() {
    yield needle.subarray(0, 4);
    yield needle.subarray(4);
  }
  expect(await countNeedle(chunks())).toBe(1);
});
