/**
 * Decoding the extended machine's 4xx instructions (docs/specs/extended.md), shared by the
 * micro-step machine, the fast run loop, the assembler and the analysis.
 */
import type { ExtMnemonic } from "../../dialects/types";
import type { MicroOp } from "../../core/events";

export type AddressMode = "indirect" | "indexed";

/** A memory instruction with a new addressing mode. */
export type ModeMnemonic = "LDA" | "STA" | "ADD" | "SUB";

export interface ExtDecoded {
  readonly mnemonic: ExtMnemonic | ModeMnemonic;
  readonly mode?: AddressMode;
  /** The instruction word, 410 to 451. */
  readonly code: number;
  /** 2 when the next mailbox holds the address or port. */
  readonly words: 1 | 2;
}

const MODE_ORDER: readonly ModeMnemonic[] = ["LDA", "STA", "ADD", "SUB"];

const TABLE: ReadonlyArray<readonly [number, ExtMnemonic | ModeMnemonic, 1 | 2, AddressMode?]> = [
  [410, "PUSH", 1],
  [411, "POP", 1],
  [412, "CALL", 2],
  [413, "RET", 1],
  [414, "LDX", 2],
  [415, "STX", 2],
  [416, "INX", 1],
  [417, "DEX", 1],
  ...MODE_ORDER.map((m, i) => [420 + i, m, 2, "indirect"] as const),
  ...MODE_ORDER.map((m, i) => [430 + i, m, 2, "indexed"] as const),
  [440, "EI", 1],
  [441, "DI", 1],
  [442, "RTI", 1],
  [443, "VEC", 2],
  [444, "WAIT", 1],
  [450, "GET", 2],
  [451, "PUT", 2],
];

const BY_CODE = new Map<number, ExtDecoded>(
  TABLE.map(([code, mnemonic, words, mode]) => [
    code,
    mode ? { code, mnemonic, words, mode } : { code, mnemonic, words },
  ]),
);

/** The extended instruction a value encodes, or null. */
export function decodeExt(value: number): ExtDecoded | null {
  return BY_CODE.get(value) ?? null;
}

/** The instruction word for an extended mnemonic, or for LDA, STA, ADD and SUB with a mode. */
export function encodeExt(mnemonic: ExtMnemonic | ModeMnemonic, mode?: AddressMode): number {
  for (const d of BY_CODE.values()) if (d.mnemonic === mnemonic && d.mode === mode) return d.code;
  throw new RangeError(`${mnemonic}${mode ? ` (${mode})` : ""} is not an extended instruction.`);
}

export const EXT_MNEMONICS: readonly ExtMnemonic[] = [
  "PUSH",
  "POP",
  "CALL",
  "RET",
  "LDX",
  "STX",
  "INX",
  "DEX",
  "EI",
  "DI",
  "RTI",
  "VEC",
  "WAIT",
  "GET",
  "PUT",
];

/** Extended mnemonics that take an operand (an address, or a port for GET and PUT). */
export function extTakesOperand(mnemonic: ExtMnemonic): boolean {
  return [...BY_CODE.values()].some((d) => d.mnemonic === mnemonic && !d.mode && d.words === 2);
}

const FETCH_OPERAND: readonly MicroOp[] = ["operand-fetch-address", "operand-fetch-read"];

/** The execute micro-steps of an extended instruction, in order. */
export function extSteps(d: ExtDecoded): readonly MicroOp[] {
  if (d.mode) {
    const address: MicroOp[] =
      d.mode === "indirect"
        ? ["indirect-address", "indirect-read", "operand-address"]
        : ["index-add"];
    const finish: MicroOp[] =
      d.mnemonic === "STA"
        ? ["store-mdr", "store-write"]
        : ["operand-read", d.mnemonic === "LDA" ? "load-acc" : "alu"];
    return [...FETCH_OPERAND, ...address, ...finish];
  }
  switch (d.mnemonic) {
    case "PUSH":
      return ["stack-push"];
    case "POP":
      return ["stack-pop", "load-acc"];
    case "CALL":
      return [...FETCH_OPERAND, "stack-push", "branch"];
    case "RET":
      return ["stack-pop", "branch"];
    case "LDX":
      return [...FETCH_OPERAND, "operand-address", "operand-read", "load-x"];
    case "STX":
      return [...FETCH_OPERAND, "operand-address", "store-mdr", "store-write"];
    case "INX":
    case "DEX":
      return ["index-change"];
    case "EI":
    case "DI":
      return ["interrupt-enable"];
    case "RTI":
      return ["stack-pop", "stack-pop", "stack-pop", "interrupt-enable"];
    case "VEC":
      return [...FETCH_OPERAND, "set-vector"];
    case "WAIT":
      return ["wait"];
    case "GET":
      return [...FETCH_OPERAND, "device-read"];
    default:
      return [...FETCH_OPERAND, "device-write"];
  }
}

/** Interrupt entry, run between instructions in place of a fetch. */
export const INTERRUPT_STEPS: readonly MicroOp[] = [
  "interrupt-accept",
  "stack-push",
  "stack-push",
  "stack-push",
  "interrupt-jump",
];

/** `stage` values from here on are interrupt entry steps. */
export const INTERRUPT_STAGE = 100;
