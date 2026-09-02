---
name: grilling-for-routine
description: >-
  Use when ask-dora routes a routine idea, when running dora harness new,
  or when grilling a loop-able idea into a routine. Collect skills to run,
  skills to refer to, and the Scalekit Agent Gateway MCP URL. After one
  good one-pass, may freeze a deterministic step as a Fixed step.
---

# grilling-for-routine

Use this grill with an internal teammate. Turn a routine idea into a routine.
The Runtime ticks the Loop. Today the Runtime is Hermes. Do not pick a sample product.

## Loop-able

First check: can the same prompt run on an interval?

Loop-able: a poll, a scan, or a check that can repeat with no human on each Tick.

Not loop-able: a webhook, a push listener, a one-off, or a job that needs a human every Tick.

If not loop-able: say why. Do not write a routine folder. If it is a Dora job, load review-with-dora. Stop.

## Pocket

Size check. Not a new object. The saved thing is still a Routine.

Pocket: one job, one machine, one user. The night prompt is specific enough to Tick.

Not pocket: a fleet, a general assistant, or a vague idea.

If not pocket: say why. Keep asking until the night prompt is one specific job. If it cannot be one job: do not write a routine folder.

## Fixed step

Second preference. Optional. A small loop-able job can ship with `prompt.md` only.

After one good one-pass, offer to freeze a deterministic step into a Skill. A decision step stays in `prompt.md`. The grill may also change `prompt.md` with no new Skill.

Before a freeze, check the one-pass. Do this in the grill only. Do not load implement or code-review. A Tick never runs this check.

- Name one seam you can see: output, a file, or a list.
- State an expected result from that one-pass, not from the draft Skill.
- If you cannot name that result, the step is not deterministic. Leave it in `prompt.md`.
- Spec check: did the one-pass do what `prompt.md` said, or did the agent invent? If it invented, do not freeze.

The grill drafts. The human accepts. A Tick never writes. The one-pass does not author files.

Add a new Skill only before the first save. Draft it in a temp folder. Pass that temp path as `--skills-run` so the folder writer copies it.

After save, update only `prompt.md` and the Skill copy. Do not add a new Skill after save.

Refuse Hermes `--script` and `--no-agent` as the freeze path. Those flags cannot call Scalekit MCP tools. A Skill script is local work only.

Load `writing-for-routine` for `prompt.md` and the Fixed-step Skill. Dora appends the pocket-agent footer at run. Do not put it in `prompt.md`. A Tick has no last chat. That skill names the skip store.

## Connectors

Load `discover-connectors` (Scalekit) only to look up the live public catalog. Say what exists. That skill does not configure the dashboard.

If the teammate needs to add or configure a **connection** in the Scalekit dashboard: load `setup-agentkit` when it is on disk.

If `discover-connectors` or `setup-agentkit` is missing: print official install, then stop. Do not invent a catalog. Do not invent dashboard steps.

```
https://docs.scalekit.com/dev-kit/build-with-ai/
npx skills add scalekit-inc/authstack
```

Then tell the teammate to reload skills or restart the session and try again. Dora does not install authstack.

An interval job cannot do a push, a webhook, or a human in the loop every tick. Say so when the idea needs one of those.

## Gate

Collect all three before you write the unattended prompt:

1. Skills to **run** (optional extra SKILL.md folders the night pass loads).
   Say **none** if no extra Skill is needed.
2. Skills to **refer to** (optional folders the prompt may cite).
   Say **none** if none.
3. Scalekit Agent Gateway **MCP URL**.
   Most jobs need this. Say **none** if the job is a Skill script plus local creds only.
   Slack, GitHub, and other MCP connectors live here. A connector is not a skill.

A default shared MCP URL may already be saved. Reuse it. Ask before you override it for this routine.
`--mcp-url none` writes a routine with no Agent Gateway.

If MCP is **none**: skip the connector check and skip Hermes MCP login.
After save, the teammate puts secrets in `~/.dora/harness/<slug>/.env`.
Dora does not copy `.env` from the original skill. Dora does not print secrets.
A Skill script stays inside the copied Skill. The routine has no top-level scripts directory.

If no matching skill is on disk, do not invent one. Offer **none**, a local path, or a GitHub URL. Do not treat a missing Slack or GitHub skill as a blocker.

## Routine copy

A skill source is a name, a local path, or a GitHub URL.

Name lookup: project `skills/`, then home skills, then ask for a path or a GitHub URL. Do not invent a registry.

Dora copies each skill folder into the routine. Night-pass edits land on the copy. Do not write the original.

Offer `dora review --quick` on each copy. The teammate can skip.

## Order

1. Run the loop-able check.
2. Run the pocket check. Ask until the night prompt is one specific job.
3. Collect the gate. Offer a readable slug. The teammate picks or renames it.
4. If MCP is not none: run the connector check. If MCP is none: skip it.
5. Load `writing-for-routine`. Write `prompt.md`.
6. Print the one-pass command. If Hermes is present, offer to run it. If Hermes is missing, print official install steps. Do not fake a pass. The one-pass does not author files.
7. After one good one-pass, run the freeze check. Load `writing-for-routine` again. Update `prompt.md`. Offer a Fixed step only if the seam, the expected result, and the spec check pass. Draft that Skill in a temp folder. The human accepts. Another one-pass is allowed.
8. Write the routine folder only after that pass, or after the teammate accepts the printed command. Save copies the skills into the routine. Then offer `dora review --quick` on each copy. The teammate can skip.
9. After save, update only `prompt.md` and the Skill copy. Do not add a new Skill.
10. If MCP is none: skip login. Creds stay in the routine folder.
    If MCP is set: register Scalekit on Hermes, then login.
   Boot registers it: `dora harness boot <slug>`.
   The same add is `hermes mcp add scalekit --url <mcp-url> --auth oauth` in a real terminal.
   Login without that add fails: server not found.
   After the add, the teammate runs `hermes mcp login scalekit` in a real terminal.
   Done-when: login is the next line only after boot or that add.
   Dora prints Runtime watch commands after boot, list, pause, and resume. Do not invent a Dora logs verb.
   Dora does not run login. Dora does not edit `~/.hermes/config.yaml`.
   If a refresh token dies, run that login again. If the Scalekit connected account is dead, open the provider link again.

Do not ask for the loop interval during this grill. Default is 1 hour. Ask after a good run.

```bash
dora harness new --accept --yes --slug <slug> --prompt-file <prompt.md> --mcp-url <url> --skills-run <name|path|url> --skills-refer <name|path|url>
```

MUST run the loop-able check first.
MUST run the pocket check. One job, one machine, one user. Night prompt specific.
MUST treat Fixed step as optional and second.
MUST freeze only after one good one-pass, and only if the step is deterministic.
MUST name a visible seam and an expected result from the one-pass before a freeze.
MUST NOT freeze when the one-pass invented a step.
MUST NOT load implement or code-review on a Tick.
MUST draft. MUST wait for human accept. A Tick never writes.
MUST NOT let the one-pass author files.
MUST add a new Skill only before the first save, in a temp folder.
MUST update only `prompt.md` and the Skill copy after save.
MUST NOT use Hermes `--script` or `--no-agent` as the freeze path.
MUST collect the gate before save.
MUST accept none for skills to run and skills to refer.
MUST accept none for MCP URL.
MUST skip Hermes MCP login when MCP is none.
MUST NOT copy `.env` or secrets from the original skill.
MUST tell the teammate to put secrets in the routine folder when MCP is none.
MUST copy named skills into the routine.
MUST NOT require a skill because a connector exists.
MUST NOT write the original skill directory.
MUST NOT invent a registry, a slug, a connector, a connector catalog, or a loop interval.
MUST print the official authstack install when `discover-connectors` or `setup-agentkit` is missing.
MUST register scalekit with boot or `hermes mcp add` before `hermes mcp login scalekit`.
MUST NOT run or tell login before that add.
MUST NOT edit Hermes config.
MUST NOT write the folder when the idea is not loop-able.
MUST NOT write the folder when the idea is not pocket.
MUST NOT write the folder before the one pass or an accepted printed command.
