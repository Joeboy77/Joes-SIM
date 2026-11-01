/** The classic Little Man Computer as a custom machine definition: the designer's starting point. */
import type { InstructionDef, MachineDefinition, MachineMicroOp } from "./definition";

const toMar: MachineMicroOp = { op: "copy", from: "operand", to: "MAR" };

export const LMC_INSTRUCTIONS: readonly InstructionDef[] = [
  { mnemonic: "HLT", opcode: 0, operand: false, description: "Stop", micro: [{ op: "halt" }] },
  {
    mnemonic: "ADD",
    opcode: 1,
    operand: true,
    description: "Add a mailbox to ACC",
    micro: [toMar, { op: "read" }, { op: "alu", fn: "add", a: "ACC", b: "MDR", to: "ACC" }],
  },
  {
    mnemonic: "SUB",
    opcode: 2,
    operand: true,
    description: "Subtract a mailbox from ACC",
    micro: [toMar, { op: "read" }, { op: "alu", fn: "sub", a: "ACC", b: "MDR", to: "ACC" }],
  },
  {
    mnemonic: "STA",
    opcode: 3,
    operand: true,
    description: "Store ACC in a mailbox",
    micro: [toMar, { op: "copy", from: "ACC", to: "MDR" }, { op: "write" }],
  },
  {
    mnemonic: "LDA",
    opcode: 5,
    operand: true,
    description: "Load a mailbox into ACC",
    micro: [toMar, { op: "read" }, { op: "copy", from: "MDR", to: "ACC" }],
  },
  {
    mnemonic: "BRA",
    opcode: 6,
    operand: true,
    description: "Branch always",
    micro: [{ op: "jump", when: "always", to: "operand" }],
  },
  {
    mnemonic: "BRZ",
    opcode: 7,
    operand: true,
    description: "Branch if ACC is zero",
    micro: [{ op: "jump", when: "zero", to: "operand" }],
  },
  {
    mnemonic: "BRP",
    opcode: 8,
    operand: true,
    description: "Branch if ACC is zero or positive",
    micro: [{ op: "jump", when: "not-negative", to: "operand" }],
  },
  {
    mnemonic: "INP",
    opcode: 9,
    operand: false,
    fixedOperand: 1,
    description: "Read an input into ACC",
    micro: [{ op: "input", to: "ACC" }],
  },
  {
    mnemonic: "OUT",
    opcode: 9,
    operand: false,
    fixedOperand: 2,
    description: "Output ACC",
    micro: [{ op: "output", from: "ACC" }],
  },
];

export const LMC_DEFINITION: MachineDefinition = {
  format: "joes-sim-machine",
  version: 1,
  name: "Little Man Computer",
  description: "The classic LMC: 100 mailboxes, three-digit words and an accumulator.",
  memory: 100,
  word: { digits: 3, base: 10, signed: false },
  opcodeDigits: 1,
  registers: [
    { name: "PC", role: "pc" },
    { name: "MAR", role: "mar" },
    { name: "MDR", role: "mdr" },
    { name: "IR", role: "ir" },
    { name: "ACC" },
  ],
  fetch: [
    { op: "copy", from: "PC", to: "MAR" },
    { op: "read" },
    { op: "copy", from: "MDR", to: "IR" },
    { op: "inc", reg: "PC" },
  ],
  instructions: LMC_INSTRUCTIONS,
};

/** An example variant, made only by adding instructions: INC, DEC, MUL and NEG. */
export const LMC_PLUS: MachineDefinition = {
  ...LMC_DEFINITION,
  name: "LMC with INC, DEC and MUL",
  description:
    "The classic LMC with three extra instructions, using the free opcode 4 and 9xx codes.",
  word: { digits: 3, base: 10, signed: true },
  instructions: [
    ...LMC_INSTRUCTIONS,
    {
      mnemonic: "MUL",
      opcode: 4,
      operand: true,
      description: "Multiply ACC by a mailbox",
      micro: [toMar, { op: "read" }, { op: "alu", fn: "mul", a: "ACC", b: "MDR", to: "ACC" }],
    },
    {
      mnemonic: "INC",
      opcode: 9,
      operand: false,
      fixedOperand: 10,
      description: "Add 1 to ACC",
      micro: [{ op: "inc", reg: "ACC" }],
    },
    {
      mnemonic: "DEC",
      opcode: 9,
      operand: false,
      fixedOperand: 11,
      description: "Take 1 from ACC",
      micro: [{ op: "dec", reg: "ACC" }],
    },
  ],
};
