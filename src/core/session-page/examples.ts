import type { FileChange, Turn } from "./group.ts";
import type { SessionFacts, SessionRow } from "./read.ts";

export type ExampleTrace = { row: SessionRow; turns: Turn[]; facts: SessionFacts };

function facts(logPath: string, files: FileChange[]): SessionFacts {
  return {
    subagents: [],
    recaps: [],
    permissions: [],
    skills: [],
    files,
    parentSessionId: null,
    logPath,
    headCommit: null,
    reasoningEffort: null,
    sandbox: null,
    compactionCount: null,
  };
}

const loginFile: FileChange = {
  path: "/example/app/src/login.ts",
  added: 1,
  removed: 1,
  diff: "before:\n  return password.length >= 0;\nafter:\n  return password.length > 0;",
};

/** Built-in traces for the empty site. Not read from disk. */
export const EXAMPLES: ExampleTrace[] = [
  {
    row: {
      id: "example:login",
      title: "Example · Fix the login check",
      model: "gemini-2.5-pro",
      folder: "/example/app",
      branch: "main",
      contextPct: null,
      errors: 0,
      turns: 1,
      live: false,
      lastActive: "2026-07-15T12:00:00.000Z",
      hidden: false,
      agent: "gemini",
    },
    turns: [
      {
        n: 1,
        prompt: "The login check still accepts an empty password.",
        reply: "Reject an empty password before the hash compare.",
        thinking: "password.length >= 0 is true for an empty string.",
        tools: [
          {
            name: "read_file",
            path: "/example/app/src/login.ts",
            failed: false,
            output: "export function allow(password) {\n  return password.length >= 0;\n}",
          },
        ],
        hooks: 0,
        closed: true,
        files: [loginFile],
      },
    ],
    facts: facts("Example trace. Not a file on this computer.", [loginFile]),
  },
  {
    row: {
      id: "example:flag",
      title: "Example · Rename the flag",
      model: "claude-sonnet",
      folder: "/example/app",
      branch: "main",
      contextPct: null,
      errors: 0,
      turns: 2,
      live: false,
      lastActive: "2026-07-15T12:05:00.000Z",
      hidden: false,
      agent: "claude-code",
    },
    turns: [
      {
        n: 1,
        prompt: "Rename showHidden to includeHidden.",
        reply: "Renamed the prop and the checkbox label.",
        tools: [],
        hooks: 0,
        closed: true,
      },
      {
        n: 2,
        prompt: "Keep the old name as a comment for one release.",
        reply: "Left a one-line comment above the prop.",
        tools: [],
        hooks: 0,
        closed: true,
      },
    ],
    facts: facts("Example trace. Not a file on this computer.", []),
  },
];

export function exampleTrace(id: string): ExampleTrace | null {
  return EXAMPLES.find((item) => item.row.id === id) ?? null;
}
