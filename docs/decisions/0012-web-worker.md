# 0012: Running the engine in a web worker

## Context

Instant runs can take millions of instructions, and the infinite-loop look-ahead runs ahead of
the visible machine. Neither should freeze the page.

## Choice

`apps/web/src/sim/engine.worker.ts` runs `run()` on a copy of the state. `runOffThread` in
`runner.ts` sends the request and returns a promise. If workers are not available, or the worker
fails, the run happens on the main thread instead, and any runs that were waiting are finished
there, so the simulator is never left busy. Fast and slower speeds step on the main thread,
because each step is far shorter than a frame.

## Reason

Workers keep the page responsive for long runs at no cost to the step-by-step speeds. The
fallback means the simulator still works in old browsers and embedded webviews.
