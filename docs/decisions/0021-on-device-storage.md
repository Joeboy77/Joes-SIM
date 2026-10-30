# 0021: Keeping work on the device

## Context

Phase 4 needs files, autosave and progress with no accounts and no database (brief, section 1).
Closing and reopening the browser must restore everything.

## Choice

- One IndexedDB database, `joes-sim`, with two stores: `files` (one record per workspace
  file) and `records` (progress, and which file is open). `apps/web/src/storage/`.
- The simulator saves 400 ms after the program, dialect or inputs change, and at once when the
  page is hidden or closed, so a quick close never loses the last edit.
- The simulator appears only after the saved work has loaded (a few milliseconds), so nothing
  the learner does is overwritten by the load.
- Progress updates run one after another in a queue, so two quick changes never overwrite each
  other. Progress saved by an older version is filled in with defaults when it loads.
- If IndexedDB is not available (some private windows), the simulator still works and says it
  cannot save.

## Reason

IndexedDB is the only browser store with room for many files, and it works offline. Keeping
the code small (no library) keeps the bundle small and the behaviour easy to test with
`fake-indexeddb`.
