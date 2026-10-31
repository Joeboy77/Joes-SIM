# 0029: Teacher packs

## Choice

- A pack is JSON: `format: "joes-sim-pack"`, `version: 1`, title, author, description, dialect
  and an ordered list of items. Items are headings, lessons, challenges or programs, each with an
  optional note.
- `parsePack` checks every part and refuses a damaged pack whole, with a plain reason.
- Packs are shared as a file or a link (`/packs/view?pack=…`, the whole pack compressed into the
  link). Learners can keep a pack on their device. Packs made or opened on a device are included
  in backups.
- The editor adds items from lists of lessons and challenges, or as headings and programs, and
  moves them up and down. It is deliberately simple.
- Learners' progress stays on their own devices; a teacher sees it only if a learner sends a
  backup.

## The DCIT 207 pack

It follows the course topics in section 9 of the brief that the current machines support. Topics
that need later machines (pipeline, cache, interrupts, multicore, RISC-V) are listed under
"Coming later" so learners know they are planned.
