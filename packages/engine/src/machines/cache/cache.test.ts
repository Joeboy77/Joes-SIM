/** Hand-worked examples from docs/specs/cache.md, one or more for each configuration. */
import { describe, expect, it } from "vitest";
import { assemble } from "../../assembler/assemble";
import { createState } from "../../core/state";
import {
  cachedAccesses,
  checkCache,
  memoryAccesses,
  simulateCache,
  splitAddress,
  type Access,
  type CacheConfig,
} from "./cache";

const reads = (...addresses: number[]): Access[] =>
  addresses.map((address) => ({ address, write: false }));
const ops = (text: string): Access[] =>
  text.split(" ").map((t) => ({ address: Number(t.slice(1)), write: t[0] === "W" }));

const config = (c: Partial<CacheConfig>): CacheConfig => ({
  blockSize: 1,
  sets: 4,
  ways: 1,
  replacement: "lru",
  write: "write-back",
  ...c,
});

const outcome = (r: ReturnType<typeof simulateCache>) =>
  r.accesses.map((a) => (a.hit ? "hit" : (a.miss as string)));

describe("hand-worked cache examples (docs/specs/cache.md)", () => {
  it("1. direct-mapped: blocks that share a set throw each other out", () => {
    const r = simulateCache(reads(0, 4, 0, 8, 1, 5, 1), config({ sets: 4 }));
    expect(outcome(r)).toEqual([
      "compulsory",
      "compulsory",
      "conflict",
      "compulsory",
      "compulsory",
      "compulsory",
      "conflict",
    ]);
    expect(r.stats.hits).toBe(0);
    expect(r.stats.misses).toEqual({ compulsory: 5, capacity: 0, conflict: 2, total: 7 });
  });

  it("2. two-way set-associative LRU: the same accesses now hit twice", () => {
    const r = simulateCache(reads(0, 4, 0, 8, 1, 5, 1), config({ sets: 2, ways: 2 }));
    expect(outcome(r)).toEqual([
      "compulsory",
      "compulsory",
      "hit",
      "compulsory",
      "compulsory",
      "compulsory",
      "hit",
    ]);
    // 8 replaced 4, the least recently used block in set 0.
    expect(r.accesses[3]?.evicted).toEqual({ block: 4, dirty: false });
    expect(r.stats.hitRate).toBeCloseTo(2 / 7);
    expect(r.stats.averageAccessTime).toBeCloseTo(1 + (5 / 7) * 10);
  });

  it("3. fully associative FIFO throws out the oldest block, even if just used", () => {
    const r = simulateCache(
      reads(0, 1, 0, 2, 0, 1),
      config({ sets: 1, ways: 2, replacement: "fifo" }),
    );
    expect(outcome(r)).toEqual([
      "compulsory",
      "compulsory",
      "hit",
      "compulsory",
      "capacity",
      "capacity",
    ]);
  });

  it("4. the same with LRU keeps the block just used", () => {
    const r = simulateCache(reads(0, 1, 0, 2, 0, 1), config({ sets: 1, ways: 2 }));
    expect(outcome(r)).toEqual([
      "compulsory",
      "compulsory",
      "hit",
      "compulsory",
      "hit",
      "capacity",
    ]);
  });

  it("5. two-mailbox blocks: a miss brings in the neighbour too", () => {
    const r = simulateCache(reads(0, 1, 2, 3, 4, 0), config({ blockSize: 2, sets: 2 }));
    expect(outcome(r)).toEqual([
      "compulsory",
      "hit",
      "compulsory",
      "hit",
      "compulsory",
      "capacity",
    ]);
    expect(r.stats.hits).toBe(2);
  });

  it("6. write-back: dirty blocks are written to memory only when thrown out", () => {
    const r = simulateCache(ops("W0 R0 W2 R1 W1 R3"), config({ sets: 2 }));
    expect(outcome(r)).toEqual([
      "compulsory",
      "hit",
      "compulsory",
      "compulsory",
      "hit",
      "compulsory",
    ]);
    expect(r.accesses[2]?.evicted).toEqual({ block: 0, dirty: true });
    expect(r.accesses[5]?.evicted).toEqual({ block: 1, dirty: true });
    expect(r.stats.writeBacks).toBe(2);
    expect(r.stats.writesThrough).toBe(0);
  });

  it("7. write-through: every write goes to memory, and a write miss loads nothing", () => {
    const r = simulateCache(ops("W0 R0 W2 R1 W1 R3"), config({ sets: 2, write: "write-through" }));
    expect(outcome(r)).toEqual([
      "compulsory",
      "compulsory",
      "compulsory",
      "compulsory",
      "hit",
      "compulsory",
    ]);
    expect(r.accesses[0]?.way).toBeUndefined();
    expect(r.stats.writesThrough).toBe(3);
    expect(r.stats.writeBacks).toBe(0);
  });

  it("8. random replacement repeats exactly for a seed", () => {
    const stream = reads(0, 1, 2, 3, 0, 2, 4, 1, 0, 3, 2, 1);
    const c = config({ sets: 1, ways: 2, replacement: "random" });
    const a = simulateCache(stream, { ...c, seed: 7 });
    expect(simulateCache(stream, { ...c, seed: 7 })).toEqual(a);
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
      outcome(simulateCache(stream, { ...c, seed })).join(),
    );
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it("9. an address splits into tag, index and offset bits", () => {
    expect(splitAddress(5, { blockSize: 2, sets: 2 })).toEqual({
      tag: 1,
      index: 0,
      offset: 1,
      bits: { tag: "00001", index: "0", offset: "1" },
    });
    expect(splitAddress(99, { blockSize: 4, sets: 8 })).toEqual({
      tag: 3,
      index: 0,
      offset: 3,
      bits: { tag: "11", index: "000", offset: "11" },
    });
    expect(splitAddress(37, { blockSize: 1, sets: 1 }).bits).toEqual({
      tag: "0100101",
      index: "",
      offset: "",
    });
  });

  it("10. a program's accesses: data only, or with instruction fetches", () => {
    const p = assemble("        LDA a\n        ADD a\n        HLT\na       DAT 4").program;
    const all = memoryAccesses(createState({ memory: p?.memory ?? [] }), 3);
    expect(all.map((a) => [a.address, a.write, a.fetch])).toEqual([
      [0, false, true],
      [3, false, false],
      [1, false, true],
      [3, false, false],
      [2, false, true],
    ]);
    const c = config({ sets: 4 });
    expect(simulateCache(cachedAccesses(all, c), c).stats.hits).toBe(1);
    const unified = { ...c, fetches: true };
    const u = simulateCache(cachedAccesses(all, unified), unified);
    expect([u.stats.hits, u.stats.misses.total]).toEqual([1, 4]);
  });

  it("refuses configurations that do not fit", () => {
    expect(checkCache(config({ blockSize: 3 }))).toMatch(/block size/);
    expect(checkCache(config({ sets: 3 }))).toMatch(/Sets/);
    expect(checkCache(config({ ways: 3 }))).toMatch(/Ways/);
    expect(checkCache(config({ blockSize: 8, sets: 32 }))).toMatch(/128/);
    expect(() => simulateCache([], config({ ways: 5 }))).toThrow(RangeError);
    expect(simulateCache([], config({})).stats.averageAccessTime).toBe(0);
  });
});
