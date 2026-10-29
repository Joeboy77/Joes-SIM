# 0007: History granularity and limits

## Context

Learners step backwards by instruction and by micro-step, and scrub a timeline (brief, 4.3).

## Choice

- History records every **micro-step** as a diff (changed registers, changed mailboxes, appended
  outputs and inputs) together with its events.
- A full keyframe is stored every 1,000 **instructions**. Rebuilding any position replays at
  most about 1,000 instructions of diffs.
- The limit (default 200,000) counts **instructions**. When it is passed, the oldest stretch up to
  the next keyframe is dropped and `history.dropped` says how many positions went, so the
  interface can tell the learner.
- Recording after going back discards the old future: the run branches.
- An input typed in while the machine waits becomes part of the next recorded step, so stepping
  back past it removes it again.

## Reason

Micro-step diffs are tiny (one or two fields), so recording every one costs little and makes
micro-step reverse playback exact. Counting the limit in instructions matches how learners think
about a run.
