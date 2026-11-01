/**
 * A dialect fixes every edge-case rule that textbooks, exam boards and simulators disagree on.
 * Each dialect has a matching spec in docs/specs/dialects/ that names the source of every rule.
 */

export type DialectId = "classic" | "higginson" | "ocr";

export type Mnemonic =
  "ADD" | "SUB" | "STA" | "LDA" | "BRA" | "BRZ" | "BRP" | "INP" | "OUT" | "OTC" | "HLT";

/** Instructions of the extended machine (docs/specs/extended.md). */
export type ExtMnemonic =
  | "PUSH"
  | "POP"
  | "CALL"
  | "RET"
  | "LDX"
  | "STX"
  | "INX"
  | "DEX"
  | "EI"
  | "DI"
  | "RTI"
  | "VEC"
  | "WAIT"
  | "GET"
  | "PUT";

/** Any instruction either machine can run. INT names an interrupt entry in traces. */
export type AnyMnemonic = Mnemonic | ExtMnemonic | "INT";

/**
 * How the accumulator handles results outside its range.
 *
 * - `unsigned-wrap`: values are 000 to 999. Results wrap modulo 1000. A subtraction below zero
 *   sets the negative flag; every other write to the accumulator clears it.
 * - `signed-wrap`: values are -999 to 999. Results beyond that wrap modulo 1000, keeping their
 *   sign. The negative flag is simply "the accumulator is below zero".
 */
export type ArithmeticMode = "unsigned-wrap" | "signed-wrap";

/** What the assembler does when an instruction that needs an address has none. */
export type MissingOperandRule = "error" | "zero-with-warning";

export interface Dialect {
  readonly id: DialectId;
  readonly name: string;
  readonly summary: string;
  /** Path of the spec file, relative to the repository root. */
  readonly spec: string;

  /** Smallest and largest value a mailbox, the accumulator or an input can hold. */
  readonly minValue: number;
  readonly maxValue: number;
  readonly arithmetic: ArithmeticMode;

  /** BRZ branches only when the accumulator is zero and the negative flag is clear. */
  readonly brzRequiresFlagClear: boolean;

  /** Accepted spellings, upper case. The first spelling listed for a mnemonic is canonical. */
  readonly spellings: Readonly<Record<string, Mnemonic>>;
  /** Mnemonics known to other dialects but not this one, for helpful errors. */
  readonly unsupported: Readonly<Record<string, string>>;

  readonly missingOperand: MissingOperandRule;
}
