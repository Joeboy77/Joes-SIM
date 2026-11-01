# 0036: The multicore machine

## Context

Phase 8 adds two to four cores sharing one memory, three schedules, an atomic instruction for
locks (specified first, in [docs/specs/multicore.md](../specs/multicore.md)), race detection and
challenges about races.

## Decision

- **Steps are whole instructions.** The scheduler picks a core at the start of each instruction,
  and that core finishes it before another runs. Every instruction is therefore atomic, and races
  happen between instructions, which is where learners can see them (between LDA and STA).
- **The cores reuse the classic machine.** Each core is run as a classic machine over the shared
  memory and trays, so classic semantics hold on every core. Only TAS is new.
- **TAS is `460` + address**, a two-mailbox instruction in a 4xx family the extended machine does
  not use, so `DAT 400` stays invalid everywhere.
- **Manual choices are part of the run**, like key presses on the extended machine, so stepping
  back and replaying gives the same run. Choosing differently after stepping back replaces the
  later choices.
- **Race detection is a lockset check over the trace**: different cores, at least one write, no
  lock held by both. Lock mailboxes (those named by TAS) are not reported.
- **Looping is not proved endless on many cores.** A core spinning on a lock can be freed by
  another, so runs stop at the step budget instead.

## Consequences

The registers at the top level of the state mirror the core that ran last, so the existing
panels (narration, trace table, watch) keep working; the cores, the timeline and races have their
own panel. The pipeline and cache views show a single core, and say so on the multicore machine.
