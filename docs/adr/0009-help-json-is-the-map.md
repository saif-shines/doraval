# `dora --help --json` is the agent map

ADR 0001 rejected a second door. ADR 0004 added `dora agent-help` so `--help` could stay short. The Runner already reads `--help`. Two catalogs split the story. We delete the `agent-help` verb. Text `--help` stays a short first page (Start here + one-line verb list). The live machine map (same tree, `read-only` / `writes`) moves to `dora --help --json`. Per-command flags stay on `<cmd> --help`. Old `dora agent-help` is a hard break (exit `2` + Next).
