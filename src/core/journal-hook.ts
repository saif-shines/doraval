import { existsSync } from "fs";
import { spawnSync } from "bun";

/** Legacy hook command installed before absolute-path + --json migration. */
export const LEGACY_JOURNAL_HOOK_COMMAND =
  "sh -c 'dora journal context 2>/dev/null || true'";

export function resolveDoraBinary(): string {
  for (const name of ["dora", "doraval"]) {
    let probe = spawnSync(["command", "-v", name], { stdout: "pipe", stderr: "pipe" });
    if (probe.exitCode !== 0) {
      probe = spawnSync(["which", name], { stdout: "pipe", stderr: "pipe" });
    }
    if (probe.exitCode === 0) {
      const found = new TextDecoder().decode(probe.stdout).trim().split("\n")[0]?.trim();
      if (found) return found;
    }
  }

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