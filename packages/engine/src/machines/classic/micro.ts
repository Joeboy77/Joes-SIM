/**
 * The classic machine, one micro-step at a time. Each call performs exactly one register
 * transfer of the fetch, decode, execute cycle and reports it as events.
 */
import { getDialect } from "../../dialects/dialects";
import type { Dialect } from "../../dialects/types";
import type { EngineEvent, MicroOp, MicroStep, Phase } from "../../core/events";
import {
  DECODE_STAGE,
  EXECUTE_START,
  alu,
  branchTaken,
  decode,
  executeLength,
  flagAfterLoad,
  type Decoded,
} from "../../core/semantics";
import { MEMORY_SIZE, type MachineState, type OutputItem } from "../../core/types";
import type { AnyMnemonic } from "../../dialects/types";
import { completeExt, executeExt, interruptPending, interruptStep } from "../extended/micro";
import { stepMulticore } from "../multicore/micro";
import {
  INTERRUPT_STAGE,
  decodeExt,
  type AddressMode,
  type ExtDecoded,
} from "../extended/semantics";

export interface MicroResult {
  readonly state: MachineState;
  readonly step: MicroStep | null;
}

export type Changes = { -readonly [K in keyof MachineState]?: MachineState[K] };

export function stepMicro(state: MachineState): MicroResult {
  if (state.multi) return stepMulticore(state);
  if (state.status !== "ready") {
    if (state.status === "waiting-input" && state.stage >= EXECUTE_START) {
      return { state, step: { phase: "execute", op: "input", events: [{ type: "input-needed" }] } };
    }
    if (state.status === "waiting-interrupt") {
      return {
        state,
        step: { phase: "execute", op: "wait", events: [{ type: "wait", idle: true }] },
      };
    }
    return { state, step: null };
  }
  const dialect = getDialect(state.dialect);
  const { stage } = state;

  // The extended machine takes a pending interrupt between instructions.
  if (state.ext) {
    if (stage >= INTERRUPT_STAGE) return interruptStep(state);
    if (stage === 0 && interruptPending(state.ext)) {
      return interruptStep({ ...state, stage: INTERRUPT_STAGE });
    }
  }

  if (stage === 0) {
    return micro(state, "fetch", "fetch-address", { mar: state.pc, currentAddress: state.pc }, [
      { type: "transfer", from: "PC", to: "MAR", value: state.pc },
    ]);
  }
  if (stage === 1) {
    const value = state.memory[state.mar] ?? 0;
    return micro(state, "fetch", "fetch-read", { mdr: value }, [
      { type: "memory-read", address: state.mar, value },
      { type: "transfer", from: "MEMORY", to: "MDR", value },
    ]);
  }
  if (stage === 2) {
    return micro(state, "fetch", "fetch-load-ir", { ir: state.mdr }, [
      { type: "transfer", from: "MDR", to: "IR", value: state.mdr },
    ]);
  }
  if (stage === 3) {
    const next = (state.pc + 1) % MEMORY_SIZE;
    return micro(state, "fetch", "fetch-increment", { pc: next }, [
      { type: "pc-increment", previous: state.pc, value: next },
    ]);
  }

  const extDecoded = state.ext && Math.floor(state.ir / 100) === 4 ? decodeExt(state.ir) : null;
  const decoded = extDecoded ?? decode(state.ir, dialect);
  if (stage === DECODE_STAGE) {
    if (!decoded) {
      const error = {
        code: "invalid-instruction" as const,
        message: invalidMessage(state.ir),
        address: state.currentAddress,
        value: state.ir,
      };
      const next: MachineState = {
        ...state,
        status: "error",
        error,
        microSteps: state.microSteps + 1,
      };
      return {
        state: next,
        step: { phase: "decode", op: "decode", events: [{ type: "error", error }] },
      };
    }
    return micro(state, "decode", "decode", {}, [
      extDecoded
        ? {
            type: "decode",
            instruction: state.ir,
            opcode: 4,
            address: state.ir % 100,
            mnemonic: extDecoded.mnemonic,
            ...(extDecoded.mode ? { mode: extDecoded.mode } : {}),
          }
        : { type: "decode", instruction: state.ir, ...(decoded as Decoded) },
      { type: "transfer", from: "IR", to: "CONTROL", value: state.ir },
    ]);
  }

  // Execute stages. `decoded` is non-null: decode would have stopped the machine otherwise.
  if (extDecoded) return executeExt(state, extDecoded, stage - EXECUTE_START, dialect);
  return execute(state, decoded as Decoded, stage - EXECUTE_START, dialect);
}

function execute(state: MachineState, d: Decoded, index: number, dialect: Dialect): MicroResult {
  const last = index === executeLength(d.mnemonic) - 1;
  const done = (op: MicroOp, changes: Changes, events: EngineEvent[]) =>
    micro(state, "execute", op, changes, events, last ? d : undefined);

  switch (d.mnemonic) {
    case "ADD":
    case "SUB":
    case "LDA": {
      if (index === 0) return operandAddress(state, d, done);
      if (index === 1) {
        const value = state.memory[state.mar] ?? 0;
        return done("operand-read", { mdr: value }, [
          { type: "memory-read", address: state.mar, value },
          { type: "transfer", from: "MEMORY", to: "MDR", value },
        ]);
      }
      if (d.mnemonic === "LDA") {
        const negative = flagAfterLoad(state.mdr);
        return done("load-acc", { acc: state.mdr, negative }, [
          { type: "transfer", from: "MDR", to: "ACC", value: state.mdr },
          ...flagEvent(state.negative, negative),
        ]);
      }
      const operation = d.mnemonic === "ADD" ? "add" : "sub";
      const r = alu(operation, state.acc, state.mdr, dialect);
      return done("alu", { acc: r.result, negative: r.negative }, [
        { type: "transfer", from: "MDR", to: "ALU", value: state.mdr },
        {
          type: "alu",
          operation,
          a: state.acc,
          b: state.mdr,
          raw: r.raw,
          result: r.result,
          wrapped: r.wrapped,
        },
        { type: "transfer", from: "ALU", to: "ACC", value: r.result },
        ...flagEvent(state.negative, r.negative),
      ]);
    }
    case "STA": {
      if (index === 0) return operandAddress(state, d, done);
      if (index === 1) {
        return done("store-mdr", { mdr: state.acc }, [
          { type: "transfer", from: "ACC", to: "MDR", value: state.acc },
        ]);
      }
      const previous = state.memory[state.mar] ?? 0;
      const memory = state.memory.slice();
      memory[state.mar] = state.mdr;
      return done("store-write", { memory }, [
        { type: "transfer", from: "MDR", to: "MEMORY", value: state.mdr },
        { type: "memory-write", address: state.mar, previous, value: state.mdr },
      ]);
    }
    case "BRA":
    case "BRZ":
    case "BRP": {
      const taken = branchTaken(d.mnemonic, state.acc, state.negative, dialect);
      const events: EngineEvent[] = [
        {
          type: "branch",
          mnemonic: d.mnemonic,
          taken,
          from: state.currentAddress,
          target: d.address,
        },
      ];
      if (taken) events.push({ type: "transfer", from: "IR", to: "PC", value: d.address });
      return done("branch", taken ? { pc: d.address } : {}, events);
    }
    case "INP": {
      if (state.inputIndex >= state.inputs.length) {
        return {
          state: { ...state, status: "waiting-input" },
          step: { phase: "execute", op: "input", events: [{ type: "input-needed" }] },
        };
      }
      const value = state.inputs[state.inputIndex] ?? 0;
      const negative = flagAfterLoad(value);
      return done("input", { acc: value, negative, inputIndex: state.inputIndex + 1 }, [
        { type: "input", value, index: state.inputIndex },
        { type: "transfer", from: "INPUT", to: "ACC", value },
        ...flagEvent(state.negative, negative),
      ]);
    }
    case "OUT":
    case "OTC": {
      const item: OutputItem =
        d.mnemonic === "OUT"
          ? { kind: "number", value: state.acc }
          : { kind: "char", value: state.acc, char: toChar(state.acc) };
      return done("output", { outputs: [...state.outputs, item] }, [
        { type: "transfer", from: "ACC", to: "OUTPUT", value: state.acc },
        { type: "output", item },
      ]);
    }
    case "HLT":
      return done("halt", { status: "halted" }, [{ type: "halt", address: state.currentAddress }]);
  }
}

function operandAddress(
  state: MachineState,
  d: Decoded,
  done: (op: MicroOp, changes: Changes, events: EngineEvent[]) => MicroResult,
): MicroResult {
  return done("operand-address", { mar: d.address }, [
    { type: "transfer", from: "IR", to: "MAR", value: d.address },
  ]);
}

export function flagEvent(previous: boolean, value: boolean): EngineEvent[] {
  return previous === value ? [] : [{ type: "flag-change", flag: "negative", value }];
}

/** Applies one micro-step. When `completes` is given, the instruction finishes with it. */
export function micro(
  state: MachineState,
  phase: Phase,
  op: MicroOp,
  changes: Changes,
  events: EngineEvent[],
  completes?:
    Decoded | ExtDecoded | { readonly mnemonic: AnyMnemonic; readonly mode?: AddressMode },
): MicroResult {
  let next: MachineState = {
    ...state,
    ...changes,
    stage: completes ? 0 : state.stage + 1,
    cycles: completes ? state.cycles + 1 : state.cycles,
    microSteps: state.microSteps + 1,
  };
  if (completes) {
    const mode = "mode" in completes ? completes.mode : undefined;
    events.push({
      type: "instruction-complete",
      address: state.currentAddress,
      instruction: state.ir,
      mnemonic: completes.mnemonic,
      ...(mode ? { mode } : {}),
    });
    // On the extended machine the timer counts the instruction and due keys arrive.
    if (next.ext) {
      const c = completeExt(next.ext, next.cycles, completes.mnemonic === "INT");
      next = { ...next, ext: c.ext };
      events.push(...c.events);
    }
  }
  return { state: next, step: { phase, op, events } };
}

export function toChar(code: number): string {
  return code >= 0 && code <= 0xffff ? String.fromCharCode(code) : "�";
}

export function invalidMessage(value: number): string {
  return `${formatValue(value)} is not an instruction the machine understands.`;
}

export function formatValue(value: number): string {
  return value < 0 ? `-${String(-value).padStart(3, "0")}` : String(value).padStart(3, "0");
}
