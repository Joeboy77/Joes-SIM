/**
 * Running a custom machine (docs/specs/custom-machines.md): an assembler for its mnemonics, and
 * an interpreter that runs one micro-operation at a time and reports what moved.
 */
import type { OutputItem } from "../../core/types";
import {
  shapeOf,
  type InstructionDef,
  type MachineDefinition,
  type MachineMicroOp,
  type Shape,
} from "./definition";

// ---- Assembling ----

export interface CustomDiagnostic {
  readonly line: number;
  readonly message: string;
}

export interface CustomProgram {
  readonly memory: readonly number[];
  readonly labels: Readonly<Record<string, number>>;
  /** Source line (1-based) for each word, or null. */
  readonly addressToLine: readonly (number | null)[];
  readonly kinds: readonly ("code" | "data" | "empty")[];
}

const LABEL = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function assembleCustom(
  source: string,
  def: MachineDefinition,
): { ok: boolean; program: CustomProgram | null; diagnostics: CustomDiagnostic[] } {
  const shape = shapeOf(def);
  const byName = new Map(def.instructions.map((i) => [i.mnemonic.toUpperCase(), i]));
  const diagnostics: CustomDiagnostic[] = [];
  const pending: { line: number; ins: InstructionDef | null; operand?: string }[] = [];
  const labels: Record<string, number> = {};
  source.split(/\r?\n/).forEach((text, index) => {
    const line = index + 1;
    const cut = text.search(/\/\/|;|#/);
    const tokens = (cut >= 0 ? text.slice(0, cut) : text).split(/\s+/).filter(Boolean);
    if (!tokens.length) return;
    let [first, ...rest] = tokens as [string, ...string[]];
    const isOp = (w: string) => w.toUpperCase() === "DAT" || byName.has(w.toUpperCase());
    if (!isOp(first)) {
      const next = rest[0];
      const known = `It knows ${[...byName.keys()].join(", ")} and DAT.`;
      // "MUL 5": an unknown instruction. "x FOO": a label, then an unknown instruction.
      if (next !== undefined && !isOp(next)) {
        const bad = /^[+-]?\d+$/.test(next) || !LABEL.test(first) ? first : next;
        diagnostics.push({
          line,
          message: `Line ${line}: '${bad}' is not an instruction of this machine. ${known}`,
        });
        return;
      }
      if (!LABEL.test(first)) {
        diagnostics.push({
          line,
          message: `Line ${line}: '${first}' is not an instruction of this machine. ${known}`,
        });
        return;
      }
      if (first in labels)
        diagnostics.push({ line, message: `Line ${line}: the label '${first}' is used twice.` });
      labels[first] = pending.length;
      if (next === undefined) {
        diagnostics.push({
          line,
          message: `Line ${line}: put an instruction or DAT after the label '${first}'.`,
        });
        return;
      }
      rest.shift();
      first = next;
    }
    if (pending.length >= def.memory) {
      diagnostics.push({
        line,
        message: `Line ${line}: the program does not fit in ${def.memory} words.`,
      });
      return;
    }
    const ins =
      first.toUpperCase() === "DAT" ? null : (byName.get(first.toUpperCase()) as InstructionDef);
    if (rest.length > 1)
      diagnostics.push({
        line,
        message: `Line ${line}: there is more after the operand than this line can use.`,
      });
    const operand = rest[0];
    if (ins && !ins.operand && operand !== undefined) {
      diagnostics.push({ line, message: `Line ${line}: ${ins.mnemonic} takes no operand.` });
    }
    if (ins?.operand && operand === undefined) {
      diagnostics.push({
        line,
        message: `Line ${line}: ${ins.mnemonic} needs an address or a value.`,
      });
    }
    pending.push({ line, ins, ...(operand !== undefined ? { operand } : {}) });
  });

  const memory = new Array<number>(def.memory).fill(0);
  const addressToLine = new Array<number | null>(def.memory).fill(null);
  const kinds = new Array<"code" | "data" | "empty">(def.memory).fill("empty");
  pending.forEach((p, address) => {
    let value = 0;
    if (p.operand !== undefined) {
      if (/^[+-]?\d+$/.test(p.operand)) value = Number(p.operand);
      else if (p.operand in labels) value = labels[p.operand] as number;
      else
        diagnostics.push({
          line: p.line,
          message: `Line ${p.line}: the label '${p.operand}' is not defined.`,
        });
    }
    if (p.ins) {
      if (p.ins.operand && (value < 0 || value >= shape.operandSize)) {
        diagnostics.push({
          line: p.line,
          message: `Line ${p.line}: ${value} does not fit in the operand field (0 to ${shape.operandSize - 1}).`,
        });
      }
      const operand = p.ins.operand ? value : (p.ins.fixedOperand ?? 0);
      memory[address] = p.ins.opcode * shape.operandSize + operand;
      kinds[address] = "code";
    } else {
      if (value < shape.min || value > shape.max) {
        diagnostics.push({
          line: p.line,
          message: `Line ${p.line}: ${value} does not fit in a word (${shape.min} to ${shape.max}).`,
        });
      }
      memory[address] = value;
      kinds[address] = "data";
    }
    addressToLine[address] = p.line;
  });
  diagnostics.sort((a, b) => a.line - b.line);
  const ok = diagnostics.length === 0;
  return { ok, program: ok ? { memory, labels, addressToLine, kinds } : null, diagnostics };
}

// ---- Running ----

export type CustomEvent =
  | {
      readonly type: "transfer";
      readonly from: string;
      readonly to: string;
      readonly value: number;
    }
  | { readonly type: "memory-read"; readonly address: number; readonly value: number }
  | {
      readonly type: "memory-write";
      readonly address: number;
      readonly previous: number;
      readonly value: number;
    }
  | {
      readonly type: "decode";
      readonly instruction: number;
      readonly opcode: number;
      readonly operand: number;
      readonly mnemonic: string;
    }
  | {
      readonly type: "alu";
      readonly fn: string;
      readonly a: number;
      readonly b: number;
      readonly raw: number;
      readonly result: number;
      readonly to: string;
    }
  | { readonly type: "jump"; readonly taken: boolean; readonly target: number }
  | { readonly type: "input"; readonly value: number; readonly to: string }
  | { readonly type: "input-needed" }
  | { readonly type: "output"; readonly item: OutputItem }
  | { readonly type: "halt" }
  | { readonly type: "error"; readonly message: string }
  | { readonly type: "instruction-complete"; readonly address: number; readonly mnemonic: string };

export interface CustomStep {
  readonly phase: "fetch" | "decode" | "execute";
  /** The micro-operation, or null for decode. */
  readonly micro: MachineMicroOp | null;
  readonly events: readonly CustomEvent[];
}

export interface CustomState {
  readonly registers: Readonly<Record<string, number>>;
  readonly memory: readonly number[];
  /** Z: the last result was 0. N: its true value was below zero. */
  readonly z: boolean;
  readonly n: boolean;
  readonly inputs: readonly number[];
  readonly inputIndex: number;
  readonly outputs: readonly OutputItem[];
  readonly status: "ready" | "waiting-input" | "halted" | "error";
  readonly error: string | null;
  readonly phase: "fetch" | "decode" | "execute";
  /** Position inside the current phase's micro-operations. */
  readonly index: number;
  /** The instruction being run, from decode on. */
  readonly current: { readonly mnemonic: string; readonly operand: number } | null;
  readonly currentAddress: number;
  readonly cycles: number;
  readonly microSteps: number;
}

export function createCustomState(
  def: MachineDefinition,
  memory: readonly number[] = [],
  inputs: readonly number[] = [],
): CustomState {
  return {
    registers: Object.fromEntries(def.registers.map((r) => [r.name, 0])),
    memory: Array.from({ length: def.memory }, (_, i) => memory[i] ?? 0),
    z: false,
    n: false,
    inputs: [...inputs],
    inputIndex: 0,
    outputs: [],
    status: "ready",
    error: null,
    phase: "fetch",
    index: 0,
    current: null,
    currentAddress: 0,
    cycles: 0,
    microSteps: 0,
  };
}

function wrap(v: number, shape: Shape, signed: boolean): number {
  if (signed) return v % shape.modulus || 0;
  return ((v % shape.modulus) + shape.modulus) % shape.modulus;
}

/** The instruction an IR value encodes, and its operand. */
export function decodeCustom(
  value: number,
  def: MachineDefinition,
): { ins: InstructionDef; operand: number } | null {
  const shape = shapeOf(def);
  if (value < 0) return null;
  const opcode = Math.floor(value / shape.operandSize);
  const operand = value % shape.operandSize;
  const ins = def.instructions.find(
    (i) => i.opcode === opcode && (i.fixedOperand === undefined || i.fixedOperand === operand),
  );
  return ins ? { ins, operand } : null;
}

export function stepCustom(
  state: CustomState,
  def: MachineDefinition,
): { state: CustomState; step: CustomStep | null } {
  if (state.status === "waiting-input" && state.inputIndex < state.inputs.length) {
    state = { ...state, status: "ready" };
  }
  if (state.status !== "ready") return { state, step: null };
  const shape = shapeOf(def);
  const { roles } = shape;
  const regs = state.registers;
  const signed = def.word.signed;
  const free = (name: string) => !def.registers.find((r) => r.name === name)?.role;

  if (state.phase === "decode") {
    const ir = regs[roles.ir] as number;
    const d = decodeCustom(ir, def);
    if (!d) {
      const message = `${ir} is not an instruction this machine knows.`;
      return {
        state: { ...state, status: "error", error: message, microSteps: state.microSteps + 1 },
        step: { phase: "decode", micro: null, events: [{ type: "error", message }] },
      };
    }
    return {
      state: {
        ...state,
        phase: "execute",
        index: 0,
        current: { mnemonic: d.ins.mnemonic, operand: d.operand },
        microSteps: state.microSteps + 1,
      },
      step: {
        phase: "decode",
        micro: null,
        events: [
          {
            type: "decode",
            instruction: ir,
            opcode: d.ins.opcode,
            operand: d.operand,
            mnemonic: d.ins.mnemonic,
          },
        ],
      },
    };
  }

  const list =
    state.phase === "fetch"
      ? def.fetch
      : (def.instructions.find((i) => i.mnemonic === state.current?.mnemonic) as InstructionDef)
          .micro;
  const op = list[state.index];
  const operand = state.current?.operand ?? 0;
  const value = (name: string) => (name === "operand" ? operand : (regs[name] as number));
  let registers = regs;
  let memory = state.memory;
  let { z, n, inputIndex, outputs } = state;
  let status: CustomState["status"] = state.status;
  let error: string | null = null;
  const events: CustomEvent[] = [];
  const setReg = (name: string, v: number, flags: boolean) => {
    registers = { ...registers, [name]: v };
    if (flags) {
      z = v === 0;
      n = v < 0;
    }
  };
  const fail = (message: string) => {
    status = "error";
    error = message;
    events.push({ type: "error", message });
  };
  const address = () => {
    const a = registers[roles.mar] as number;
    if (a < 0 || a >= def.memory) {
      fail(`Address ${a} is outside memory (0 to ${def.memory - 1}).`);
      return null;
    }
    return a;
  };

  if (op) {
    switch (op.op) {
      case "copy": {
        const v = value(op.from);
        setReg(op.to, v, free(op.to));
        events.push({
          type: "transfer",
          from: op.from === "operand" ? roles.ir : op.from,
          to: op.to,
          value: v,
        });
        break;
      }
      case "set":
        setReg(op.reg, wrap(op.value, shape, signed), free(op.reg));
        events.push({ type: "transfer", from: "CONTROL", to: op.reg, value: op.value });
        break;
      case "read": {
        const a = address();
        if (a === null) break;
        const v = memory[a] as number;
        setReg(roles.mdr, v, false);
        events.push(
          { type: "memory-read", address: a, value: v },
          { type: "transfer", from: "MEMORY", to: roles.mdr, value: v },
        );
        break;
      }
      case "write": {
        const a = address();
        if (a === null) break;
        const v = registers[roles.mdr] as number;
        const previous = memory[a] as number;
        memory = memory.slice();
        (memory as number[])[a] = v;
        events.push(
          { type: "transfer", from: roles.mdr, to: "MEMORY", value: v },
          { type: "memory-write", address: a, previous, value: v },
        );
        break;
      }
      case "inc":
      case "dec": {
        const raw = (registers[op.reg] as number) + (op.op === "inc" ? 1 : -1);
        const v =
          op.reg === roles.pc
            ? ((raw % def.memory) + def.memory) % def.memory
            : wrap(raw, shape, signed);
        setReg(op.reg, v, false);
        if (free(op.reg)) {
          z = v === 0 && raw >= 0;
          n = raw < 0;
        }
        events.push({ type: "transfer", from: op.reg, to: op.reg, value: v });
        break;
      }
      case "alu": {
        const a = registers[op.a] as number;
        const b = op.b === undefined ? 0 : (registers[op.b] as number);
        const raw =
          op.fn === "add"
            ? a + b
            : op.fn === "sub"
              ? a - b
              : op.fn === "mul"
                ? a * b
                : op.fn === "negate"
                  ? -a
                  : b === 0
                    ? 0
                    : op.fn === "div"
                      ? Math.trunc(a / b)
                      : a % b;
        const result = wrap(raw, shape, signed);
        registers = { ...registers, [op.to]: result };
        z = result === 0;
        n = raw < 0;
        events.push(
          { type: "transfer", from: op.a, to: "ALU", value: a },
          { type: "alu", fn: op.fn, a, b, raw, result, to: op.to },
          { type: "transfer", from: "ALU", to: op.to, value: result },
        );
        break;
      }
      case "input": {
        if (inputIndex >= state.inputs.length) {
          return {
            state: { ...state, status: "waiting-input" },
            step: { phase: state.phase, micro: op, events: [{ type: "input-needed" }] },
          };
        }
        const v = wrap(state.inputs[inputIndex] as number, shape, signed);
        inputIndex++;
        setReg(op.to, v, free(op.to));
        events.push(
          { type: "input", value: v, to: op.to },
          { type: "transfer", from: "INPUT", to: op.to, value: v },
        );
        break;
      }
      case "output": {
        const v = registers[op.from] as number;
        const item: OutputItem =
          op.as === "char"
            ? { kind: "char", value: v, char: String.fromCharCode(v) }
            : { kind: "number", value: v };
        outputs = [...outputs, item];
        events.push(
          { type: "transfer", from: op.from, to: "OUTPUT", value: v },
          { type: "output", item },
        );
        break;
      }
      case "jump": {
        // A result that wrapped round from below zero does not count as zero, as in the Classic LMC.
        const taken =
          op.when === "always" ||
          (op.when === "zero" && z && !n) ||
          (op.when === "not-zero" && !(z && !n)) ||
          (op.when === "negative" && n) ||
          (op.when === "not-negative" && !n);
        const target = value(op.to);
        if (taken) {
          setReg(roles.pc, ((target % def.memory) + def.memory) % def.memory, false);
          events.push({
            type: "transfer",
            from: op.to === "operand" ? roles.ir : op.to,
            to: roles.pc,
            value: target,
          });
        }
        events.push({ type: "jump", taken, target });
        break;
      }
      default:
        status = "halted";
        events.push({ type: "halt" });
    }
  }
  // Closures above may have changed it; read it as the full type again.
  const outcome = status as CustomState["status"];
  const last = state.index + 1 >= list.length;
  const completes = state.phase === "execute" && (last || outcome === "halted");
  if (completes && outcome !== "error") {
    events.push({
      type: "instruction-complete",
      address: state.currentAddress,
      mnemonic: state.current?.mnemonic ?? "",
    });
  }
  const fetchStart = state.phase === "fetch" && state.index === 0;
  return {
    state: {
      ...state,
      registers,
      memory,
      z,
      n,
      inputIndex,
      outputs,
      status: outcome,
      error,
      phase:
        outcome !== "ready"
          ? state.phase
          : last
            ? state.phase === "fetch"
              ? "decode"
              : "fetch"
            : state.phase,
      index: outcome !== "ready" ? state.index : last ? 0 : state.index + 1,
      currentAddress: fetchStart ? (regs[roles.pc] as number) : state.currentAddress,
      cycles: state.cycles + (completes && outcome !== "error" ? 1 : 0),
      microSteps: state.microSteps + 1,
    },
    step: { phase: state.phase, micro: op ?? null, events },
  };
}

/** Runs whole instructions until the machine stops, waits for input or uses up the budget. */
export function runCustom(
  state: CustomState,
  def: MachineDefinition,
  maxSteps = 100_000,
): { state: CustomState; reason: "halted" | "error" | "waiting-input" | "budget" } {
  let s = state;
  for (let i = 0; i < maxSteps * 20; i++) {
    if (s.status === "halted" || s.status === "error") break;
    if (s.cycles >= maxSteps && s.phase === "fetch" && s.index === 0)
      return { state: s, reason: "budget" };
    const r = stepCustom(s, def);
    if (r.state === s) break;
    s = r.state;
  }
  if (s.status === "ready") return { state: s, reason: "budget" };
  return { state: s, reason: s.status };
}
