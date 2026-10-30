# 0010: One store for the simulator, with replay for timeline jumps

## Context

Phase 2 needs the editor, both machine views, the memory grid, the run bar and the input and
output panels to agree at all times, including when the learner pauses, switches view or drags
the timeline in the middle of an animation.

## Options

1. React state spread across components.
2. One store outside React that every panel reads from.

## Choice

One vanilla zustand store (`apps/web/src/sim/store.ts`) holds the source, the assembled program,
the machine state, the history and the playback settings. Components read slices with
`useSimState`. Views never read the engine directly: they get an `Activity` (what the last
action did) from `activityOf` and draw from the current state.

Stepping records into a `History`, so stepping back one micro-step is cheap. A timeline jump
replays the program from its starting state up to the chosen instruction. The engine is
deterministic, so the replay always lands on the same state. Inputs given while the program was
waiting are copied into the starting state, so later replays read them too.

## Reason

With one source of truth, an animation can only show what has already happened. Pausing or
switching view mid-animation leaves the true state on screen, which meets the Phase 2 criterion.
Replay costs at most a few milliseconds at the engine's speed, and it removes the need to keep
every state.
