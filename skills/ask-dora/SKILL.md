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
If discover-connectors is missing: install scalekit-inc/authstack, then reload skills.
```

## Route

1. Read the ask.
2. If a routine already exists and the ask is boot, pause, resume, list, open, or watch: name that `dora harness` verb. Do not load the grill.
3. If it is a routine, a loop, recurring, a routine idea, a pocket job, or `dora harness new`: load `grilling-for-routine`. Done: that skill is loaded.
4. If it is a Dora job (review, fix, unused, scan): load `review-with-dora`. Done: that skill is loaded.
5. If the ask is only about connectors (catalog, Slack, GitHub tools):
   If `discover-connectors` is on disk: load it. Done.
   If missing: print official install. Do not invent a catalog. Do not load the rest of authstack. Stop.
6. Else: name the matching `dora` verb from `dora --help --json`. Done: the teammate has the next command.

Look up facts (skill on disk, Hermes present, `discover-connectors` present). Leave slug, connector, and interval to the human.
If Hermes is missing and the ask needs a Tick or boot: print official install steps. Do not fake a pass.

When `discover-connectors` is missing:

```
Install Scalekit authstack. Follow:
https://docs.scalekit.com/dev-kit/build-with-ai/
npx skills add scalekit-inc/authstack
Then reload skills or restart the session and try again.
```

Dora does not install authstack.

MUST print the map when the ask is empty.
MUST load `review-with-dora` for a Dora job.
MUST load `grilling-for-routine` for a routine, a loop, recurring, a routine idea, a pocket job, or harness new.
MUST name `dora harness` boot/pause/resume/list/open when a routine already exists.
MUST NOT load the grill for those existing-routine verbs.
MUST load `discover-connectors` for a connector-only ask when that skill is on disk.
MUST print the official authstack install and stop when `discover-connectors` is missing.
MUST NOT invent a connector catalog.
MUST NOT load the rest of authstack.
MUST NOT hold the review loop, the grill, the pocket check, or the night-prompt craft.
