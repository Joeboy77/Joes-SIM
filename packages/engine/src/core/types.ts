import type { DialectId } from "../dialects/types";
import type { ExtendedState } from "../machines/extended/types";

export const MEMORY_SIZE = 100;

export type OutputItem =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "char"; readonly value: number; readonly char: string };

export type MachineStatus = "ready" | "waiting-input" | "waiting-interrupt" | "halted" | "error";

export type MachineErrorCode =
  | "invalid-instruction"
  // The extended machine only (docs/specs/extended.md).
  | "address-out-of-range"
  | "stack-overflow"
  | "stack-underflow"
  | "device-error"
  | "wait-forever";

export interface MachineError {
  readonly code: MachineErrorCode;
  readonly message: string;
  /** Address of the instruction that caused the error. */
  readonly address: number;
  /** The value that could not be run. */
  readonly value: number;
}

/**
 * The whole machine as plain, serialisable data. Never mutated: every step returns a new state.
 * Arrays are shared between states until they change (copy on write), so states are cheap.
 */
export interface MachineState {
  readonly dialect: DialectId;
  readonly memory: readonly number[];
  readonly pc: number;
  readonly mar: number;
  readonly mdr: number;
  readonly ir: number;
  readonly acc: number;
  readonly negative: boolean;

  /** All inputs given so far; `inputIndex` is the next one to be read. */
  readonly inputs: readonly number[];
  readonly inputIndex: number;
  readonly outputs: readonly OutputItem[];

  readonly status: MachineStatus;
  readonly error: MachineError | null;

  /**
   * Position inside the current instruction: 0 to 3 fetch, 4 decode, 5 and up execute.
   * 0 means the machine is between instructions.
   */
  readonly stage: number;
  /** Address of the instruction being (or last) executed. */
  readonly currentAddress: number;
  /** Instructions completed (fetch, decode, execute cycles). */
  readonly cycles: number;
  /** Micro-steps completed. */
  readonly microSteps: number;

  /**
   * The extended machine's registers and devices. Absent on the classic machine, which then
   * behaves exactly as before.
   */
  readonly ext?: ExtendedState;
}
