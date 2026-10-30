# 0018: The trace table and fill-in mode

## Choice

- Columns: step, mailbox, instruction, ACC, PC, negative flag, input, output, and any mailbox
  (chosen by label or number). By default the table shows step, instruction, ACC, PC, output
  and up to three labelled data mailboxes, which matches most exam trace tables.
- Values are shown after each instruction, as in exam tables.
- Instructions use the source's labels ("STA first"), like the learner's own code.
- Clicking a step number jumps there. CSV export includes every row; the screen shows the first
  1,000. Printing prints only the table.
- **Fill-in mode** traces the whole run (up to 200 rows) on its own, so the learner can fill the
  table before stepping, as in an exam. ACC, PC, flag, output and mailbox columns are hidden.
  Answers count as equal when they are the same number ("7" and "007"). A cell that should be
  empty counts only if the learner wrote something in it, so blank cells cannot inflate the
  score.

## Tests

Six trace tables worked out by hand (add, subtract in two dialects, countdown, echo until zero
and larger of two) match the generated ones.
