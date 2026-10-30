# 0024: Predict mode

## Choice

- Before each instruction, the simulator asks one question that fits it: the accumulator after
  LDA, ADD, SUB or INP; whether BRZ or BRP branches; which mailbox runs after BRA; what OUT or
  OTC outputs; what STA writes; whether HLT (or an invalid instruction) stops the machine.
- The answer comes from running the instruction on a copy of the machine, so it is always what
  really happens. Numbers match when they are equal ("7" and "007").
- After answering, the machine steps and shows the answer with the instruction's narration.
- Accuracy is counted for each kind of question on the device and shown on the Progress page.
  Multiple-choice questions inside lessons are not counted, because they test ideas rather than
  predict a step.
- No question is asked part-way through an instruction, or when INP needs an input that has not
  been given.
