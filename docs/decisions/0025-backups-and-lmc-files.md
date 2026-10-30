# 0025: Backups and .lmc files

## Choice

- An `.lmc` file is the program's source with its dialect as a first-line comment,
  `// dialect: classic`. Files without that line (from other tools) open as they are, in the
  current dialect. Windows line endings are converted.
- A backup is one JSON file: `format: "joes-sim-backup"`, a `version`, every workspace file,
  all progress and which file was open.
- A backup is checked completely before anything changes. A damaged file, a file that is not a
  backup, or one from a newer version is refused with a plain message, and nothing is changed.
- Restoring replaces everything in the browser, after the learner confirms.

## Reason

Replacing rather than merging means a restored device matches the one the backup came from,
which is what moving to another device needs.
