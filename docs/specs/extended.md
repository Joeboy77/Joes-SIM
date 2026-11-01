# The extended machine

**Status: approved** (reviewed 1 November 2026, with the answers below to the open questions).
See [decision 0034](../decisions/0034-extended-machine.md).

The extended machine adds the following to the classic machine in [classic.md](classic.md):

- a stack;
- subroutines;
- indirect and indexed addressing;
- interrupts;
- virtual devices.

It is a separate machine (`extendedMachine`) behind the same interface, so the simulator, trace
table, narration and time travel work with it unchanged.

## Requirements

1. **Classic programs run unchanged.** Every classic reference program, in every dialect, gives
   the same outputs, cycles, final state and micro-step events on the extended machine as on the
   classic one. This is a property test.
2. Stack, PUSH, POP, CALL and RET.
3. Indirect and indexed addressing.
4. Interrupts: enable and disable, an interrupt vector, saving and restoring state, and return
   from interrupt.
5. Devices: text console, 16 by 16 pixel display, keyboard buffer, timer that raises
   interrupts, seven-segment display, beeper.
6. Deterministic. The same program, inputs and key presses always give the same run.

## The main choice: keep the 3-digit word and 100 mailboxes

The brief allows a wider word or more memory. This design uses **neither**:

- A word is still 3 digits, in the dialect's range.
- Memory is still 100 mailboxes, 00 to 99.

New instructions use the opcode 4, which no classic dialect uses. Instructions that need an
address take **two mailboxes**: the instruction, then the address.

**Why not a wider word?** We considered 4-digit words with 1,000 mailboxes and rejected it.
It would break requirement 1 in three ways:

- **Arithmetic would change.** In the Classic dialect, 999 + 1 wraps to 000. With 4-digit words
  it would give 1000. Programs that rely on the wrap (several challenges and the overflow lesson
  do) would behave differently.
- **Programs that build instructions would break.** Classic programs make instructions out of
  data. For example, `DAT 500` is "LDA 00", and adding 1 to it makes "LDA 01". This is how
  classic LMC walks through an array. With a different encoding, those constants would mean
  other instructions.
- **Memory would no longer fit on screen.** All 100 mailboxes fit in the 10 × 10 grid. Learners
  see the whole machine at once, and the heatmap, trace table and share links depend on that.
  1,000 mailboxes would need scrolling or paging.

**Why not more memory?** The pixel display has 256 pixels, and the console a screen of text.
Neither fits in 100 mailboxes. So devices keep their own memory, which programs reach through
**ports** (`GET` and `PUT`) rather than through mailboxes. This is port-mapped I/O, as on x86
processors. 100 mailboxes are then enough for the programs Phase 6 needs. The worked example at
the end draws on the display, reads the keyboard and handles timer interrupts in 45 mailboxes.

**What it costs.** Two-word instructions use more memory. A stack in 100 mailboxes is small.
Both costs are honest teaching points, not hidden ones:

- A real instruction set has to trade instruction size against what an instruction can do.
- If the stack grows into the program, the machine stops and says so (see the stack overflow
  rule below).

## New registers and flags

| Part                      | Holds                                                         | Starts at   |
| ------------------------- | ------------------------------------------------------------- | ----------- |
| SP (stack pointer)        | Address of the top of the stack; 100 means the stack is empty | 100         |
| X (index register)        | A value in the dialect's range, used by indexed addressing    | 0           |
| IE (interrupts enabled)   | Whether an interrupt may stop the main program                | off         |
| IV (interrupt vector)     | Address of the interrupt handler                              | 00          |
| Pending interrupts        | Timer and keyboard, each raised or not                        | none        |
| Stack floor (not visible) | First mailbox after the assembled program                     | set on load |

Every classic register keeps its meaning.

## Instruction set additions

All new instructions start with 4. The middle digit names the family, so learners can read
them:

| Family     | Codes |
| ---------- | ----- |
| Stack      | 41x   |
| Indirect   | 42x   |
| Indexed    | 43x   |
| Interrupts | 44x   |
| Devices    | 45x   |

"+ address" means the next mailbox holds the address, or the port number.

| Mnemonic | Code          | Words | What it does                                                                                  |
| -------- | ------------- | ----- | --------------------------------------------------------------------------------------------- |
| PUSH     | 410           | 1     | SP = SP − 1, then mailbox SP = ACC                                                            |
| POP      | 411           | 1     | ACC = mailbox SP, then SP = SP + 1. Sets the negative flag as LDA does                        |
| CALL a   | 412 + address | 2     | Push the address of the next instruction, then PC = a                                         |
| RET      | 413           | 1     | Pop the return address into PC                                                                |
| LDX a    | 414 + address | 2     | X = mailbox a                                                                                 |
| STX a    | 415 + address | 2     | Mailbox a = X                                                                                 |
| INX      | 416           | 1     | X = X + 1 (wraps as ACC does)                                                                 |
| DEX      | 417           | 1     | X = X − 1 (wraps as ACC does)                                                                 |
| LDA @a   | 420 + address | 2     | ACC = mailbox (mailbox a). **Indirect**: mailbox a holds the address of the value             |
| STA @a   | 421 + address | 2     | Mailbox (mailbox a) = ACC                                                                     |
| ADD @a   | 422 + address | 2     | ACC = ACC + mailbox (mailbox a)                                                               |
| SUB @a   | 423 + address | 2     | ACC = ACC − mailbox (mailbox a)                                                               |
| LDA a,X  | 430 + address | 2     | ACC = mailbox (a + X). **Indexed**: a is the start of a table, X is the position in it        |
| STA a,X  | 431 + address | 2     | Mailbox (a + X) = ACC                                                                         |
| ADD a,X  | 432 + address | 2     | ACC = ACC + mailbox (a + X)                                                                   |
| SUB a,X  | 433 + address | 2     | ACC = ACC − mailbox (a + X)                                                                   |
| EI       | 440           | 1     | Interrupts on                                                                                 |
| DI       | 441           | 1     | Interrupts off                                                                                |
| RTI      | 442           | 1     | Return from interrupt: pop the flag, ACC and PC saved on entry, then interrupts on            |
| VEC a    | 443 + address | 2     | IV = a: interrupts run the handler at a                                                       |
| WAIT     | 444           | 1     | Pause until an interrupt is pending. Error if interrupts are off, since nothing could wake it |
| GET p    | 450 + port    | 2     | ACC = value read from device port p                                                           |
| PUT p    | 451 + port    | 2     | Send ACC to device port p                                                                     |

All other 4xx codes are still invalid instructions, including 400 to 409. Two things follow:

- The classic reference program `invalid-instruction`, which runs `DAT 400`, keeps its meaning.
- 400 stays an easy "this is not an instruction" value for lessons.

SUB and ADD in any mode set the negative flag and wrap exactly as their classic forms do.

### Addressing rules

- **Effective address.** For indirect it is the value in mailbox a. For indexed it is a + X.
  It must be 00 to 99. Anything else, including negative values in the signed dialects, stops
  the machine with an `address-out-of-range` error that names both the value and where it came
  from. We chose an error over wrapping because a wrapped address hides the bug the learner
  needs to find.
- The assembler writes `@` for indirect and `,X` for indexed: `LDA @ptr`, `STA table,X`. Spaces
  around the comma are allowed, and the X may be either case.
- Branches have no indirect or indexed forms in this version (see open question 4).

### Stack rules

- The stack grows **down** from mailbox 99. The first PUSH writes mailbox 99.
- **Stack overflow.** A PUSH, CALL or interrupt entry stops the machine with a `stack-overflow`
  error if it would write below the stack floor. The stack floor is the first mailbox after the
  assembled program, and code and data both count as the program. The message names the mailbox
  the stack would have overwritten.
- **Stack underflow.** POP, RET or RTI with SP = 100 stops the machine with a `stack-underflow`
  error.
- **Writing over the stack.** A store (STA, STX, indirect or indexed) into a mailbox at or above
  SP is allowed, since real machines allow it. The Problems panel reports it as a runtime
  finding: "Mailbox 97 is on the stack and was overwritten at step 41".

## Interrupts

There are two sources: the **timer** and the **keyboard**. One handler serves both, and it
reads port 50 to learn which source raised the interrupt. This is how many real processors
report the cause of an interrupt. It keeps the design to one vector.

The machine checks **between instructions**. The check happens only when IE is on and an
interrupt is pending. If both are pending, the timer goes first. Entry runs these micro-steps:

1. `interrupt-accept`: record the source as the cause, and turn IE off, so a second interrupt
   cannot stop the handler. A timer interrupt is cleared here. A keyboard interrupt stays
   pending while keys wait in the buffer (see Devices).
2. `stack-push`: push PC.
3. `stack-push`: push ACC.
4. `stack-push`: push the negative flag as 1 or 0.
5. `interrupt-jump`: PC = IV.

RTI undoes the entry in reverse:

1. Pop the flag.
2. Pop ACC.
3. Pop PC.
4. Turn IE on.

The saved state therefore sits on the stack, where the animated stack shows it. Entry counts as
one cycle, so every interrupt shows up in performance figures.

When no interrupt is pending, no check step runs. Classic programs therefore produce exactly
the same micro-steps as before (requirement 1).

## Devices

Programs reach devices through ports 00 to 99 with GET and PUT. The following stop the machine
with a `device-error` that names the port and the rule broken:

- an unknown port;
- a GET from a write-only port, or a PUT to a read-only port;
- a value outside a port's range.

| Port  | Device          | GET or PUT | Meaning                                                                                                    |
| ----- | --------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| 01    | Console         | PUT        | Show the character with this code (32 to 126). 10 starts a new line; 12 clears the console                 |
| 02    | Keyboard        | GET        | The next key code from the buffer, or 0 if the buffer is empty                                             |
| 03    | Keyboard        | GET        | How many keys are waiting (0 to 8)                                                                         |
| 10    | Pixel display   | PUT        | Choose a pixel, 0 to 255 (row × 16 + column)                                                               |
| 11    | Pixel display   | PUT, GET   | PUT: colour the chosen pixel (0 to 15), then choose the next one (255 wraps to 0). GET: the pixel's colour |
| 12    | Pixel display   | PUT        | Fill the whole display with a colour (0 to 15)                                                             |
| 20    | Timer           | PUT        | Raise a timer interrupt every n instructions (1 to 999); 0 turns the timer off                             |
| 21    | Timer           | GET        | Instructions left until the next tick                                                                      |
| 30    | Seven-segment   | PUT        | Show a number, −999 to 999, on three digits                                                                |
| 31–33 | Seven-segment   | PUT        | Light segments of digit 1, 2 or 3 directly: 0 to 127, bit 0 = segment a … bit 6 = segment g                |
| 40    | Beeper          | PUT        | Play a note: 1 to 88 (piano keys; 49 is A above middle C), 0 stops                                         |
| 41    | Beeper          | PUT        | Length of the next notes in tenths of a second (1 to 20, default 2)                                        |
| 50    | Interrupt cause | GET        | 1 timer, 2 keyboard, 0 none since the last interrupt                                                       |

More detail on each device:

- **Console.** 32 columns by 12 rows; old lines scroll away. It is separate from the output
  tray. Challenge tests keep checking the output tray, so OUT and OTC behave as before.
- **Keyboard.**
  - A buffer of 8 key codes, plus 0 when the buffer is empty. A key pressed when the buffer is
    full is dropped, and an event says so.
  - The keyboard interrupt is **level-triggered**: it is pending whenever keys wait in the
    buffer, and reading the last one clears it. A handler that reads one key with GET 2 runs
    again for the next, so no key is missed. A handler that never reads the key runs again and
    again, as on real hardware. (Changed during the build: the draft raised it once per key,
    which lost keys typed quickly.)
  - Key codes are character codes: letters, digits and space. Some keys get codes of their own:
    Enter is 10, and Backspace is 8. The arrow keys are 1 to 4 (up, down, left, right).
- **Pixel display.**
  - Colours 0 to 15 come from an original 16-colour palette. Colour 0 is black and 15 is white.
    Exact values are set in the build and checked for contrast in both themes.
  - The display redraws only the pixels that change (brief, Phase 6).
- **Timer.** It counts instructions completed, **not** wall-clock time, so a run is the same at
  any speed and in tests.
- **Beeper.** The engine emits a `beep` event and nothing more. The app plays the note with Web
  Audio, and only after the learner has turned sound on. Instant mode and tests play nothing.

### Key presses stay deterministic

Key presses are part of a run's input, like the input tray. A run has a **key schedule**: a
list of `{ cycle, key }` entries. Tests and challenges set the schedule in advance.

When the learner types into the keyboard device during a run, each key is added to the schedule
at the current cycle. Stepping back and replaying then gives the same run. Share links carry the
schedule. Changing the code or the inputs clears it, as it clears history.

## The fetch, decode, execute cycle

Fetch and decode are unchanged.

- **Two-word instructions** add two micro-steps after decode:
  - `operand-fetch-address`: MAR ← PC.
  - `operand-fetch-read`: MDR ← memory[MAR], then PC ← PC + 1.

  The address in IR stays the family code. The operand is shown in a new **operand** field.

- **Indirect** adds `indirect-address` (MAR ← operand) and `indirect-read` (MDR ← memory[MAR]).
  After these, MDR holds the effective address, and `operand-address` copies it to MAR.
- **Indexed** adds `index-add`: MAR ← operand + X, in one step.
- **LDX** ends with `load-x` (X ← MDR); **INX** and **DEX** use `index-change`.
- **Stack instructions** use `stack-push` (SP ← SP − 1, memory[SP] ← value) and `stack-pop`
  (value ← memory[SP], SP ← SP + 1). Each one appears in the micro-step view.
- **GET and PUT** use `device-read` and `device-write`.

The table below gives each instruction's full micro-step list. Every count includes the four
fetch steps and decode.

| Instruction     | Execute micro-steps                                                                     | Total |
| --------------- | --------------------------------------------------------------------------------------- | ----- |
| PUSH            | `stack-push`                                                                            | 6     |
| POP             | `stack-pop`, `load-acc`                                                                 | 7     |
| CALL            | operand fetch (2), `stack-push` (return address), `branch`                              | 9     |
| RET             | `stack-pop`, `branch`                                                                   | 7     |
| LDX             | operand fetch (2), `operand-address`, `operand-read`, `load-x`                          | 10    |
| STX             | operand fetch (2), `operand-address`, `store-mdr`, `store-write`                        | 10    |
| INX, DEX        | `index-change`                                                                          | 6     |
| LDA/ADD/SUB @a  | operand fetch (2), indirect (2), `operand-address`, `operand-read`, `load-acc` or `alu` | 12    |
| STA @a          | operand fetch (2), indirect (2), `operand-address`, `store-mdr`, `store-write`          | 12    |
| LDA/ADD/SUB a,X | operand fetch (2), `index-add`, `operand-read`, `load-acc` or `alu`                     | 10    |
| STA a,X         | operand fetch (2), `index-add`, `store-mdr`, `store-write`                              | 10    |
| EI, DI          | `interrupt-enable`                                                                      | 6     |
| RTI             | `stack-pop` (3), `interrupt-enable`                                                     | 9     |
| VEC             | operand fetch (2), `set-vector`                                                         | 8     |
| WAIT            | `wait` (see below)                                                                      | 6     |
| GET, PUT        | operand fetch (2), `device-read` or `device-write`                                      | 8     |

**Cycles** still count instructions completed, plus one for each interrupt entry.

**The timer** counts down once per completed instruction, starting with the instruction after
the PUT that set it. When it reaches 0 it raises a timer interrupt and reloads its period.
Interrupt entry does not count.

**WAIT** finishes at once if an interrupt is pending. Otherwise:

- with the timer running, it **idles**: it completes and runs again, so each idle WAIT counts as
  an instruction and the timer keeps counting;
- with key presses still scheduled, the next one arrives now (idle time is skipped);
- with nothing that could wake it, the machine waits at this step with status
  `waiting-interrupt` until the learner types a key.

## Events

All classic events are kept. New events:

| Event               | When                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `stack-push`        | A value goes onto the stack (address, value, new SP, and why: PUSH, CALL or interrupt)    |
| `stack-pop`         | A value comes off the stack (address, value, new SP, and why)                             |
| `call`, `return`    | A subroutine starts or ends: caller address, target, and return address                   |
| `effective-address` | Indirect or indexed addressing works out an address (mode, operand, pointer or X, result) |
| `register-change`   | X, IE or IV changes (SP changes are in `stack-push` and `stack-pop`)                      |
| `interrupt-raised`  | A device raises an interrupt (source), at the end of an instruction                       |
| `interrupt-enter`   | The main program is stopped and the handler starts                                        |
| `interrupt-return`  | RTI resumes the main program                                                              |
| `device-read`       | GET reads a port (device, port, value)                                                    |
| `device-write`      | PUT writes a port (device, port, value, what changed, e.g. pixels)                        |
| `key`               | A key enters the buffer, or is dropped because it is full                                 |
| `beep`              | The beeper plays a note (note, length)                                                    |
| `wait`              | WAIT runs: idle (nothing pending yet) or not                                              |

These events drive the animations:

- **Animated stack.** `stack-push` and `stack-pop` grow and shrink a column of mailboxes, and SP
  moves with them.
- **Arrow back to the caller.** `call` and `return` draw it.
- **Interrupt timeline marker.** `interrupt-enter` and `interrupt-return` place it.
- **Pixel display.** `device-write` lists the pixels changed, so the display redraws only those.

**Narration.** Every new micro-step gets a beginner and a technical sentence in the narration
catalogue (Phase 6 acceptance: "every new instruction has narration and tests").

## Status and errors

New status:

- `waiting-interrupt`: WAIT is waiting. A key press or a timer tick makes the machine ready.
  `run` stops with this reason when nothing is scheduled to wake it.

New error codes:

- `address-out-of-range`
- `stack-overflow`
- `stack-underflow`
- `device-error`
- `wait-forever` (WAIT with interrupts off)

All other classic rules are unchanged:

- invalid instructions;
- a halted or errored machine does not step;
- PC wraps from 99 to 00, which also applies to fetching an operand word.

## Running and analysis

- **Infinite-loop detection.** The repeated-state check also compares SP, X, IE, IV, pending
  interrupts, the timer countdown and all device state.
  - A GET from the keyboard counts as reading input, like INP. A loop that waits for a key is
    therefore never called infinite.
  - **While interrupts are on, no loop is called infinite.** A key can arrive at any moment and
    change what happens next, so a repeating stretch proves nothing. The step budget stops such
    a run. (Added during the build: a timer-driven program does repeat its full state exactly,
    for example a dot that wraps round the display.)
- **History and time travel.** Keyframes and diffs include the new registers, the stack floor
  and device state. The pixel display adds 256 values to a keyframe. That is under 1 KB, so the
  keyframe interval stays at 1,000.
- **Trace table.** It gets SP, X and IE columns, and a column for the device each step touched.
  Interrupt entry has its own row, shown as "interrupt (timer)" or "interrupt (keyboard)".
- **Static analysis.**
  - The control-flow graph learns CALL and RET, and treats the vector as an entry point.
  - New detectors flag a CALL whose subroutine never reaches RET, RET reached from the main
    program without a CALL, PUSH with no POP anywhere, and EI with no VEC. (Checking that PUSH
    and POP balance on every path was dropped: it needs the stack depth along each path, and
    reported correct recursive programs.)
  - A program that turns interrupts on is not told it has no HLT or cannot stop.
  - At run time, a store into the live stack (at or above SP) is reported, and each new error
    code gets its own explanation and hints.

## Assembler

- **Mnemonics.** New: PUSH POP CALL RET LDX STX INX DEX EI DI RTI VEC WAIT GET PUT. Operand
  forms: `@label`, `label,X`, a plain address, and ports as numbers 00 to 99.
- **Two-word instructions.** Each takes two mailboxes. A label names the first one.
- **Source map and disassembler.** The source map points both words at the source line. The
  disassembler marks the second word as **operand** in the memory grid and the machine-code
  view, so it is not read as a separate instruction.
- **The extended machine is available with every dialect.** The dialect still sets the value
  range, the BRZ and BRP rules, and spellings such as STO and OTC. The new mnemonics are the
  same in every dialect.
- **Classic machine.** If a program uses an extended mnemonic there, assembly fails with a
  message that suggests switching to the extended machine.

## Worked example (illustrative)

A dot moves along the top row of the display, one pixel per timer tick. Pressing a digit key
changes its colour.

```
        VEC  tick       // interrupts run "tick"
        LDA  period
        PUT  20         // timer every 40 instructions
        EI
idle    WAIT            // nothing to do until an interrupt
        BRA  idle

tick    GET  50         // which device?
        SUB  one
        BRZ  timer      // 1 = timer
        GET  02         // 2 = keyboard: read the key
        SUB  zero       // key '0' is code 48
        STA  colour
        RTI
timer   LDA  pos
        PUT  10         // choose the old pixel
        LDA  black
        PUT  11         // clear it
        LDA  pos
        ADD  one
        SUB  sixteen
        BRP  wrap       // past the end of the row?
        ADD  sixteen
        BRA  draw
wrap    LDA  zeroval
draw    STA  pos
        PUT  10
        LDA  colour
        PUT  11         // draw the dot
        RTI

period  DAT  40
one     DAT  1
zero    DAT  48
sixteen DAT  16
zeroval DAT  0
black   DAT  0
pos     DAT  0
colour  DAT  15
```

The program takes 45 mailboxes. The stack is used only by interrupt entry: three
values, in mailboxes 97 to 99.

## Acceptance tests

- **Classic compatibility.** Every classic reference program, in every dialect, gives the same
  result and identical event streams on both machines.
- **Unit tests.** Each new instruction has a hand-checked test of its micro-steps, its events
  and its narration.
- **Error tests.** Each error code has a test.
- **Reference programs for the new features:**
  - a recursive subroutine, using CALL, RET and PUSH;
  - summing an array, once indexed and once indirect;
  - a timer-driven counter on the seven-segment display;
  - a keyboard echo to the console;
  - the drawing example above.
- **Property tests.** The fast loop and the micro-step machine always agree, as for classic.
- **End-to-end test.** A program draws on the pixel display, reads the keyboard and responds to
  timer interrupts in the app (Phase 6 acceptance).

## Questions settled at review

The reviewer approved the draft as written, so each open question takes the draft's answer:

1. **Port I/O.** Devices are reached through ports, and all 100 mailboxes stay memory.
2. **GET and PUT** are the names, so the classic OUT keeps its one meaning.
3. **One vector with a cause port** (port 50).
4. **No indirect branches** in this version. A later phase can add `BRA @a` in the free 4xx space.
5. **No TAX or TXA.** LDX, STX, INX and DEX are enough for every Phase 6 lesson.
