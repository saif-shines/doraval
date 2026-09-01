# Doraval — domain context

Agent-readable glossary for architecture and code. Product language wins over legacy file names.

## Product

**Doraval** (`dora` / `doraval`) is a context-effectiveness CLI: scan, review, and manage agent skills, memory files, and rules across Claude, Cursor, Codex, Copilot, and Grok.

## Core terms

| Term | Meaning |
|------|---------|
| **Skill** | A directory with `SKILL.md` (frontmatter + body) that agents load as specialized instructions. |
| **Authored** | Skill origin: a Skill under the current project. |
| **Global** | Skill origin: a Skill under the user home (for example `~/.claude/skills`). |
| **Imported** | Skill origin: a Skill from plugin cache or `node_modules`. Read-only. Not a remove target. |
| **Plugin** | A package that ships one or more Skills (and related files) for an agent. First-class. Not “a Skill folder”. |
| **Plugin-owned Skill** | A Skill that lives inside a Plugin. Detected when an ancestor has a Plugin manifest (`plugin.json` or the provider marketplace file). Home (`$HOME`) is never a Plugin root. Not the same as **Imported**. This pass: `unused` skips it with no error; named `remove` / `restore` exit `1` and Next is `dora review --quick <plugin-root>`. Review and `fix` on that Skill path are a later pass. |
| **Subagent** | A specialized agent file (for example `.claude/agents/*.md`). Own role and tools. Not a Memory file. Not a Skill. |
| **Catalog (this pass)** | The artifact types this pass must treat: Skill, Plugin, Memory file, Subagent. Out of scope: hooks, channels, MCP, scheduled tasks, and the rest of `docs/research-notes`. |
| **Review** | One `review(path)`. Tiered quality pass over a Skill and/or Memory file: structure → heuristics → optional LLM judge → optional sessions. Workspace and Skill reviews also include cwd Memory files (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `copilot-instructions.md`). |
| **Scan** | Fast workspace map (`dora scan`): agents present, skill validation, shadows/overlaps, install/intelligence. Not the empty-argv default. |
| **Rule** | One module (`src/core/rules`). Registry, packages, resolve, stamp, and mutation. CLI only renders and writes config. |
| **Package** | Named enable-set of rules: `recommended` (default), `strict`, `minimal`. |
| **Judge** | One module (`judge()`). Owns mode (**api** / **delegate** / **fail**) and transport. Review passes prompt, schema, and `ci`. |
| **Memory** | Product term for principles, artifacts, and always-on files (`AGENTS.md`, `CLAUDE.md`, …) under `~/.doraval/memory/` and project roots. |
| **Config** | Global product config at `~/.doraval/config.yml`. Code type is still `JournalConfig` (legacy name — not a “journal product”). Holds projects, `eval.*` judge settings (vendor, model, API key), rules, agent command. CLI: `dora config` (list / get / set / setup). Not `dora providers`. _Avoid_: a second key command; `dora judge` as a verb. |
| **Session** | Past agent conversation transcript, normalized via **session adapters** into a list of **Events**, plus a derived summary for evidence and adherence eval. _Avoid_: login session; auth session; a signed-in visit. |
| **Event** | One step inside a Session: a message, tool call, tool result, or error. The Session IR is a list of Events. _Avoid_: turn (not every Event is a user turn); entry (parser word); SessionPrimitives as the foundation. |
| **Finding** | One Skill-check outcome (tier + severity + message + optional rule code / docUrl). The Skill-check module sets `structure` or `heuristics`. Review adds `llm` and `sessions`. Scan presents Skill Findings as health; shadows, overlaps, MCP, budget, and install stay Scan-only. |
| **Review window** | Sessions that unused, Review, and `dora session` read. Count and time period are one configurable pair. Default is last 30 Sessions and 3 months. Two legal loads: **Project load** is last 30 in this directory. **Global load** is last 30 per agent, any project. Hits from every agent still count. Defaults live in `~/.doraval/config.yml`. Flags override one run. Old shipped default was last 10 Sessions and 30 days. _Avoid_: Evidence window; mixing the two loads in one verdict. |
| **Never invoked** | A Skill with no invoke evidence in Sessions inside the Review window. Not the same as a remove candidate. |
| **Recent install** | A Skill or Plugin whose Install age is under the threshold. Unused names it as never invoked. It is not a Remove candidate. _Avoid_: tying this to the Review window; dumping Imported cache names in the unused table. |
| **Remove candidate** | An Authored Skill that is Never invoked and not a Recent install. Its own Finding (new rule). Not R029. Review and Scan may recommend remove. A Global Skill is never a Remove candidate from one project’s Sessions. |
| **Quarantine** | Move a Global Skill aside so it can be restored. Not a delete. _Avoid_: stash. |
| **Remove** | Write action (`dora skill remove`). Deletes an Authored Skill. Quarantines a Global Skill. A name is enough. `--for` selects the agent. `--global` selects origin when Authored and Global share a name. One match: just Remove. Several matches (including same agent, two origins): TTY picker; a Runner must pass `--for` / `--global` / a path or it exits `2` with Next. |
| **Restore** | Write action (`dora skill restore`). Puts a Quarantined Global Skill back at its original path (`~/.doraval/quarantine/` plus a record). Does not undo an Authored delete. Git does that. If the original path is occupied, stop. |
| **Explicit remove** | A named Remove. Works on any Authored or Global Skill. Does not require Remove-candidate status. Refuses Imported. |

## Docs voice

Two addressees. Do not mix them on one surface.

| Term | Meaning |
|------|---------|
| **Reader** | The human. “you” on README, install, and `get-started`. |
| **Runner** | The agent that executes `dora`. “you” on the skill, on `dora --help`, and on per-command `--help`. |

The website is mixed. Do not mix the two voices on one page.

**`--help` voice:** top-level `dora --help` talks to the **Runner** (the agent), same as per-command `--help`. README, install, and `get-started` stay **Reader**. See `docs/adr/0001-help-talks-to-runner.md`.

**First loop:** `npx skills add saif-shines/doraval`, then `dora review --quick` so findings show before JSON, LLM, or CI flags. The same two lines open README Quick start **and** `dora --help`.

**Empty argv:** Bare `dora` prints `--help`. It does not run Scan or Review. Scan is `dora scan` only. Same shape as agent-browser (empty argv is help, not `open`) and Entire-in-a-repo. Not Entire’s unset-repo setup flow — Doraval has no `enable`. _Avoid_: treating bare `dora` as the product job.

**README:** Reader surface. Follows the agent-browser README shape (install → quick start → long pasteable command catalog).

**Site catalog:** Same long catalog as the README. Path follows agent-browser (they use `/commands` for this page). The skill still does not copy a flag encyclopedia.

**This pass** is lockstep, not a docs rewrite. The binary (`dora --help`, per-command `--help`, unknown-command, `dora agent-help`) is the work. README and `/commands` change only when a new help line would disagree with them.

**agent-help:** Legacy verb. This pass **deletes** it. One text door: `dora --help` and `<cmd> --help`. Text `--help` is short: Start here + one-line verb list. Catalog and flags live on `<cmd> --help` and on `dora --help --json` (same tree, `read-only` / `writes`). `_Avoid_`: a second catalog (`agent-help`, `--capabilities`); a 400-line `--help`. See ADR 0004 (to be superseded).

**`--json`:** Alias for `--format json`. Both work. `--ci` still implies JSON. Errors stay on stderr.

**Help/agent-help pass (2026-08-20) is done when:** `dora --help` names the same first Review as the README (`dora review --quick`); `dora agent-help` exists and `--capabilities` is gone; per-command `--help` for review / fix / scan shows examples; `dora nosuch` prints one error and `Next: dora --help` (no help dump); `--json` works; agent scan skips the proceed gate; agent writes without `--yes`/`--dry-run` exit `2`; **and** README / `/commands` still agree with those lines.

That grill is settled. Do not implement from this glossary alone.

## Agent-contract pass (this grill)

| Term | Meaning |
|------|---------|
| **Mechanical improve** | The Runner job for this pass: diagnose, then apply mechanical `dora fix --yes`. The human still owns judgment, Remove, Restore, and `memory promote`. |
| **First loop (this pass)** | `dora review --quick`, then `dora fix --yes` when Findings are mechanical. Unused is a Next, not the start. Scan is a map. |
| **Pass test** | This pass is done when both are true: (1) a cold Runner with only the shipped skill finishes the first loop and does not ask the human a question; (2) every verb that Runner needs is on `dora agent-help --json`, with a stable JSON shape and a Next line. |
| **Harden first** | This pass changes existing verbs (JSON, Next, exit codes, read-only vs writes). It does not add new jobs first. |
| **Subagent this pass** | Discover only. `dora new agent` and `dora agent-help` stay (that pass). Review does not grade Subagent files. This CLI-structure pass moves create to `dora agent new` and deletes `agent-help`. |
| **Skill on agent-help** | `dora skill unused` is **read-only**. `dora skill remove` and `restore` are **writes**. Do not label the whole group as writes only. |
| **Runner verbs (this pass)** | `agent-help`, `review`, `fix`, `scan`, `sessions`, `skill unused`, `new`. `skill remove` / `restore` stay on the map as writes the human owns. |

_Avoid_: “perfect”; “improve context” with no job; a Runner that Removes or promotes without the human; calling `AGENTS.md` “agent.md”; treating a Plugin-owned Skill as a `dora skill unused` / `remove` / `restore` target.

Grill for this pass is **closed**. Shipped in v0.6.23. Spec: https://github.com/saif-shines/doraval/issues/44. Tickets: [#45](https://github.com/saif-shines/doraval/issues/45), [#46](https://github.com/saif-shines/doraval/issues/46), [#47](https://github.com/saif-shines/doraval/issues/47).

## Plugin-health pass (this grill)

| Term | Meaning |
|------|---------|
| **Separate units** | A Plugin and a Skill are two things. A Plugin is not “a bag you must use instead of a Skill.” A Skill is not “the Plugin.” |
| **Plugin Review** | `dora review <plugin-root>`. Same Review as today. Owned Skills are listed under that report. Not a `dora plugin review` verb. |
| **This pass** | Health read/report for Plugin + owned Skills. Not Subagent Review. `dora skill unused` / `remove` / `restore` still skip Plugin-owned Skills. |
| **Skill-path Review** | `dora review` of a Plugin-owned Skill is allowed. Health of that Skill only. Say it is Plugin-owned. |
| **Skill-path fix** | `dora fix` of a Plugin-owned Skill still applies mechanical fixes to that Skill. Unchanged. |
| **Plugin Next** | On Review of a Plugin-owned Skill, on that Skill’s Scan health row, and after `dora fix` of that Skill: say Plugin-owned. Next is `dora review --quick <plugin-root>` and `dora fix <plugin-root> --dry-run`. Do not auto `--yes` the whole Plugin. |
| **JSON (this pass)** | Review / Scan / fix JSON marks a Plugin-owned Skill with `pluginOwned: true` and `pluginRoot`. No new top-level `next` array. |
| **Runner-first (this pass)** | Design output for the Runner. The table may stay. Do not add human-only chrome. |

_Avoid_: refusing all Skill paths inside a Plugin; `dora plugin review`; treating Plugin Review as a new report format; applying Plugin-wide `--yes` without the human.

**Later product direction (not this pass):** the binary is for the Runner. Humans read README and the site. No new TTY pickers. Existing human confirms stay until a later grill. Not C (do not drop tables/confirms in this pass).

Grill for this pass is **closed**. Shipped in v0.6.24. Spec: https://github.com/saif-shines/doraval/issues/48. Tickets: [#49](https://github.com/saif-shines/doraval/issues/49), [#50](https://github.com/saif-shines/doraval/issues/50).

## Session-analysis pass (this grill)

| Term | Meaning |
|------|---------|
| **This pass** | Sharper Session **evidence**. Same Review / unused / `dora sessions` jobs. A corpus job comes later. |
| **Later analyse** | A Runner uses Doraval to read many Sessions, find gaps, and proceed. Not this pass’s user-facing verb. “Gaps” is not defined yet. |
| **Adopt-aggressively** | Take what we need from `agent-traces` (facts and grain). Breaking Review / unused / `dora sessions` is allowed if the new IR unlocks Later analyse. |
| **Event grain** | The Session IR is a list of Events. A Session summary is derived. Review and unused may break. |
| **Two grains** | Event list + derived Session summary. A Content table is a later view, not a grain. |
| **Capture-wide** | The Event list stores facts Later analyse will need. CLI output this pass stays evidence-only. _Avoid_: dumping the warehouse into `dora review`. |
| **Approach research** | Cited in `docs/research-notes/48-agent-traces.md` and `docs/research-notes/49-agent-trace-approaches.md`. |
| **Parent optional** | An Event may have `parentId` when the log has it. Missing means unknown, not root. The IR stays a list. A tree is a later view. Do not invent parents. |
| **Fill when present** | An Event field is set only from the log. Unset means the file did not have it. Do not invent zeros. |
| **Skill invoke record** | A derived record that a Skill ran. Not an Event type. It has the Skill name, the detect signal, and a pointer at the source Event(s). Same job as Entire `SkillEvent`. Unused and Review read this list. _Avoid_: synthetic `type=skill` Event; Entire collapse/UI flags. |
| **Skill signals (this pass)** | Only proven signals: Claude Skill tool, slash command, Grok titles/paths. Cursor, Codex, Copilot stay empty. No Pi adapter. Named like Entire (`skill_tool_use`, `prompt_slash_command`). |
| **Window (this pass)** | Review, unused, and `dora sessions` still use the Review window (last 10, 30 days). No full-corpus walk. |
| **Tool pair** | A tool is two Events: `tool_call` and `tool_result`, joined by `toolCallId`. Inline join is a later view. |
| **ATIF (this pass)** | Map only. Event fields stay ATIF-shaped. No emit. No ingest. No atifact dependency. |
| **Token pressure (this pass)** | Review reports token-pressure from Sessions (Entire-style advice: cache-read, call volume, long session). Not unused. Not remove-candidate. |
| **Session health** | A separate block on Review about the Session (token pressure). Not a Finding. Finding stays a Skill-check outcome. |
| **Token-pressure signals (this pass)** | Only what we can fill: cache-read share (when present), tool/assistant call count, user turn count. No context-window %. No checkpoints. |
| **This pass ships** | Adapters emit Events. Session summary and Skill invoke records are derived. Unused reads those records. Review adds a Session health block. Same verbs. No new `analyse` command. |
| **Token-pressure thresholds** | Entire’s numbers: cache-read ≥ 80% of tokens, call count ≥ 20, user turns ≥ 10. |

_Avoid_: shipping a warehouse (Polars / Parquet / Hub) this pass; calling this pass “session analysis”; keeping a thin IR that cannot support Later analyse; treating SessionPrimitives as the foundation; putting Content in the glossary.

This grill is **closed**. Spec: https://github.com/saif-shines/doraval/issues/51. Tickets: [#52](https://github.com/saif-shines/doraval/issues/52), [#53](https://github.com/saif-shines/doraval/issues/53), [#54](https://github.com/saif-shines/doraval/issues/54), [#55](https://github.com/saif-shines/doraval/issues/55). ADR: `docs/adr/0007-event-list-is-session-ir.md`.

## CLI-structure pass (this grill)

| Term | Meaning |
|------|---------|
| **This pass** | Empty argv prints `--help`. Delete `agent-help`. JSON map is `dora --help --json`. Text `--help` is a **short first page**. Help polish. `reconcile` becomes **Conflicts**. Delete `providers` (the spec dump). Keep version bump as `dora plugin bump`. Delete top-level `new`. The word stays `new` on the noun (`dora skill new`). Nouns are **singular**. Bare noun groups **list**. **Grow** = tidy existing verbs and flags. Old names are a **hard break** (exit `2` + Next). No aliases. Keep `dora config`. |
| **Conflicts** | The later write that settles cross-agent contradictions in shared `AGENTS.md`. Old verb `reconcile`. _Avoid_: reconcile (legacy name). |
| **Grow (this pass)** | Same commands, same jobs, clearer names and flag patterns. Full flag audit. Rule is **C**: dialect + escape test. _Avoid_: adding verbs to look like agent-browser; splitting Review. |
| **Dialect flags** | Same on every product command: `--json` (machine output) and `--cwd` (which repo). `--ci` still implies JSON. `--format json` may stay as the old spelling. _Avoid_: a third output mode; `--json` on only some verbs. |
| **Write flags** | `--yes` or `--dry-run`. `conflicts` drops `--apply`. |
| **Escape test** | If a human sees a prompt or picker, a Runner must have `--yes`, `--dry-run`, `--json`, or an id. Entire’s fallback rule. |
| **Job flags** | Belong on one verb (`--quick`, `--fail-on`, `skill --for`). |
| **Dead flags** | `review --for` and `review --agent` go away. They do not filter. |
| **Create-on-noun** | You create a Skill with `dora skill new` (same for rule, agent, plugin). Not a top-level grab-bag. _Avoid_: `dora new`. |
| **Agent group** | `dora agent` lists Subagents. `dora agent new` scaffolds one. |
| **Plugin group** | `dora plugin` lists Plugins in the repo. `dora plugin new` scaffolds one. `dora plugin bump` raises plugin and marketplace semver. Review of a Plugin is still `dora review <plugin-root>`. _Avoid_: `dora plugin review`; top-level `dora bump`; `dora providers`. |
| **Bare group lists** | `dora skill`, `dora memory`, `dora session`, `dora rule`, `dora config`, `dora agent`, `dora plugin` list. They do not dump usage. They do not open a hub. |
| **Singular nouns** | CLI groups are singular: `skill`, `rule`, `session`, `memory`, `config`, `agent`, `plugin`. Old `rules` and `sessions` are a hard break. _Avoid_: `dora rules`; `dora sessions`. |
| **Skill list** | Bare `dora skill` lists every Authored and Global Skill (name, origin, unused mark). `dora skill unused` lists unused Skills. Remove candidates are never invoked and not a Recent install. _Avoid_: bare skill = unused only. |

Grill for this pass is **closed**. Spec: https://github.com/saif-shines/doraval/issues/56. Tickets: [#57](https://github.com/saif-shines/doraval/issues/57), [#58](https://github.com/saif-shines/doraval/issues/58), [#59](https://github.com/saif-shines/doraval/issues/59), [#60](https://github.com/saif-shines/doraval/issues/60). ADRs: `docs/adr/0008-empty-argv-prints-help.md`, `docs/adr/0009-help-json-is-the-map.md` (supersedes 0004).

**`llms.txt`:** generated from the site. Fix the pages. Do not hand-write a second index.

_Avoid_: one “you” for both on a **Reader** page; an agent page that still talks to a human (“use with your agent”); leading with `--format json` before a `--quick` review. Top-level `--help` is allowed to say “for agents.”

**Interactive gate:** A TTY confirm before work. A human on a real terminal still sees it. A caller we treat as an agent does not. Detection is an env/TTY rule, not a new flag. See `docs/adr/0002-agent-skips-scan-prompt.md`.

**Write gate:** `fix`, `conflicts`, and `memory promote` write files. A detected agent that omits `--yes` / `--dry-run` gets exit `2` and a Next line. No prompt. No write. See `docs/adr/0003-agent-write-needs-flag.md`.

**Hard break (this pass):** `dora new`, `dora reconcile`, `dora agent-help`, `dora rules`, `dora sessions`, `dora bump`, and `dora providers` exit `2` with one Next line. They do not run. No hidden alias. _Avoid_: deprecation aliases.

## Unused-scope pass (this grill)

Grill is **closed**. Not shipped. Spec: https://github.com/saif-shines/doraval/issues/61. Tickets: [#62](https://github.com/saif-shines/doraval/issues/62), [#63](https://github.com/saif-shines/doraval/issues/63), [#64](https://github.com/saif-shines/doraval/issues/64), [#65](https://github.com/saif-shines/doraval/issues/65). ADR: `docs/adr/0010-two-session-loads.md`. Companion to ADR 0006.

| Term | Meaning |
|------|---------|
| **Unused scope** | One unused audit names one Skill set and one Session set. The two must match. _Avoid_: mixing Global Skills with one project’s Sessions; “all Skills combined.” |
| **Project unused** | Authored Skills + Project load. A Global Skill is not a Remove candidate here (ADR 0006). Review and `dora session` use this load. |
| **Global unused** | Unused over Global Skills (and Plugin unused). Evidence is Global load. Verb is `dora skill unused --global`. Not shipped. Does not weaken ADR 0006 for Project unused. _Avoid_: home unused (say Global); a second unused verb. |
| **Standalone Skill** | A Skill that is not Plugin-owned. Unused may name it. _Avoid_: individual; loose Skill. |
| **Owned Plugin** | A Plugin whose files the user can edit. Not Imported. Unused may recommend Remove of an unused child Skill. _Avoid_: treating cache / `node_modules` as owned. |
| **Plugin unused** | Unused names unused child Skills inside a Plugin. If every child is unused, unused names the Plugin only. Unused only suggests. It does not Remove. Remove of a child is a later named write, and only on an Owned Plugin. Imported cache: a count on the unused table, not a name dump. Do not remove. |
| **Install age** | Time since that Skill or Plugin landed on disk. Default three months. A child Skill uses its `SKILL.md` time. A Plugin row uses `plugin.json` time. Under the threshold, unused says it is recent. It is not a Remove candidate. _Avoid_: using the Review window as Install age; one mtime for every child. |

_Avoid_: treating Imported (plugin cache / `node_modules`) as Global; a third mixed audit.

## Judgment-loop pass (this grill)

Grill is **closed**. Slice 1 shipped as #70 / #71. Slice 2 rewrite policy is in the shipped Skill (Warp skill-improvements, not a second Skill).

| Term | Meaning |
|------|---------|
| **This pass** | Two slices. Slice 1: richer Brief + do not skip. Slice 2: rewrite policy in the shipped Skill. One shipped Skill. Authored only. Unused / Scan / Sessions stay on their own verbs. |
| **Parked** | (1) Copy or refresh the shipped Doraval Skill onto disk. (2) Global Judgment writes. (3) Memory overhaul. (4) One packet that dumps unused + Scan + Sessions. |
| **Judgment write** | The Runner edits an Authored `SKILL.md` for Judgment items, then re-reviews. Allowed on a Plugin-owned Authored Skill (same as Skill-path fix). The human still owns Remove, Restore, and `memory promote`. This supersedes the agent-contract line “the human still owns judgment” for this pass. |
| **Judgment** | A Finding that `dora fix --yes` will not write. The Runner reads Brief, does the Judgment write, then re-reviews. |
| **Brief** | `dora fix --brief`. Must include each Judgment item’s rule code, `docUrl`, severity, and one rewrite hint, plus the current `SKILL.md`. No unused / Scan / Sessions dump. |
| **Brief JSON** | `judgment` is a list of objects: `{code, message, docUrl, severity, hint}`. Not a list of strings. Hard break. One shape long-term. |
| **Pass test (this pass)** | A cold Runner with only the shipped Skill runs Review, mechanical Fix, Brief, Judgment write, then re-review. **exit 0**. It does not ask the human. |
| **Rewrite policy** | **Replace:** name the rule, write the smallest wording, one home, Brief span only. Skill already states the rule → show the Finding. Authored files only. |
| **Hint** | Finding.hint if set, else the generic fallback: edit only the named span; leave the rest. Rule catalog titles are not Hints. No Judge on `--brief`. |

_Avoid_: skill-doctor as a product name; a second Skill; `dora skill update`; calling this `dora update`; a Runner that Removes or promotes; Judgment write on a Global Skill; stuffing unused or Scan into `fix --brief`.

## Identity pass (this grill)

Grill is **closed**. #66. Shared understanding 2026-08-28. Shipped 2026-08-29. Live hello/ack on doraval.dev.

| Term | Meaning |
|------|---------|
| **This pass** | When logged in and Connected, a Probe: CLI sends hello, the UI shows it, the user acks, the CLI prints ack. Config stays on the machine. The UI does not write `config.yml`. The Probe server lives on doraval.dev. Proven by a live deploy. |
| **Probe** | A two-way hello/ack between the CLI and doraval.dev. Not Config sync. Not a Config editor. |
| **Config UI** | A screen on doraval.dev for Config. Viewing it requires login. A visitor sees Sign-up / login, not Config. Not this pass. |
| **Destination** | Config UI lives on doraval.dev. Local-only UI is not the destination. |
| **Connected** | The CLI holds an API key issued by doraval.dev and can talk to that account. Not “dora is on PATH.” This pass. |
| **Config sync** | The CLI pushes Config to doraval.dev after it is Connected. Not this pass. The site does not read the machine. |
| **Parked identity** | Config sync, Config UI. Later: observability. Not Memory overhaul. |
| **Sign-up** | A human creates an account with Scalekit OAuth. Not a Runner login. Not a Session. |
| **API auth** | A key from doraval.dev. Stored in Config (`dora config`), next to Judge keys. Used to call the hosted API. Never pushed back to the site. |
| **Coming soon** | A visible stub for a later identity feature. Not a working Sign-up. |

_Avoid_: calling a login a Session; treating “dora is installed” as Connected; a local UI as the destination.

## Harness (shipped)

`dora harness` is the front desk. The Runtime ticks the Loop. Today the Runtime is Hermes. 2026-08-31.

| Term | Meaning |
|------|---------|
| **Routine** | Saved folder at `~/.dora/harness/<slug>/`. The only product object. _Avoid_: pack. |
| **Loop** | The same unattended prompt on an interval. The Runtime's timer. Default 1 hour. |
| **Tick** | One unattended run of a Loop. The Runtime starts it on the interval. Not the one-pass test. _Avoid_: night tick as a second object. |
| **Runtime** | The background agent that ticks a Loop. Today that agent is Hermes. Dora prints that Runtime's watch commands. _Avoid_: calling Hermes the product; a second Runtime in this pass. |
| **Max tick** | One-pass wall clock via the Runtime. Default 10 minutes. Night idle cap is the Runtime's idle timeout (Hermes: `HERMES_CRON_TIMEOUT`, default 600s). |
| **Harness** | Verbs: `new`, `boot`, `pause`, `resume`, `list`, `open`. |
| **Skill script** | A helper file inside a Skill folder. The Skill names the path. The routine has no top-level scripts directory. _Avoid_: routine script; Hermes `--script`. |
| **Fixed step** | A deterministic routine step stored in a Skill. `prompt.md` names that Skill. It does not repeat the step. _Avoid_: programmatize as a noun; Judgment (that word is a Dora Finding). |

_Avoid_: Dora on the OAuth / magic-link path; Slack, Discord, or Webflow in the harness; writing loop terms into kit CONTEXT.md.

## Naming debt (intentional)

- **`JournalConfig` / `journal:`** — historical. Prefer saying **config** in docs and new code comments. Full rename is not required for correctness.
- **`E-VAL-*` / `E-SCAN-*`** — older scan/error codes. New mechanical skill issues should stamp **rule codes** (`R0xx`) where a binding exists.
- **`agent-invoke`** — CLI agent spawn for skill exercise / prompt-gen. **Not** the judge path (judge is API or delegate only).

## Architecture vocabulary

When designing modules: **module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality** (see codebase-design skill). Prefer one deep module per product concept (especially **Judge**).
