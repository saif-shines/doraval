import { outJson } from "./out.js";
import { buildCapabilities } from "./capabilities.js";

/** One-line root catalog. Detail lives on `<cmd> --help`. */
export const ROOT_VERBS: [string, string][] = [
  ["review", "Multi-tier skill review (start with --quick)"],
  ["fix", "Apply mechanical review fixes"],
  ["scan", "Fast workspace map"],
  ["skill", "List Skills; unused, remove, restore, new"],
  ["rule", "List and configure review rules; new"],
  ["session", "List coding-agent sessions"],
  ["memory", "Capture principles; promote to AGENTS.md"],
  ["conflicts", "Settle cross-agent contradictions"],
  ["config", "List, get, or set config (Judge keys)"],
  ["agent", "List Subagents; new"],
  ["plugin", "List Plugins; new; bump semver"],
  ["update", "Update doraval"],
  ["probe", "Send hello to doraval.dev and wait for ack"],
];

export function printRootHelp(): void {
  const lines = [
    "Reads your repo and tells you what's broken in agent context.",
    "",
    "Start here:",
    "  npx skills add saif-shines/doraval",
    "  dora review --quick",
    "",
    "Usage: dora <command> [args] [options]",
    "",
    ...ROOT_VERBS.map(([name, blurb]) => `  ${name.padEnd(12)}${blurb}`),
    "",
    "Docs: https://doraval.dev",
    "Map:  dora --help --json",
    "",
  ];
  process.stdout.write(lines.join("\n"));
}

export function printRootHelpJson(): void {
  outJson(buildCapabilities());
}

export function wantsJson(argv: string[]): boolean {
  if (argv.includes("--json") || argv.includes("--ci")) return true;
  if (argv.some((a) => a === "--format=json" || a.startsWith("--format=json"))) return true;
  const i = argv.indexOf("--format");
  return i >= 0 && argv[i + 1] === "json";
}

/** First product verb, skipping flag values. */
export function firstCommand(argv: string[]): string | undefined {
  const takeValue = new Set(["--format", "--cwd", "--completion"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (takeValue.has(a)) {
      i++;
      continue;
    }
    if (a.startsWith("--format=") || a.startsWith("--cwd=") || a.startsWith("--completion=")) continue;
    if (!a.startsWith("-")) return a;
  }
  return undefined;
}
