# The pipeline

The pipeline view shows how a processor overlaps instructions (brief, Phase 7). It runs the
**extended instruction set** through five stages:

1. **IF** (fetch)
2. **ID** (decode)
3. **EX** (execute)
4. **MEM** (memory)
5. **WB** (write back)

## A timing model over the real run

The extended machine runs the program as usual. The pipeline then works out, clock cycle by
clock cycle, when each instruction that ran would pass through the five stages.

- **Results never change.** Outputs, memory and registers are always exactly those of the
  extended machine. Only the clock count changes.
- **The diagram builds live.** Stepping the program adds rows to the pipeline diagram, so it
  grows as the program runs. Learners can also move through the diagram clock cycle by clock
  cycle.

See [decision 0035](../decisions/0035-pipeline-and-cache.md).

The code is in `packages/engine/src/machines/pipeline/schedule.ts`. The examples below are its
tests (`pipeline.test.ts`), worked out by hand from these rules before the code ran them.

## What each stage does

| Stage | Work                                                                                          |
| ----- | --------------------------------------------------------------------------------------------- |
| IF    | Fetch the instruction. Two-mailbox instructions fetch both mailboxes in the same cycle        |
| ID    | Decode, and read the registers in the last cycle spent here                                   |
| EX    | Work out addresses (table + X, SP ± 1), change X (INX, DEX), decide BRZ and BRP               |
| MEM   | Read or write memory; ADD and SUB add here, once their operand arrives; GET and PUT use ports |
| WB    | Write ACC, the negative flag, X and SP to the registers                                       |

ACC and the negative flag are treated as one register, called ACC below.

## Instruction profiles

For each instruction, the table gives:

- **Reads**: the registers it needs, and the stage that needs them;
- **Writes**: the registers it changes, and the stage at whose end the new value exists;
- **MEM**: how many cycles it spends in MEM;
- **Jump known in**: for instructions that can jump, the stage in which the next address
  becomes known.

| Instruction      | Reads                | Writes                     | MEM | Jump known in             |
| ---------------- | -------------------- | -------------------------- | --- | ------------------------- |
| LDA              | X in EX if `,X`      | ACC after MEM              | 1   |                           |
| LDA @            |                      | ACC after MEM              | 2   |                           |
| ADD, SUB         | ACC in MEM           | ACC after MEM              | 1   |                           |
| ADD @, SUB @     | ACC in MEM           | ACC after MEM              | 2   |                           |
| STA              | ACC in MEM           |                            | 1   |                           |
| STA @            | ACC in MEM           |                            | 2   |                           |
| BRA              |                      |                            | 1   | ID                        |
| BRZ, BRP         | ACC in EX            |                            | 1   | EX                        |
| INP, GET         |                      | ACC after MEM              | 1   |                           |
| OUT, OTC, PUT    | ACC in MEM           |                            | 1   |                           |
| PUSH             | SP in EX, ACC in MEM | SP after EX                | 1   |                           |
| POP              | SP in EX             | SP after EX, ACC after MEM | 1   |                           |
| CALL             | SP in EX             | SP after EX                | 1   | ID                        |
| RET              | SP in EX             | SP after EX                | 1   | MEM (address from memory) |
| LDX              |                      | X after MEM                | 1   |                           |
| STX              | X in MEM             |                            | 1   |                           |
| INX, DEX         | X in EX              | X after EX                 | 1   |                           |
| RTI              | SP in EX             | SP after EX, ACC after MEM | 3   | MEM                       |
| WAIT             |                      |                            | 1   | EX (when it idles)        |
| interrupt entry  | SP in EX, ACC in MEM | SP after EX                | 3   | ID                        |
| HLT, EI, DI, VEC |                      |                            | 1   |                           |

The `,X` forms of ADD, SUB and STA also read X in EX. Indirect forms spend two cycles in MEM:
one for the pointer, then one for the value. RTI and interrupt entry move three values (the
flag, ACC and PC). An interrupt entry goes through the pipeline like an instruction.

## The rules

Cycles count from 1, and stages run in order. Each instruction's stage start times are the
earliest that satisfy every rule below. Instruction _k_ follows _k − 1_.

- **Flow.** A stage starts once the previous stage is done: ID ≥ IF + 1, EX ≥ ID + 1,
  MEM ≥ EX + 1, and WB ≥ MEM + (cycles in MEM).
- **One instruction per stage.** An instruction enters a stage only once the one before has
  left it: IF*k* ≥ ID*k−1*, ID*k* ≥ EX*k−1*, EX*k* ≥ MEM*k−1*, MEM*k* ≥ WB*k−1*, and
  WB*k* ≥ WB*k−1* + 1. An instruction that is held up stays in its stage, and the ones behind
  it wait in theirs.
- **Data hazards, with forwarding.** A value that exists at the end of cycle _r_ can be used
  from cycle _r_ + 1:
  - a stage that needs a value in EX starts after _r_;
  - one that needs it in MEM has its last MEM cycle after _r_.

  The value travels along a **forwarding path**, from the end of EX or MEM straight to the
  stage that needs it.

- **Data hazards, without forwarding.** Registers are read in the last cycle of ID. A value is
  written in the first half of its WB cycle and read in the second half. So the reader's last
  ID cycle must be no earlier than the writer's WB: EX*k* ≥ WB*writer* + 1.
- **Control hazards.** Fetch carries on from the next mailbox, or from where the predictor
  says.
  - If the next instruction that actually ran is somewhere else, the instructions fetched in
    the meantime are thrown away (**flushed**).
  - The right one is fetched the cycle after the jump becomes known: in ID, EX or the last MEM
    cycle, as in the table.
  - So a wrong guess costs 1 cycle for BRA, CALL and interrupt entry, 2 for BRZ, BRP and WAIT,
    and 3 for RET (5 for RTI).
- **Self-modifying code.** A store can write into an instruction that has already been
  fetched. In that case the instruction is fetched again, in the cycle after the store's
  (last) MEM cycle.

The run takes as many cycles as the last instruction's WB cycle. Without the pipeline, each
instruction would take 4 + (cycles in MEM) cycles on its own. That figure is shown alongside,
with the speed-up and cycles per instruction (CPI).

### Branch prediction

**Prediction off.** The pipeline always fetches the next mailbox ("predict not taken").

**Prediction on.** A 2-bit counter and a branch target buffer are kept for each instruction
address that can jump (BRA, BRZ, BRP, CALL and WAIT).

- A counter starts at 1.
- The pipeline guesses "taken" when the counter is 2 or 3 **and** the buffer knows a target.
- After each run of the instruction, the counter goes up if it jumped and down if it did not,
  between 0 and 3, and the buffer records the target.

RET, RTI and interrupt entry are never guessed: their targets come from memory or a device.

### Counting lost cycles

With no hazards, one instruction finishes every cycle, so _n_ instructions take _n_ + 4 cycles.
Every cycle beyond that is a lost (stall) cycle.

- When an instruction finishes more than one cycle after the one before, the gap is counted
  against it.
- Its own extra MEM cycles count as **structural**.
- The rest is put down to the last hazard that held it up: **data**, **control**, structural
  (MEM held by an instruction in front), or **self-modifying**.

The four causes always add up to the total.

## Hand-worked examples

Forwarding is on and prediction is off, unless an example says otherwise. Each start-time list
gives IF, ID, EX, MEM and WB.

**1. Independent instructions.** `LDA a; LDA b; HLT`

- Starts: 1 2 3 4 5 / 2 3 4 5 6 / 3 4 5 6 7.
- 7 cycles, against 15 unpipelined. No stalls.

**2. A chain through ACC.** `LDA a; ADD b; STA c; HLT`

- ADD gets ACC from LDA's MEM, forwarded into its own MEM in cycle 5.
- STA gets ACC from ADD in cycle 6.
- 8 cycles, no stalls.

**3. The same chain without forwarding.**

- ADD must wait for LDA's WB (cycle 5), so its EX is cycle 6.
- Starts: 1 2 3 4 5 / 2 3 6 7 8 / 3 6 9 10 11 / 6 9 10 11 12.
- 12 cycles: 4 data stalls.

**4. Load-use before a taken branch.** `INP; BRZ z; HLT; z HLT`, input 0.

- ACC exists at the end of INP's MEM (cycle 4), so BRZ's EX waits until cycle 5: 1 data stall.
- The branch is known in EX (cycle 5).
- HLT at 02 was fetched in cycle 3 and decoded in cycle 5. The mailbox after it was fetched in
  cycle 5. Both are flushed.
- The target is fetched in cycle 6.
- Starts: 1 2 3 4 5 / 2 3 5 6 7 / 6 7 8 9 10.
- 10 cycles: 1 data and 2 control.

**5. The same branch, not taken** (input 5). 8 cycles: 1 data.

**6. Example 5 without forwarding.** BRZ waits for INP's WB: 9 cycles, 2 data.

**7. BRA.** `BRA x; HLT; x HLT`

- The target is known in ID (cycle 2). One instruction is flushed.
- The target is fetched in cycle 3.
- 7 cycles: 1 control.

**8. A countdown loop** (`LDA n; loop SUB one; BRP loop; HLT`, n = 2, Classic dialect).

- 8 instructions run.
- Each BRP waits one cycle for SUB's ACC: 3 data stalls.
- Each of the 2 taken branches costs 2 control cycles.
- 19 cycles.

**9. Example 8 with prediction.**

- First BRP: counter 1, no target known. It guesses "not taken" and is wrong.
- Second: counter 2, with a target. It guesses "taken" and is right.
- Third: counter 3. It guesses "taken", but the loop ends, so it is wrong.
- Still 19 cycles. The second time round saves 2 cycles (SUB starts 9 11 12 13 14), and the
  exit costs 2.

**10. The same loop with n = 4.**

- 12 instructions.
- Without prediction: 12 + 4 + 5 data + 4 × 2 control = 29 cycles.
- With prediction: only the first and last guesses are wrong, giving 12 + 4 + 5 + 2 + 2 = 25
  cycles.

**11. Indirect addressing.** `LDA @p; LDA a; HLT`

- LDA @ spends cycles 4 and 5 in MEM, so the next LDA waits in EX.
- Starts: 1 2 3 4 6 / 2 3 4 6 7 / 3 4 6 7 8.
- 8 cycles: 1 structural.

**12. INX before an indexed load.** `INX; LDA t,X; HLT`

- X exists at the end of INX's EX (cycle 3) and is forwarded straight to LDA's EX in cycle 4.
- 7 cycles, no stalls.

**13. Example 12 without forwarding.** 9 cycles: 2 data.

**14. LDX before an indexed load.** X only exists after LDX's MEM. 8 cycles: 1 data.

**15. The stack.** `LDA a; PUSH; PUSH; POP; POP; HLT`

- Each instruction gets SP forwarded from EX of the one before.
- 10 cycles, no stalls.

**16. Example 15 without forwarding.** Every PUSH and POP waits 2 cycles for SP. 18 cycles: 8 data.

**17. CALL and RET.** `CALL s; HLT; s RET`

- CALL is known in ID: 1 flushed, 1 control cycle.
- RET's target comes from memory, known at the end of its MEM (cycle 6). Three instructions are
  flushed, costing 3 control cycles.
- Starts: 1 2 3 4 5 / 3 4 5 6 7 / 7 8 9 10 11.
- 11 cycles.

**18. Self-modifying code.** `LDA new; STA x; x HLT; HLT; new DAT 902`

- STA writes mailbox 02 in cycle 5. The instruction there was fetched in cycle 3, so it is
  fetched again in cycle 6. It is now OUT.
- 11 cycles: 3 self-modifying.

**19. An interrupt.** `VEC h; EI; WAIT; HLT; h GET 2; RTI`, with a key waiting from the
start.

- The interrupt enters before WAIT and holds MEM for cycles 6 to 8.
- The handler is known in ID (cycle 4).
- GET waits for MEM. RTI holds MEM for cycles 10 to 12.
- Starts: 1 2 3 4 5 / 2 3 4 5 6 / 3 4 5 6 9 / 5 6 7 9 10 / 6 7 9 10 13.
- 13 cycles (29 unpipelined): 4 structural.

**20. What each stage holds** (example 4):

| Cycle | IF         | ID          | EX     | MEM    | WB  |
| ----- | ---------- | ----------- | ------ | ------ | --- |
| 4     | flushed 02 | BRZ (stall) | bubble | INP    |     |
| 5     | flushed 03 | flushed 02  | BRZ    | bubble | INP |

On top of these examples, every classic and extended reference program is scheduled with each
combination of forwarding and prediction. Each run must:

- keep the stages in order;
- never put two instructions in one stage in the same cycle;
- have stall causes that add up to the total.
