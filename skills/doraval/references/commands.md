# dora verbs

Flags live on `dora <command> --help`. The live map is `dora --help --json`.

| Command | Job |
| --- | --- |
| `dora` | Short `--help`. First job is `dora review --quick`. |
| `dora scan` | Workspace map: surfaces, health, contradictions |
| `dora review [path]` | Gate: structure → heuristics → Judge → sessions. Full Review adds Session health. `--quick` skips Judge and Session health. |
| `dora fix [path]` | Mechanical `--yes` or judgment `--brief` |
| `dora skill` | List Authored + Global Skills |
| `dora skill new` | Scaffold a Skill (`rule new`, `agent new`, `plugin new` on those nouns) |
| `dora skill unused` | Remove-candidate filter |
| `dora skill remove` / `restore` | Delete Authored or Quarantine / restore Global |
| `dora memory` | Principles; `promote` writes `AGENTS.md` |
| `dora conflicts` | Cross-agent contradictions (`--dry-run`, then `--yes`) |
| `dora session` | List / `show` recent Sessions (short id is enough if unique) |
| `dora config` | List / get / set. Judge keys: `dora config setup` |
| `dora plugin bump` | Plugin and marketplace semver |

Writes take `--yes` or `--dry-run`. Missing flag is **exit 2**.
Add `--format json` after Findings when you will branch on fields.

