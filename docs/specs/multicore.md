# The multicore machine

Several Little Men share one set of mailboxes (brief, Phase 8). Each **core** has its own
registers:

- PC, MAR, MDR, IR and ACC;
- the negative flag.

All cores share:

- the 100 mailboxes;
- the input tray;
- the output tray. Each output is tagged with the core that produced it.

Machine id: `multicore`. It has 2 to 4 cores, and each core runs the **classic** instruction set
of the chosen dialect, plus one atomic instruction, TAS.

## Where each core starts

Core 0 starts at mailbox 00, or at the label `core0` if the program has one. Cores 1, 2 and 3
start at the labels `core1`, `core2` and `core3`; a core with no label starts at 00 too, so cores
can also all run the same code.

## Steps and scheduling

The machine moves **one whole instruction of one core per step**. Instructions never interleave
inside each other. This makes every single instruction atomic, so a race can only happen
**between** instructions. For example, another core can run between one core's `LDA total` and its
`STA total`.

The scheduler chooses which core runs next, from the cores that can run (status `ready`). There
are three schedules.

| Schedule    | Which core runs next                                                                                            |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| Round-robin | Each core in turn runs `quantum` instructions (1 to 10, default 1), then the next one runs                      |
| Random      | A ready core picked at random from a **seed** (xorshift32), so the same seed always gives the same interleaving |
| Manual      | The learner picks the core for every step                                                                       |

**Manual choices** are recorded in the run like key presses on the extended machine. Stepping
back and replaying therefore gives the same run, and share links carry the choices.

A core that runs **HLT** stops; the others carry on.

A core that runs **INP** with the input tray empty **waits**. The machine waits for input only
when every core that has not halted is waiting.

The machine:

- **halts** when every core has halted;
- **stops with an error** as soon as any core does, for example on an invalid instruction.

**Cycles** count the steps of all cores together. Each core also counts its own.

## The atomic instruction: TAS (test and set)

| Mnemonic | Code          | Words | What it does                                                             |
| -------- | ------------- | ----- | ------------------------------------------------------------------------ |
| TAS a    | 460 + address | 2     | In one step: ACC = mailbox a, then mailbox a = 1. The flag is set as LDA |

- TAS uses the extended machine's encoding style. It is a two-mailbox instruction in the 4xx
  space, in a family (46x) the extended machine does not use, so the two never clash.
- Every other 4xx stays an invalid instruction here. In particular 400 does, so the classic
  reference program that runs `DAT 400` still stops with an error.
- The assembler accepts TAS only for the multicore machine.

### Micro-steps

TAS takes 11 micro-steps:

1. Fetch and decode (5 steps).
2. `operand-fetch-address` and `operand-fetch-read`.
3. `operand-address`.
4. `operand-read` (MDR ← the old value).
5. `load-acc` (ACC ← MDR).
6. `store-write` (mailbox ← 1).

The read and the write happen in the same step, so no other core can run between them. That is
what "atomic" means.

### Building a lock with TAS

A **lock** is a mailbox holding 0 (free) or 1 (taken).

```
take    TAS lock        // old value into ACC; lock becomes 1
        BRZ got         // it was 0: the lock is ours
        BRA take        // it was 1: someone else has it, try again
got     ...             // the critical section
        LDA zero
        STA lock        // release: lock = 0
```

The same lock built from `LDA lock` / `STA lock` is **not** safe. Two cores can both read 0
before either writes 1. The race challenges show this.

## Race detection

Two accesses to the same mailbox **race** when all of these are true:

- they come from different cores;
- at least one of them writes;
- the two cores held no lock in common at the time.

The rules for locks:

- **Taking a lock.** A core holds lock `L` from a TAS on `L` that read 0 until it writes 0 to
  `L`.
- **Lock mailboxes.** Any mailbox a TAS in the program names is a lock mailbox. Lock mailboxes
  themselves are never reported.
- **What is compared.** For each mailbox the detector remembers the last write and each core's
  last read. A new access is compared with those.

Each race is reported once per mailbox, with:

- the step of each access;
- the two cores;
- whether each was a read or a write.

The simulator marks the mailbox and the steps on the timeline. This is a simple **lockset**
check:

- It can flag hand-offs that are made safe in other ways, for example with a flag variable.
- It never misses an unlocked write that another core reads or writes.

## What the views show

- **Datapath view.** The cores are drawn side by side, each with its registers, status and next
  instruction.
- **Story view.** Each Little Man has his own colour, pattern and name tag (Kofi, Kwame, Yaw,
  Kojo).
- **Timeline.** One coloured cell per step shows which core ran. Steps with a race are marked.
- **Memory grid.** It marks racing mailboxes.

## Acceptance tests

- **Determinism.** The same seed always gives the same interleaving, and a different seed can
  give a different one.
- **The classic race.** Two cores each add 1 to a shared total three times:
  - Round-robin with quantum 1 gives the wrong total (3).
  - Round-robin with quantum 3 gives 6.
  - Some seeds give the wrong total.
  - With a TAS lock, every schedule and every seed gives 6, and no race is reported.
- **Classic programs.** Every classic reference program run on core 0 gives the same outputs as
  on the classic machine. For this test, the other cores start on a mailbox holding HLT.
- **TAS.** It has tests of its micro-steps, its narration and its atomicity.
