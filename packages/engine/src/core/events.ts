import type { AnyMnemonic } from "../dialects/types";
import type { DeviceName } from "../machines/extended/devices";
import type { AddressMode } from "../machines/extended/semantics";
import type { InterruptSource } from "../machines/extended/types";
import type { MachineError, OutputItem } from "./types";

export type Register = "PC" | "MAR" | "MDR" | "IR" | "ACC" | "SP" | "X" | "IV";
export type Component = Register | "MEMORY" | "ALU" | "CONTROL" | "INPUT" | "OUTPUT" | "DEVICE";

export type Phase = "fetch" | "decode" | "execute" | "interrupt";

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
  | "halt"
  // The extended machine (docs/specs/extended.md).
  | "operand-fetch-address" // MAR <- PC
  | "operand-fetch-read" // MDR <- memory[MAR]; PC <- PC + 1
  | "indirect-address" // MAR <- operand
  | "indirect-read" // MDR <- memory[MAR]: the effective address
  | "index-add" // MAR <- operand + X
  | "load-x" // X <- MDR
  | "index-change" // X <- X +/- 1
  | "stack-push" // SP <- SP - 1; memory[SP] <- value
  | "stack-pop" // value <- memory[SP]; SP <- SP + 1
  | "interrupt-enable" // IE <- on or off
  | "set-vector" // IV <- operand
  | "wait"
  | "device-read" // ACC <- port
  | "device-write" // port <- ACC
  | "interrupt-accept"
  | "interrupt-jump"; // PC <- IV

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
      readonly mnemonic: AnyMnemonic;
      readonly mode?: AddressMode;
    }
  | {
      readonly type: "alu";
      readonly operation: "add" | "sub";
      /** The register changed: ACC, or X for INX and DEX. Absent means ACC. */
      readonly register?: "ACC" | "X";
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
      readonly mnemonic: AnyMnemonic;
      readonly mode?: AddressMode;
    }
  // The extended machine.
  | {
      readonly type: "stack-push";
      readonly address: number;
      readonly value: number;
      readonly sp: number;
      readonly reason: "push" | "call" | "interrupt";
      /** For interrupt entry: which register is saved. */
      readonly saves?: "PC" | "ACC" | "flag";
    }
  | {
      readonly type: "stack-pop";
      readonly address: number;
      readonly value: number;
      readonly sp: number;
      readonly reason: "pop" | "return" | "interrupt-return";
      readonly restores?: "PC" | "ACC" | "flag";
    }
  | {
      readonly type: "call";
      readonly from: number;
      readonly target: number;
      readonly returnAddress: number;
    }
  | { readonly type: "return"; readonly from: number; readonly target: number }
  | {
      readonly type: "effective-address";
      readonly mode: AddressMode;
      readonly operand: number;
      /** The pointer's value (indirect) or X (indexed). */
      readonly via: number;
      readonly address: number;
    }
  | {
      readonly type: "register-change";
      readonly register: "X" | "IE" | "IV";
      readonly value: number | boolean;
    }
  | { readonly type: "interrupt-raised"; readonly source: InterruptSource }
  | {
      readonly type: "interrupt-enter";
      readonly source: InterruptSource;
      /** Where the main program will resume. */
      readonly from: number;
      readonly handler: number;
    }
  | { readonly type: "interrupt-return"; readonly target: number }
  | {
      readonly type: "device-read";
      readonly device: DeviceName;
      readonly port: number;
      readonly value: number;
    }
  | {
      readonly type: "device-write";
      readonly device: DeviceName;
      readonly port: number;
      readonly value: number;
      /** Pixels whose colour changed. */
      readonly pixels?: readonly number[];
    }
  | { readonly type: "key"; readonly key: number; readonly dropped: boolean }
  | { readonly type: "beep"; readonly note: number; readonly length: number }
  | { readonly type: "wait"; readonly idle: boolean }
  // The multicore machine: which core ran this micro-step.
  | { readonly type: "core"; readonly core: number };

export interface MicroStep {
  readonly phase: Phase;
  readonly op: MicroOp;
  readonly events: readonly EngineEvent[];
}
