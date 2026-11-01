/**
 * The five-stage pipeline (docs/specs/pipeline.md). It is a timing model: the extended machine
 * runs the program, and this works out when each executed instruction would pass through fetch,
 * decode, execute, memory and write back on a pipelined processor. Results are never changed,
 * only the clock: the program computes exactly what it computes on the other machines.
 */
import type { AnyMnemonic } from "../../dialects/types";
import { MEMORY_SIZE } from "../../core/types";
import type { TraceRow } from "../../insight/trace";
import { decodeExt } from "../extended/semantics";

export type Stage = "IF" | "ID" | "EX" | "MEM" | "WB";
export const STAGES: readonly Stage[] = ["IF", "ID", "EX", "MEM", "WB"];

/** ACC and the negative flag travel together; X and SP are the other registers. */
export type Resource = "ACC" | "X" | "SP";

export interface PipelineOptions {
  /** Pass values straight from EX and MEM to a later instruction that needs them. */
  readonly forwarding: boolean;
  /** A 2-bit predictor with a branch target buffer, instead of always fetching the next mailbox. */
  readonly prediction: boolean;
}

export const DEFAULT_PIPELINE: PipelineOptions = { forwarding: true, prediction: false };

interface Profile {
  /** Registers read, and the stage that needs them. */
  readonly reads: readonly (readonly [Resource, "EX" | "MEM"])[];
  /** Registers written, and the stage at whose end the new value exists. */
  readonly writes: readonly (readonly [Resource, "EX" | "MEM"])[];
  /** Cycles spent in MEM: 2 for indirect (pointer, then value), 3 for RTI and interrupt entry. */
  readonly mem: number;
  /** Where the next instruction's address becomes known, for instructions that can jump. */
  readonly control?: "ID" | "EX" | "MEM";
  /** Never guessed by the predictor (the target comes from memory or an interrupt). */
  readonly unpredictable?: boolean;
}

/** How each instruction uses the pipeline (docs/specs/pipeline.md, "Instruction profiles"). */
export function profileOf(mnemonic: AnyMnemonic, mode?: "indirect" | "indexed"): Profile {
  const index: (readonly [Resource, "EX"])[] = mode === "indexed" ? [["X", "EX"]] : [];
  const mem = mode === "indirect" ? 2 : 1;
  switch (mnemonic) {
    case "LDA":
      return { reads: index, writes: [["ACC", "MEM"]], mem };
    case "ADD":
    case "SUB":
      return { reads: [...index, ["ACC", "MEM"]], writes: [["ACC", "MEM"]], mem };
    case "STA":
      return { reads: [...index, ["ACC", "MEM"]], writes: [], mem };
    case "BRA":
      return { reads: [], writes: [], mem: 1, control: "ID" };
    case "BRZ":
    case "BRP":
      return { reads: [["ACC", "EX"]], writes: [], mem: 1, control: "EX" };
    case "INP":
    case "GET":
      return { reads: [], writes: [["ACC", "MEM"]], mem: 1 };
    case "OUT":
    case "OTC":
    case "PUT":
      return { reads: [["ACC", "MEM"]], writes: [], mem: 1 };
    case "PUSH":
      return {
        reads: [
          ["SP", "EX"],
          ["ACC", "MEM"],
        ],
        writes: [["SP", "EX"]],
        mem: 1,
      };
    case "POP":
      return {
        reads: [["SP", "EX"]],
        writes: [
          ["SP", "EX"],
          ["ACC", "MEM"],
        ],
        mem: 1,
      };
    case "CALL":
      return { reads: [["SP", "EX"]], writes: [["SP", "EX"]], mem: 1, control: "ID" };
    case "RET":
      return {
        reads: [["SP", "EX"]],
        writes: [["SP", "EX"]],
        mem: 1,
        control: "MEM",
        unpredictable: true,
      };
    case "LDX":
      return { reads: [], writes: [["X", "MEM"]], mem: 1 };
    case "STX":
      return { reads: [["X", "MEM"]], writes: [], mem: 1 };
    case "INX":
    case "DEX":
      return { reads: [["X", "EX"]], writes: [["X", "EX"]], mem: 1 };
    case "RTI":
      return {
        reads: [["SP", "EX"]],
        writes: [
          ["SP", "EX"],
          ["ACC", "MEM"],
        ],
        mem: 3,
        control: "MEM",
        unpredictable: true,
      };
    case "WAIT":
      return { reads: [], writes: [], mem: 1, control: "EX" };
    case "INT":
      return {
        reads: [
          ["SP", "EX"],
          ["ACC", "MEM"],
        ],
        writes: [["SP", "EX"]],
        mem: 3,
        control: "ID",
        unpredictable: true,
      };
    default:
      // HLT, EI, DI, VEC
      return { reads: [], writes: [], mem: 1 };
  }
}

/** A value passed straight from one instruction to a later one. */
export interface Forward {
  readonly resource: Resource;
  /** Index of the instruction that produced it. */
  readonly from: number;
  readonly fromStage: "EX" | "MEM";
  readonly toStage: "EX" | "MEM";
  /** The cycle in which the later instruction uses it. */
  readonly cycle: number;
}

export interface Stalls {
  /** Waiting for a value an earlier instruction has not produced yet. */
  readonly data: number;
  /** Waiting for a jump's target after a wrong guess. */
  readonly control: number;
  /** Waiting for MEM, held by an instruction that needs it for more than one cycle. */
  readonly structural: number;
  /** Fetching again, because an earlier store changed this instruction after it was fetched. */
  readonly selfModifying: number;
}

export interface Scheduled {
  readonly index: number;
  readonly address: number;
  readonly mnemonic: AnyMnemonic;
  /** The cycle each stage starts (cycles count from 1). MEM lasts `memCycles`. */
  readonly start: Readonly<Record<Stage, number>>;
  readonly memCycles: number;
  /** Cycles this instruction was held back, by cause. */
  readonly stalls: Stalls;
  readonly forwards: readonly Forward[];
  /** For instructions that can jump: what was guessed, and whether it was right. */
  readonly guess?: { readonly taken: boolean; readonly right: boolean };
}

/** An instruction fetched down the wrong path and thrown away. */
export interface Flushed {
  /** The jump it followed. */
  readonly after: number;
  readonly address: number;
  readonly fetched: number;
  /** When it reached ID, if it did before being thrown away. */
  readonly decoded?: number;
  /** The last cycle it was in the pipeline: the cycle the jump's target became known. */
  readonly until: number;
}

export interface PipelineResult {
  readonly instructions: readonly Scheduled[];
  readonly flushed: readonly Flushed[];
  /** Clock cycles until the last instruction leaves write back. */
  readonly cycles: number;
  /** Cycles for the same instructions one at a time, with no overlap. */
  readonly unpipelinedCycles: number;
  /** Cycles lost, in total and by cause. */
  readonly stalls: Stalls & { readonly total: number };
  readonly options: PipelineOptions;
}

const ZERO: Stalls = { data: 0, control: 0, structural: 0, selfModifying: 0 };

/**
 * Schedules the instructions of a run, in the order they ran, through the five stages.
 * `memory` is the program as loaded, for the addresses of wrong-path fetches.
 */
export function schedulePipeline(
  rows: readonly TraceRow[],
  memory: readonly number[],
  options: PipelineOptions = DEFAULT_PIPELINE,
): PipelineResult {
  const out: Scheduled[] = [];
  const flushed: Flushed[] = [];
  /** The last instruction to write each register, and when its value exists and is written back. */
  const writer = new Map<
    Resource,
    { index: number; ready: number; stage: "EX" | "MEM"; wb: number }
  >();
  const counters = new Map<number, number>();
  const targets = new Map<number, number>();
  const stores: { at: number; address: number }[] = [];
  let redirect = 0;
  const totals = { data: 0, control: 0, structural: 0, selfModifying: 0 };

  rows.forEach((row, k) => {
    const prev = out[k - 1];
    const p = profileOf(row.mnemonic, row.mode);
    const words = row.words ?? 1;
    /** The last hazard that held this instruction up. */
    let cause: keyof Stalls | null = null;
    const forwards: Forward[] = [];
    const bind = (natural: number, required: number, why: keyof Stalls) => {
      if (required > natural) cause = why;
      return Math.max(natural, required);
    };

    // IF: one fetch a cycle, once the previous instruction has moved on to ID.
    let fetch = prev ? Math.max(prev.start.IF + 1, prev.start.ID) : 1;
    fetch = bind(fetch, redirect, "control");
    redirect = 0;
    // A store into this instruction after it would have been fetched: fetch it again.
    const covers = (a: number) =>
      a === row.address || (words === 2 && a === (row.address + 1) % MEMORY_SIZE);
    for (const s of stores)
      if (covers(s.address) && s.at >= fetch) fetch = bind(fetch, s.at + 1, "selfModifying");

    // ID: once the previous instruction has moved on to EX.
    const decode = Math.max(fetch + 1, prev ? prev.start.EX : 0);

    // EX: registers are read in the last cycle of ID. Without forwarding a value must have been
    // written back by then; with it, a value for EX can come the cycle after it exists.
    let execute = Math.max(decode + 1, prev ? prev.start.MEM : 0);
    for (const [res, when] of p.reads) {
      const w = writer.get(res);
      if (!w) continue;
      if (!options.forwarding) execute = bind(execute, w.wb + 1, "data");
      else if (when === "EX") execute = bind(execute, w.ready + 1, "data");
    }

    // MEM: once the previous instruction has left it. Values for MEM are needed in its last cycle.
    let memStart = execute + 1;
    if (prev) memStart = bind(memStart, prev.start.WB, "structural");
    if (options.forwarding) {
      for (const [res, when] of p.reads) {
        const w = writer.get(res);
        if (w && when === "MEM") memStart = bind(memStart, w.ready + 1 - (p.mem - 1), "data");
      }
    }
    const writeBack = Math.max(memStart + p.mem, prev ? prev.start.WB + 1 : 0);

    // Values passed along a forwarding path: read after decode, before being written back.
    if (options.forwarding) {
      for (const [res, when] of p.reads) {
        const w = writer.get(res);
        const cycle = when === "EX" ? execute : memStart + p.mem - 1;
        if (w && execute - 1 < w.wb) {
          forwards.push({ resource: res, from: w.index, fromStage: w.stage, toStage: when, cycle });
        }
      }
    }

    const start = { IF: fetch, ID: decode, EX: execute, MEM: memStart, WB: writeBack };
    for (const [res, when] of p.writes) {
      const ready = when === "EX" ? execute : memStart + p.mem - 1;
      writer.set(res, { index: k, ready, stage: when, wb: writeBack });
    }
    if (row.write && (row.mnemonic === "STA" || row.mnemonic === "STX")) {
      stores.push({ at: memStart + p.mem - 1, address: row.write.address });
    }

    // Each cycle in which nothing finished just before this instruction is put down to the last
    // hazard that held it up.
    const extra = writeBack - (prev ? prev.start.WB + 1 : 5);
    const stalls = { ...ZERO };
    if (extra > 0) {
      // Its own extra MEM cycles are structural; the rest is down to what held it up.
      const own = Math.min(extra, p.mem - 1);
      stalls.structural += own;
      if (extra > own) stalls[cause ?? "structural"] += extra - own;
      for (const key of Object.keys(totals) as (keyof Stalls)[]) totals[key] += stalls[key];
    }

    // Jumps: did the next instruction come from where the pipeline guessed?
    let guess: Scheduled["guess"];
    const next = rows[k + 1];
    if (p.control && next) {
      const sequential = (row.address + words) % MEMORY_SIZE;
      // An interrupt entry's address is the instruction it interrupted: where this one went.
      const taken = next.address !== sequential;
      let predictedTaken = false;
      let predictedTarget: number | undefined;
      if (options.prediction && !p.unpredictable) {
        const c = counters.get(row.address) ?? 1;
        predictedTarget = targets.get(row.address);
        predictedTaken = c >= 2 && predictedTarget !== undefined;
        counters.set(row.address, taken ? Math.min(3, c + 1) : Math.max(0, c - 1));
        if (taken) targets.set(row.address, next.address);
      }
      // Returns and interrupt entry always jump, and nothing guesses where.
      const always = p.unpredictable === true;
      const right =
        !always && predictedTaken === taken && (!taken || predictedTarget === next.address);
      if (!always) guess = { taken: predictedTaken, right };
      if (!right) {
        const known =
          p.control === "ID" ? decode : p.control === "EX" ? execute : memStart + p.mem - 1;
        redirect = known + 1;
        // The instructions fetched behind it on the guessed path, thrown away once it is known.
        let a = predictedTaken && predictedTarget !== undefined ? predictedTarget : sequential;
        let behind = { IF: start.IF, ID: start.ID, EX: start.EX };
        for (;;) {
          const f = Math.max(behind.IF + 1, behind.ID);
          if (f > known) break;
          const id = Math.max(f + 1, behind.EX);
          flushed.push({
            after: k,
            address: a,
            fetched: f,
            ...(id <= known ? { decoded: id } : {}),
            until: known,
          });
          behind = { IF: f, ID: id, EX: Math.max(id + 1, behind.EX + 1) };
          const ext = decodeExt(memory[a] as number);
          a = (a + (ext?.words ?? 1)) % MEMORY_SIZE;
        }
      }
    }

    out.push({
      index: k,
      address: row.address,
      mnemonic: row.mnemonic,
      start,
      memCycles: p.mem,
      stalls,
      forwards,
      ...(guess ? { guess } : {}),
    });
  });

  const last = out.at(-1);
  const cycles = last ? last.start.WB : 0;
  const unpipelinedCycles = out.reduce((n, s) => n + 4 + s.memCycles, 0);
  const total = totals.data + totals.control + totals.structural + totals.selfModifying;
  return {
    instructions: out,
    flushed,
    cycles,
    unpipelinedCycles,
    stalls: { ...totals, total },
    options,
  };
}

/** What each stage holds in one clock cycle: an instruction, a flushed fetch, or nothing. */
export type Slot =
  | { readonly kind: "instruction"; readonly index: number; readonly stalled: boolean }
  | { readonly kind: "flushed"; readonly address: number }
  | { readonly kind: "bubble" };

export function stagesAt(result: PipelineResult, cycle: number): Record<Stage, Slot> {
  const slots: Record<Stage, Slot> = {
    IF: { kind: "bubble" },
    ID: { kind: "bubble" },
    EX: { kind: "bubble" },
    MEM: { kind: "bubble" },
    WB: { kind: "bubble" },
  };
  for (const s of result.instructions) {
    if (cycle < s.start.IF || cycle > s.start.WB) continue;
    const stage = stageOf(s, cycle);
    // The first cycle in a stage is its work; any more are spent waiting there.
    slots[stage] = {
      kind: "instruction",
      index: s.index,
      stalled: cycle >= s.start[stage] + span(s, stage),
    };
  }
  for (const f of result.flushed) {
    if (cycle < f.fetched || cycle > f.until) continue;
    const stage: Stage = f.decoded !== undefined && cycle >= f.decoded ? "ID" : "IF";
    if (slots[stage].kind === "bubble") slots[stage] = { kind: "flushed", address: f.address };
  }
  return slots;
}

/** The stage an instruction is in during a cycle (it stays in a stage while stalled). */
export function stageOf(s: Scheduled, cycle: number): Stage {
  if (cycle >= s.start.WB) return "WB";
  if (cycle >= s.start.MEM) return "MEM";
  if (cycle >= s.start.EX) return "EX";
  if (cycle >= s.start.ID) return "ID";
  return "IF";
}

/** Cycles a stage takes when nothing holds the instruction back. */
function span(s: Scheduled, stage: Stage): number {
  return stage === "MEM" ? s.memCycles : 1;
}
