/**
 * A compact record of a run, so learners can step backwards and scrub a timeline.
 *
 * Each micro-step is stored as a small diff (only what changed) with its events. A full state
 * (keyframe) is kept every `keyframeInterval` instructions, so any point can be rebuilt quickly.
 * When the run grows past `maxInstructions`, the oldest stretch is dropped and `dropped` says so.
 */
import type { MicroStep } from "./events";
import type { MachineState, OutputItem } from "./types";

const SCALARS = [
  "pc",
  "mar",
  "mdr",
  "ir",
  "acc",
  "negative",
  "inputIndex",
  "status",
  "error",
  "stage",
  "currentAddress",
  "cycles",
  "microSteps",
] as const;
type ScalarKey = (typeof SCALARS)[number];

interface StateDiff {
  readonly scalars: ReadonlyArray<readonly [ScalarKey, unknown, unknown]>;
  readonly memory: ReadonlyArray<readonly [number, number, number]>;
  readonly outputsFrom: number;
  readonly outputsAdded: readonly OutputItem[];
  readonly inputsFrom: number;
  readonly inputsAdded: readonly number[];
}

interface Entry {
  readonly diff: StateDiff;
  readonly step: MicroStep;
}

export interface HistoryOptions {
  /** Instructions kept before the oldest are dropped. Default 200,000. */
  readonly maxInstructions?: number;
  /** Instructions between full snapshots. Default 1,000. */
  readonly keyframeInterval?: number;
}

export class History {
  readonly maxInstructions: number;
  readonly keyframeInterval: number;

  private entries: Entry[] = [];
  /** Absolute position of entries[0]'s starting state. */
  private offset = 0;
  private keyframes = new Map<number, MachineState>();
  /** Absolute positions that sit between instructions, ascending. */
  private boundaries: number[] = [];
  private instructionsSinceKeyframe = 0;
  private cursor: number;
  private cursorState: MachineState;
  private headState: MachineState;
  private droppedPositions = 0;

  constructor(initial: MachineState, options: HistoryOptions = {}) {
    this.maxInstructions = options.maxInstructions ?? 200_000;
    this.keyframeInterval = options.keyframeInterval ?? 1_000;
    if (this.keyframeInterval < 1 || this.keyframeInterval >= this.maxInstructions) {
      throw new RangeError("keyframeInterval must be at least 1 and below maxInstructions.");
    }
    this.keyframes.set(0, initial);
    if (initial.stage === 0) this.boundaries.push(0);
    this.cursor = 0;
    this.cursorState = initial;
    this.headState = initial;
  }

  /** First position still held. */
  get start(): number {
    return this.offset;
  }

  /** Last position recorded. */
  get end(): number {
    return this.offset + this.entries.length;
  }

  get position(): number {
    return this.cursor;
  }

  get state(): MachineState {
    return this.cursorState;
  }

  /** Number of early positions dropped to stay within the limit. */
  get dropped(): number {
    return this.droppedPositions;
  }

  /**
   * Records the state after one micro-step. If the cursor is not at the end (the learner went
   * back), the later history is discarded first: this step starts a new future.
   */
  push(next: MachineState, step: MicroStep): void {
    if (next === this.cursorState) return;
    if (this.cursor < this.end) this.truncateAfterCursor();
    this.entries.push({ diff: diff(this.headState, next), step });
    this.headState = next;
    this.cursor = this.end;
    this.cursorState = next;
    if (next.stage === 0) {
      this.boundaries.push(this.cursor);
      this.instructionsSinceKeyframe++;
      if (this.instructionsSinceKeyframe >= this.keyframeInterval) {
        this.keyframes.set(this.cursor, next);
        this.instructionsSinceKeyframe = 0;
      }
      this.enforceLimit();
    }
  }

  /** The state at an absolute position. */
  stateAt(position: number): MachineState {
    this.assertInRange(position);
    if (position === this.cursor) return this.cursorState;
    if (position === this.cursor - 1)
      return applyBackward(this.cursorState, this.entryAt(this.cursor).diff);
    if (position === this.cursor + 1)
      return applyForward(this.cursorState, this.entryAt(position).diff);
    let at = this.nearestKeyframe(position);
    let state = this.keyframes.get(at) as MachineState;
    // Walking forward from the cursor is shorter than from the keyframe.
    if (this.cursor <= position && this.cursor > at) {
      at = this.cursor;
      state = this.cursorState;
    }
    while (at < position) {
      at++;
      state = applyForward(state, this.entryAt(at).diff);
    }
    return state;
  }

  /** The micro-step that moved the machine from `position - 1` to `position`. */
  stepAt(position: number): MicroStep {
    this.assertInRange(position);
    if (position === this.offset) throw new RangeError("No step leads to the first position held.");
    return this.entryAt(position).step;
  }

  goTo(position: number): MachineState {
    this.cursorState = this.stateAt(position);
    this.cursor = position;
    return this.cursorState;
  }

  /** Moves back one micro-step. Returns null at the start. */
  back(): MachineState | null {
    return this.cursor > this.offset ? this.goTo(this.cursor - 1) : null;
  }

  /** Moves forward one recorded micro-step. Returns null at the end. */
  forward(): MachineState | null {
    return this.cursor < this.end ? this.goTo(this.cursor + 1) : null;
  }

  /** Moves back to the start of the previous instruction. Returns null at the start. */
  backInstruction(): MachineState | null {
    const target = findLast(this.boundaries, (b) => b < this.cursor);
    return target === undefined ? null : this.goTo(target);
  }

  /** Positions that sit between instructions, for a timeline of whole instructions. */
  instructionPositions(): readonly number[] {
    return this.boundaries;
  }

  private entryAt(position: number): Entry {
    return this.entries[position - this.offset - 1] as Entry;
  }

  private nearestKeyframe(position: number): number {
    let best = this.offset;
    for (const k of this.keyframes.keys()) if (k <= position && k > best) best = k;
    return best;
  }

  private assertInRange(position: number): void {
    if (!Number.isInteger(position) || position < this.offset || position > this.end) {
      throw new RangeError(
        `Position ${position} is outside the history (${this.offset} to ${this.end}).`,
      );
    }
  }

  private truncateAfterCursor(): void {
    this.entries.length = this.cursor - this.offset;
    this.headState = this.cursorState;
    for (const k of [...this.keyframes.keys()]) if (k > this.cursor) this.keyframes.delete(k);
    this.boundaries = this.boundaries.filter((b) => b <= this.cursor);
    const lastKeyframe = Math.max(...this.keyframes.keys());
    this.instructionsSinceKeyframe = this.boundaries.filter((b) => b > lastKeyframe).length;
  }

  /** Drops the oldest stretch, up to the next keyframe, while over the instruction limit. */
  private enforceLimit(): void {
    while (this.boundaries.length - 1 > this.maxInstructions) {
      const next = [...this.keyframes.keys()]
        .filter((k) => k > this.offset)
        .sort((a, b) => a - b)[0];
      if (next === undefined || next > this.cursor) return;
      this.entries.splice(0, next - this.offset);
      this.keyframes.delete(this.offset);
      this.droppedPositions += next - this.offset;
      this.offset = next;
      this.boundaries = this.boundaries.filter((b) => b >= next);
    }
  }
}

function diff(prev: MachineState, next: MachineState): StateDiff {
  const scalars: Array<readonly [ScalarKey, unknown, unknown]> = [];
  for (const key of SCALARS) {
    if (prev[key] !== next[key]) scalars.push([key, prev[key], next[key]]);
  }
  const memory: Array<readonly [number, number, number]> = [];
  if (prev.memory !== next.memory) {
    for (let i = 0; i < next.memory.length; i++) {
      const a = prev.memory[i] as number;
      const b = next.memory[i] as number;
      if (a !== b) memory.push([i, a, b]);
    }
  }
  return {
    scalars,
    memory,
    outputsFrom: prev.outputs.length,
    outputsAdded: next.outputs.slice(prev.outputs.length),
    inputsFrom: prev.inputs.length,
    inputsAdded: next.inputs.slice(prev.inputs.length),
  };
}

function applyForward(state: MachineState, d: StateDiff): MachineState {
  const next: Record<string, unknown> = { ...state };
  for (const [key, , value] of d.scalars) next[key] = value;
  if (d.memory.length) {
    const memory = state.memory.slice();
    for (const [address, , value] of d.memory) memory[address] = value;
    next["memory"] = memory;
  }
  if (d.outputsAdded.length) next["outputs"] = [...state.outputs, ...d.outputsAdded];
  if (d.inputsAdded.length) next["inputs"] = [...state.inputs, ...d.inputsAdded];
  return next as unknown as MachineState;
}

function applyBackward(state: MachineState, d: StateDiff): MachineState {
  const prev: Record<string, unknown> = { ...state };
  for (const [key, value] of d.scalars) prev[key] = value;
  if (d.memory.length) {
    const memory = state.memory.slice();
    for (const [address, value] of d.memory) memory[address] = value;
    prev["memory"] = memory;
  }
  if (d.outputsAdded.length) prev["outputs"] = state.outputs.slice(0, d.outputsFrom);
  if (d.inputsAdded.length) prev["inputs"] = state.inputs.slice(0, d.inputsFrom);
  return prev as unknown as MachineState;
}

function findLast<T>(items: readonly T[], predicate: (item: T) => boolean): T | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i] as T;
    if (predicate(item)) return item;
  }
  return undefined;
}
