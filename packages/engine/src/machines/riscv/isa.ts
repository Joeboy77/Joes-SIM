/**
 * The RV32I subset (docs/specs/riscv.md): register names, and encoding and decoding of real
 * 32-bit instruction words, so the machine code matches what RARS shows.
 */

export const ABI_NAMES = [
  "zero",
  "ra",
  "sp",
  "gp",
  "tp",
  "t0",
  "t1",
  "t2",
  "s0",
  "s1",
  "a0",
  "a1",
  "a2",
  "a3",
  "a4",
  "a5",
  "a6",
  "a7",
  "s2",
  "s3",
  "s4",
  "s5",
  "s6",
  "s7",
  "s8",
  "s9",
  "s10",
  "s11",
  "t3",
  "t4",
  "t5",
  "t6",
] as const;

/** The register number for "x5", "t0" or "fp", or null. */
export function registerNumber(name: string): number | null {
  const n = name.toLowerCase();
  if (n === "fp") return 8;
  const x = /^x(\d{1,2})$/.exec(n);
  if (x) {
    const i = Number(x[1]);
    return i < 32 ? i : null;
  }
  const i = (ABI_NAMES as readonly string[]).indexOf(n);
  return i >= 0 ? i : null;
}

export type Format = "R" | "I" | "S" | "B" | "U" | "J";

export type RvName =
  | "add"
  | "sub"
  | "and"
  | "or"
  | "xor"
  | "sll"
  | "srl"
  | "sra"
  | "slt"
  | "sltu"
  | "addi"
  | "andi"
  | "ori"
  | "xori"
  | "slti"
  | "sltiu"
  | "slli"
  | "srli"
  | "srai"
  | "lui"
  | "auipc"
  | "lw"
  | "lh"
  | "lhu"
  | "lb"
  | "lbu"
  | "sw"
  | "sh"
  | "sb"
  | "beq"
  | "bne"
  | "blt"
  | "bge"
  | "bltu"
  | "bgeu"
  | "jal"
  | "jalr"
  | "ecall";

interface Spec {
  readonly format: Format;
  readonly opcode: number;
  readonly funct3?: number;
  readonly funct7?: number;
}

export const SPECS: Readonly<Record<RvName, Spec>> = {
  add: { format: "R", opcode: 0x33, funct3: 0, funct7: 0 },
  sub: { format: "R", opcode: 0x33, funct3: 0, funct7: 0x20 },
  sll: { format: "R", opcode: 0x33, funct3: 1, funct7: 0 },
  slt: { format: "R", opcode: 0x33, funct3: 2, funct7: 0 },
  sltu: { format: "R", opcode: 0x33, funct3: 3, funct7: 0 },
  xor: { format: "R", opcode: 0x33, funct3: 4, funct7: 0 },
  srl: { format: "R", opcode: 0x33, funct3: 5, funct7: 0 },
  sra: { format: "R", opcode: 0x33, funct3: 5, funct7: 0x20 },
  or: { format: "R", opcode: 0x33, funct3: 6, funct7: 0 },
  and: { format: "R", opcode: 0x33, funct3: 7, funct7: 0 },
  addi: { format: "I", opcode: 0x13, funct3: 0 },
  slli: { format: "I", opcode: 0x13, funct3: 1, funct7: 0 },
  slti: { format: "I", opcode: 0x13, funct3: 2 },
  sltiu: { format: "I", opcode: 0x13, funct3: 3 },
  xori: { format: "I", opcode: 0x13, funct3: 4 },
  srli: { format: "I", opcode: 0x13, funct3: 5, funct7: 0 },
  srai: { format: "I", opcode: 0x13, funct3: 5, funct7: 0x20 },
  ori: { format: "I", opcode: 0x13, funct3: 6 },
  andi: { format: "I", opcode: 0x13, funct3: 7 },
  lb: { format: "I", opcode: 0x03, funct3: 0 },
  lh: { format: "I", opcode: 0x03, funct3: 1 },
  lw: { format: "I", opcode: 0x03, funct3: 2 },
  lbu: { format: "I", opcode: 0x03, funct3: 4 },
  lhu: { format: "I", opcode: 0x03, funct3: 5 },
  jalr: { format: "I", opcode: 0x67, funct3: 0 },
  ecall: { format: "I", opcode: 0x73, funct3: 0 },
  sb: { format: "S", opcode: 0x23, funct3: 0 },
  sh: { format: "S", opcode: 0x23, funct3: 1 },
  sw: { format: "S", opcode: 0x23, funct3: 2 },
  beq: { format: "B", opcode: 0x63, funct3: 0 },
  bne: { format: "B", opcode: 0x63, funct3: 1 },
  blt: { format: "B", opcode: 0x63, funct3: 4 },
  bge: { format: "B", opcode: 0x63, funct3: 5 },
  bltu: { format: "B", opcode: 0x63, funct3: 6 },
  bgeu: { format: "B", opcode: 0x63, funct3: 7 },
  lui: { format: "U", opcode: 0x37 },
  auipc: { format: "U", opcode: 0x17 },
  jal: { format: "J", opcode: 0x6f },
};

/** One instruction, decoded. Unused fields are 0. */
export interface Decoded {
  readonly name: RvName;
  readonly rd: number;
  readonly rs1: number;
  readonly rs2: number;
  /** The immediate, sign-extended (for U-type, the upper 20 bits already shifted). */
  readonly imm: number;
}

const bits = (v: number, hi: number, lo: number) => (v >>> lo) & ((1 << (hi - lo + 1)) - 1);
const signExtend = (v: number, width: number) => (v << (32 - width)) >> (32 - width);

export function encode(d: Decoded): number {
  const s = SPECS[d.name];
  const { rd, rs1, rs2, imm } = d;
  const f3 = (s.funct3 ?? 0) << 12;
  let word: number;
  switch (s.format) {
    case "R":
      word = ((s.funct7 ?? 0) << 25) | (rs2 << 20) | (rs1 << 15) | f3 | (rd << 7);
      break;
    case "I": {
      const shift = d.name === "slli" || d.name === "srli" || d.name === "srai";
      const field = shift ? ((s.funct7 ?? 0) << 5) | (imm & 31) : imm & 0xfff;
      word = (field << 20) | (rs1 << 15) | f3 | (rd << 7);
      break;
    }
    case "S":
      word = (bits(imm, 11, 5) << 25) | (rs2 << 20) | (rs1 << 15) | f3 | (bits(imm, 4, 0) << 7);
      break;
    case "B":
      word =
        (bits(imm, 12, 12) << 31) |
        (bits(imm, 10, 5) << 25) |
        (rs2 << 20) |
        (rs1 << 15) |
        f3 |
        (bits(imm, 4, 1) << 8) |
        (bits(imm, 11, 11) << 7);
      break;
    case "U":
      word = (imm & 0xfffff000) | (rd << 7);
      break;
    default:
      word =
        (bits(imm, 20, 20) << 31) |
        (bits(imm, 10, 1) << 21) |
        (bits(imm, 11, 11) << 20) |
        (bits(imm, 19, 12) << 12) |
        (rd << 7);
  }
  return (word | s.opcode) >>> 0;
}

/** Decodes an instruction word, or returns null for one outside the subset. */
export function decode(word: number): Decoded | null {
  const opcode = word & 0x7f;
  const rd = bits(word, 11, 7);
  const funct3 = bits(word, 14, 12);
  const rs1 = bits(word, 19, 15);
  const rs2 = bits(word, 24, 20);
  const funct7 = bits(word, 31, 25);
  const find = (format: Format, extra?: (s: Spec) => boolean) =>
    (Object.keys(SPECS) as RvName[]).find((n) => {
      const s = SPECS[n];
      return (
        s.format === format &&
        s.opcode === opcode &&
        (s.funct3 === undefined || s.funct3 === funct3) &&
        (!extra || extra(s))
      );
    });
  switch (opcode) {
    case 0x33: {
      const name = find("R", (s) => s.funct7 === funct7);
      return name ? { name, rd, rs1, rs2, imm: 0 } : null;
    }
    case 0x13: {
      const shift = funct3 === 1 || funct3 === 5;
      const name = find("I", (s) => !shift || s.funct7 === funct7);
      if (!name) return null;
      return { name, rd, rs1, rs2: 0, imm: shift ? rs2 : signExtend(bits(word, 31, 20), 12) };
    }
    case 0x03:
    case 0x67: {
      const name = find("I");
      return name ? { name, rd, rs1, rs2: 0, imm: signExtend(bits(word, 31, 20), 12) } : null;
    }
    case 0x73:
      return word === 0x73 ? { name: "ecall", rd: 0, rs1: 0, rs2: 0, imm: 0 } : null;
    case 0x23: {
      const name = find("S");
      const imm = signExtend((bits(word, 31, 25) << 5) | bits(word, 11, 7), 12);
      return name ? { name, rd: 0, rs1, rs2, imm } : null;
    }
    case 0x63: {
      const name = find("B");
      const imm = signExtend(
        (bits(word, 31, 31) << 12) |
          (bits(word, 7, 7) << 11) |
          (bits(word, 30, 25) << 5) |
          (bits(word, 11, 8) << 1),
        13,
      );
      return name ? { name, rd: 0, rs1, rs2, imm } : null;
    }
    case 0x37:
    case 0x17:
      return {
        name: opcode === 0x37 ? "lui" : "auipc",
        rd,
        rs1: 0,
        rs2: 0,
        imm: (word & 0xfffff000) | 0,
      };
    case 0x6f: {
      const imm = signExtend(
        (bits(word, 31, 31) << 20) |
          (bits(word, 19, 12) << 12) |
          (bits(word, 20, 20) << 11) |
          (bits(word, 30, 21) << 1),
        21,
      );
      return { name: "jal", rd, rs1: 0, rs2: 0, imm };
    }
    default:
      return null;
  }
}

const reg = (i: number) => ABI_NAMES[i] as string;
const hex = (n: number) => `0x${(n >>> 0).toString(16).padStart(8, "0")}`;

/** An instruction as RARS shows it in its "Basic" column (with ABI names; jumps as targets). */
export function show(d: Decoded, address: number): string {
  const s = SPECS[d.name];
  switch (s.format) {
    case "R":
      return `${d.name} ${reg(d.rd)}, ${reg(d.rs1)}, ${reg(d.rs2)}`;
    case "I":
      if (d.name === "ecall") return "ecall";
      if (s.opcode === 0x03 || d.name === "jalr")
        return `${d.name} ${reg(d.rd)}, ${d.imm}(${reg(d.rs1)})`;
      return `${d.name} ${reg(d.rd)}, ${reg(d.rs1)}, ${d.imm}`;
    case "S":
      return `${d.name} ${reg(d.rs2)}, ${d.imm}(${reg(d.rs1)})`;
    case "B":
      return `${d.name} ${reg(d.rs1)}, ${reg(d.rs2)}, ${hex(address + d.imm)}`;
    case "U":
      return `${d.name} ${reg(d.rd)}, ${hex(d.imm >>> 12).replace(/^0x0*(?=.)/, "0x")}`;
    default:
      return `jal ${reg(d.rd)}, ${hex(address + d.imm)}`;
  }
}
