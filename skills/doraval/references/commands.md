# dora — command reference

Global: exit `0` clean · `1` issues found · `2` could not run.
`--format json` (or `--ci`) on any command for machine output.

| Command | Job |
| --- | --- |
| `dora` / `dora scan` | Repo diagnosis: agent surfaces, skill health, contradictions, next actions |
| `dora review [path]` | 4-tier gate: structure → heuristics → LLM → sessions (tiers skip if unavailable) |
| `dora fix [path]` | Apply mechanical fixes; emit briefs for judgement fixes |
| `dora new --for <agent>` | Scaffold a skill, rule, agent, or plugin |
| `dora memory` | Principles that stick; enforce in review; promote to AGENTS.md |
| `dora reconcile` | Settle cross-agent contradictions (interactive or `--apply`) |
| `dora sessions` | List / show recent agent sessions |

## scan (bare `dora`)
Flags: `--cwd <dir>` · `--format table|json` · `--ci`
```
dora
dora scan --cwd /path/to/repo --format json
```

## review
Flags: `--quick` (tiers 1–2, no LLM) · `--deep` (require LLM) · `--all` (every
skill) · `--fail-on error|warning` (default `error`) · `--format` · `--ci`
```
dora review .
dora review --all --quick --ci
dora review --deep ./skills/foo      # exit 2 if no judge available
```

## fix
Flags: `--yes` (apply without prompting) · `--dry-run` (preview only) ·
`--brief` (agent-ready prompt for judgement fixes) · `--format` · `--ci`
```
dora fix . --dry-run
dora fix .
dora fix --brief
```

## memory
```
dora memory add "Run tests before shipping skill changes" --weight 8
dora memory list
dora memory promote                 # hard rules → AGENTS.md (diff + confirm)
dora memory context --json          # for hooks
```

## reconcile
```
dora reconcile --dry-run
dora reconcile --apply
```

Machine manifest (all commands, flags, exit codes) for programmatic use:
`dora --capabilities` → JSON.
