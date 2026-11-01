/**
 * The record of a run, one row per completed instruction: the trace table, the memory heatmap
 * and the path taken through the control-flow graph all read from it (brief, 7.3 to 7.5).
 *
 * A Trace follows the machine rather than listening to it: `syncTo(cycle)` replays forward from
 * the last recorded instruction, and `truncate(cycle)` drops rows after a step back. So it gives
 * the same answer after stepping, an instant run (which produces no events) or a timeline jump.
 * Every 1,000 rows it keeps a keyframe, so going back never replays more than 1,000 instructions.
 */
import type { AnyMnemonic } from "../dialects/types";
import type { EngineEvent } from "../core/events";
import { step } from "../core/step";
import { MEMORY_SIZE, type MachineState, type OutputItem } from "../core/types";
import type { KeyPress } from "../machines/extended/types";

export interface TraceRow {
  /** 1-based instruction number, as in an exam trace table. */
  readonly step: number;
  readonly address: number;
  readonly instruction: number;
  readonly mnemonic: AnyMnemonic;
  /** Machine values after the instruction. */
  readonly acc: number;
  readonly negative: boolean;
  readonly pc: number;
  readonly read?: { readonly address: number; readonly value: number };
  readonly write?: { readonly address: number; readonly previous: number; readonly value: number };
  readonly input?: number;
  readonly output?: OutputItem;
  readonly branch?: { readonly taken: boolean; readonly target: number };
  readonly alu?: { readonly operation: "add" | "sub"; readonly wrapped: boolean };
  /** The extended machine's registers after the instruction. */
  readonly sp?: number;
  readonly x?: number;
  readonly ie?: boolean;
  /** The device port the instruction read or wrote. */
  readonly device?: {
    readonly port: number;
    readonly device: string;
    readonly value: number;
    readonly direction: "read" | "write";
  };
  /** Values pushed onto (positive count) or popped off the stack. */
  readonly stack?: { readonly pushed: number; readonly popped: number };
  /** For an interrupt entry (mnemonic INT): what interrupted. */
  readonly interrupt?: "timer" | "keyboard";
  /** 2 for an instruction whose address or port is in the next mailbox. */
  readonly words?: 2;
  /** Indirect or indexed addressing (extended machine). */
  readonly mode?: "indirect" | "indexed";
  /** The core that ran it (multicore machine). */
  readonly core?: number;
}

export interface TraceOptions {
  /** Most rows kept. Past this the trace stops growing. Default 10,000. */
  readonly maxRows?: number;
}

export const DEFAULT_TRACE_ROWS = 10_000;
const KEYFRAME_EVERY = 1000;

export class Trace {
  readonly initial: MachineState;
  readonly maxRows: number;
  private readonly _rows: TraceRow[] = [];
  /** State after the last recorded row: the point replay continues from. */
  private head: MachineState;
  /** State at cycle k * KEYFRAME_EVERY. */
  private keyframes: MachineState[];
  /** Times each mailbox was run as an instruction, read as an operand, and written. */
  readonly executed = new Uint32Array(MEMORY_SIZE);
  readonly reads = new Uint32Array(MEMORY_SIZE);
  readonly writes = new Uint32Array(MEMORY_SIZE);
  /** Times execution went from one address to the next, keyed `from * 100 + to`. */
  readonly transitions = new Map<number, number>();
  /** Increases on every change, so views know when to redraw. */
  version = 0;

  constructor(initial: MachineState, options: TraceOptions = {}) {
    if (initial.stage !== 0) throw new Error("A trace must start between instructions.");
    this.initial = initial;
    this.head = initial;
    this.keyframes = [initial];
    this.maxRows = options.maxRows ?? DEFAULT_TRACE_ROWS;
  }

  get rows(): readonly TraceRow[] {
    return this._rows;
  }

  /** The cycle the trace has reached. */
  get cycle(): number {
    return this.head.cycles - this.initial.cycles;
  }

  /** True when the row limit stopped the trace. */
  get full(): boolean {
    return this._rows.length >= this.maxRows;
  }

  /** Inputs only ever grow. Replays need inputs given during the run too. */
  setInputs(inputs: readonly number[]): void {
    this.head = { ...this.head, inputs };
    this.keyframes = this.keyframes.map((k) => ({ ...k, inputs }));
  }

  /** Manual core choices (multicore machine): replays must make the same ones. */
  setChoices(choices: readonly number[]): void {
    const with_ = (s: MachineState): MachineState =>
      s.multi && s.multi.choices !== choices ? { ...s, multi: { ...s.multi, choices } } : s;
    this.head = with_(this.head);
    this.keyframes = this.keyframes.map(with_);
  }

  /** Key presses only ever grow, like inputs: replays need keys typed during the run. */
  setKeys(keys: readonly KeyPress[]): void {
    const withKeys = (s: MachineState): MachineState =>
      s.ext && s.ext.keys !== keys ? { ...s, ext: { ...s.ext, keys } } : s;
    this.head = withKeys(this.head);
    this.keyframes = this.keyframes.map(withKeys);
  }

  /** Records instructions until `cycle` instructions have completed, or the machine stops. */
  syncTo(cycle: number): void {
    const target = Math.min(cycle, this.maxRows);
    if (target < this._rows.length) {
      this.truncate(target);
      return;
    }
    let changed = false;
    while (this._rows.length < target) {
      const r = step(this.head, { granularity: "instruction" });
      if (r.state.cycles !== this.head.cycles + 1) break; // waiting for input, or an error
      this.record(r.events, r.state);
      changed = true;
    }
    if (changed) this.version++;
  }

  /** Drops every row after `cycle`. */
  truncate(cycle: number): void {
    const keep = Math.max(0, cycle);
    if (keep >= this._rows.length) return;
    for (let i = this._rows.length - 1; i >= keep; i--) this.forget(this._rows[i] as TraceRow);
    this._rows.length = keep;
    const k = Math.floor(keep / KEYFRAME_EVERY);
    this.keyframes.length = k + 1;
    let s = this.keyframes[k] as MachineState;
    while (s.cycles - this.initial.cycles < keep) s = step(s, { granularity: "instruction" }).state;
    this.head = s;
    this.version++;
  }

  private record(events: readonly EngineEvent[], after: MachineState): void {
    const complete = events.find(
      (e): e is Extract<EngineEvent, { type: "instruction-complete" }> =>
        e.type === "instruction-complete",
    );
    if (!complete)
      throw new Error("An instruction finished without an instruction-complete event.");
    const row: {
      -readonly [K in keyof TraceRow]: TraceRow[K];
    } = {
      step: this._rows.length + 1,
      address: complete.address,
      instruction: complete.instruction,
      mnemonic: complete.mnemonic,
      ...(complete.mode ? { mode: complete.mode } : {}),
      ...(after.multi ? { core: after.multi.last ?? 0 } : {}),
      acc: after.acc,
      negative: after.negative,
      pc: after.pc,
      ...(after.ext ? { sp: after.ext.sp, x: after.ext.x, ie: after.ext.ie } : {}),
    };
    const entry = complete.mnemonic === "INT";
    const twoWord = events.filter((e) => e.type === "pc-increment").length > 1;
    if (twoWord) row.words = 2;
    let fetched = entry;
    let pushed = 0;
    let popped = 0;
    for (const e of events) {
      if (e.type === "memory-read") {
        // The first read fetches the instruction itself, and the second mailbox of a
        // two-mailbox instruction is part of it too; any other read is of an operand.
        const ownWord = e.address === (complete.address + 1) % MEMORY_SIZE && !row.read;
        if (fetched && !(ownWord && twoWord)) row.read = { address: e.address, value: e.value };
        fetched = true;
      } else if (e.type === "stack-push") pushed++;
      else if (e.type === "stack-pop") popped++;
      else if (e.type === "interrupt-enter") row.interrupt = e.source;
      else if (e.type === "device-read" || e.type === "device-write") {
        row.device = {
          port: e.port,
          device: e.device,
          value: e.value,
          direction: e.type === "device-read" ? "read" : "write",
        };
      } else if (e.type === "memory-write") {
        row.write = { address: e.address, previous: e.previous, value: e.value };
      } else if (e.type === "input") row.input = e.value;
      else if (e.type === "output") row.output = e.item;
      else if (e.type === "branch") row.branch = { taken: e.taken, target: e.target };
      else if (e.type === "alu") row.alu = { operation: e.operation, wrapped: e.wrapped };
    }
    if (pushed || popped) row.stack = { pushed, popped };
    this._rows.push(row);
    this.count(row, 1);
    this.head = after;
    if (this._rows.length % KEYFRAME_EVERY === 0) this.keyframes.push(after);
  }

  private forget(row: TraceRow): void {
    this.count(row, -1);
  }

  private count(row: TraceRow, by: 1 | -1): void {
    (this.executed[row.address] as number) += by;
    if (row.words === 2) (this.executed[(row.address + 1) % MEMORY_SIZE] as number) += by;
    if (row.read) (this.reads[row.read.address] as number) += by;
    if (row.write) (this.writes[row.write.address] as number) += by;
    if (row.mnemonic !== "HLT") {
      const key = row.address * MEMORY_SIZE + row.pc;
      const n = (this.transitions.get(key) ?? 0) + by;
      if (n === 0) this.transitions.delete(key);
      else this.transitions.set(key, n);
    }
  }
}

/** How a mailbox was actually used during the run (brief, 7.4). */
export type UsageKind = "code" | "data" | "both" | "unused";

export function usageOf(trace: Trace, address: number): UsageKind {
  const ran = (trace.executed[address] ?? 0) > 0;
  const touched = (trace.reads[address] ?? 0) + (trace.writes[address] ?? 0) > 0;
  if (ran && touched) return "both";
  if (ran) return "code";
  if (touched) return "data";
  return "unused";
}

/** The value of a mailbox after each row, for a trace-table column. */
export function mailboxColumn(trace: Trace, address: number): number[] {
  let value = trace.initial.memory[address] ?? 0;
  return trace.rows.map((r) => {
    if (r.write?.address === address) value = r.write.value;
    return value;
  });
}
