# dora — verbs

Flags live on `--help`. Run `dora <command> --help`. Do not copy a flag catalog here.

Live command map (commands, flags, exit codes): `dora agent-help` or `dora agent-help --json`.

| Command | Job |
| --- | --- |
| `dora` / `dora scan` | Fast workspace check: surfaces, health, contradictions |
| `dora review [path]` | Quality gate: structure → heuristics → Judge → sessions |
| `dora fix [path]` | Mechanical fixes (`--yes`) or judgement briefs (`--brief`) |
| `dora new --for <agent>` | Scaffold a Skill, Rule, agent, or plugin |
| `dora skill remove` | Delete Authored or Quarantine Global (`--yes` / `--dry-run`) |
| `dora skill restore` | Restore a Quarantined Global Skill |
| `dora memory` | Principles that stick; promote to `AGENTS.md` |
| `dora reconcile` | Settle cross-agent contradictions |
| `dora sessions` | List / show recent agent sessions |

First Review is `dora review --quick`. Add `--format json` after Findings, when you will branch on fields.
