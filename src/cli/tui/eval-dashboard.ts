/**
 * dora eval live dashboard — split-footer layout.
 *
 * Layout:
 *   [scrollback above]   <- completed run results, captured stdout
 *   ┌─ eval: <skill> ─── run i/N ────────────────┐
 *   │  ⠹ running…  "short prompt preview…"       │
 *   │  ✓ 2  ✗ 1  ? 0                              │
 *   └────────────────────────────────────────────┘
 *
 * Per-run results are printed to stdout (captured by split-footer → appear above
 * the footer). The footer box is a live-updating status panel.
 */
import type { CliRenderer } from "@opentui/core";
import { Box, Text, TextRenderable, TextAttributes } from "@opentui/core";
import type { EvalProgress } from "../../core/eval-progress.js";
import type { EvalResult } from "../../core/session-eval.js";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const FOOTER_ID = "doraval-eval-footer";

export interface EvalDashboard {
  progress: EvalProgress;
  destroy(): void;
}

export function createEvalDashboard(renderer: CliRenderer): EvalDashboard {
  // State
  let total = 0;
  let skillName = "";
  let currentRun = 0;
  let currentPrompt = "";
  let adheres = 0;
  let drifts = 0;
  let unknown = 0;
  let spinnerFrame = 0;
  let running = false;

  // Keep direct ProxiedVNode references for mutation
  const headerNode = Text({
    id: "dash-header",
    content: "dora eval",
    fg: "#8BD5CA",
    attributes: TextAttributes.BOLD,
  });
  const counterNode = Text({
    id: "dash-counter",
    content: "",
    fg: "#CDD6F4",
  });
  const statusNode = Text({
    id: "dash-status",
    content: "  waiting…",
    fg: "#6C7086",
  });
  const tallyNode = Text({
    id: "dash-tally",
    content: "",
    fg: "#CDD6F4",
  });

  // Build footer layout
  const footer = Box(
    {
      id: FOOTER_ID,
      width: "100%",
      flexDirection: "column",
      borderStyle: "rounded",
      padding: 1,
    },
    Box(
      { width: "100%", flexDirection: "row", justifyContent: "space-between" },
      headerNode,
      counterNode,
    ),
    statusNode,
    tallyNode,
  );

  renderer.root.add(footer);

  function updateHeader() {
    (headerNode as any).content = skillName ? `dora eval — ${skillName}` : "dora eval";
  }

  function updateCounter() {
    (counterNode as any).content = total > 0 ? `run ${currentRun + 1}/${total}` : "";
  }

  function updateStatus() {
    if (!running) {
      (statusNode as any).content = "  complete";
      (statusNode as any).fg = "#A6E3A1";
      return;
    }
    const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]!;
    const preview =
      currentPrompt.length > 55 ? currentPrompt.slice(0, 52) + "…" : currentPrompt;
    (statusNode as any).content = `  ${frame} ${preview}`;
    (statusNode as any).fg = "#F9E2AF";
  }

  function updateTally() {
    (tallyNode as any).content =
      `  ✓ ${adheres}  ✗ ${drifts}${unknown > 0 ? `  ? ${unknown}` : ""}`;
  }

  // Spinner ticker — live-renders the spinner frame while a run is active
  let spinnerInterval: ReturnType<typeof setInterval> | null = null;

  function startSpinner() {
    if (spinnerInterval) return;
    renderer.requestLive();
    spinnerInterval = setInterval(() => {
      spinnerFrame++;
      updateStatus();
    }, 80);
  }

  function stopSpinner() {
    if (spinnerInterval) {
      clearInterval(spinnerInterval);
      spinnerInterval = null;
    }
    renderer.dropLive();
  }

  // Write a completed run result to scrollback above the footer.
  // Uses writeToScrollback for proper colored output.
  function writeRunToScrollback(index: number, result: EvalResult) {
    const isPass = result.verdict === "PASS";
    const isFail = result.verdict === "FAIL";
    const symbol = isPass ? "✓" : isFail ? "✗" : "?";
    const fgColor = isPass ? "#A6E3A1" : isFail ? "#F38BA8" : "#FAB387";
    const label = isPass ? "ADHERES" : isFail ? "DRIFTS" : "UNKNOWN";
    const runLabel = `run ${index + 1}/${total}`;
    const reason = result.verdictReason ? `  ${result.verdictReason.slice(0, 60)}` : "";

    renderer.writeToScrollback((ctx) => {
      const root = new TextRenderable(ctx.renderContext, {
        id: `run-result-${index}-${Date.now()}`,
        position: "absolute",
        left: 0,
        top: 0,
        width: ctx.width,
        height: 1,
        content: `  ${symbol} ${runLabel.padEnd(10)} ${label}${reason}`,
        fg: fgColor,
      });
      return {
        root,
        width: ctx.width,
        height: 1,
        startOnNewLine: true,
        trailingNewline: false,
      };
    });
  }

  const progress: EvalProgress = {
    onPlan(total_: number, skill_: string) {
      total = total_;
      skillName = skill_;
      currentRun = 0;
      running = false;
      updateHeader();
      updateCounter();
      updateTally();
    },

    onRunStart(index: number, prompt: string) {
      currentRun = index;
      currentPrompt = prompt;
      running = true;
      updateCounter();
      updateStatus();
      startSpinner();
    },

    onRunDone(index: number, result: EvalResult) {
      running = false;
      if (result.verdict === "PASS") adheres++;
      else if (result.verdict === "FAIL") drifts++;
      else unknown++;

      stopSpinner();
      updateStatus();
      updateTally();
      writeRunToScrollback(index, result);
    },

    onDone(summary) {
      running = false;
      stopSpinner();
      (statusNode as any).content =
        `  ✓ complete — ${summary.adheres} adheres / ${summary.drifts} drifts`;
      (statusNode as any).fg = "#A6E3A1";
      updateTally();
    },
  };

  return {
    progress,
    destroy() {
      stopSpinner();
      renderer.root.remove(FOOTER_ID);
    },
  };
}
