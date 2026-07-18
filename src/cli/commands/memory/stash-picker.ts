/**
 * Stash candidate pickers: clack multiselect (capped) or optional fzf (-m full list).
 */
import { spawnSync } from "node:child_process";
import { multiselect, isCancel } from "@clack/prompts";

/** Interactive clack picker cap — B34 large-N (never truncate silently). */
export const STASH_PICKER_CAP = 20;

export type StashCandidate = { relativePath: string; status: string };

export interface FzfPickDeps {
  /** Resolve whether `fzf` is on PATH. */
  whichFzf: () => boolean;
  /** Run fzf; return stdout + exit code. */
  runFzf: (input: string) => { stdout: string; exitCode: number | null };
}

export function defaultWhichFzf(): boolean {
  try {
    const r = spawnSync("which", ["fzf"], { stdout: "pipe", stderr: "pipe" });
    return r.status === 0;
  } catch {
    return false;
  }
}

export function defaultRunFzf(input: string): { stdout: string; exitCode: number | null } {
  const r = spawnSync(
    "fzf",
    [
      "-m",
      "--height=40%",
      "--border",
      "--prompt=Stash> ",
      "--header=TAB multi-select · Enter confirm · Esc cancel",
    ],
    {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "inherit"],
    },
  );
  return {
    stdout: typeof r.stdout === "string" ? r.stdout : "",
    exitCode: r.status,
  };
}

const defaultDeps: FzfPickDeps = {
  whichFzf: defaultWhichFzf,
  runFzf: defaultRunFzf,
};

/**
 * Fuzzy multi-select via fzf. Returns selected relative paths, or [] if cancel/empty.
 * Throws if fzf is not installed.
 */
export function pickStashWithFzf(
  candidates: StashCandidate[],
  deps: FzfPickDeps = defaultDeps,
): string[] {
  if (!deps.whichFzf()) {
    throw new Error(
      "fzf not found on PATH. Install fzf (https://github.com/junegunn/fzf) or omit --fzf to use the built-in picker.",
    );
  }
  const lines = candidates.map((c) => `${c.relativePath}\t(${c.status})`).join("\n") + "\n";
  const { stdout, exitCode } = deps.runFzf(lines);
  // fzf: 0 = ok, 1 = no match / abort, 130 = Ctrl-C
  if (exitCode !== 0) return [];
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split("\t")[0]!.trim())
    .filter(Boolean);
}

/**
 * Clack multiselect with B34 cap. Caps list and returns { selected, truncated }.
 */
export async function pickStashWithClack(
  candidates: StashCandidate[],
  opts: {
    cap?: number;
    onTruncated?: (shown: number, total: number) => void;
  } = {},
): Promise<string[]> {
  const cap = opts.cap ?? STASH_PICKER_CAP;
  let pickerList = candidates;
  if (candidates.length > cap) {
    opts.onTruncated?.(cap, candidates.length);
    pickerList = candidates.slice(0, cap);
  }
  const selected = await multiselect({
    message: "Select files to stash into project memory",
    options: pickerList.map((c) => ({
      value: c.relativePath,
      label: `${c.relativePath} (${c.status})`,
    })),
    required: false,
    output: process.stderr,
  });
  if (isCancel(selected) || (selected as string[]).length === 0) return [];
  return selected as string[];
}
