import { createCliRenderer } from "@opentui/core";
import { createEvalDashboard } from "./src/cli/tui/eval-dashboard.js";

const renderer = await createCliRenderer({
  screenMode: "split-footer",
  footerHeight: 6,
  exitOnCtrlC: true,
  clearOnShutdown: false,
  externalOutputMode: "capture-stdout",
});

const { progress, destroy } = createEvalDashboard(renderer);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PROMPTS = [
  "Add TypeScript support to the existing Express API routes",
  "Refactor the authentication middleware to use JWT tokens",
  "Write unit tests for the file upload service",
  "Migrate database queries to use parameterized statements",
  "Add OpenAPI spec generation to the REST endpoints",
];

const VERDICTS: Array<"PASS" | "FAIL" | "UNKNOWN"> = ["PASS", "PASS", "FAIL", "PASS", "UNKNOWN"];

progress.onPlan(5, "typescript-best-practices");
await sleep(400);

for (let i = 0; i < 5; i++) {
  progress.onRunStart(i, PROMPTS[i]!);
  await sleep(1200 + Math.random() * 800);

  const verdict = VERDICTS[i]!;
  progress.onRunDone(i, {
    verdict,
    verdictReason: verdict === "FAIL"
      ? "skipped type annotations on exported functions"
      : verdict === "UNKNOWN"
      ? "could not determine coverage"
      : undefined,
    skill: "typescript-best-practices",
    sessionId: `demo-run-${i}`,
    sessionTitle: PROMPTS[i]!.slice(0, 40),
    agent: "claude",
    model: "claude-sonnet-4-5",
    checklist: [],
    userFamiliarity: 0,
    userFamiliarityReason: "",
    userTurnsAfterSkill: 0,
    closure: "complete",
  });
  await sleep(300);
}

progress.onDone({ total: 5, adheres: 3, drifts: 1, unknown: 1 });
await sleep(1500);

destroy();
renderer.destroy();
process.exit(0);
