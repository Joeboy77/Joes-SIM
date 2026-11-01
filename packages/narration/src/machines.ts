/**
 * Narration for the RISC-V machine and for custom machines (brief, Phase 10): one sentence per
 * instruction or micro-operation, at a beginner and a technical level.
 */
import { ABI_NAMES, type CustomStep, type RvStep } from "@joes-sim/engine";
import type { Level } from "./types";

const reg = (i: number) => ABI_NAMES[i] as string;
const hex = (n: number) => `0x${(n >>> 0).toString(16).padStart(8, "0")}`;

const OPS: Record<string, [string, string]> = {
  add: ["+", "adds"],
  addi: ["+", "adds"],
  sub: ["−", "subtracts"],
  and: ["AND", "keeps the bits set in both"],
  andi: ["AND", "keeps the bits set in both"],
  or: ["OR", "keeps the bits set in either"],
  ori: ["OR", "keeps the bits set in either"],
  xor: ["XOR", "keeps the bits set in exactly one"],
  xori: ["XOR", "keeps the bits set in exactly one"],
  sll: ["<<", "shifts left"],
  slli: ["<<", "shifts left"],
  srl: [">>>", "shifts right, filling with zeros"],
  srli: [">>>", "shifts right, filling with zeros"],
  sra: [">>", "shifts right, keeping the sign"],
  srai: [">>", "shifts right, keeping the sign"],
  slt: ["<", "compares (signed)"],
  slti: ["<", "compares (signed)"],
  sltu: ["<u", "compares (unsigned)"],
  sltiu: ["<u", "compares (unsigned)"],
};

const BRANCH: Record<string, [string, string]> = {
  beq: ["=", "equal to"],
  bne: ["≠", "not equal to"],
  blt: ["<", "less than"],
  bge: ["≥", "greater than or equal to"],
  bltu: ["<u", "less than (unsigned)"],
  bgeu: ["≥u", "greater than or equal to (unsigned)"],
};

/** One sentence for one RISC-V instruction. */
export function narrateRv(step: RvStep, level: Level): string {
  const d = step.instruction;
  const { rs1Value: a, rs2Value: b } = step.decode;
  const wb = step.writeBack;
  const rd = reg(d.rd);
  const technical = level === "technical";
  const head = `${step.text}:`;
  const value = wb ? wb.value : 0;
  const op = OPS[d.name];
  if (op) {
    const second =
      d.name.endsWith("i") && d.name !== "xori" ? d.imm : d.name === "xori" ? d.imm : b;
    const right = d.name.endsWith("i") ? String(second) : `${reg(d.rs2)} (${b})`;
    if (technical) return `${head} ${rd} ← ${a} ${op[0]} ${second} = ${value}.`;
    return `${head} the ALU ${op[1]}: ${reg(d.rs1)} (${a}) ${op[0]} ${right} gives ${value}, which goes into ${rd}.`;
  }
  if (step.memory) {
    const m = step.memory;
    const size = m.size === 4 ? "word" : m.size === 2 ? "halfword" : "byte";
    if (m.write) {
      return technical
        ? `${head} memory[${hex(m.address)}] ← ${reg(d.rs2)} (${size}) = ${m.value}.`
        : `${head} the address is ${reg(d.rs1)} + ${d.imm} = ${hex(m.address)}; ${reg(d.rs2)} (${m.value}) is stored there as a ${size}.`;
    }
    return technical
      ? `${head} ${rd} ← memory[${hex(m.address)}] (${size}) = ${m.value}.`
      : `${head} the address is ${reg(d.rs1)} + ${d.imm} = ${hex(m.address)}; the ${size} there, ${m.value}, is loaded into ${rd}.`;
  }
  const br = BRANCH[d.name];
  if (br) {
    const taken = step.execute.taken === true;
    if (technical) {
      return `${head} ${a} ${br[0]} ${b} is ${taken ? "true" : "false"}; PC ← ${hex(step.nextPc)}.`;
    }
    return `${head} is ${reg(d.rs1)} (${a}) ${br[1]} ${reg(d.rs2)} (${b})? ${taken ? `Yes, so jump to ${hex(step.nextPc)}` : "No, so carry on to the next instruction"}.`;
  }
  switch (d.name) {
    case "lui":
      return technical
        ? `${head} ${rd} ← ${hex(d.imm)}.`
        : `${head} the upper 20 bits go into ${rd}, which becomes ${hex(d.imm)} (${d.imm}).`;
    case "auipc":
      return technical
        ? `${head} ${rd} ← PC + ${hex(d.imm)} = ${hex(value)}.`
        : `${head} ${rd} gets this instruction's address plus ${hex(d.imm)}: ${hex(value)}. Used to reach labels.`;
    case "jal":
      return technical
        ? `${head} ${rd} ← ${hex(value)}; PC ← ${hex(step.nextPc)}.`
        : d.rd === 0
          ? `${head} jump to ${hex(step.nextPc)}.`
          : `${head} save the return address ${hex(value)} in ${rd}, then jump to ${hex(step.nextPc)}.`;
    case "jalr":
      return technical
        ? `${head} ${rd} ← ${hex(value)}; PC ← ${reg(d.rs1)} + ${d.imm} = ${hex(step.nextPc)}.`
        : d.rd === 0
          ? `${head} jump to the address in ${reg(d.rs1)}: ${hex(step.nextPc)}${d.rs1 === 1 ? " (return to the caller)" : ""}.`
          : `${head} save the return address in ${rd}, then jump to ${hex(step.nextPc)}, the address in ${reg(d.rs1)}.`;
    default: {
      // ecall
      const what = step.syscall?.description ?? "a system call";
      return technical
        ? `${head} system call ${step.syscall?.service ?? ""}: ${what}.`
        : `${head} ask the system to ${what}.`;
    }
  }
}

/** One sentence for one micro-operation of a custom machine. */
export function narrateCustom(step: CustomStep, level: Level): string {
  const technical = level === "technical";
  const find = <T extends CustomStep["events"][number]["type"]>(type: T) =>
    step.events.find(
      (e): e is Extract<CustomStep["events"][number], { type: T }> => e.type === type,
    );
  const error = find("error");
  if (error) return `The machine stops: ${error.message}`;
  const decode = find("decode");
  if (decode) {
    return technical
      ? `Decode: ${decode.instruction} → opcode ${decode.opcode}, operand ${decode.operand}: ${decode.mnemonic}.`
      : `The control unit reads ${decode.instruction}: opcode ${decode.opcode} means ${decode.mnemonic}, with operand ${decode.operand}.`;
  }
  const m = step.micro;
  const phase = step.phase === "fetch" ? "Fetch" : "Execute";
  const read = find("memory-read");
  const write = find("memory-write");
  const alu = find("alu");
  const jump = find("jump");
  const input = find("input");
  const output = find("output");
  const transfer = find("transfer");
  if (find("input-needed")) return "There is no input to read, so the machine waits for one.";
  if (find("halt")) return "The machine stops.";
  if (read)
    return technical
      ? `${phase}: MDR ← memory[${read.address}] = ${read.value}.`
      : `Read memory at ${read.address}: ${read.value}.`;
  if (write) {
    return technical
      ? `${phase}: memory[${write.address}] ← ${write.value} (was ${write.previous}).`
      : `Write ${write.value} into memory at ${write.address}, replacing ${write.previous}.`;
  }
  if (alu) {
    return technical
      ? `${phase}: ${alu.to} ← ${alu.a} ${alu.fn} ${alu.b} = ${alu.result}.`
      : `The ALU works out ${alu.fn} of ${alu.a}${alu.fn === "negate" ? "" : ` and ${alu.b}`}: ${alu.result}${alu.raw !== alu.result ? ` (the true answer ${alu.raw} wrapped round)` : ""}. It goes into ${alu.to}.`;
  }
  if (jump) {
    if (m?.op === "jump" && m.when === "always")
      return technical ? `${phase}: PC ← ${jump.target}.` : `Jump to ${jump.target}.`;
    return jump.taken
      ? technical
        ? `${phase}: condition true; PC ← ${jump.target}.`
        : `The condition holds, so jump to ${jump.target}.`
      : technical
        ? `${phase}: condition false; no jump.`
        : "The condition does not hold, so carry on.";
  }
  if (input)
    return technical
      ? `${phase}: ${input.to} ← input ${input.value}.`
      : `Take ${input.value} from the input into ${input.to}.`;
  if (output)
    return technical
      ? `${phase}: output ← ${output.item.value}.`
      : `Put ${output.item.value} in the output.`;
  // Every other micro-operation moves one value.
  const t = transfer as NonNullable<typeof transfer>;
  if (t.from === t.to) {
    return technical
      ? `${phase}: ${t.to} ← ${t.value}.`
      : `${t.to} changes by one: it is now ${t.value}.`;
  }
  return technical
    ? `${phase}: ${t.to} ← ${t.from} = ${t.value}.`
    : `Copy ${t.value} from ${t.from} into ${t.to}.`;
}
