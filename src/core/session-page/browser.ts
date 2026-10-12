import { CHOOSE_HOME, traceId, type AgentName } from "./agents.ts";
import { listFolder, openFolder, type FolderEntry, type FolderStorage, type OpenedFile, type SessionRow } from "./folder.ts";

type ByteReader = {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  releaseLock(): void;
};

type BrowserFile = {
  size: number;
  lastModified: number;
  stream(): { getReader(): ByteReader };
};

type FileHandle = {
  kind: "file";
  getFile(): Promise<BrowserFile>;
};

type DirHandle = {
  kind: "directory";
  getDirectoryHandle(name: string): Promise<DirHandle>;
  getFileHandle(name: string): Promise<FileHandle>;
  entries(): AsyncIterable<[string, FileHandle | DirHandle]>;
};

export type GrokFolder = DirHandle;

function siteLogPath(hit: { agent: AgentName; id: string }): string {
  return hit.agent === "grok" ? `sessions/…/${hit.id}/updates.jsonl` : traceId(hit.agent, hit.id);
}

function browserStorage(): FolderStorage<DirHandle> {
  return {
    async list(dir) {
      const entries: FolderEntry[] = [];
      for await (const [name, handle] of dir.entries()) {
        entries.push({ name, kind: handle.kind === "directory" ? "directory" : "file" });
      }
      return entries;
    },
    async openDir(dir, name) {
      try {
        return await dir.getDirectoryHandle(name);
      } catch {
        return null;
      }
    },
    async openFile(dir, name) {
      try {
        const handle = await dir.getFileHandle(name);
        const file = await handle.getFile();
        const opened: OpenedFile = {
          size: file.size,
          mtimeMs: file.lastModified,
          label: "",
          stream: () => streamFile(file),
        };
        return opened;
      } catch {
        return null;
      }
    },
  };
}

async function* streamFile(file: BrowserFile): AsyncIterable<Uint8Array> {
  const reader = file.stream().getReader();
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) return;
      if (next.value) yield next.value;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function listTraceFolder(root: GrokFolder): Promise<SessionRow[]> {
  const listed = await listFolder(root, browserStorage(), siteLogPath);
  if ("unrecognized" in listed) throw new Error(CHOOSE_HOME);
  return listed.rows;
}

export async function loadTraceSession(root: GrokFolder, id: string) {
  return openFolder(root, id, browserStorage(), siteLogPath);
}
