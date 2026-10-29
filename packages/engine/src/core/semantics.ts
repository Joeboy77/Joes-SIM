/**
 * Instruction semantics shared by the micro-step machine and the fast run loop, so the two can
 * never disagree. Every rule that depends on the dialect lives here.
 */
import type { Dialect, Mnemonic } from "../dialects/types";

export interface Decoded {
  readonly mnemonic: Mnemonic;
  readonly opcode: number;
  readonly address: number;
}

/** Turns a mailbox value into an instruction, or null when it is not a valid instruction. */
export function decode(value: number, dialect: Dialect): Decoded | null {
  if (!Number.isInteger(value) || value < 0 || value > 999) return null;
  const opcode = Math.floor(value / 100);
  const address = value % 100;
  switch (opcode) {
    case 0:
      return { mnemonic: "HLT", opcode, address };
    case 1:
      return { mnemonic: "ADD", opcode, address };
    case 2:
      return { mnemonic: "SUB", opcode, address };
    case 3:
      return { mnemonic: "STA", opcode, address };
    case 5:
      return { mnemonic: "LDA", opcode, address };
    case 6:
      return { mnemonic: "BRA", opcode, address };
    case 7:
      return { mnemonic: "BRZ", opcode, address };
    case 8:
      return { mnemonic: "BRP", opcode, address };
    case 9:
      if (address === 1) return { mnemonic: "INP", opcode, address };
      if (address === 2) return { mnemonic: "OUT", opcode, address };
      if (address === 22 && "OTC" in dialect.spellings) return { mnemonic: "OTC", opcode, address };
      return null;
    default:
      return null;
  }
}

/** The machine code for a mnemonic and address. */
export function encode(mnemonic: Mnemonic, address = 0): number {
  switch (mnemonic) {
    case "HLT":
      return 0;
    case "INP":
      return 901;
    case "OUT":
      return 902;
    case "OTC":
      return 922;
    default:
      return OPCODES[mnemonic] * 100 + address;
  }
}

const OPCODES: Record<Exclude<Mnemonic, "HLT" | "INP" | "OUT" | "OTC">, number> = {
  ADD: 1,
  SUB: 2,
  STA: 3,
  LDA: 5,
  BRA: 6,
  BRZ: 7,
  BRP: 8,
};

/** True for instructions that use their address part. */
export function takesAddress(mnemonic: Mnemonic): boolean {
  return mnemonic in OPCODES;
}

export interface AluResult {
  readonly raw: number;
  readonly result: number;
  readonly negative: boolean;
  readonly wrapped: boolean;
}

export function alu(operation: "add" | "sub", a: number, b: number, dialect: Dialect): AluResult {
  const raw = operation === "add" ? a + b : a - b;
  if (dialect.arithmetic === "unsigned-wrap") {
    const result = ((raw % 1000) + 1000) % 1000;
    return { raw, result, negative: raw < 0, wrapped: raw < 0 || raw > 999 };
  }
  // signed-wrap: keep the sign, drop the thousands digit. `|| 0` turns -0 into 0.
  const result = raw % 1000 || 0;
  return { raw, result, negative: result < 0, wrapped: raw !== result };
}

/** The negative flag after the accumulator is loaded directly (LDA or INP). */
export function flagAfterLoad(value: number): boolean {
  return value < 0;
}

export function branchTaken(
  mnemonic: "BRA" | "BRZ" | "BRP",
  acc: number,
  negative: boolean,
  dialect: Dialect,
): boolean {
  if (mnemonic === "BRA") return true;
  if (mnemonic === "BRZ") return acc === 0 && !(dialect.brzRequiresFlagClear && negative);
  return !negative;
}

export function inRange(value: number, dialect: Dialect): boolean {
  return Number.isInteger(value) && value >= dialect.minValue && value <= dialect.maxValue;
}

/** Number of execute micro-steps for each instruction. */
export function executeLength(mnemonic: Mnemonic): number {
  switch (mnemonic) {
    case "ADD":
    case "SUB":
    case "LDA":
    case "STA":
      return 3;
    default:
      return 1;
  }
}

export const FETCH_STAGES = 4;
export const DECODE_STAGE = 4;
export const EXECUTE_START = 5;
