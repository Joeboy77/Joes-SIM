/**
 * A cache between the processor and the 100 mailboxes (docs/specs/cache.md). Like the pipeline,
 * it is a model over a run: the machine runs the program, and this replays its memory accesses
 * through a configurable cache. Results never change; only hits, misses and timing are counted.
 */
import { step } from "../../core/step";
import type { MachineState } from "../../core/types";

/** Addresses 00 to 99 fit in 7 bits. */
export const ADDRESS_BITS = 7;

export type Replacement = "lru" | "fifo" | "random";
export type WritePolicy = "write-back" | "write-through";

export interface CacheConfig {
  /** Mailboxes per block: 1, 2, 4 or 8. */
  readonly blockSize: number;
  /** Sets: 1 (fully associative), 2, 4, 8, 16 or 32. */
  readonly sets: number;
  /** Blocks per set: 1 (direct-mapped) to 8. */
  readonly ways: number;
  readonly replacement: Replacement;
  /** Write-back allocates on a write miss; write-through does not (docs/specs/cache.md). */
  readonly write: WritePolicy;
  /** Cycles to read a block from memory. Default 10. */
  readonly missPenalty?: number;
  /** Cycles for a hit. Default 1. */
  readonly hitTime?: number;
  /** Seed for random replacement. Default 1. */
  readonly seed?: number;
  /** Also cache instruction fetches (a unified cache). Default false: data only. */
  readonly fetches?: boolean;
}

export const DEFAULT_CACHE: CacheConfig = {
  blockSize: 2,
  sets: 4,
  ways: 1,
  replacement: "lru",
  write: "write-back",
  missPenalty: 10,
  hitTime: 1,
  seed: 1,
  fetches: false,
};

export const BLOCK_SIZES = [1, 2, 4, 8] as const;
export const SET_COUNTS = [1, 2, 4, 8, 16, 32] as const;
export const WAY_COUNTS = [1, 2, 4, 8] as const;

/** Why a configuration cannot be used, or null. */
export function checkCache(c: CacheConfig): string | null {
  if (!(BLOCK_SIZES as readonly number[]).includes(c.blockSize)) {
    return "The block size must be 1, 2, 4 or 8 mailboxes.";
  }
  if (!(SET_COUNTS as readonly number[]).includes(c.sets))
    return "Sets must be 1, 2, 4, 8, 16 or 32.";
  if (!(WAY_COUNTS as readonly number[]).includes(c.ways)) return "Ways must be 1, 2, 4 or 8.";
  if (c.blockSize * c.sets > 128)
    return "Block size × sets cannot be more than 128 (7 address bits).";
  return null;
}

export interface Access {
  readonly address: number;
  readonly write: boolean;
  /** An instruction fetch rather than a data access. */
  readonly fetch?: boolean;
  /** The instruction (1-based step) that made it. */
  readonly step?: number;
}

export interface Split {
  readonly tag: number;
  readonly index: number;
  readonly offset: number;
  /** The address in binary, split into its fields. */
  readonly bits: { readonly tag: string; readonly index: string; readonly offset: string };
}

const log2 = (n: number) => Math.round(Math.log2(n));

/** How an address divides into tag, index and offset for a configuration. */
export function splitAddress(address: number, c: Pick<CacheConfig, "blockSize" | "sets">): Split {
  const offsetBits = log2(c.blockSize);
  const indexBits = log2(c.sets);
  const tagBits = ADDRESS_BITS - offsetBits - indexBits;
  const binary = address.toString(2).padStart(ADDRESS_BITS, "0");
  return {
    tag: address >> (offsetBits + indexBits),
    index: (address >> offsetBits) & (c.sets - 1),
    offset: address & (c.blockSize - 1),
    bits: {
      tag: binary.slice(0, tagBits),
      index: binary.slice(tagBits, tagBits + indexBits),
      offset: binary.slice(tagBits + indexBits),
    },
  };
}

export type MissKind = "compulsory" | "capacity" | "conflict";

export interface AccessResult extends Access {
  readonly split: Split;
  readonly hit: boolean;
  readonly miss?: MissKind;
  /** The way used: where it hit, or where the block was placed. Absent when not placed. */
  readonly way?: number;
  /** A block thrown out to make room: its first address, and whether it was written back. */
  readonly evicted?: { readonly block: number; readonly dirty: boolean };
  /** Write-through: this write also went to memory. */
  readonly writtenThrough?: boolean;
}

export interface Line {
  readonly valid: boolean;
  readonly tag: number;
  readonly dirty: boolean;
  /** First mailbox of the block held. */
  readonly block: number;
  readonly lastUsed: number;
  readonly loaded: number;
}

export interface CacheStats {
  readonly accesses: number;
  readonly reads: number;
  readonly writes: number;
  readonly hits: number;
  readonly misses: Readonly<Record<MissKind, number>> & { readonly total: number };
  readonly hitRate: number;
  /** Dirty blocks written back to memory (write-back). */
  readonly writeBacks: number;
  /** Writes sent straight to memory (write-through). */
  readonly writesThrough: number;
  /** Average memory access time, in cycles: hit time + miss rate × miss penalty. */
  readonly averageAccessTime: number;
}

export interface CacheResult {
  readonly config: CacheConfig;
  readonly accesses: readonly AccessResult[];
  /** The cache after the last access: sets, then ways. */
  readonly sets: readonly (readonly Line[])[];
  readonly stats: CacheStats;
}

const EMPTY: Line = { valid: false, tag: 0, dirty: false, block: 0, lastUsed: 0, loaded: 0 };

/** A small seeded generator (xorshift32), so random replacement repeats exactly. */
function generator(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x;
  };
}

/** Replays memory accesses through a cache. */
export function simulateCache(accesses: readonly Access[], config: CacheConfig): CacheResult {
  const problem = checkCache(config);
  if (problem) throw new RangeError(problem);
  const { sets: setCount, ways, replacement, write } = config;
  const missPenalty = config.missPenalty ?? 10;
  const hitTime = config.hitTime ?? 1;
  const random = generator(config.seed ?? 1);
  const sets: Line[][] = Array.from({ length: setCount }, () =>
    Array.from({ length: ways }, () => EMPTY),
  );
  // Every block ever loaded, and a fully associative LRU cache of the same size, to tell
  // compulsory, capacity and conflict misses apart.
  const loadedEver = new Set<number>();
  const shadow: number[] = [];
  const shadowSize = setCount * ways;
  const allocatesOnWrite = write === "write-back";

  const results: AccessResult[] = [];
  const misses = { compulsory: 0, capacity: 0, conflict: 0 };
  let hits = 0;
  let writeBacks = 0;
  let writesThrough = 0;
  let reads = 0;

  accesses.forEach((a, time) => {
    if (!a.write) reads++;
    const split = splitAddress(a.address, config);
    const block = a.address - split.offset;
    const set = sets[split.index] as Line[];
    const allocate = !a.write || allocatesOnWrite;

    // The fully associative shadow, which allocates the same way.
    const inShadow = shadow.indexOf(block);
    if (inShadow >= 0) shadow.splice(inShadow, 1);
    const shadowHit = inShadow >= 0;
    if (shadowHit || allocate) {
      shadow.push(block);
      if (shadow.length > shadowSize) shadow.shift();
    }

    const way = set.findIndex((l) => l.valid && l.tag === split.tag);
    if (way >= 0) {
      hits++;
      const line = set[way] as Line;
      set[way] = {
        ...line,
        lastUsed: time,
        dirty: line.dirty || (a.write && write === "write-back"),
      };
      const through = a.write && write === "write-through";
      if (through) writesThrough++;
      results.push({ ...a, split, hit: true, way, ...(through ? { writtenThrough: true } : {}) });
      return;
    }

    const kind: MissKind = !loadedEver.has(block)
      ? "compulsory"
      : !shadowHit || setCount === 1
        ? "capacity"
        : "conflict";
    misses[kind]++;
    if (!allocate) {
      // Write-through, write miss: the write goes to memory and the block is not loaded.
      writesThrough++;
      results.push({ ...a, split, hit: false, miss: kind, writtenThrough: true });
      return;
    }
    loadedEver.add(block);
    let victim = set.findIndex((l) => !l.valid);
    if (victim < 0) {
      if (replacement === "random") victim = random() % ways;
      else {
        const key = (l: Line) => (replacement === "lru" ? l.lastUsed : l.loaded);
        victim = set.reduce((best, l, i) => (key(l) < key(set[best] as Line) ? i : best), 0);
      }
    }
    const old = set[victim] as Line;
    const evicted = old.valid ? { block: old.block, dirty: old.dirty } : undefined;
    if (evicted?.dirty) writeBacks++;
    set[victim] = {
      valid: true,
      tag: split.tag,
      block,
      dirty: a.write && write === "write-back",
      lastUsed: time,
      loaded: time,
    };
    const through = a.write && write === "write-through";
    if (through) writesThrough++;
    results.push({
      ...a,
      split,
      hit: false,
      miss: kind,
      way: victim,
      ...(evicted ? { evicted } : {}),
      ...(through ? { writtenThrough: true } : {}),
    });
  });

  const total = misses.compulsory + misses.capacity + misses.conflict;
  const count = accesses.length;
  const hitRate = count ? hits / count : 0;
  return {
    config,
    accesses: results,
    sets,
    stats: {
      accesses: count,
      reads,
      writes: count - reads,
      hits,
      misses: { ...misses, total },
      hitRate,
      writeBacks,
      writesThrough,
      averageAccessTime: count ? hitTime + (total / count) * missPenalty : 0,
    },
  };
}

/**
 * The memory accesses a run makes, in order: instruction fetches (and the second mailbox of
 * two-mailbox instructions) and data reads and writes. Runs `cycles` instructions from `initial`.
 */
export function memoryAccesses(initial: MachineState, cycles: number): Access[] {
  const out: Access[] = [];
  let state = initial;
  while (state.cycles < cycles && state.status === "ready") {
    const r = step(state, { granularity: "instruction" });
    if (r.state === state) break;
    const n = r.state.cycles;
    for (const s of r.steps) {
      const fetch = s.op === "fetch-read" || s.op === "operand-fetch-read";
      for (const e of s.events) {
        if (e.type === "memory-read")
          out.push({ address: e.address, write: false, fetch, step: n });
        else if (e.type === "memory-write") out.push({ address: e.address, write: true, step: n });
      }
    }
    state = r.state;
  }
  return out;
}

/** The accesses a cache sees: data only, or fetches too. */
export function cachedAccesses(all: readonly Access[], config: CacheConfig): Access[] {
  return config.fetches ? [...all] : all.filter((a) => !a.fetch);
}
