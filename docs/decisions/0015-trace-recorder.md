# 0015: How the trace is recorded

## Context

The trace table, the memory heatmap and the flow graph's loop counts all need a record of the
run. Instant runs produce no events, and the learner can step back or jump on the timeline at
any moment.

## Options

1. Record events as they happen, and throw the record away after a jump.
2. Follow the machine: record by replaying from the last recorded instruction.

## Choice

`Trace` (`packages/engine/src/insight/trace.ts`) follows the machine. After every move the store
calls `trace.syncTo(state.cycles)`:

- Going forward, it replays the missing instructions with `step()` and records one row each.
- Going back, it drops the later rows and subtracts their counts. It keeps a keyframe every
  1,000 rows, so it never replays more than 1,000 instructions to find its new position.
- Inputs given while the machine waited are copied into the trace, so replays read them too.

A row is recorded when an instruction completes. Heat counts and trace rows therefore cover
completed instructions only; the instruction in progress is shown by the live highlights.

The trace keeps the first 10,000 rows. Recording runs at about 190,000 instructions a second,
so 10,000 rows take about 55 ms after an instant run. 100,000 rows took about half a second,
which would freeze the page.

## Reason

Following the machine gives the same answer however the learner got there, which is easy to
test: a property-style test compares stepping back and forward with a fresh trace. Every row is
also checked against the fast core for all 37 reference programs in every dialect.
