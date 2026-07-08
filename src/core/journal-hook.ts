import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "bun";

/** Legacy hook command installed before absolute-path + --json migration. */
export const LEGACY_JOURNAL_HOOK_COMMAND =
  "sh -c 'dora journal context 2>/dev/null || true'";

function decodeSpawnStdout(stdout: Uint8Array | undefined): string {
  if (!stdout?.length) return "";
  return new TextDecoder().decode(stdout).trim().split(/\r?\n/)[0]?.trim() ?? "";
}

function probePathBinary(name: string): string | null {
  const probes: string[][] =
    process.platform === "win32"
      ? [[`where.exe`, name]]
      : [
          ["command", "-v", name],
          ["which", name],
        ];

  for (const cmd of probes) {
    try {
      const probe = spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
      if (probe.exitCode === 0) {
        const found = decodeSpawnStdout(probe.stdout);
        if (found) return found;
      }
    } catch {
      // Probe executable missing from PATH (common on Windows for `which` / `command`).
    }
  }

  return null;
}

function resolvePackagedBinary(): string | null {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const candidate of ["doraval.cjs", "doraval.js"]) {
      const path = join(here, "../../bin", candidate);
      if (existsSync(path)) return path;
    }
  } catch {
    // import.meta.url unavailable in some bundled contexts.
  }
  return null;
}

export function resolveDoraBinary(): string {
  for (const name of ["dora", "doraval"]) {
    const found = probePathBinary(name);
    if (found) return found;
  }

  const packaged = resolvePackagedBinary();
  if (packaged) return packaged;

  const argv1 = process.argv[1];
  if (argv1 && existsSync(argv1)) return argv1;

  return "dora";
}

export function buildJournalHookCommand(opts?: {
  doraPath?: string;
  json?: boolean;
  quiet?: boolean;
}): string {
  const bin = opts?.doraPath ?? resolveDoraBinary();
  const args = ["journal", "context"];
  if (opts?.json !== false) args.push("--json");
  if (opts?.quiet) args.push("--quiet");
  const inner = [bin, ...args].join(" ");
  if (opts?.quiet) {
    return `sh -c '${inner.replace(/'/g, "'\\''")} 2>/dev/null || true'`;
  }
  return inner;
}

export function isJournalHookCommand(command: unknown): boolean {
  if (typeof command !== "string") return false;
  if (command === LEGACY_JOURNAL_HOOK_COMMAND) return true;
  return /\bjournal\s+context\b/.test(command);
}

export function journalHookGroup(opts?: { quiet?: boolean }) {
  return {
    hooks: [
      {
        type: "command",
        command: buildJournalHookCommand({ quiet: opts?.quiet }),
      },
    ],
  };
}