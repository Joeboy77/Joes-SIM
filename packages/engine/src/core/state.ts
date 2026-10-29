import { DEFAULT_DIALECT, getDialect } from "../dialects/dialects";
import type { DialectId } from "../dialects/types";
import { inRange } from "./semantics";
import { MEMORY_SIZE, type MachineState } from "./types";

export interface CreateStateOptions {
  /** Up to 100 mailbox values; missing mailboxes start at 0. */
  readonly memory?: readonly number[];
  readonly inputs?: readonly number[];
  readonly dialect?: DialectId;
}

/** A fresh machine with the program loaded and the program counter at 00. */
export function createState(options: CreateStateOptions = {}): MachineState {
  const dialectId = options.dialect ?? DEFAULT_DIALECT;
  const dialect = getDialect(dialectId);
  const source = options.memory ?? [];
  if (source.length > MEMORY_SIZE) {
    throw new RangeError(`Memory has ${MEMORY_SIZE} mailboxes; got ${source.length} values.`);
  }
  const memory = Array.from({ length: MEMORY_SIZE }, (_, i) => source[i] ?? 0);
  memory.forEach((value, address) => {
    if (!inRange(value, dialect)) {
      throw new RangeError(
        `Mailbox ${address} holds ${value}, outside ${dialect.minValue} to ${dialect.maxValue} for the ${dialect.name} dialect.`,
      );
    }
  });
  const inputs = [...(options.inputs ?? [])];
  inputs.forEach((value) => assertInput(value, dialectId));

  return {
    dialect: dialectId,
    memory,
    pc: 0,
    mar: 0,
    mdr: 0,
    ir: 0,
    acc: 0,
    negative: false,
    inputs,
    inputIndex: 0,
    outputs: [],
    status: "ready",
    error: null,
    stage: 0,
    currentAddress: 0,
    cycles: 0,
    microSteps: 0,
  };
}

export function isValidInput(value: number, dialect: DialectId): boolean {
  return inRange(value, getDialect(dialect));
}

function assertInput(value: number, dialectId: DialectId): void {
  if (!isValidInput(value, dialectId)) {
    const d = getDialect(dialectId);
    throw new RangeError(
      `Input ${value} is outside ${d.minValue} to ${d.maxValue} for the ${d.name} dialect.`,
    );
  }
}

/** Adds an input to the end of the queue. A machine waiting for input becomes ready again. */
export function provideInput(state: MachineState, value: number): MachineState {
  assertInput(value, state.dialect);
  return {
    ...state,
    inputs: [...state.inputs, value],
    status: state.status === "waiting-input" ? "ready" : state.status,
  };
}

/** True when stepping can make progress. */
export function canStep(state: MachineState): boolean {
  return state.status === "ready";
}

export function isFinished(state: MachineState): boolean {
  return state.status === "halted" || state.status === "error";
}
