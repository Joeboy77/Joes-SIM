# 0008: Infinite-loop detection

## Context

The brief (4.2) asks the engine to detect true infinite loops: when the full machine state
repeats with no input consumed, the program can never halt, and the app should say where the
loop began.

## Choice

- The state compared is memory, PC, ACC and the negative flag at instruction boundaries.
  MAR, MDR and IR are left out because they are overwritten before they are next read, so they
  cannot change the future. Outputs are left out because they never affect execution: a loop
  that prints forever still never halts.
- Brent's cycle-detection algorithm runs inside the fast run loop. It needs only one stored
  snapshot and finds a loop of length λ within about 2λ extra instructions. Reading an input
  restarts detection.
- Once a repeat is found, the engine replays from the start of the input-free stretch to find
  exactly where the loop begins. It reports `startCycle`, `startAddress` and `length`.
- A property test checks soundness on random programs: whenever a loop is reported, running
  without detection never stops, and one trip of the reported length returns to the same state.
  It also checks that detection never changes the result of a run that finishes.

## Reason

This is a proof, not a guess: repeated deterministic state means the program can never stop. No
step budget can give that kind of answer. The cost is small: about 12% slower in the performance
test, still about 50 times the brief's target.
