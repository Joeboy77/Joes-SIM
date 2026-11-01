import { FastCore } from "../machines/classic/fast";
import { stepMicro } from "../machines/classic/micro";
import { conditionMet, type RunCondition } from "./conditions";
import type { ExtendedState } from "../machines/extended/types";
import type { MachineState } from "./types";

export type StopReason =
  | "halted"
  | "error"
  | "waiting-input"
  | "waiting-interrupt"
  | "breakpoint"
  | "budget"
  | "infinite-loop"
  | "condition";

export interface InfiniteLoop {
  /** The instruction count (cycle) at which the repeating part begins. */
  readonly startCycle: number;
  /** Address of the first instruction of the repeating part. */
  readonly startAddress: number;
  /** Instructions in one trip round the loop. */
  readonly length: number;
}

export interface RunOptions {
  /** Most instructions to run before stopping with reason "budget". Default 1,000,000. */
  readonly maxSteps?: number;
  /** Stop before running an instruction at one of these addresses. */
  readonly breakpoints?: Iterable<number>;
  /** Stop when the machine state repeats with no input read. Default true. */
  readonly detectLoops?: boolean;
  /** Stop after the first instruction that makes any of these true. */
  readonly conditions?: readonly RunCondition[];
}

export interface RunResult {
  readonly state: MachineState;
  readonly reason: StopReason;
  readonly loop?: InfiniteLoop;
  /** Which condition stopped the run, when the reason is "condition". */
  readonly condition?: number;
}

export const DEFAULT_STEP_BUDGET = 1_000_000;

/**
 * Runs until the program stops, needs input, reaches a breakpoint, uses up its budget or is
 * proven to loop forever. No events are produced; use `step` to watch execution.
 */
export function run(initial: MachineState, options: RunOptions = {}): RunResult {
  const budget = options.maxSteps ?? DEFAULT_STEP_BUDGET;
  const breakpoints = new Set(options.breakpoints ?? []);
  const detectLoops = options.detectLoops ?? true;
  const conditions = options.conditions ?? [];
  const metCondition = (view: Parameters<typeof conditionMet>[1]) =>
    conditions.findIndex((c) => conditionMet(c, view));

  let state = initial;
  let executed = 0;
  // Finish an instruction that is part-way through, one micro-step at a time.
  if (state.stage !== 0 && state.status === "ready") {
    while (state.stage !== 0 && state.status === "ready") state = stepMicro(state).state;
    executed = 1;
  }
  const early = stopReason(state);
  if (early) return { state, reason: early };
  if (executed > 0) {
    const met = metCondition(state);
    if (met >= 0) return { state, reason: "condition", condition: met };
  }

  const core = new FastCore(state);
  const detector = detectLoops ? new LoopDetector(core) : null;

  while (true) {
    if (executed > 0 && breakpoints.has(core.pc))
      return { state: core.toState(), reason: "breakpoint" };
    if (executed >= budget) return { state: core.toState(), reason: "budget" };
    const outcome = core.exec();
    executed++;
    if (outcome === "halted") return { state: core.toState(), reason: "halted" };
    if (outcome === "error") return { state: core.toState(), reason: "error" };
    if (outcome === "waiting-input") return { state: core.toState(), reason: "waiting-input" };
    if (outcome === "waiting-interrupt") {
      return { state: core.toState(), reason: "waiting-interrupt" };
    }
    if (conditions.length > 0) {
      const met = metCondition(core);
      if (met >= 0) return { state: core.toState(), reason: "condition", condition: met };
    }
    const loop = detector?.observe();
    if (loop) return { state: core.toState(), reason: "infinite-loop", loop };
  }
}

function stopReason(state: MachineState): StopReason | null {
  if (state.status === "halted") return "halted";
  if (state.status === "error") return "error";
  if (state.status === "waiting-input") return "waiting-input";
  if (state.status === "waiting-interrupt") return "waiting-interrupt";
  return null;
}

interface Snapshot {
  pc: number;
  acc: number;
  negative: boolean;
  memory: number[];
  version: number;
  cycles: number;
  ext: ExtendedState | undefined;
}

/**
 * Proves a program can never halt. Between inputs the machine is deterministic, so if its state
 * (memory, PC, accumulator, flag) ever repeats, it will repeat forever. Uses Brent's cycle
 * detection: constant extra memory, and found within a few trips round the loop.
 */
class LoopDetector {
  private segmentStart!: Snapshot;
  private tortoise!: Snapshot;
  private power = 1;
  private lambda = 0;
  private inputIndex = -1;
  private keyboardReads = -1;
  private keyIndex = -1;

  constructor(private readonly core: FastCore) {
    this.reset();
  }

  observe(): InfiniteLoop | null {
    const core = this.core;
    // With interrupts on, a key press can arrive at any moment and change what happens next,
    // so a repeating stretch does not prove the program will never stop.
    if (
      core.ext?.ie ||
      core.inputIndex !== this.inputIndex ||
      core.keyboardReads !== this.keyboardReads ||
      (core.ext?.keyIndex ?? 0) !== this.keyIndex
    ) {
      this.reset();
      return null;
    }
    this.lambda++;
    if (this.sameAsTortoise()) return this.locate(this.lambda);
    // Brent: move the tortoise up to the hare each time the step count reaches a power of two.
    if (this.lambda === this.power) {
      this.tortoise = this.snapshot();
      this.power *= 2;
      this.lambda = 0;
    }
    return null;
  }

  private reset(): void {
    this.inputIndex = this.core.inputIndex;
    this.keyboardReads = this.core.keyboardReads;
    this.keyIndex = this.core.ext?.keyIndex ?? 0;
    this.segmentStart = this.snapshot();
    this.tortoise = this.segmentStart;
    this.power = 1;
    this.lambda = 0;
  }

  private snapshot(): Snapshot {
    const c = this.core;
    return {
      pc: c.pc,
      acc: c.acc,
      negative: c.negative,
      memory: c.snapshotMemory(),
      version: c.memoryVersion,
      cycles: c.cycles,
      ext: c.ext,
    };
  }

  private sameAsTortoise(): boolean {
    const c = this.core;
    const t = this.tortoise;
    if (c.pc !== t.pc || c.acc !== t.acc || c.negative !== t.negative) return false;
    if (!sameExt(c.ext, t.ext)) return false;
    if (c.memoryVersion === t.version) return true;
    return sameMemory(c.memory, t.memory);
  }

  /** Finds where the loop begins by replaying from the start of this input-free stretch. */
  private locate(length: number): InfiniteLoop {
    const start = this.segmentStart;
    const base = this.core.toState();
    const fromStart = (): FastCore =>
      new FastCore({
        ...base,
        pc: start.pc,
        acc: start.acc,
        negative: start.negative,
        memory: start.memory,
        cycles: start.cycles,
        status: "ready",
        stage: 0,
        ...(start.ext ? { ext: start.ext } : {}),
      });
    const a = fromStart();
    const b = fromStart();
    for (let i = 0; i < length; i++) b.exec();
    let mu = 0;
    while (!(
      a.pc === b.pc &&
      a.acc === b.acc &&
      a.negative === b.negative &&
      sameExt(a.ext, b.ext) &&
      sameMemory(a.memory, b.memory)
    )) {
      a.exec();
      b.exec();
      mu++;
    }
    return { startCycle: start.cycles + mu, startAddress: a.pc, length };
  }
}

function sameMemory(a: readonly number[], b: readonly number[]): boolean {
  if (a === b) return true;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Whether two extended states are the same, ignoring the key schedule (no keys arrive in a loop). */
function sameExt(a: ExtendedState | undefined, b: ExtendedState | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (
    a.sp !== b.sp ||
    a.x !== b.x ||
    a.ie !== b.ie ||
    a.iv !== b.iv ||
    a.timerPending !== b.timerPending ||
    a.keyboardPending !== b.keyboardPending ||
    a.cause !== b.cause ||
    a.operand !== b.operand
  ) {
    return false;
  }
  const d = a.devices;
  const e = b.devices;
  return (
    d.console === e.console &&
    d.pixel === e.pixel &&
    d.timerPeriod === e.timerPeriod &&
    d.timerLeft === e.timerLeft &&
    d.minus === e.minus &&
    d.note === e.note &&
    d.noteLength === e.noteLength &&
    sameMemory(d.keyboard, e.keyboard) &&
    d.keyboard.length === e.keyboard.length &&
    sameMemory(d.segments, e.segments) &&
    sameMemory(d.pixels, e.pixels)
  );
}
