# dora verbs

Same order as `dora --help`. Flags: `dora <command> --help`. Map: `dora --help --json`.
Bare noun groups **list**. Create sits on the noun (`… new`).

| Command | Job |
| --- | --- |
| `dora` | Short `--help`. First job is `dora review --quick`. |
| `dora review [path]` | Gate: structure → heuristics → Judge → sessions. Full Review adds Session health. `--quick` skips Judge and Session health. |
| `dora fix [path]` | Mechanical `--yes`. Judgment `--brief` / `--json` (`message`, `severity`, `hint`, optional `code` / `docUrl`). |
| `dora scan` | Workspace map. Not the empty-argv default. |
| `dora skill` | List Authored + Global Skills |
| `dora skill unused` | Unused Skills. Remove candidates are never invoked and not a Recent install. `--global` is home Skills. `--last` / `--since` override the Review window for one run. |
| `dora skill remove` / `restore` | Delete Authored or Quarantine / restore Global |
| `dora skill new` | Scaffold a Skill |
| `dora rule` | List review rules |
| `dora rule new` | Scaffold a Rule |
| `dora session` | List Sessions. `show <id>` (short id is enough if unique) |
| `dora memory` | List principles. `add` / `promote` (`promote` writes `AGENTS.md`) |
| `dora conflicts` | Cross-agent contradictions (`--dry-run`, then `--yes`) |
| `dora config` | List keys. `get` / `set` / `setup`. Secret `set` needs `--yes` or `--dry-run`. `identity.api_key` is minted on doraval.dev/account. Never echo it. |
| `dora agent` | List Subagents |
| `dora agent new` | Scaffold a Subagent |
| `dora plugin` | List Plugins |
| `dora plugin new` | Scaffold a Plugin |
| `dora plugin bump` | Plugin and marketplace semver |
| `dora harness` | List routines at `~/.dora/harness/<slug>/`. |
| `dora harness new` | Start `ask-dora` / `grilling-for-routine`. `--accept --yes` writes the folder after the printed one-pass command. Run appends `Sent by pocket agent <slug>`. Night prompt may use a tick handoff when the destination cannot tell. |
| `dora harness boot <slug>` | Start the Hermes gateway and one cron job. Then run `hermes mcp login scalekit`. Dora prints Runtime watch commands: `hermes cron list`, `hermes cron runs`, `hermes logs`, `hermes dashboard`. Dora exits. |
| `dora harness pause <slug>` | Pause that job only. Gateway stays up. Dora prints Runtime watch commands. |
| `dora harness resume <slug>` | Start later ticks again. Dora prints Runtime watch commands. |
| `dora harness list` | Name slugs. Show running or paused. Dora prints Runtime watch commands. |
| `dora harness open <slug>` | Open that routine folder. No Runtime watch. |
| `dora update` | Update doraval |
| `dora probe` | POST hello; poll until ack or 60s timeout. Needs `identity.api_key`. Human clicks ack on `/account`. `--json` is `{status,id}`. |

Writes take `--yes` or `--dry-run`. Missing flag is **exit 2**.
Add `--format json` after Findings when you will branch on fields.

