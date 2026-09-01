---
name: ask-dora
description: >-
  Use when the teammate types /ask-dora, or asks any Dora question, a
  routine idea, a pocket job, dora harness new, or a connector catalog
  question.
disable-model-invocation: true
---

# ask-dora

User-invoked router for an internal teammate. One name. Use a primitive. Do not hold that primitive's craft here.

## Empty

Print this map. Then stop.

```
Dora jobs: review, fix, unused, scan. Load review-with-dora.
Routine flow: a routine, a loop, recurring, a routine idea, a pocket job, or harness new.
  Load grilling-for-routine. Night prompt: writing-for-routine.
After a routine exists: dora harness boot, pause, resume, list, open.
If Hermes is missing: print official install steps. Dora does not install Hermes.
If a Scalekit AgentKit skill is missing: install scalekit-inc/authstack, then reload skills.
```

## Route

1. Read the ask.
2. If a routine already exists and the ask is boot, pause, resume, list, open, or watch: name that `dora harness` verb. Do not load the grill.
3. If it is a routine, a loop, recurring, a routine idea, a pocket job, or `dora harness new`: load `grilling-for-routine`. Done: that skill is loaded.
4. If it is a Dora job (review, fix, unused, scan): load `review-with-dora`. Done: that skill is loaded.
5. If the ask is only the public connector catalog (what exists, tool names):
   If `discover-connectors` is on disk: load it. Done.
   If missing: print official install. Stop.
6. If the ask is add or configure a Scalekit dashboard **connection**:
   If `setup-agentkit` is on disk: load it. Done.
   If missing: print official install. Stop.
7. If the ask is a **connected account**, OAuth link, or calling Slack/GitHub as that account:
   If `integrate-agentkit` is on disk: load it. Done.
   If missing: print official install. Stop.
8. Else: name the matching `dora` verb from `dora --help --json`. Done: the teammate has the next command.

Look up facts (skill on disk, Hermes present, AgentKit skills present). Leave slug, connector, and interval to the human.
If Hermes is missing and the ask needs a Tick or boot: print official install steps. Do not fake a pass.

`discover-connectors` is the public catalog only. It does not configure the dashboard.

When the needed AgentKit skill is missing:

```
Install Scalekit authstack. Follow:
https://docs.scalekit.com/dev-kit/build-with-ai/
npx skills add scalekit-inc/authstack
Then reload skills or restart the session and try again.
```

Dora does not install authstack. Dora does not teach the dashboard.

MUST print the map when the ask is empty.
MUST load `review-with-dora` for a Dora job.
MUST load `grilling-for-routine` for a routine, a loop, recurring, a routine idea, a pocket job, or harness new.
MUST name `dora harness` boot/pause/resume/list/open when a routine already exists.
MUST NOT load the grill for those existing-routine verbs.
MUST load `discover-connectors` only for a public catalog ask, when that skill is on disk.
MUST load `setup-agentkit` for a dashboard connection ask, when that skill is on disk.
MUST load `integrate-agentkit` for a connected-account ask, when that skill is on disk.
MUST print the official authstack install and stop when the needed AgentKit skill is missing.
MUST NOT invent a connector catalog or dashboard steps.
MUST NOT hold the review loop, the grill, the pocket check, or the night-prompt craft.
