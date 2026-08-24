# Bare `dora` prints `--help`

Empty `dora` used to run Scan. Every Start-here surface already named `dora review --quick` as the first job. Agent-browser and Entire-in-a-repo print help on empty argv; they do not run a job. We copy that shape. Scan stays `dora scan`. We do not run Review on empty argv (a whole-repo Review can prompt). Hard break: no alias back to Scan.
