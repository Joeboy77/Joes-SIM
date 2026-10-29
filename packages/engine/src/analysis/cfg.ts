/**
 * Control-flow graph: blocks of straight-line instructions joined by branches, built from the
 * mailboxes as they are before the program runs.
 */
import { getDialect } from "../dialects/dialects";
import type { DialectId } from "../dialects/types";
import { decode } from "../core/semantics";
import { MEMORY_SIZE } from "../core/types";

export type EdgeKind = "fallthrough" | "taken" | "not-taken" | "jump";
export type BlockExit = "halt" | "invalid" | "jump" | "branch" | "fallthrough";

export interface CfgEdge {
  readonly from: number;
  readonly to: number;
  readonly kind: EdgeKind;
}

export interface BasicBlock {
  readonly id: number;
  /** Addresses in execution order. */
  readonly addresses: readonly number[];
  readonly exit: BlockExit;
}

export interface Loop {
  /** Block the back edge returns to. */
  readonly header: number;
  /** Block the back edge leaves from. */
  readonly latch: number;
  /** Blocks inside the loop, header included. */
  readonly body: readonly number[];
}

export interface ControlFlowGraph {
  readonly blocks: readonly BasicBlock[];
  readonly edges: readonly CfgEdge[];
  readonly loops: readonly Loop[];
  /** Block id for each reachable address, or null. */
  readonly blockOf: readonly (number | null)[];
  /** True for addresses execution can reach from 00. */
  readonly reachable: readonly boolean[];
}

interface Successor {
  readonly to: number;
  readonly kind: EdgeKind;
}

/** Where execution can go after the instruction at `address`. */
export function successors(
  memory: readonly number[],
  address: number,
  dialect: DialectId,
): Successor[] {
  const d = decode(memory[address] ?? 0, getDialect(dialect));
  const next = (address + 1) % MEMORY_SIZE;
  if (!d || d.mnemonic === "HLT") return [];
  if (d.mnemonic === "BRA") return [{ to: d.address, kind: "jump" }];
  if (d.mnemonic === "BRZ" || d.mnemonic === "BRP") {
    return [
      { to: next, kind: "not-taken" },
      { to: d.address, kind: "taken" },
    ];
  }
  return [{ to: next, kind: "fallthrough" }];
}

export function buildCfg(memory: readonly number[], dialect: DialectId): ControlFlowGraph {
  const reachable = new Array<boolean>(MEMORY_SIZE).fill(false);
  const leaders = new Set<number>([0]);
  const stack = [0];
  while (stack.length) {
    const a = stack.pop() as number;
    if (reachable[a]) continue;
    reachable[a] = true;
    const succ = successors(memory, a, dialect);
    if (succ.length !== 1 || succ[0]?.kind === "jump") succ.forEach((s) => leaders.add(s.to));
    succ.forEach((s) => stack.push(s.to));
  }

  const blockOf = new Array<number | null>(MEMORY_SIZE).fill(null);
  const blocks: BasicBlock[] = [];
  const ordered = [...leaders].filter((a) => reachable[a]).sort((x, y) => x - y);
  for (const start of ordered) {
    const id = blocks.length;
    const addresses: number[] = [];
    let a = start;
    let exit: BlockExit = "fallthrough";
    while (true) {
      addresses.push(a);
      blockOf[a] = id;
      const succ = successors(memory, a, dialect);
      if (succ.length === 0) {
        exit = decode(memory[a] ?? 0, getDialect(dialect)) ? "halt" : "invalid";
        break;
      }
      if (succ.length === 2) {
        exit = "branch";
        break;
      }
      const only = succ[0] as Successor;
      if (only.kind === "jump") {
        exit = "jump";
        break;
      }
      if (leaders.has(only.to) || blockOf[only.to] !== null) break;
      a = only.to;
    }
    blocks.push({ id, addresses, exit });
  }

  const edges: CfgEdge[] = [];
  for (const block of blocks) {
    const last = block.addresses[block.addresses.length - 1] as number;
    for (const s of successors(memory, last, dialect)) {
      const to = blockOf[s.to];
      if (to !== null && to !== undefined) edges.push({ from: block.id, to, kind: s.kind });
    }
  }

  return { blocks, edges, loops: findLoops(blocks.length, edges), blockOf, reachable };
}

/** Back edges found by depth-first search from the entry block, with each loop's body. */
function findLoops(count: number, edges: readonly CfgEdge[]): Loop[] {
  if (count === 0) return [];
  const out = Array.from({ length: count }, () => [] as number[]);
  const into = Array.from({ length: count }, () => [] as number[]);
  for (const e of edges) {
    (out[e.from] as number[]).push(e.to);
    (into[e.to] as number[]).push(e.from);
  }
  const state = new Array<0 | 1 | 2>(count).fill(0);
  const loops: Loop[] = [];
  const visit = (n: number) => {
    state[n] = 1;
    for (const m of out[n] as number[]) {
      if (state[m] === 1) loops.push({ header: m, latch: n, body: loopBody(m, n, into) });
      else if (state[m] === 0) visit(m);
    }
    state[n] = 2;
  };
  visit(0);
  return loops;
}

function loopBody(header: number, latch: number, into: readonly number[][]): number[] {
  const body = new Set([header]);
  const stack = [latch];
  while (stack.length) {
    const n = stack.pop() as number;
    if (body.has(n)) continue;
    body.add(n);
    stack.push(...(into[n] as number[]));
  }
  return [...body].sort((a, b) => a - b);
}
