---
name: ask-dora
description: >-
  Use when the teammate types /ask-dora, or asks any Dora question, a
  routine idea, a pocket job, or dora harness new.
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
```

## Route

1. Read the ask.
2. If a routine already exists and the ask is boot, pause, resume, list, open, or watch: name that `dora harness` verb. Do not load the grill.
3. If it is a routine, a loop, recurring, a routine idea, a pocket job, or `dora harness new`: load `grilling-for-routine`. Done: that skill is loaded.
4. If it is a Dora job (review, fix, unused, scan): load `review-with-dora`. Done: that skill is loaded.
5. Else: name the matching `dora` verb from `dora --help --json`. Done: the teammate has the next command.

Look up facts (skill on disk, Hermes present). Leave slug, connector, and interval to the human.
If Hermes is missing and the ask needs a Tick or boot: print official install steps. Do not fake a pass.

MUST print the map when the ask is empty.
MUST load `review-with-dora` for a Dora job.
MUST load `grilling-for-routine` for a routine, a loop, recurring, a routine idea, a pocket job, or harness new.
MUST name `dora harness` boot/pause/resume/list/open when a routine already exists.
MUST NOT load the grill for those existing-routine verbs.
MUST NOT hold the review loop, the grill, the pocket check, or the night-prompt craft.
