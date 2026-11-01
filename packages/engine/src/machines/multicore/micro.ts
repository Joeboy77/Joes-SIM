/**
 * The multicore machine, one micro-step at a time (docs/specs/multicore.md). The scheduler picks a
 * core at the start of each instruction; that core runs the whole instruction on the classic
 * micro-step machine, against the shared memory and trays, before any other core may run.
 */
import type { EngineEvent, MicroOp } from "../../core/events";
import { DECODE_STAGE, flagAfterLoad } from "../../core/semantics";
import { MEMORY_SIZE, type MachineState, type MachineStatus } from "../../core/types";
import { flagEvent, micro, stepMicro, type MicroResult } from "../classic/micro";
import { DEFAULT_SCHEDULE, type CoreState, type MulticoreState, type Schedule } from "./types";

/** The instruction word of TAS: the address is in the next mailbox. */
export const TAS = 460;
export const MIN_CORES = 2;
export const MAX_CORES = 4;
/** Name tags for the cores' Little Men. */
export const CORE_NAMES = ["Kofi", "Kwame", "Yaw", "Kojo"] as const;

export interface CreateMulticoreOptions {
  readonly cores?: number;
  /** Where each core starts. Missing entries start at 00. */
  readonly starts?: readonly number[];
  readonly schedule?: Schedule;
  /** Manual choices already made, one core per step. */
  readonly choices?: readonly number[];
}

export function createMulticore(options: CreateMulticoreOptions = {}): MulticoreState {
  const count = options.cores ?? MIN_CORES;
  if (!Number.isInteger(count) || count < MIN_CORES || count > MAX_CORES) {
    throw new RangeError(`A multicore machine has ${MIN_CORES} to ${MAX_CORES} cores.`);
  }
  const schedule = options.schedule ?? DEFAULT_SCHEDULE;
  const cores = Array.from({ length: count }, (_, i): CoreState => {
    const pc = options.starts?.[i] ?? 0;
    return {
      pc,
      mar: 0,
      mdr: 0,
      ir: 0,
      acc: 0,
      negative: false,
      stage: 0,
      currentAddress: pc,
      status: "ready",
      cycles: 0,
      operand: 0,
    };
  });
  return {
    cores,
    schedule,
    rng: schedule.seed >>> 0 || 1,
    turn: 0,
    used: 0,
    choices: [...(options.choices ?? [])],
    selected: 0,
    active: null,
    last: null,
  };
}

function xorshift(x: number): number {
  let y = x >>> 0 || 1;
  y ^= y << 13;
  y >>>= 0;
  y ^= y >>> 17;
  y ^= y << 5;
  return y >>> 0;
}

/** A core can run if it is ready, or waiting for input that has now arrived. */
export function canRun(core: CoreState, state: MachineState): boolean {
  return (
    core.status === "ready" ||
    (core.status === "waiting-input" && state.inputIndex < state.inputs.length)
  );
}

/** The core the scheduler runs next, and the scheduler's state after choosing it. */
export function pickCore(
  state: MachineState,
  m: MulticoreState,
): { core: number; multi: MulticoreState } | null {
  const n = m.cores.length;
  const ok = (i: number) => canRun(m.cores[i] as CoreState, state);
  const ready = Array.from({ length: n }, (_, i) => i).filter(ok);
  if (ready.length === 0) return null;
  const nextFrom = (start: number) => {
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      if (ok(i)) return i;
    }
    return start;
  };
  switch (m.schedule.mode) {
    case "round-robin": {
      const stay = ok(m.turn) && m.used < m.schedule.quantum;
      const core = stay ? m.turn : nextFrom(m.turn + 1);
      return { core, multi: { ...m, turn: core, used: (stay ? m.used : 0) + 1 } };
    }
    case "random": {
      const rng = xorshift(m.rng);
      return { core: ready[rng % ready.length] as number, multi: { ...m, rng } };
    }
    default: {
      const want = m.choices[state.cycles] ?? m.selected;
      const core = nextFrom(Math.min(Math.max(0, want), n - 1));
      const choices = m.choices.length > state.cycles ? m.choices : [...m.choices, core];
      return { core, multi: { ...m, choices } };
    }
  }
}

/** One core seen as a single machine, over the shared memory and trays. */
function viewOf(state: MachineState, c: CoreState): MachineState {
  return {
    dialect: state.dialect,
    memory: state.memory,
    inputs: state.inputs,
    inputIndex: state.inputIndex,
    outputs: state.outputs,
    error: state.error,
    microSteps: state.microSteps,
    pc: c.pc,
    mar: c.mar,
    mdr: c.mdr,
    ir: c.ir,
    acc: c.acc,
    negative: c.negative,
    stage: c.stage,
    currentAddress: c.currentAddress,
    cycles: c.cycles,
    status: "ready",
  };
}

const TAS_STEPS: readonly MicroOp[] = [
  "operand-fetch-address",
  "operand-fetch-read",
  "operand-address",
  "operand-read",
  "load-acc",
  "store-write",
];

/** One micro-step of TAS, from decode on. Returns the new operand register too. */
function tasStep(view: MachineState, operand: number): { result: MicroResult; operand: number } {
  const index = view.stage - DECODE_STAGE - 1;
  if (index < 0) {
    return {
      operand,
      result: micro(view, "decode", "decode", {}, [
        {
          type: "decode",
          instruction: TAS,
          opcode: 4,
          address: TAS % 100,
          mnemonic: "TAS",
        },
        { type: "transfer", from: "IR", to: "CONTROL", value: TAS },
      ]),
    };
  }
  const op = TAS_STEPS[index] as MicroOp;
  const last = index === TAS_STEPS.length - 1;
  const done = (changes: Parameters<typeof micro>[3], events: EngineEvent[]) =>
    micro(view, "execute", op, changes, events, last ? { mnemonic: "TAS" } : undefined);
  switch (op) {
    case "operand-fetch-address":
      return {
        operand,
        result: done({ mar: view.pc }, [
          { type: "transfer", from: "PC", to: "MAR", value: view.pc },
        ]),
      };
    case "operand-fetch-read": {
      const value = view.memory[view.mar] as number;
      const next = (view.pc + 1) % MEMORY_SIZE;
      return {
        operand: value,
        result: done({ mdr: value, pc: next }, [
          { type: "memory-read", address: view.mar, value },
          { type: "transfer", from: "MEMORY", to: "MDR", value },
          { type: "pc-increment", previous: view.pc, value: next },
        ]),
      };
    }
    case "operand-address": {
      if (!(Number.isInteger(operand) && operand >= 0 && operand < MEMORY_SIZE)) {
        const error = {
          code: "address-out-of-range" as const,
          message: `The address after TAS is ${operand}, which is not a mailbox address (00 to 99).`,
          address: view.currentAddress,
          value: view.ir,
        };
        return {
          operand,
          result: {
            state: { ...view, status: "error", error, microSteps: view.microSteps + 1 },
            step: { phase: "execute", op, events: [{ type: "error", error }] },
          },
        };
      }
      return {
        operand,
        result: done({ mar: operand }, [
          { type: "transfer", from: "MDR", to: "MAR", value: operand },
        ]),
      };
    }
    case "operand-read": {
      const value = view.memory[view.mar] as number;
      return {
        operand,
        result: done({ mdr: value }, [
          { type: "memory-read", address: view.mar, value },
          { type: "transfer", from: "MEMORY", to: "MDR", value },
        ]),
      };
    }
    case "load-acc": {
      const negative = flagAfterLoad(view.mdr);
      return {
        operand,
        result: done({ acc: view.mdr, negative }, [
          { type: "transfer", from: "MDR", to: "ACC", value: view.mdr },
          ...flagEvent(view.negative, negative),
        ]),
      };
    }
    default: {
      // store-write: the lock becomes 1, in the same instruction as the read.
      const previous = view.memory[view.mar] as number;
      const memory = view.memory.slice();
      memory[view.mar] = 1;
      return {
        operand,
        result: done({ memory }, [{ type: "memory-write", address: view.mar, previous, value: 1 }]),
      };
    }
  }
}

function overallStatus(cores: readonly CoreState[], state: MachineState): MachineStatus {
  if (cores.some((c) => c.status === "error")) return "error";
  if (cores.every((c) => c.status === "halted")) return "halted";
  if (cores.some((c) => canRun(c, state))) return "ready";
  return "waiting-input";
}

/** One micro-step of the multicore machine. */
export function stepMulticore(state: MachineState): MicroResult {
  const m = state.multi as MulticoreState;
  if (state.status !== "ready") return { state, step: null };
  let multi = m;
  let core = m.active;
  if (core === null) {
    const picked = pickCore(state, m);
    if (!picked) return { state, step: null };
    core = picked.core;
    multi = picked.multi;
  }
  const before = multi.cores[core] as CoreState;
  const view = viewOf(state, before);
  const tas = view.ir === TAS && view.stage >= DECODE_STAGE;
  const { result, operand } = tas
    ? tasStep(view, before.operand)
    : { result: stepMicro(view), operand: before.operand };
  const r = result.state;
  const after: CoreState = {
    pc: r.pc,
    mar: r.mar,
    mdr: r.mdr,
    ir: r.ir,
    acc: r.acc,
    negative: r.negative,
    stage: r.stage,
    currentAddress: r.currentAddress,
    status: r.status === "waiting-interrupt" ? "ready" : r.status,
    cycles: r.cycles,
    operand,
  };
  const cores = multi.cores.map((c, i) => (i === core ? after : c));
  const completed = r.cycles > before.cycles;
  const outputs =
    r.outputs.length > state.outputs.length
      ? [...state.outputs, ...r.outputs.slice(state.outputs.length).map((o) => ({ ...o, core }))]
      : state.outputs;
  const shared = { ...state, memory: r.memory, inputIndex: r.inputIndex, outputs };
  const next: MachineState = {
    ...shared,
    pc: after.pc,
    mar: after.mar,
    mdr: after.mdr,
    ir: after.ir,
    acc: after.acc,
    negative: after.negative,
    stage: after.stage,
    currentAddress: after.currentAddress,
    error: r.error ?? state.error,
    microSteps: r.microSteps,
    cycles: state.cycles + (completed ? 1 : 0),
    status: overallStatus(cores, shared),
    multi: {
      ...multi,
      cores,
      active: after.stage !== 0 && after.status === "ready" ? core : null,
      last: core,
    },
  };
  const step = result.step
    ? { ...result.step, events: [{ type: "core" as const, core }, ...result.step.events] }
    : null;
  return { state: next, step };
}
