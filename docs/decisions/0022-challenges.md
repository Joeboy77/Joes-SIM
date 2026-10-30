# 0022: Challenges, scores and the model solution

## Context

The brief (7.8, 8.1) asks for at least 40 challenges with tests run in the browser,
optimisation scores, tiered hints, solutions after a genuine attempt, and bug hunts.

## Choice

- 47 challenges in `packages/content/src/challenges/library.ts`, in the format of 8.1 with two
  additions: `kind` ("build" or "bug-hunt") and a `mailboxes` target.
- **Scores**: instructions in the program, mailboxes it fills, and cycles on the test that takes
  longest. Each best score is kept on its own.
- **Targets** are the model solution's own scores, so every target is achievable. A test checks
  that every solution passes and meets its targets exactly, and that every starter program
  assembles but does not already pass.
- Tests stop after 100,000 instructions, or when the loop detector proves a loop never ends.
- A failing test links to the simulator at the instruction where the output first differs (or
  where the run stopped, if an output is missing). The program goes in the URL fragment, which
  is never sent to a server.
- **The model solution** opens after solving, after three runs with code different from the
  starter, or after all three hints and one such run. Running the unchanged starter does not
  count as an attempt.

## Reason

Making the solution wait for real effort keeps it useful as a check rather than a shortcut,
without locking out a learner who is truly stuck.
