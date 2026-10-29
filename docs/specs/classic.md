# The classic machine

This is the machine every dialect runs on. Rules that differ between dialects (value range,
arithmetic, BRZ, accepted spellings) are listed in [dialects/](dialects/).

## Components

| Part                 | Holds                                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| Memory               | 100 mailboxes, addresses 00 to 99                                               |
| PC (program counter) | Address of the next instruction, 00 to 99                                       |
| MAR (memory address) | The address being read or written                                               |
| MDR (memory data)    | The value just read, or about to be written                                     |
| IR (instruction)     | The instruction being run, shown as opcode (first digit) and address (last two) |
| ACC (accumulator)    | The working value                                                               |
| Negative flag        | Set when the last result was below zero                                         |
| Input tray           | A queue of values; INP takes the next one                                       |
| Output tray          | A list of numbers (OUT) and characters (OTC)                                    |

The range of a mailbox, the accumulator and an input is set by the dialect: 000 to 999 in
Classic, -999 to 999 in Higginson-compatible and OCR.

## Instruction set

| Mnemonic     | Code | What it does                                                               |
| ------------ | ---- | -------------------------------------------------------------------------- |
| ADD          | 1xx  | ACC = ACC + mailbox xx                                                     |
| SUB          | 2xx  | ACC = ACC − mailbox xx; sets the negative flag if the result is below zero |
| STA (or STO) | 3xx  | Mailbox xx = ACC                                                           |
| LDA          | 5xx  | ACC = mailbox xx                                                           |
| BRA          | 6xx  | PC = xx                                                                    |
| BRZ          | 7xx  | PC = xx if ACC is zero (see the dialect for the flag rule)                 |
| BRP          | 8xx  | PC = xx if the negative flag is clear. **Zero counts as positive.**        |
| INP          | 901  | ACC = next input                                                           |
| OUT          | 902  | Output ACC as a number                                                     |
| OTC          | 922  | Output ACC as a character (Higginson-compatible only)                      |
| HLT (or COB) | 000  | Stop. Any 0xx stops; the assembler always writes 000                       |
| DAT          | —    | Assembler directive: reserve a mailbox, optionally with a starting value   |

Codes 4xx, 9xx other than 901, 902 and (where available) 922, and any negative value are not
instructions. Running one stops the machine with an `invalid-instruction` error.

Sources: Wikipedia, "Little Man Computer" (citing Madnick's original 1965 model); Peter
Higginson's LMC help page (<https://peterhigginson.co.uk/lmc/help.html>), which states "4xx: This code
is unused and gives an error" and lists OTC as "Output accumulator as a character if address is 22".

## The fetch, decode, execute cycle

Each instruction is a sequence of micro-steps. The engine can run one micro-step at a time
(`step(state, { granularity: "micro" })`) or a whole instruction (the default). `state.stage`
says where the machine is inside the current instruction.

| Stage | Phase   | Micro-step        | Register transfer                              |
| ----- | ------- | ----------------- | ---------------------------------------------- |
| 0     | Fetch   | `fetch-address`   | MAR ← PC                                       |
| 1     | Fetch   | `fetch-read`      | MDR ← memory[MAR]                              |
| 2     | Fetch   | `fetch-load-ir`   | IR ← MDR                                       |
| 3     | Fetch   | `fetch-increment` | PC ← PC + 1 (99 wraps to 00)                   |
| 4     | Decode  | `decode`          | Control unit splits IR into opcode and address |
| 5+    | Execute | depends on opcode | see below                                      |

Execute steps:

| Instruction   | Steps                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| ADD, SUB      | `operand-address` MAR ← IR.address; `operand-read` MDR ← memory[MAR]; `alu` ACC ← ACC ± MDR, flag set |
| LDA           | `operand-address`; `operand-read`; `load-acc` ACC ← MDR, flag set from the value                      |
| STA           | `operand-address`; `store-mdr` MDR ← ACC; `store-write` memory[MAR] ← MDR                             |
| BRA, BRZ, BRP | `branch`: test the condition; if taken, PC ← IR.address                                               |
| INP           | `input`: ACC ← next input. If there is none, the machine waits (status `waiting-input`) at this step  |
| OUT, OTC      | `output`: copy ACC to the output tray                                                                 |
| HLT           | `halt`: status becomes `halted`                                                                       |

So an instruction takes 6 micro-steps (branches, I/O, HLT) or 8 (ADD, SUB, LDA, STA).

**Cycles** count whole instructions completed. This is the number used for the challenge
targets and optimisation scores (brief, Section 8.1). `microSteps` counts micro-steps.

## Events

Every micro-step returns typed events. The views (animation, narration, trace table,
heatmap) read only these.

| Event                   | When                                                                       |
| ----------------------- | -------------------------------------------------------------------------- |
| `transfer`              | A value moves between components (from, to, value)                         |
| `memory-read`           | A mailbox is read                                                          |
| `memory-write`          | A mailbox is written (with the previous value)                             |
| `pc-increment`          | PC goes up by one                                                          |
| `decode`                | The instruction is split into opcode and address                           |
| `alu`                   | ADD or SUB, with the true result, the stored result and whether it wrapped |
| `flag-change`           | The negative flag changes                                                  |
| `branch`                | A branch instruction runs, taken or not                                    |
| `input`, `input-needed` | An input is read, or there is none to read                                 |
| `output`                | A number or character is output                                            |
| `halt`, `error`         | The machine stops                                                          |
| `instruction-complete`  | The last micro-step of an instruction                                      |

## Status

| Status          | Meaning                                                                |
| --------------- | ---------------------------------------------------------------------- |
| `ready`         | Can step                                                               |
| `waiting-input` | INP found the input tray empty. `provideInput` makes it ready again    |
| `halted`        | HLT ran                                                                |
| `error`         | An invalid instruction was decoded. `state.error` says which and where |

Stepping a halted or errored machine changes nothing.

## Running

`run(state, options)` runs whole instructions without events, for instant mode and tests.
It stops for one of these reasons:

- `halted`, `error` or `waiting-input`, as above.
- `breakpoint`: the next instruction is at a breakpoint address (never the first instruction of
  the run, so you can continue from a breakpoint).
- `budget`: `maxSteps` instructions ran (default 1,000,000).
- `infinite-loop`: the program can never halt. Between inputs the machine is deterministic, so
  if memory, PC, ACC and the flag ever repeat with no input read, the program will repeat
  forever. The result says the cycle where the loop begins, its first address and its length.
  See [decision 0008](../decisions/0008-infinite-loop-detection.md).

The fast loop and the micro-step machine share one module of semantics, and property tests check
they always end in the same state.
