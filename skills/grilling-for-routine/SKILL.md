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

## Fixed step

Second preference. Optional. A small loop-able job can ship with `prompt.md` only.

After one good one-pass, offer to freeze a deterministic step into a Skill. A decision step stays in `prompt.md`. The grill may also change `prompt.md` with no new Skill.

The grill drafts. The human accepts. A Tick never writes. The one-pass does not author files.

Add a new Skill only before the first save. Draft it in a temp folder. Pass that temp path as `--skills-run` so the folder writer copies it.

After save, update only `prompt.md` and the Skill copy. Do not add a new Skill after save.

Refuse Hermes `--script` and `--no-agent` as the freeze path. Those flags cannot call Scalekit MCP tools. A Skill script is local work only.

Load `writing-for-routine` for `prompt.md` and the Fixed-step Skill.

## Connectors

Load `discover-connectors` (Scalekit). Look up the live catalog. Say what exists. Say if a needed connector is missing. Do not vendor that catalog here.

An interval job cannot do a push, a webhook, or a human in the loop every tick. Say so when the idea needs one of those.

## Gate

Collect all three before you write the unattended prompt:

1. Skills to **run** (optional extra SKILL.md folders the night pass loads).
   Say **none** if the MCP tools are enough.
2. Skills to **refer to** (optional folders the prompt may cite).
   Say **none** if none.
3. Scalekit Agent Gateway **MCP URL** (required).
   Slack, GitHub, and other connectors live here. A connector is not a skill.

A default shared MCP URL may already be saved. Reuse it. Ask before you override it for this routine.

If no matching skill is on disk, do not invent one. Offer **none**, a local path, or a GitHub URL. Do not treat a missing Slack or GitHub skill as a blocker.

## Routine copy

A skill source is a name, a local path, or a GitHub URL.

Name lookup: project `skills/`, then home skills, then ask for a path or a GitHub URL. Do not invent a registry.

Dora copies each skill folder into the routine. Night-pass edits land on the copy. Do not write the original.

Offer `dora review --quick` on each copy. The teammate can skip.

## Order

1. Run the loop-able check.
2. Ask what the routine idea does until the night prompt is specific.
3. Collect the gate. Offer a readable slug. The teammate picks or renames it.
4. Run the connector check.
5. Load `writing-for-routine`. Write `prompt.md`.
6. Print the one-pass command. If Hermes is present, offer to run it. If Hermes is missing, print official install steps. Do not fake a pass. The one-pass does not author files.
7. After one good one-pass, load `writing-for-routine` again. Update `prompt.md`. Offer a Fixed step if a step is deterministic. Draft that Skill in a temp folder. The human accepts. Another one-pass is allowed.
8. Write the routine folder only after that pass, or after the teammate accepts the printed command. Save copies the skills into the routine. Then offer `dora review --quick` on each copy. The teammate can skip.
9. After save, update only `prompt.md` and the Skill copy. Do not add a new Skill.
10. Register Scalekit on Hermes, then login.
   Boot registers it: `dora harness boot <slug>`.
   The same add is `hermes mcp add scalekit --url <mcp-url> --auth oauth` in a real terminal.
   Login without that add fails: server not found.
   After the add, the teammate runs `hermes mcp login scalekit` in a real terminal.
   Done-when: login is the next line only after boot or that add.
   Dora does not run login. Dora does not edit `~/.hermes/config.yaml`.
   If a refresh token dies, run that login again. If the Scalekit connected account is dead, open the provider link again.

Do not ask for the loop interval during this grill. Default is 1 hour. Ask after a good run.

```bash
dora harness new --accept --yes --slug <slug> --prompt-file <prompt.md> --mcp-url <url> --skills-run <name|path|url> --skills-refer <name|path|url>
```

MUST run the loop-able check first.
MUST treat Fixed step as optional and second.
MUST freeze only after one good one-pass, and only if the step is deterministic.
MUST draft. MUST wait for human accept. A Tick never writes.
MUST NOT let the one-pass author files.
MUST add a new Skill only before the first save, in a temp folder.
MUST update only `prompt.md` and the Skill copy after save.
MUST NOT use Hermes `--script` or `--no-agent` as the freeze path.
MUST collect the gate before save.
MUST accept none for skills to run and skills to refer.
MUST copy named skills into the routine.
MUST NOT require a skill because a connector exists.
MUST NOT write the original skill directory.
MUST NOT invent a registry, a slug, a connector, or a loop interval.
MUST register scalekit with boot or `hermes mcp add` before `hermes mcp login scalekit`.
MUST NOT run or tell login before that add.
MUST NOT edit Hermes config.
MUST NOT write the folder when the idea is not loop-able.
MUST NOT write the folder before the one pass or an accepted printed command.
