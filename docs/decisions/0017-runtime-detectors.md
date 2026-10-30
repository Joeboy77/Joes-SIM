# 0017: Mistakes found during a run, and going to their cause

## Context

Phase 3 adds the detectors that need a run (see 0009), tiered hints, and "Go to the step that
caused this".

## Choice

`detectRuntime` (`packages/engine/src/insight/runtime.ts`) reads the trace and the current state:

| Code                  | When it is reported                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `brp-on-zero`         | BRP branches on exactly 0, straight after a SUB. Reported as a note, because counting down to 0 is often intended.        |
| `ran-data`            | The machine runs a mailbox that the source wrote as DAT or left empty. Modifying an existing instruction is not reported. |
| `input-ran-out`       | INP waits for more inputs than were typed in.                                                                             |
| `inputs-left-over`    | The program halts with inputs never read.                                                                                 |
| `infinite-loop`       | The loop detector proves the program can never stop.                                                                      |
| `invalid-instruction` | The machine stops on a value that is not an instruction.                                                                  |

The cause is the instruction that wrote the mailbox, if any; otherwise the instruction that led
there; for a loop, the first step of the loop. "Go to" jumps to just before that instruction
runs, so pressing Step shows it happen.

Every finding, static or runtime, has three hints: a nudge, a pointer and the exact cause. The
learner reveals them one at a time.

## Reason

Hints that are wrong teach learners to ignore hints, so the rules stay narrow. Each detector
has two programs that trigger it and one that does not.
