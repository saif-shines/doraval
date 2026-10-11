import { useState } from "react";
import { listGrokFolder, loadGrokSession, type GrokFolder } from "../../../src/core/session-page/browser.ts";
import type { SessionFacts, SessionRow } from "../../../src/core/session-page/read.ts";
import type { Turn } from "../../../src/core/session-page/group.ts";

export const client = "only";

type Loaded = { row: SessionRow; turns: Turn[]; facts: SessionFacts };
type IconName = "folder" | "down" | "users" | "user" | "bot" | "wrench" | "file" | "git" | "alert" | "dot" | "scroll" | "spark";

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { id?: string; mode?: "read" }) => Promise<GrokFolder>;
};

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    className: `h-4 w-4 shrink-0 fill-none stroke-current stroke-2 ${className}`,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "folder") {
    return (
      <svg {...common}>
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      </svg>
    );
  }
  if (name === "down") {
    return (
      <svg {...common}>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
    );
  }
  if (name === "users") {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (name === "user") {
    return (
      <svg {...common}>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  }
  if (name === "bot") {
    return (
      <svg {...common}>
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
      </svg>
    );
  }
  if (name === "wrench") {
    return (
      <svg {...common}>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    );
  }
  if (name === "git") {
    return (
      <svg {...common}>
        <circle cx="12" cy="18" r="3" />
        <circle cx="6" cy="6" r="3" />
        <circle cx="18" cy="6" r="3" />
        <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" />
        <path d="M12 12v3" />
      </svg>
    );
  }
  if (name === "alert") {
    return (
      <svg {...common}>
        <path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  if (name === "dot") {
    return (
      <svg {...common} className={`h-3.5 w-3.5 shrink-0 fill-current stroke-none ${className}`}>
        <circle cx="12" cy="12" r="5" />
      </svg>
    );
  }
  if (name === "scroll") {
    return (
      <svg {...common}>
        <path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4" />
        <path d="M19 17V5a2 2 0 0 0-2-2H4" />
      </svg>
    );
  }
  if (name === "spark") {
    return (
      <svg {...common}>
        <path d="M9.9 10.1 12 3l2.1 7.1L21 12l-6.9 1.9L12 21l-2.1-7.1L3 12z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return "";
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${Math.round(seconds * 10) / 10} s`;
  let minutes = Math.floor(seconds / 60);
  let rem = Math.round(seconds - minutes * 60);
  if (rem === 60) {
    minutes += 1;
    rem = 0;
  }
  if (rem === 0) return `${minutes} m`;
  return `${minutes} m ${rem} s`;
}

function formatCost(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n)}`;
}

function ToolLine({ tool }: { tool: Turn["tools"][number] }) {
  const [open, setOpen] = useState(true);
  const command = typeof tool.command === "string" ? tool.command : "";
  const pathValue = typeof tool.path === "string" ? tool.path : "";
  const showCommand = command !== "" && command !== tool.name;
  const mid = pathValue || (showCommand ? command : "");
  const duration = typeof tool.durationMs === "number" ? formatDuration(tool.durationMs) : "";
  return (
    <div className={`border-t border-border py-1.5 ${tool.failed ? "text-red-700" : ""}`}>
      <div className="grid grid-cols-[9rem_minmax(0,1fr)_auto] gap-2 font-mono text-xs">
        <span>{tool.name}</span>
        <span className="break-all text-muted-foreground" title={mid}>{mid}</span>
        <span className="flex gap-2">
          {duration ? <span>{duration}</span> : null}
          {tool.failed ? <span>failed</span> : null}
        </span>
      </div>
      {showCommand && pathValue && pathValue !== command ? (
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground" title={command}>{command}</p>
      ) : null}
      {typeof tool.output === "string" && tool.output !== "" ? (
        <div className="mt-1">
          <button
            type="button"
            className="rounded-sm border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            Output
          </button>
          {tool.outputTruncated ? <p className="mt-1 text-xs text-muted-foreground">Output cut at 2000 characters.</p> : null}
          {open ? <pre className="mt-1 overflow-auto whitespace-pre-wrap rounded-sm border border-border bg-muted p-2 font-mono text-xs">{tool.output}</pre> : null}
        </div>
      ) : null}
    </div>
  );
}

function Kicker({ icon, children }: { icon: IconName; children: string }) {
  return (
    <p className="mb-1 flex items-center gap-1.5 font-mono text-[0.72rem] font-medium uppercase tracking-wide text-accent">
      <Icon name={icon} className="h-3.5 w-3.5" />
      {children}
    </p>
  );
}

export default function Sessions() {
  const [folder, setFolder] = useState<GrokFolder | null>(null);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [selected, setSelected] = useState("");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [status, setStatus] = useState("");
  const [openDiff, setOpenDiff] = useState<string | null>(null);

  const visible = rows.filter((row) => showHidden || !row.hidden);

  async function chooseFolder() {
    const picker = (window as PickerWindow).showDirectoryPicker;
    if (!picker) {
      setStatus("This browser cannot read a local folder. Use Chrome or Edge, or run dora session open.");
      return;
    }
    try {
      const next = await picker({ id: "doraval-grok", mode: "read" });
      setStatus("Reading summaries.");
      const listed = await listGrokFolder(next);
      setFolder(next);
      setRows(listed);
      setSelected("");
      setLoaded(null);
      setStatus(listed.length === 0 ? "No sessions in that folder." : "");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Could not read that folder. Choose the .grok folder, not the sessions folder inside it.");
    }
  }

  async function openSession(id: string) {
    if (!folder) return;
    setSelected(id);
    setStatus("");
    setOpenDiff(null);
    const next = await loadGrokSession(folder, id);
    setLoaded(next);
    if (!next) setStatus("Session not found.");
  }

  return (
    <article className="flex h-[calc(100dvh-4rem)] flex-col px-3 py-3 text-left text-foreground">
      <p className="mb-1 font-mono text-xs font-medium uppercase tracking-wide text-accent">Sessions</p>
      <h1 className="text-3xl font-semibold tracking-tight">Grok sessions</h1>
      <p className="mt-2 text-sm leading-snug text-muted-foreground">
        Choose the .grok folder on this computer. The list and the turns stay in the browser. Nothing is uploaded.
        On this machine, dora session open is the same page.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-sm bg-accent px-3 py-2 text-sm text-accent-foreground"
          onClick={() => void chooseFolder()}
        >
          <Icon name="down" />
          Choose .grok folder
        </button>
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} />
          <Icon name="users" />
          Include subagents and temp folders
        </label>
      </div>
      {status ? <p className="mt-3 text-sm text-muted-foreground">{status}</p> : null}

      {rows.length > 0 ? (
        <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 items-start gap-3 md:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="h-full overflow-auto border-r border-border pr-2">
            {visible.length === 0 ? <p className="text-sm text-muted-foreground">No sessions in that folder.</p> : null}
            {visible.map((row) => (
              <button
                key={row.id}
                type="button"
                className={`block w-full border-l-2 px-3 py-2.5 text-left ${
                  row.id === selected ? "border-accent bg-muted" : "border-transparent"
                }`}
                onClick={() => void openSession(row.id)}
              >
                <span className="block text-sm font-semibold leading-snug">{row.title}</span>
                {row.folder ? (
                  <span className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Icon name="folder" className="mt-0.5" />
                    <span className="break-all">{row.folder}</span>
                  </span>
                ) : null}
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{[row.model, row.branch].filter(Boolean).join(" · ")}</span>
                  {row.contextPct != null ? <span>{row.contextPct}% context</span> : null}
                  {row.turns != null ? <span>{row.turns} turns</span> : null}
                  {row.errors ? (
                    <span className="inline-flex items-center gap-1 text-red-700">
                      <Icon name="alert" className="h-3.5 w-3.5" />
                      {row.errors} failed
                    </span>
                  ) : null}
                  {row.live ? (
                    <span className="inline-flex items-center gap-1 text-accent">
                      <Icon name="dot" />
                      now
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </aside>

          <div className="h-full min-w-0 overflow-auto text-left">
            {loaded ? (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  {[
                    [loaded.row.turns == null ? "—" : String(loaded.row.turns), "Turns"],
                    [loaded.row.contextPct == null ? "—" : `${loaded.row.contextPct}%`, "Context"],
                    [loaded.row.errors == null ? "—" : String(loaded.row.errors), "Errors"],
                    [loaded.row.model || "—", "Model"],
                  ].map(([value, label]) => (
                    <div key={label} className="min-w-24 rounded-sm border border-border bg-muted px-3 py-2">
                      <strong className="block text-sm font-semibold tracking-tight">{value}</strong>
                      <span className="font-mono text-[0.68rem] uppercase tracking-wide text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>

                <section className="mb-4 text-left text-sm">
                  <Kicker icon="git">Lineage</Kicker>
                  {loaded.facts.parentSessionId ? (
                    <button type="button" className="text-accent" onClick={() => void openSession(loaded.facts.parentSessionId!)}>
                      Parent {loaded.facts.parentSessionId}
                    </button>
                  ) : null}
                  {loaded.facts.headCommit ? <p className="font-mono text-xs text-muted-foreground">{loaded.facts.headCommit}</p> : null}
                  <p className="break-all font-mono text-xs text-muted-foreground">{loaded.facts.logPath}</p>
                </section>

                {typeof loaded.facts.costUsd === "number" ? (
                  <section className="mb-4">
                    <Kicker icon="spark">Cost</Kicker>
                    <p className="text-sm">{formatCost(loaded.facts.costUsd)}</p>
                  </section>
                ) : null}
                {typeof loaded.facts.compactionCount === "number" && loaded.facts.compactionCount > 0 ? (
                  <p className="mb-4 text-sm text-muted-foreground">Compactions: {loaded.facts.compactionCount}</p>
                ) : null}
                {loaded.facts.subagents.length > 0 ? (
                  <section className="mb-4">
                    <Kicker icon="users">Subagents</Kicker>
                    {loaded.facts.subagents.map((agent) => (
                      <div key={agent.id} className="mb-2">
                        {agent.id ? (
                          <button type="button" className="font-mono text-xs text-accent" onClick={() => void openSession(agent.id)}>
                            {agent.id}
                          </button>
                        ) : null}
                        {agent.description ? <p className="text-sm">{agent.description}</p> : null}
                        <p className="text-xs text-muted-foreground">
                          {[agent.model, agent.status, typeof agent.durationMs === "number" ? formatDuration(agent.durationMs) : "", agent.toolCalls != null ? `${agent.toolCalls} tool calls` : ""]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    ))}
                  </section>
                ) : null}

                {loaded.turns.map((turn) => (
                  <section key={turn.n} className="border-t border-border py-2 text-left">
                    <h2 className="mb-3 text-left text-base font-semibold">
                      Turn {turn.n}
                      {turn.closed ? "" : " · open"}
                    </h2>
                    <Kicker icon="user">You</Kicker>
                    <p className="mb-3 whitespace-pre-wrap">{turn.prompt || "(no prompt)"}</p>
                    {turn.thinking ? (
                      <>
                        <Kicker icon="spark">Thinking</Kicker>
                        <p className="mb-3 whitespace-pre-wrap">{turn.thinking}</p>
                      </>
                    ) : null}
                    {turn.reply ? (
                      <>
                        <Kicker icon="bot">Assistant</Kicker>
                        <p className="mb-3 whitespace-pre-wrap">{turn.reply}</p>
                      </>
                    ) : null}
                    {turn.tools.length > 0 ? (
                      <>
                        <Kicker icon={turn.tools.some((tool) => tool.failed) ? "alert" : "wrench"}>Tools</Kicker>
                        {turn.tools.map((tool, index) => (
                          <ToolLine key={`${turn.n}-${index}`} tool={tool} />
                        ))}
                      </>
                    ) : null}
                  </section>
                ))}

                {loaded.facts.files.length > 0 ? (
                  <section className="border-t border-border py-2">
                    <Kicker icon="file">Changed files</Kicker>
                    {loaded.facts.files.map((file) => (
                      <div key={file.path} className="py-1">
                        <button
                          type="button"
                          className="break-all text-left font-mono text-xs text-muted-foreground"
                          onClick={() => setOpenDiff(openDiff === file.path ? null : file.path)}
                        >
                          {file.path} +{file.added} −{file.removed}
                        </button>
                        {openDiff === file.path && file.diff ? (
                          <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{file.diff}</pre>
                        ) : null}
                      </div>
                    ))}
                  </section>
                ) : null}

                {loaded.facts.recaps.length > 0 ? (
                  <section className="border-t border-border py-2">
                    <Kicker icon="scroll">Recap</Kicker>
                    {loaded.facts.recaps.map((recap) => (
                      <p key={recap.slice(0, 40)} className="mb-2 whitespace-pre-wrap text-sm">
                        {recap}
                      </p>
                    ))}
                  </section>
                ) : null}

                {(() => {
                  const names = [...loaded.facts.skills];
                  for (const turn of loaded.turns) {
                    for (const name of turn.skills ?? []) {
                      if (name && !names.includes(name)) names.push(name);
                    }
                  }
                  if (names.length === 0) return null;
                  return (
                    <section className="border-t border-border py-2">
                      <Kicker icon="spark">Skills</Kicker>
                      <p className="text-sm">{names.join(", ")}</p>
                    </section>
                  );
                })()}
                {loaded.facts.permissions.length > 0 ? (
                  <section className="border-t border-border py-2">
                    <Kicker icon="alert">Permissions</Kicker>
                    {loaded.facts.permissions.map((item) => (
                      <div key={`${item.tool}-${item.decision}`} className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2 font-mono text-xs">
                        <span>{item.tool}</span>
                        <span className="text-muted-foreground">{item.decision}</span>
                      </div>
                    ))}
                  </section>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Pick a session.</p>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}
