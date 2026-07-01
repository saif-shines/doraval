/**
 * Full-screen TUI hub — launched by bare `dora` on a real TTY.
 *
 * Panes:
 *   1 Home     — project status
 *   2 Journal  — entries; a add, s sync
 *   3 Evals    — recent results; e run eval
 *   4 Skills   — workspace skills; v validate, l lint
 *
 * Global: Tab/1-4 switch, ? help, : command palette, r refresh, q quit.
 */
import {
  createCliRenderer,
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  InputRenderableEvents,
  TextAttributes,
  type KeyEvent,
} from "@opentui/core";
import { setBackend, resetToText } from "../render/index.js";
import type { RenderBackend } from "../render/backend.js";
import { loadProjectStatus, type ProjectStatus } from "../../core/views/status-view.js";
import {
  loadAllEntries,
  writePendingEntry,
  type EntryWithMeta,
} from "../../core/views/journal-view.js";
import { loadEvals, type EvalResultWithMeta } from "../../core/views/evals-view.js";
import { discoverSkills, type SkillEntry } from "../../core/views/skills-view.js";
import { loadSkill, validateSkillModel } from "../../core/skill-validate.js";
import { lintSkill } from "../../core/skill-lint.js";
import { detectCapabilities } from "../../core/capability-detect.js";
import { readConfig, getEvalConfig } from "../../core/journal-config.js";

const PANES = ["home", "journal", "evals", "skills"] as const;
type Pane = (typeof PANES)[number];
type AppMode = "browse" | "add" | "busy" | "command";

type JournalData = { committed: EntryWithMeta[]; staged: EntryWithMeta[] };

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function stripAnsi(s: string): string {
  return s.replace(/\x1B\[[0-9;]*[mA-Za-z]/g, "");
}

export async function launchApp(): Promise<void> {
  const cfg = await readConfig().catch(() => null);
  const evalCfg = cfg ? getEvalConfig(cfg) : {};
  const agentCmd =
    cfg && "agent" in (cfg as any) && typeof (cfg as any).agent?.command === "string"
      ? ((cfg as any).agent.command as string)
      : "claude";
  const agentCfg = { command: agentCmd };

  const status = await loadProjectStatus().catch(() => null);
  let journal: JournalData = await loadAllEntries(status?.project ?? null).catch(
    () => ({ committed: [] as EntryWithMeta[], staged: [] as EntryWithMeta[] }),
  );
  let evals: EvalResultWithMeta[] = await loadEvals({ limit: 20 }).catch(
    () => [] as EvalResultWithMeta[],
  );
  let skills: SkillEntry[] = discoverSkills();

  const renderer = await createCliRenderer({
    screenMode: "alternate-screen",
    exitOnCtrlC: false,
    clearOnShutdown: true,
  });

  const appBackend: RenderBackend = {
    write() {}, info() {}, dim() {}, blank() {}, heading() {},
    success() {}, warn() {}, fail() {}, pass() {}, failItem() {}, warnItem() {},
    async destroy() { try { renderer.destroy(); } catch {} },
  };
  setBackend(appBackend, "tui");

  // ─── layout ─────────────────────────────────────────────────────────────
  const layout = new BoxRenderable(renderer, {
    id: "app-root",
    width: "100%",
    height: "100%",
    flexDirection: "column",
  });

  const tabBarBox = new BoxRenderable(renderer, {
    id: "app-tabbar-box",
    width: "100%",
    borderStyle: "single",
    paddingX: 1,
  });
  const tabBarText = new TextRenderable(renderer, {
    id: "app-tabbar-text",
    content: buildTabBar("home"),
    fg: "#8BD5CA",
    attributes: TextAttributes.BOLD,
  });
  tabBarBox.add(tabBarText);

  const contentBox = new BoxRenderable(renderer, {
    id: "app-content-area",
    width: "100%",
    flexGrow: 1,
    paddingX: 2,
    paddingTop: 1,
  });
  const contentText = new TextRenderable(renderer, {
    id: "app-content-text",
    width: "100%",
    content: buildPaneContent("home", status, journal, evals, skills),
    fg: "#CDD6F4",
  });
  contentBox.add(contentText);

  // command palette box (added/removed dynamically)
  const cmdBox = new BoxRenderable(renderer, {
    id: "app-cmd-box",
    width: "100%",
    paddingX: 1,
    paddingY: 0,
    borderStyle: "single",
  });
  const cmdPromptText = new TextRenderable(renderer, {
    id: "app-cmd-prompt",
    content: ":",
    fg: "#CBA6F7",
    attributes: TextAttributes.BOLD,
  });
  const cmdInput = new InputRenderable(renderer, {
    id: "app-cmd-input",
    width: 40,
    placeholder: "command…",
    backgroundColor: "#1e1e2e",
    focusedBackgroundColor: "#313244",
    textColor: "#CDD6F4",
    cursorColor: "#CBA6F7",
  });
  const cmdRow = new BoxRenderable(renderer, {
    id: "app-cmd-row",
    flexDirection: "row",
    width: "100%",
  });
  cmdRow.add(cmdPromptText);
  cmdRow.add(cmdInput);
  cmdBox.add(cmdRow);

  const hintBox = new BoxRenderable(renderer, {
    id: "app-hint-box",
    width: "100%",
    paddingX: 1,
  });
  const hintText = new TextRenderable(renderer, {
    id: "app-hint-text",
    content: browseHint("home"),
    fg: "#6C7086",
  });
  hintBox.add(hintText);

  layout.add(tabBarBox);
  layout.add(contentBox);
  layout.add(hintBox);
  renderer.root.add(layout);

  // ─── state ──────────────────────────────────────────────────────────────
  let activePane: Pane = "home";
  let appMode: AppMode = "browse";
  let showingHelp = false;

  // add-form
  let formTitleInput: InputRenderable | null = null;
  let formPushbackInput: InputRenderable | null = null;
  let formRationaleInput: InputRenderable | null = null;
  let formFocusIndex = 0;

  // busy
  let busySpinnerInterval: ReturnType<typeof setInterval> | null = null;
  let busyFrame = 0;
  let busyCancelled = false;
  let busyLines: string[] = [];

  function getFormInputs() {
    return [formTitleInput, formPushbackInput, formRationaleInput].filter(
      (x): x is InputRenderable => x !== null,
    );
  }

  // ─── content helpers ────────────────────────────────────────────────────
  function setContent(text: string) {
    (contentText as any).content = text;
  }

  function switchPane(pane: Pane) {
    showingHelp = false;
    activePane = pane;
    (tabBarText as any).content = buildTabBar(pane);
    setContent(buildPaneContent(pane, status, journal, evals, skills));
    (hintText as any).content = browseHint(pane);
  }

  // ─── busy mode ──────────────────────────────────────────────────────────
  function startBusy(label: string) {
    appMode = "busy";
    busyCancelled = false;
    busyLines = [`\n  ${label}\n`];
    busyFrame = 0;
    renderer.requestLive();
    busySpinnerInterval = setInterval(() => {
      busyFrame++;
      const frame = SPINNER_FRAMES[busyFrame % SPINNER_FRAMES.length]!;
      const display = [...busyLines];
      const last = display[display.length - 1] ?? "";
      display[display.length - 1] = last.replace(/^  [⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] /, `  ${frame} `);
      setContent(display.join("\n"));
    }, 80);
    (hintText as any).content = "  Esc cancel";
  }

  function appendBusyLine(line: string) {
    busyLines.push(line);
    setContent(busyLines.join("\n"));
  }

  function stopBusy() {
    if (busySpinnerInterval) { clearInterval(busySpinnerInterval); busySpinnerInterval = null; }
    renderer.dropLive();
    appMode = "browse";
    (hintText as any).content = browseHint(activePane);
  }

  // ─── help ────────────────────────────────────────────────────────────────
  function toggleHelp() {
    showingHelp = !showingHelp;
    if (showingHelp) {
      setContent(buildHelp());
      (hintText as any).content = "  ? close help";
    } else {
      setContent(buildPaneContent(activePane, status, journal, evals, skills));
      (hintText as any).content = browseHint(activePane);
    }
  }

  // ─── command palette ─────────────────────────────────────────────────────
  function enterCommandMode() {
    appMode = "command";
    showingHelp = false;
    cmdInput.value = "";
    layout.remove("app-hint-box");
    layout.add(cmdBox);
    layout.add(hintBox);
    cmdInput.focus();
    (hintText as any).content = "  Esc cancel   Enter execute";
  }

  function exitCommandMode() {
    appMode = "browse";
    layout.remove("app-cmd-box");
    layout.remove("app-hint-box");
    layout.add(hintBox);
    (hintText as any).content = browseHint(activePane);
  }

  async function executeCommand(raw: string) {
    const cmd = raw.trim().toLowerCase();
    exitCommandMode();
    if (!cmd) return;

    switch (cmd) {
      case "q": case "quit":
        renderer.destroy(); resetToText(); process.exit(0);
        break;
      case "r": case "refresh":
        await refreshData(); break;
      case "?": case "help":
        toggleHelp(); break;
      case "1": switchPane("home"); break;
      case "2": switchPane("journal"); break;
      case "3": switchPane("evals"); break;
      case "4": switchPane("skills"); break;
      case "a": case "add":
        switchPane("journal"); enterAddMode(); break;
      case "sync": case "journal sync": case "s":
        switchPane("journal"); await runJournalSync(); break;
      case "v": case "validate":
        switchPane("skills"); await runInAppValidate(); break;
      case "l": case "lint":
        switchPane("skills"); await runInAppLint(); break;
      case "e": case "eval":
        switchPane("evals"); await runLatestEval(); break;
      default:
        setContent(`\n  Unknown command: ${cmd}\n\n  Press ? for help or : to try again.`);
    }
  }

  // ─── add form ────────────────────────────────────────────────────────────
  function enterAddMode() {
    if (!status?.project) {
      setContent("\n  No project configured. Run dora init first.");
      return;
    }
    appMode = "add";
    contentBox.remove("app-content-text");

    const w = 52;
    const bg = "#1e1e2e", focusBg = "#313244", fg = "#CDD6F4", cur = "#CBA6F7";
    const mkLabel = (id: string, t: string) =>
      new TextRenderable(renderer, { id, content: t, fg: "#8BD5CA" });

    const formBox = new BoxRenderable(renderer, {
      id: "app-add-form",
      flexDirection: "column",
      paddingY: 1,
    });

    formTitleInput = new InputRenderable(renderer, {
      id: "form-title", width: w,
      placeholder: "Entry title (required)...",
      backgroundColor: bg, focusedBackgroundColor: focusBg,
      textColor: fg, cursorColor: cur,
    });
    formPushbackInput = new InputRenderable(renderer, {
      id: "form-pushback", width: 8, maxLength: 1,
      placeholder: "5",
      backgroundColor: bg, focusedBackgroundColor: focusBg,
      textColor: fg, cursorColor: cur,
    });
    formRationaleInput = new InputRenderable(renderer, {
      id: "form-rationale", width: w,
      placeholder: "Context / reason (optional)...",
      backgroundColor: bg, focusedBackgroundColor: focusBg,
      textColor: fg, cursorColor: cur,
    });

    formBox.add(mkLabel("fl-1", "  Title:"));
    formBox.add(formTitleInput);
    formBox.add(mkLabel("fl-2", "\n  Pushback 1-5:"));
    formBox.add(formPushbackInput);
    formBox.add(mkLabel("fl-3", "\n  Rationale:"));
    formBox.add(formRationaleInput);
    formBox.add(
      new TextRenderable(renderer, {
        id: "form-hint",
        content: "\n  Tab next field   Enter submit   Esc cancel",
        fg: "#6C7086",
      }),
    );

    contentBox.add(formBox);
    formFocusIndex = 0;
    formTitleInput.focus();
    (hintText as any).content = "  Esc cancel   Tab next field   Enter submit";

    formTitleInput.on(InputRenderableEvents.ENTER, () => { formFocusIndex = 1; formPushbackInput?.focus(); });
    formPushbackInput.on(InputRenderableEvents.ENTER, () => { formFocusIndex = 2; formRationaleInput?.focus(); });
    formRationaleInput.on(InputRenderableEvents.ENTER, () => { void submitAddForm(); });
  }

  function exitAddMode() {
    appMode = "browse";
    contentBox.remove("app-add-form");
    formTitleInput = null; formPushbackInput = null; formRationaleInput = null;
    formFocusIndex = 0;
    contentBox.add(contentText);
    setContent(buildPaneContent(activePane, status, journal, evals, skills));
    (hintText as any).content = browseHint(activePane);
  }

  async function submitAddForm() {
    if (!status?.project) return exitAddMode();
    const title = (formTitleInput?.value ?? "").trim() || "Untitled decision";
    const pbRaw = (formPushbackInput?.value ?? "").trim();
    const pushback = pbRaw ? Math.min(5, Math.max(1, parseInt(pbRaw, 10) || 5)) : 5;
    const rationale = (formRationaleInput?.value ?? "").trim() || title;
    try {
      await writePendingEntry(status.project, { title, pushback, tags: [], rationale });
      journal = await loadAllEntries(status.project).catch(() => journal);
    } catch {}
    exitAddMode();
    switchPane("journal");
  }

  // ─── journal sync ────────────────────────────────────────────────────────
  async function runJournalSync() {
    if (!status?.project) {
      setContent("\n  No project configured. Run dora init first.");
      return;
    }
    startBusy("Syncing journal…");
    appendBusyLine(`  ${SPINNER_FRAMES[0]} publishing staged entries…`);
    try {
      const proc = Bun.spawn(
        [process.execPath, process.argv[1]!, "journal", "sync"],
        {
          cwd: process.cwd(),
          stdout: "pipe",
          stderr: "pipe",
          env: { ...process.env, DORAVAL_NO_TUI: "1", FORCE_COLOR: "0", NO_COLOR: "1" },
        },
      );
      const [out, err] = await Promise.all([
        new Response(proc.stdout as ReadableStream).text(),
        new Response(proc.stderr as ReadableStream).text(),
      ]);
      await proc.exited;
      const combined = stripAnsi((out + err).trim());
      stopBusy();
      const resultLines = ["", "  Journal sync:  "];
      for (const line of combined.split("\n").slice(0, 25)) {
        resultLines.push(`  ${line}`);
      }
      setContent(resultLines.join("\n"));
      journal = await loadAllEntries(status.project).catch(() => journal);
    } catch (err) {
      stopBusy();
      setContent(`\n  Sync failed: ${err}`);
    }
  }

  // ─── latest eval run ─────────────────────────────────────────────────────
  async function runLatestEval() {
    startBusy("Running eval on latest session…");
    appendBusyLine(`  ${SPINNER_FRAMES[0]} finding recent sessions…`);
    try {
      const proc = Bun.spawn(
        [process.execPath, process.argv[1]!, "eval", "--runs", "2"],
        {
          cwd: process.cwd(),
          stdout: "pipe",
          stderr: "pipe",
          env: { ...process.env, DORAVAL_NO_TUI: "1", FORCE_COLOR: "0", NO_COLOR: "1" },
        },
      );
      const [out, err] = await Promise.all([
        new Response(proc.stdout as ReadableStream).text(),
        new Response(proc.stderr as ReadableStream).text(),
      ]);
      await proc.exited;
      const combined = stripAnsi((out + err).trim());
      stopBusy();
      const resultLines = ["", "  Eval results:"];
      for (const line of combined.split("\n").slice(0, 30)) {
        resultLines.push(`  ${line}`);
      }
      setContent(resultLines.join("\n"));
      evals = await loadEvals({ limit: 20 }).catch(() => evals);
    } catch (err) {
      stopBusy();
      setContent(`\n  Eval failed: ${err}`);
    }
  }

  // ─── in-app validate ─────────────────────────────────────────────────────
  async function runInAppValidate() {
    const skill = skills[0];
    if (!skill) {
      setContent("\n  No skill found in workspace.\n\n  Expected: .claude/skills/<name>/SKILL.md");
      return;
    }
    startBusy(`Validating ${skill.name}…`);
    appendBusyLine(`  ${SPINNER_FRAMES[0]} validating…`);

    const loaded = await loadSkill(skill.dir);
    if (busyCancelled) { stopBusy(); setContent("\n  Cancelled."); return; }
    if (!loaded.ok) {
      stopBusy();
      setContent(`\n  ✗ Failed to load skill: ${loaded.error}`);
      return;
    }

    const result = validateSkillModel(loaded.model, { existingDirs: loaded.existingDirs });
    const passCount = result.passes.length;
    const failCount = result.errors.length;
    const total = passCount + failCount + result.warnings.length;
    const lines: string[] = ["", `  Validate: ${skill.name}   (${skill.source})`, ""];
    lines.push(
      result.errors.length === 0
        ? `  ✓ PASS  ${passCount}/${total} checks passed`
        : `  ✗ FAIL  ${failCount} error${failCount === 1 ? "" : "s"}   ${passCount} passed`,
    );
    lines.push("");
    for (const e of result.errors) {
      lines.push(`  ✗ ${e.text}`);
      if (e.hint) lines.push(`    → ${e.hint}`);
    }
    for (const w of result.warnings) {
      lines.push(`  ⚠ ${w.text}`);
      if (w.hint) lines.push(`    → ${w.hint}`);
    }
    for (const p of result.passes) lines.push(`  ✓ ${p.text}`);
    stopBusy();
    setContent(lines.join("\n"));
  }

  // ─── in-app lint ─────────────────────────────────────────────────────────
  async function runInAppLint() {
    const skill = skills[0];
    if (!skill) {
      setContent("\n  No skill found in workspace.\n\n  Expected: .claude/skills/<name>/SKILL.md");
      return;
    }
    const caps = detectCapabilities(evalCfg);
    if (caps.preferred === "none") {
      setContent(
        "\n  No judge available.\n\n  Set ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.\n  or install claude CLI.",
      );
      return;
    }

    startBusy(`Linting ${skill.name}…`);
    appendBusyLine(`  ${SPINNER_FRAMES[0]} calling LLM judge…`);

    const loaded = await loadSkill(skill.dir);
    if (busyCancelled) { stopBusy(); setContent("\n  Cancelled."); return; }
    if (!loaded.ok) {
      stopBusy();
      setContent(`\n  ✗ Failed to load skill: ${loaded.error}`);
      return;
    }

    const result = await lintSkill(loaded.model, caps, agentCfg, evalCfg, undefined);
    if (busyCancelled) { stopBusy(); setContent("\n  Cancelled."); return; }

    const lines: string[] = ["", `  Lint: ${skill.name}   via ${result.ok ? result.method : "?"}`, ""];
    if (!result.ok) {
      lines.push(`  ✗ Lint failed: ${result.error}`);
    } else {
      const sym = result.output.overall === "pass" ? "✓" : result.output.overall === "warn" ? "⚠" : "✗";
      lines.push(`  ${sym} ${result.output.overall.toUpperCase()}  ${result.output.summary}`);
      lines.push("");
      if (result.output.findings.length === 0) {
        lines.push("  No issues found.");
      } else {
        for (const f of result.output.findings) {
          const fsym = f.severity === "error" ? "✗" : f.severity === "warning" ? "⚠" : "ℹ";
          lines.push(`  ${fsym} [${f.severity}] ${f.category}  ${f.finding}`);
          lines.push(`    → ${f.suggestion}`);
        }
      }
    }
    stopBusy();
    setContent(lines.join("\n"));
  }

  // ─── refresh ─────────────────────────────────────────────────────────────
  async function refreshData() {
    journal = await loadAllEntries(status?.project ?? null).catch(() => journal);
    evals = await loadEvals({ limit: 20 }).catch(() => evals);
    skills = discoverSkills();
    if (appMode === "browse") {
      setContent(buildPaneContent(activePane, status, journal, evals, skills));
    }
  }

  // ─── key handler ─────────────────────────────────────────────────────────
  renderer.keyInput.on("keypress", (key: KeyEvent) => {
    if (appMode === "busy") {
      if (key.name === "escape") busyCancelled = true;
      return;
    }

    if (appMode === "command") {
      if (key.name === "escape") {
        exitCommandMode();
      } else if (key.name === "return") {
        const value = cmdInput.value;
        void executeCommand(value);
      }
      return;
    }

    if (appMode === "add") {
      if (key.name === "escape") exitAddMode();
      else if (key.name === "tab") {
        const inputs = getFormInputs();
        formFocusIndex = (formFocusIndex + 1) % inputs.length;
        inputs[formFocusIndex]?.focus();
      }
      return;
    }

    // browse
    if (key.name === "q" || (key.ctrl && key.name === "c")) {
      renderer.destroy(); resetToText(); process.exit(0);
    }
    if (key.name === "semicolon" || key.sequence === ":") {
      enterCommandMode(); return;
    }
    if (key.name === "question" || key.sequence === "?") {
      toggleHelp(); return;
    }

    if (key.name === "1") switchPane("home");
    else if (key.name === "2") switchPane("journal");
    else if (key.name === "3") switchPane("evals");
    else if (key.name === "4") switchPane("skills");
    else if (key.name === "tab") {
      const idx = PANES.indexOf(activePane);
      switchPane(PANES[(idx + 1) % PANES.length]!);
    } else if (key.name === "a" && activePane === "journal") {
      enterAddMode();
    } else if (key.name === "s" && activePane === "journal") {
      void runJournalSync();
    } else if (key.name === "e" && activePane === "evals") {
      void runLatestEval();
    } else if (key.name === "v" && activePane === "skills") {
      void runInAppValidate();
    } else if (key.name === "l" && activePane === "skills") {
      void runInAppLint();
    } else if (key.name === "r") {
      void refreshData();
    }
  });

  // wire cmdInput Enter (belt-and-suspenders alongside keyInput handler)
  cmdInput.on(InputRenderableEvents.ENTER, (value) => {
    if (appMode === "command") void executeCommand(value);
  });
}

// ─── tab bar ──────────────────────────────────────────────────────────────────

function buildTabBar(active: Pane): string {
  const labels: Record<Pane, string> = {
    home: "Home", journal: "Journal", evals: "Evals", skills: "Skills",
  };
  return PANES.map((p, i) => {
    const label = `${i + 1} ${labels[p]}`;
    return p === active ? `[${label}]` : label;
  }).join("   ");
}

function browseHint(pane: Pane): string {
  const extras: Record<Pane, string> = {
    home: "",
    journal: "   a add   s sync",
    evals: "   e run eval",
    skills: "   v validate   l lint",
  };
  return `  q quit   Tab/1-4 switch${extras[pane]}   : cmd   ? help   r refresh`;
}

// ─── help ─────────────────────────────────────────────────────────────────────

function buildHelp(): string {
  return `
  Keybindings

  Navigation
    1 / 2 / 3 / 4    switch pane (Home / Journal / Evals / Skills)
    Tab               cycle to next pane
    q                 quit

  Journal pane
    a                 add new entry (inline form)
    s                 sync staged entries to remote

  Evals pane
    e                 run eval on latest session (--runs 2)

  Skills pane
    v                 validate skill at cwd / first found
    l                 lint skill via LLM judge

  Global
    r                 refresh all data
    ?                 toggle this help
    :                 open command palette

  Command palette (:)
    sync / s          journal sync
    add / a           journal add form
    eval / e          run eval
    validate / v      validate skill
    lint / l          lint skill
    refresh / r       refresh data
    1-4               switch pane
    quit / q          quit
    Esc               cancel`;
}

// ─── pane content ─────────────────────────────────────────────────────────────

function buildPaneContent(
  pane: Pane,
  status: ProjectStatus | null,
  journal: JournalData,
  evals: EvalResultWithMeta[],
  skills: SkillEntry[],
): string {
  switch (pane) {
    case "home":    return buildHome(status, journal, evals, skills);
    case "journal": return buildJournal(journal);
    case "evals":   return buildEvals(evals);
    case "skills":  return buildSkills(skills);
  }
}

function buildHome(
  status: ProjectStatus | null,
  journal: JournalData,
  evals: EvalResultWithMeta[],
  skills: SkillEntry[],
): string {
  const lines: string[] = [""];
  lines.push("  dora  —  context engineering toolkit");
  lines.push("");
  if (status) {
    lines.push(`  Project  ${status.project ?? "(none)"}`);
    lines.push(`  Config   ${status.hasConfig ? "✓ configured" : "✗ not configured (run dora init)"}`);
    if (status.repo) lines.push(`  Repo     ${status.repo}`);
  } else {
    lines.push("  (no config — run dora init to set up)");
  }
  lines.push("");
  const total = journal.committed.length + journal.staged.length;
  const pass = evals.filter((e) => e.verdict === "PASS").length;
  const fail = evals.filter((e) => e.verdict === "FAIL").length;
  lines.push(
    `  Journal  ${total} ${total === 1 ? "entry" : "entries"}` +
      (journal.staged.length > 0 ? `  (${journal.staged.length} staged)` : ""),
  );
  lines.push(
    evals.length > 0
      ? `  Evals    ${evals.length} results  (✓ ${pass}  ✗ ${fail})`
      : "  Evals    no results yet",
  );
  lines.push(
    skills.length > 0
      ? `  Skills   ${skills.length} found`
      : "  Skills   none in workspace",
  );
  lines.push("");
  lines.push("  ──────────────────────────────────────────────");
  lines.push("");
  lines.push("  ? help   : command palette   q quit");
  return lines.join("\n");
}

function buildJournal(journal: JournalData): string {
  const all = [...journal.committed, ...journal.staged];
  if (all.length === 0) {
    return "\n  No journal entries yet.\n\n  Press a to add one.";
  }
  const lines: string[] = [""];
  lines.push(
    `  Journal  (${journal.committed.length} committed, ${journal.staged.length} staged)`,
  );
  lines.push("");
  for (const e of all.slice(0, 20)) {
    const staged = e._staged ? "  [staged]" : "";
    const pb = e.pushback ? `  pb:${e.pushback}` : "";
    const date = e.date ? `  ${String(e.date).slice(0, 10)}` : "";
    lines.push(`  •  ${e.title}${staged}${pb}${date}`);
    if (e.rationale) {
      const preview = e.rationale.length > 72 ? e.rationale.slice(0, 69) + "..." : e.rationale;
      lines.push(`     ${preview}`);
    }
    lines.push("");
  }
  if (all.length > 20) lines.push(`  … and ${all.length - 20} more`);
  return lines.join("\n");
}

function buildEvals(evals: EvalResultWithMeta[]): string {
  if (evals.length === 0) {
    return "\n  No eval results yet.\n\n  Press e to run eval on the latest session.";
  }
  const lines: string[] = [""];
  lines.push(`  Recent evals  (${evals.length} results)`);
  lines.push("");
  for (const e of evals.slice(0, 15)) {
    const sym = e.verdict === "PASS" ? "✓" : e.verdict === "FAIL" ? "✗" : "?";
    const verdict = e.verdict === "PASS" ? "ADHERES" : e.verdict === "FAIL" ? "DRIFTS" : "UNKNOWN";
    const ts = e.timestamp ? String(e.timestamp).slice(0, 16).replace("T", " ") : "";
    lines.push(`  ${sym}  ${e.skill}   ${verdict}   ${ts}`);
    if (e.verdictReason) {
      const preview = e.verdictReason.length > 72 ? e.verdictReason.slice(0, 69) + "..." : e.verdictReason;
      lines.push(`     ${preview}`);
    }
    lines.push("");
  }
  if (evals.length > 15) lines.push(`  … and ${evals.length - 15} more`);
  return lines.join("\n");
}

function buildSkills(skills: SkillEntry[]): string {
  if (skills.length === 0) {
    return (
      "\n  No skills found in workspace.\n\n" +
      "  Expected:\n" +
      "    .claude/skills/<name>/SKILL.md\n" +
      "    skills/<name>/SKILL.md\n" +
      "    ./SKILL.md"
    );
  }
  const lines: string[] = ["", `  Skills  (${skills.length} found)`, ""];
  for (const s of skills) {
    lines.push(`  •  ${s.name}   ${s.source}`);
    lines.push(`     ${s.dir}`);
    lines.push("");
  }
  lines.push("  ──────────────────────────────────────────────");
  lines.push("");
  lines.push(`  v validate   l lint (LLM)   — operates on: ${skills[0]?.name ?? "—"}`);
  return lines.join("\n");
}
