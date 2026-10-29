import type { Mnemonic } from "../dialects/types";
import type { MachineError, OutputItem } from "./types";

export type Register = "PC" | "MAR" | "MDR" | "IR" | "ACC";
export type Component = Register | "MEMORY" | "ALU" | "CONTROL" | "INPUT" | "OUTPUT";

export type Phase = "fetch" | "decode" | "execute";

export type MicroOp =
  | "fetch-address" // MAR <- PC
  | "fetch-read" // MDR <- memory[MAR]
  | "fetch-load-ir" // IR <- MDR
  | "fetch-increment" // PC <- PC + 1
  | "decode"
  | "operand-address" // MAR <- IR.address
  | "operand-read" // MDR <- memory[MAR]
  | "alu" // ACC <- ACC +/- MDR
  | "load-acc" // ACC <- MDR
  | "store-mdr" // MDR <- ACC
  | "store-write" // memory[MAR] <- MDR
  | "branch"
  | "input"
  | "output"
  | "halt";

/**
 * Everything the animation, narration, trace table and heatmap need. They read these events
 * and never look inside the engine.
 */
export type EngineEvent =
  | {
      readonly type: "transfer";
      readonly from: Component;
      readonly to: Component;
      readonly value: number;
    }
  | { readonly type: "memory-read"; readonly address: number; readonly value: number }
  | {
      readonly type: "memory-write";
      readonly address: number;
      readonly previous: number;
      readonly value: number;
    }
  | { readonly type: "pc-increment"; readonly previous: number; readonly value: number }
  | {
      readonly type: "decode";
      readonly instruction: number;
      readonly opcode: number;
      readonly address: number;
      readonly mnemonic: Mnemonic;
    }
  | {
      readonly type: "alu";
      readonly operation: "add" | "sub";
      readonly a: number;
      readonly b: number;
      /** The true mathematical result, before wrapping. */
      readonly raw: number;
      /** The value written to the accumulator. */
      readonly result: number;
      /** True when the result did not fit and wrapped. */
      readonly wrapped: boolean;
    }
  | { readonly type: "flag-change"; readonly flag: "negative"; readonly value: boolean }
  | {
      readonly type: "branch";
      readonly mnemonic: "BRA" | "BRZ" | "BRP";
      readonly taken: boolean;
      readonly from: number;
      readonly target: number;
    }
  | { readonly type: "input"; readonly value: number; readonly index: number }
  | { readonly type: "input-needed" }
  | { readonly type: "output"; readonly item: OutputItem }
  | { readonly type: "halt"; readonly address: number }
  | { readonly type: "error"; readonly error: MachineError }
  | {
      readonly type: "instruction-complete";
      readonly address: number;
      readonly instruction: number;
      readonly mnemonic: Mnemonic;
    };

export interface MicroStep {
  readonly phase: Phase;
  readonly op: MicroOp;
  readonly events: readonly EngineEvent[];
}
