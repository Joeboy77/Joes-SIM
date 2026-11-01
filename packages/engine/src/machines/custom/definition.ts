/**
 * Custom machine definitions (docs/specs/custom-machines.md): what a teacher writes, as JSON, and
 * the checks that explain any problem in plain language.
 */

export type AluFn = "add" | "sub" | "mul" | "div" | "mod" | "negate";
export type When = "always" | "zero" | "not-zero" | "negative" | "not-negative";

export type MachineMicroOp =
  | { readonly op: "copy"; readonly from: string; readonly to: string }
  | { readonly op: "set"; readonly reg: string; readonly value: number }
  | { readonly op: "read" }
  | { readonly op: "write" }
  | { readonly op: "inc"; readonly reg: string }
  | { readonly op: "dec"; readonly reg: string }
  | {
      readonly op: "alu";
      readonly fn: AluFn;
      readonly a: string;
      readonly b?: string;
      readonly to: string;
    }
  | { readonly op: "input"; readonly to: string }
  | { readonly op: "output"; readonly from: string; readonly as?: "number" | "char" }
  | { readonly op: "jump"; readonly when: When; readonly to: string }
  | { readonly op: "halt" };

export type MachineMicroOpKind = MachineMicroOp["op"];
export const MICRO_OPS: readonly MachineMicroOpKind[] = [
  "copy",
  "set",
  "read",
  "write",
  "inc",
  "dec",
  "alu",
  "input",
  "output",
  "jump",
  "halt",
];
export const ALU_FNS: readonly AluFn[] = ["add", "sub", "mul", "div", "mod", "negate"];
export const WHENS: readonly When[] = ["always", "zero", "not-zero", "negative", "not-negative"];

export type RegisterRole = "pc" | "mar" | "mdr" | "ir";
export const ROLES: readonly RegisterRole[] = ["pc", "mar", "mdr", "ir"];

export interface RegisterDef {
  readonly name: string;
  readonly role?: RegisterRole;
}

export interface InstructionDef {
  readonly mnemonic: string;
  readonly opcode: number;
  /** Takes an address (or other value) in its operand field. */
  readonly operand: boolean;
  /** Matches only this operand value, for instructions that share an opcode (INP 901, OUT 902). */
  readonly fixedOperand?: number;
  readonly description?: string;
  readonly micro: readonly MachineMicroOp[];
}

export interface MachineDefinition {
  readonly format: "joes-sim-machine";
  readonly version: 1;
  readonly name: string;
  readonly description?: string;
  /** Memory words, 10 to 1000. */
  readonly memory: number;
  readonly word: { readonly digits: number; readonly base: 2 | 10 | 16; readonly signed: boolean };
  /** Leading digits of an instruction word that hold the opcode. */
  readonly opcodeDigits: number;
  readonly registers: readonly RegisterDef[];
  readonly fetch: readonly MachineMicroOp[];
  readonly instructions: readonly InstructionDef[];
}

/** Numbers that follow from a definition. */
export interface Shape {
  /** base ^ digits: one more than the largest unsigned word. */
  readonly modulus: number;
  readonly min: number;
  readonly max: number;
  /** base ^ (digits − opcodeDigits): the operand field's size. */
  readonly operandSize: number;
  /** base ^ opcodeDigits. */
  readonly opcodes: number;
  readonly roles: Readonly<Record<RegisterRole, string>>;
}

export function shapeOf(def: MachineDefinition): Shape {
  const { base, digits, signed } = def.word;
  const modulus = base ** digits;
  const operandSize = base ** (digits - def.opcodeDigits);
  const roles = Object.fromEntries(
    def.registers.filter((r) => r.role).map((r) => [r.role, r.name]),
  ) as Record<RegisterRole, string>;
  return {
    modulus,
    min: signed ? -(modulus - 1) : 0,
    max: modulus - 1,
    operandSize,
    opcodes: base ** def.opcodeDigits,
    roles,
  };
}

const NAME = /^[A-Za-z][A-Za-z0-9_]{0,9}$/;
const MNEMONIC = /^[A-Za-z]{2,6}$/;

/** Every problem with a definition, in plain language. An empty list means it can be used. */
export function checkDefinition(input: unknown): string[] {
  const problems: string[] = [];
  if (typeof input !== "object" || input === null) return ["This is not a machine definition."];
  const def = input as Partial<MachineDefinition>;
  if (def.format !== "joes-sim-machine" || def.version !== 1) {
    problems.push("This file is not a Joe's SIM machine (format 'joes-sim-machine', version 1).");
    return problems;
  }
  if (typeof def.name !== "string" || !def.name.trim()) problems.push("The machine needs a name.");
  if (
    !Number.isInteger(def.memory) ||
    (def.memory as number) < 10 ||
    (def.memory as number) > 1000
  ) {
    problems.push("Memory must be a whole number of words from 10 to 1000.");
  }
  const w = def.word;
  // Binary words need more digits for the same range: up to 16 bits.
  const maxDigits = w?.base === 2 ? 16 : 6;
  if (
    !w ||
    ![2, 10, 16].includes(w.base) ||
    !Number.isInteger(w.digits) ||
    w.digits < 1 ||
    w.digits > maxDigits
  ) {
    problems.push("The word needs a base of 10 or 16 with 1 to 6 digits, or base 2 with 1 to 16.");
    return problems;
  }
  if (
    !Number.isInteger(def.opcodeDigits) ||
    (def.opcodeDigits as number) < 1 ||
    (def.opcodeDigits as number) >= w.digits
  ) {
    problems.push(
      `The opcode needs at least 1 digit and must leave at least 1 of the word's ${w.digits} for the operand.`,
    );
    return problems;
  }
  const regs = def.registers ?? [];
  const names = regs.map((r) => r.name);
  const known = new Set(names);
  for (const r of regs) {
    if (!NAME.test(r.name))
      problems.push(
        `'${r.name}' cannot be a register name: use a letter, then letters, digits or _ (up to 10).`,
      );
  }
  if (new Set(names).size !== names.length) problems.push("Two registers have the same name.");
  for (const role of ROLES) {
    const count = regs.filter((r) => r.role === role).length;
    if (count !== 1) {
      problems.push(
        `Exactly one register needs the role '${role}' (${ROLE_NAMES[role]}); there ${count === 1 ? "is" : "are"} ${count}.`,
      );
    }
  }
  const shape = shapeOf({ ...def, registers: regs } as MachineDefinition);
  if (typeof def.memory === "number" && def.memory > shape.operandSize) {
    problems.push(
      `Memory has ${def.memory} words, but the operand field (${w.digits - (def.opcodeDigits as number)} digits) can only reach ${shape.operandSize}. Use less memory or fewer opcode digits.`,
    );
  }
  const list = `The registers are ${names.join(", ")}.`;
  const checkOps = (where: string, ops: readonly MachineMicroOp[] | undefined) => {
    if (!Array.isArray(ops)) {
      problems.push(`${where} needs a list of micro-operations.`);
      return;
    }
    const reg = (name: unknown, allowOperand = false) => {
      if (allowOperand && name === "operand") return;
      if (typeof name !== "string" || !known.has(name)) {
        problems.push(`${where}: register '${String(name)}' does not exist. ${list}`);
      }
    };
    for (const op of ops) {
      switch (op?.op) {
        case "copy":
          reg(op.from, true);
          reg(op.to);
          break;
        case "set":
          reg(op.reg);
          if (!Number.isInteger(op.value)) problems.push(`${where}: 'set' needs a whole number.`);
          break;
        case "inc":
        case "dec":
          reg(op.reg);
          break;
        case "alu":
          if (!ALU_FNS.includes(op.fn))
            problems.push(
              `${where}: '${String(op.fn)}' is not something the ALU can do (${ALU_FNS.join(", ")}).`,
            );
          reg(op.a);
          if (op.fn !== "negate") reg(op.b);
          reg(op.to);
          break;
        case "input":
          reg(op.to);
          break;
        case "output":
          reg(op.from);
          break;
        case "jump":
          if (!WHENS.includes(op.when))
            problems.push(`${where}: a jump's condition must be one of ${WHENS.join(", ")}.`);
          reg(op.to, true);
          break;
        case "read":
        case "write":
        case "halt":
          break;
        default:
          problems.push(
            `${where}: '${String((op as { op?: unknown })?.op)}' is not a micro-operation (${MICRO_OPS.join(", ")}).`,
          );
      }
    }
  };
  checkOps("Fetch", def.fetch);
  const instructions = def.instructions ?? [];
  if (instructions.length === 0) problems.push("The machine needs at least one instruction.");
  const prior: { opcode: number; fixed: number | undefined; name: string }[] = [];
  const mnemonics = new Set<string>();
  for (const ins of instructions) {
    const label = `Instruction ${ins.mnemonic || "(no name)"}`;
    if (!MNEMONIC.test(ins.mnemonic ?? ""))
      problems.push(`${label}: a mnemonic is 2 to 6 letters.`);
    const m = (ins.mnemonic ?? "").toUpperCase();
    if (m === "DAT") problems.push(`${label}: DAT is kept for data.`);
    if (mnemonics.has(m)) problems.push(`Two instructions are called ${m}.`);
    mnemonics.add(m);
    if (!Number.isInteger(ins.opcode) || ins.opcode < 0 || ins.opcode >= shape.opcodes) {
      problems.push(
        `${label}: with ${def.opcodeDigits} opcode digit${def.opcodeDigits === 1 ? "" : "s"} the opcode must be 0 to ${shape.opcodes - 1}.`,
      );
    }
    if (
      ins.fixedOperand !== undefined &&
      (ins.operand ||
        !Number.isInteger(ins.fixedOperand) ||
        ins.fixedOperand < 0 ||
        ins.fixedOperand >= shape.operandSize)
    ) {
      problems.push(
        `${label}: a fixed operand must fit the operand field, on an instruction that takes no operand.`,
      );
    }
    // Two instructions clash when they share an opcode and either could match the same operand.
    const clash = prior.find(
      (p) =>
        p.opcode === ins.opcode &&
        (p.fixed === undefined || ins.fixedOperand === undefined || p.fixed === ins.fixedOperand),
    );
    if (clash) problems.push(`Opcode ${ins.opcode} is used by both ${clash.name} and ${m}.`);
    prior.push({ opcode: ins.opcode, fixed: ins.fixedOperand, name: m });
    checkOps(label, ins.micro);
  }
  return problems;
}

const ROLE_NAMES: Record<RegisterRole, string> = {
  pc: "program counter",
  mar: "memory address register",
  mdr: "memory data register",
  ir: "instruction register",
};

/** Reads a definition from JSON text. */
export function parseDefinition(
  text: string,
): { ok: true; definition: MachineDefinition } | { ok: false; problems: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, problems: ["The file is not valid JSON."] };
  }
  const problems = checkDefinition(data);
  return problems.length
    ? { ok: false, problems }
    : { ok: true, definition: data as MachineDefinition };
}
