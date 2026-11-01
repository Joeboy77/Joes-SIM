/**
 * Running RV32I programs (docs/specs/riscv.md). Each step runs one instruction and reports what
 * each of the five stages did, for the datapath view and the narration.
 */
import { TEXT_BASE, type RvProgram } from "./assemble";
import { ABI_NAMES, decode, show, type Decoded, type RvName } from "./isa";

export const SP_START = 0x7fffeffc;
export const GP_START = 0x10008000;

export interface RvState {
  readonly pc: number;
  /** x0 to x31, as signed 32-bit numbers. */
  readonly regs: readonly number[];
  /** Bytes written while running, over the program's initial data. */
  readonly written: ReadonlyMap<number, number>;
  readonly inputs: readonly number[];
  readonly inputIndex: number;
  /** Everything printed, as text. */
  readonly console: string;
  readonly status: "ready" | "waiting-input" | "halted" | "error";
  readonly error: string | null;
  /** How the program ended: "exit", "exit with code", or "dropped off the bottom". */
  readonly ended: string | null;
  readonly exitCode: number;
  /** Instructions completed. */
  readonly steps: number;
}

/** What one instruction did, stage by stage. */
export interface RvStep {
  readonly address: number;
  readonly word: number;
  readonly instruction: Decoded;
  readonly text: string;
  readonly decode: {
    readonly rs1: number;
    readonly rs2: number;
    readonly rs1Value: number;
    readonly rs2Value: number;
    readonly imm: number;
  };
  readonly execute: {
    readonly a: number;
    readonly b: number;
    readonly result: number;
    readonly operation: string;
    readonly taken?: boolean;
  };
  readonly memory?: {
    readonly address: number;
    readonly value: number;
    readonly size: 1 | 2 | 4;
    readonly write: boolean;
  };
  readonly writeBack?: { readonly rd: number; readonly value: number };
  readonly nextPc: number;
  readonly syscall?: { readonly service: number; readonly description: string };
}

export function createRvState(inputs: readonly number[] = []): RvState {
  const regs = new Array<number>(32).fill(0);
  regs[2] = SP_START | 0;
  regs[3] = GP_START;
  return {
    pc: TEXT_BASE,
    regs,
    written: new Map(),
    inputs: [...inputs],
    inputIndex: 0,
    console: "",
    status: "ready",
    error: null,
    ended: null,
    exitCode: 0,
    steps: 0,
  };
}

const hex = (n: number) => `0x${(n >>> 0).toString(16).padStart(8, "0")}`;

class RvError extends Error {}

/** A byte of memory: written while running, else the program's data or instructions, else 0. */
function byte(state: RvState, program: RvProgram, address: number): number {
  const a = address >>> 0;
  const w = state.written.get(a);
  if (w !== undefined) return w;
  const d = program.data.get(a);
  if (d !== undefined) return d;
  if (a >= TEXT_BASE && a < program.textEnd) {
    const ins = program.text[(a - TEXT_BASE) >> 2];
    return ins ? (ins.word >>> (8 * (a & 3))) & 0xff : 0;
  }
  return 0;
}

function checkAddress(address: number, size: number, write: boolean, program: RvProgram) {
  const a = address >>> 0;
  if (a % size !== 0) {
    throw new RvError(
      `${write ? "Store" : "Load"} address ${hex(a)} is not aligned to a ${size === 4 ? "word" : "halfword"} boundary.`,
    );
  }
  const inText = a >= TEXT_BASE && a < 0x10000000;
  if (write && inText)
    throw new RvError(`Cannot write to ${hex(a)}: it is in the text (program) segment.`);
  if (!inText && (a < 0x10000000 || a >= 0x80000000)) {
    throw new RvError(`Address ${hex(a)} is outside the data, heap and stack segments.`);
  }
  void program;
}

export function load(state: RvState, program: RvProgram, address: number, size: 1 | 2 | 4): number {
  let v = 0;
  for (let i = 0; i < size; i++) v |= byte(state, program, address + i) << (8 * i);
  return v | 0;
}

const NAMES = ABI_NAMES as readonly string[];

/** Runs one instruction. */
export function stepRv(
  state: RvState,
  program: RvProgram,
): { state: RvState; step: RvStep | null } {
  if (state.status === "waiting-input" && state.inputIndex < state.inputs.length)
    state = { ...state, status: "ready" };
  if (state.status !== "ready") return { state, step: null };
  const pc = state.pc >>> 0;
  if (pc === program.textEnd >>> 0) {
    return { state: { ...state, status: "halted", ended: "dropped off the bottom" }, step: null };
  }
  const index = (pc - TEXT_BASE) / 4;
  const ins = Number.isInteger(index) ? program.text[index] : undefined;
  if (!ins) {
    const error = `The program jumped to ${hex(pc)}, where there is no instruction.`;
    return { state: { ...state, status: "error", error }, step: null };
  }
  const d = decode(ins.word) as Decoded;
  const regs = state.regs.slice();
  const r1 = regs[d.rs1] as number;
  const r2 = regs[d.rs2] as number;
  let nextPc = (pc + 4) | 0;
  let written = state.written;
  let { console: out, inputIndex } = state;
  let status: RvState["status"] = "ready";
  let ended: string | null = null;
  let exitCode = state.exitCode;
  let execute: RvStep["execute"] = { a: r1, b: r2, result: 0, operation: d.name };
  let memory: RvStep["memory"];
  let writeBack: RvStep["writeBack"];
  let syscall: RvStep["syscall"];
  const setRd = (v: number) => {
    if (d.rd !== 0) regs[d.rd] = v | 0;
    writeBack = { rd: d.rd, value: d.rd === 0 ? 0 : v | 0 };
  };
  const alu = (name: RvName, a: number, b: number): number => {
    switch (name) {
      case "add":
      case "addi":
        return (a + b) | 0;
      case "sub":
        return (a - b) | 0;
      case "and":
      case "andi":
        return a & b;
      case "or":
      case "ori":
        return a | b;
      case "xor":
      case "xori":
        return a ^ b;
      case "sll":
      case "slli":
        return a << (b & 31);
      case "srl":
      case "srli":
        return (a >>> (b & 31)) | 0;
      case "sra":
      case "srai":
        return a >> (b & 31);
      case "slt":
      case "slti":
        return a < b ? 1 : 0;
      default:
        // sltu, sltiu
        return a >>> 0 < b >>> 0 ? 1 : 0;
    }
  };

  try {
    switch (d.name) {
      case "add":
      case "sub":
      case "and":
      case "or":
      case "xor":
      case "sll":
      case "srl":
      case "sra":
      case "slt":
      case "sltu": {
        const v = alu(d.name, r1, r2);
        execute = { a: r1, b: r2, result: v, operation: d.name };
        setRd(v);
        break;
      }
      case "addi":
      case "andi":
      case "ori":
      case "xori":
      case "slti":
      case "sltiu":
      case "slli":
      case "srli":
      case "srai": {
        const v = alu(d.name, r1, d.imm);
        execute = { a: r1, b: d.imm, result: v, operation: d.name };
        setRd(v);
        break;
      }
      case "lui":
        execute = { a: 0, b: d.imm, result: d.imm, operation: "lui" };
        setRd(d.imm);
        break;
      case "auipc": {
        const v = (pc + d.imm) | 0;
        execute = { a: pc | 0, b: d.imm, result: v, operation: "add" };
        setRd(v);
        break;
      }
      case "lw":
      case "lh":
      case "lhu":
      case "lb":
      case "lbu": {
        const address = (r1 + d.imm) | 0;
        const size = d.name === "lw" ? 4 : d.name === "lh" || d.name === "lhu" ? 2 : 1;
        execute = { a: r1, b: d.imm, result: address, operation: "add" };
        checkAddress(address, size, false, program);
        let v = load(state, program, address, size);
        if (d.name === "lb") v = (v << 24) >> 24;
        if (d.name === "lh") v = (v << 16) >> 16;
        if (d.name === "lbu") v &= 0xff;
        if (d.name === "lhu") v &= 0xffff;
        memory = { address: address >>> 0, value: v, size, write: false };
        setRd(v);
        break;
      }
      case "sw":
      case "sh":
      case "sb": {
        const address = (r1 + d.imm) | 0;
        const size = d.name === "sw" ? 4 : d.name === "sh" ? 2 : 1;
        execute = { a: r1, b: d.imm, result: address, operation: "add" };
        checkAddress(address, size, true, program);
        const next = new Map(written);
        for (let i = 0; i < size; i++) next.set((address + i) >>> 0, (r2 >>> (8 * i)) & 0xff);
        written = next;
        const value = size === 4 ? r2 : size === 2 ? (r2 << 16) >> 16 : (r2 << 24) >> 24;
        memory = { address: address >>> 0, value, size, write: true };
        break;
      }
      case "beq":
      case "bne":
      case "blt":
      case "bge":
      case "bltu":
      case "bgeu": {
        const taken =
          d.name === "beq"
            ? r1 === r2
            : d.name === "bne"
              ? r1 !== r2
              : d.name === "blt"
                ? r1 < r2
                : d.name === "bge"
                  ? r1 >= r2
                  : d.name === "bltu"
                    ? r1 >>> 0 < r2 >>> 0
                    : r1 >>> 0 >= r2 >>> 0;
        execute = { a: r1, b: r2, result: (pc + d.imm) | 0, operation: "compare", taken };
        if (taken) nextPc = (pc + d.imm) | 0;
        break;
      }
      case "jal":
        execute = { a: pc | 0, b: d.imm, result: (pc + d.imm) | 0, operation: "add" };
        setRd((pc + 4) | 0);
        nextPc = (pc + d.imm) | 0;
        break;
      case "jalr": {
        const target = ((r1 + d.imm) & ~1) | 0;
        execute = { a: r1, b: d.imm, result: target, operation: "add" };
        setRd((pc + 4) | 0);
        nextPc = target;
        break;
      }
      default: {
        // ecall
        const service = regs[17] as number;
        const a0 = regs[10] as number;
        switch (service) {
          case 1:
            out += String(a0);
            syscall = { service, description: `print the integer ${a0}` };
            break;
          case 4: {
            let s = "";
            for (let a = a0, i = 0; i < 100_000; a++, i++) {
              const c = byte(state, program, a);
              if (c === 0) break;
              s += String.fromCharCode(c);
            }
            out += s;
            syscall = { service, description: `print the string at ${hex(a0)}` };
            break;
          }
          case 5: {
            if (inputIndex >= state.inputs.length) {
              return { state: { ...state, status: "waiting-input" }, step: null };
            }
            const v = (state.inputs[inputIndex] as number) | 0;
            inputIndex++;
            regs[10] = v;
            writeBack = { rd: 10, value: v };
            syscall = { service, description: `read the integer ${v} into a0` };
            break;
          }
          case 10:
            status = "halted";
            ended = "exit";
            syscall = { service, description: "exit" };
            break;
          case 11:
            out += String.fromCharCode(a0 & 0xff);
            syscall = {
              service,
              description: `print the character '${String.fromCharCode(a0 & 0xff)}'`,
            };
            break;
          case 93:
            status = "halted";
            ended = "exit with code";
            exitCode = a0;
            syscall = { service, description: `exit with code ${a0}` };
            break;
          default:
            throw new RvError(
              `ecall ${service} (in a7) is not a system call this machine has. It has 1, 4, 5, 10, 11 and 93.`,
            );
        }
        execute = { a: service, b: 0, result: 0, operation: "ecall" };
      }
    }
  } catch (e) {
    if (!(e instanceof RvError)) throw e;
    return {
      state: { ...state, status: "error", error: `At ${hex(pc)} (${show(d, pc)}): ${e.message}` },
      step: null,
    };
  }

  const step: RvStep = {
    address: pc,
    word: ins.word,
    instruction: d,
    text: show(d, pc),
    decode: { rs1: d.rs1, rs2: d.rs2, rs1Value: r1, rs2Value: r2, imm: d.imm },
    execute,
    ...(memory ? { memory } : {}),
    ...(writeBack ? { writeBack } : {}),
    nextPc,
    ...(syscall ? { syscall } : {}),
  };
  return {
    state: {
      ...state,
      pc: nextPc,
      regs,
      written,
      console: out,
      inputIndex,
      status,
      ended,
      exitCode,
      steps: state.steps + 1,
    },
    step,
  };
}

/** Runs until the program ends, waits for input, or uses up the budget. */
export function runRv(
  state: RvState,
  program: RvProgram,
  maxSteps = 1_000_000,
): { state: RvState; reason: "halted" | "error" | "waiting-input" | "budget" } {
  let s = state;
  for (let i = 0; i < maxSteps; i++) {
    const r = stepRv(s, program);
    s = r.state;
    if (s.status !== "ready") return { state: s, reason: s.status };
  }
  return { state: s, reason: "budget" };
}

export const registerName = (i: number) => NAMES[i] as string;
