/**
 * Generic split-footer progress panel.
 *
 * Layout:
 *   ┌─ dora skill lint ─────────────────────── step 1/3 ─┐
 *   │  ⠹ Running quality check...                        │
 *   └─────────────────────────────────────────────────────┘
 *
 * Completed-step log lines are written to scrollback above the footer.
 * On destroy() the footer is removed from the renderer tree.
 */
import type { CliRenderer } from "@opentui/core";
import { Box, Text, TextRenderable, TextAttributes } from "@opentui/core";
import type { WorkSink } from "../../core/work-events.js";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const FOOTER_ID = "doraval-work-footer";

export interface WorkFooter {
  sink: WorkSink;
  destroy(): void;
}

export function createWorkFooter(renderer: CliRenderer, command: string): WorkFooter {
  let total = 0;
  let currentIndex = 0;
  let spinnerFrame = 0;
  let active = false;
  let logIndex = 0;

  const headerNode = Text({
    id: "wf-header",
    content: command,
    fg: "#8BD5CA",
    attributes: TextAttributes.BOLD,
  });
  const counterNode = Text({
    id: "wf-counter",
    content: "",
    fg: "#6C7086",
  });
  const statusNode = Text({
    id: "wf-status",
    content: "  waiting…",
    fg: "#6C7086",
  });

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
  );

  renderer.root.add(footer);

  let spinnerInterval: ReturnType<typeof setInterval> | null = null;

  function startSpinner() {
    if (spinnerInterval) return;
    renderer.requestLive();
    spinnerInterval = setInterval(() => {
      spinnerFrame++;
      if (active) {
        const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]!;
        const label = (statusNode as any)._currentLabel as string ?? "";
        (statusNode as any).content = `  ${frame} ${label}`;
      }
    }, 80);
  }

  function stopSpinner() {
    if (spinnerInterval) {
      clearInterval(spinnerInterval);
      spinnerInterval = null;
    }
    renderer.dropLive();
  }

  function writeLog(level: "info" | "warn" | "fail", text: string): void {
    const fg = level === "fail" ? "#F38BA8" : level === "warn" ? "#FAB387" : "#CDD6F4";
    const id = `wf-log-${logIndex++}`;
    renderer.writeToScrollback((ctx) => {
      const root = new TextRenderable(ctx.renderContext, {
        id,
        position: "absolute",
        left: 0,
        top: 0,
        width: ctx.width,
        height: 1,
        content: `  ${text}`,
        fg,
      });
      return { root, width: ctx.width, height: 1, startOnNewLine: true, trailingNewline: false };
    });
  }

  const sink: WorkSink = {
    emit(e) {
      switch (e.kind) {
        case "plan":
          total = e.total;
          (counterNode as any).content = total > 0 ? `0/${total}` : "";
          break;

        case "start":
          currentIndex = e.index;
          active = true;
          (counterNode as any).content = total > 0 ? `${currentIndex + 1}/${total}` : "";
          (statusNode as any)._currentLabel = e.label;
          (statusNode as any).content = `  ${SPINNER_FRAMES[0]} ${e.label}`;
          (statusNode as any).fg = "#F9E2AF";
          startSpinner();
          break;

        case "log":
          writeLog(e.level, e.text);
          break;

        case "done":
          active = false;
          stopSpinner();
          (statusNode as any).content = `  ✓ ${e.label ?? "complete"}`;
          (statusNode as any).fg = "#A6E3A1";
          (counterNode as any).content = total > 0 ? `${total}/${total}` : "";
          break;
      }
    },
  };

  return {
    sink,
    destroy() {
      stopSpinner();
      renderer.root.remove(FOOTER_ID);
    },
  };
}
