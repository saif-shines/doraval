import { text, select, isCancel } from "@clack/prompts";

// All prompt chrome goes to stderr — stdout is reserved for data.
const output = process.stderr;

function cancelled(): never {
  output.write("\nCancelled.\n");
  process.exit(130);
}

/**
 * Text prompt with a fallback. Non-TTY (CI, agents, pipes) returns the
 * fallback immediately — same contract as the old raw-stdin prompt.
 */
export async function prompt(label: string, fallback: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stderr.isTTY) return fallback;
  const ans = await text({
    message: label,
    placeholder: fallback,
    defaultValue: fallback,
    output,
  });
  if (isCancel(ans)) cancelled();
  return String(ans).trim() || fallback;
}

/** Select prompt. Non-TTY returns the fallback value. */
export async function promptSelect<T extends string>(
  label: string,
  options: { value: T; label: string; hint?: string }[],
  fallback: T
): Promise<T> {
  if (!process.stdin.isTTY || !process.stderr.isTTY) return fallback;
  const ans = await select({
    message: label,
    options,
    initialValue: fallback,
    output,
  });
  if (isCancel(ans)) cancelled();
  return ans as T;
}
