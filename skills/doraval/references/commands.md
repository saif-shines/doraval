# dora — verbs

Flags live on `--help`. Run `dora <command> --help`. Do not copy a flag catalog here.

Live command map (commands, flags, exit codes): `dora --help --json`.

| Command | Job |
| --- | --- |
| `dora` | Short `--help`. First command is `dora review --quick`. |
| `dora scan` | Fast workspace map: surfaces, health, contradictions |
| `dora review [path]` | Quality gate: structure → heuristics → Judge → sessions. Full Review adds Session health (token pressure). `--quick` skips it. |
| `dora fix [path]` | Mechanical fixes (`--yes`) or judgement briefs (`--brief`) |
| `dora skill new` | Scaffold a Skill (`dora rule new`, `dora agent new`, `dora plugin new`) |
| `dora skill unused` | List Authored Skills that are Remove candidates |
| `dora skill remove` | Delete Authored or Quarantine Global (`--yes` / `--dry-run`) |
| `dora skill restore` | Restore a Quarantined Global Skill |
| `dora memory` | Principles that stick; promote to `AGENTS.md` |
| `dora conflicts` | Settle cross-agent contradictions |
| `dora session` | List / show recent agent sessions. `show` accepts a unique short id from the table. |

First Review is `dora review --quick`. Add `--format json` after Findings, when you will branch on fields.
