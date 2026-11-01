/**
 * The RISC-V assembler (docs/specs/riscv.md): two passes over `.text` and `.data`, with RARS's
 * pseudo-instructions and directives, producing real instruction words.
 */
import { SPECS, encode, registerNumber, show, type RvName } from "./isa";

export const TEXT_BASE = 0x00400000;
export const DATA_BASE = 0x10010000;

export interface RvDiagnostic {
  readonly line: number;
  readonly message: string;
}

export interface RvInstruction {
  readonly address: number;
  readonly word: number;
  readonly line: number;
  /** The real instruction, as RARS's "Basic" column shows it. */
  readonly basic: string;
  /** The source text it came from (a pseudo-instruction can make two). */
  readonly source: string;
}

export interface RvProgram {
  readonly text: readonly RvInstruction[];
  /** Initial data bytes, by address. */
  readonly data: ReadonlyMap<number, number>;
  readonly labels: Readonly<Record<string, number>>;
  readonly textEnd: number;
}

interface Pending {
  readonly line: number;
  readonly address: number;
  readonly name: string;
  readonly args: readonly string[];
  readonly source: string;
}

class AsmError extends Error {}

const parseNumber = (text: string): number | null => {
  const t = text.trim();
  const ch = /^'(\\?.)'$/.exec(t);
  if (ch) return unescape(ch[1] as string).charCodeAt(0);
  if (/^-?0x[0-9a-f]+$/i.test(t)) return Number.parseInt(t.replace(/^(-?)0x/i, "$1"), 16);
  if (/^-?\d+$/.test(t)) return Number(t);
  return null;
};

function unescape(s: string): string {
  return s.replace(
    /\\(.)/g,
    (_, c: string) => ({ n: "\n", t: "\t", "0": "\0", "\\": "\\", '"': '"', "'": "'" })[c] ?? c,
  );
}

/** Splits operands on commas outside quotes. */
function splitArgs(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (c === '"' && text[i - 1] !== "\\") quoted = !quoted;
    if (c === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function stripComment(text: string): string {
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && text[i - 1] !== "\\") quoted = !quoted;
    if (c === "#" && !quoted) return text.slice(0, i);
  }
  return text;
}

const fits = (v: number, bitsSigned: number) =>
  v >= -(2 ** (bitsSigned - 1)) && v < 2 ** (bitsSigned - 1);

const PSEUDO_SIZE: Record<string, (args: readonly string[]) => number> = {
  li: (a) => {
    const v = parseNumber(a[1] ?? "");
    return v !== null && fits(v | 0, 12) ? 1 : 2;
  },
  la: () => 2,
};

const PSEUDOS = new Set([
  "li",
  "la",
  "mv",
  "not",
  "neg",
  "j",
  "jr",
  "ret",
  "call",
  "nop",
  "beqz",
  "bnez",
  "bltz",
  "bgez",
  "bgtz",
  "blez",
  "bgt",
  "ble",
  "bgtu",
  "bleu",
]);

export function assembleRiscv(source: string): {
  ok: boolean;
  program: RvProgram | null;
  diagnostics: RvDiagnostic[];
} {
  const diagnostics: RvDiagnostic[] = [];
  const labels: Record<string, number> = {};
  const pending: Pending[] = [];
  const dataItems: { line: number; address: number; directive: string; args: string[] }[] = [];
  const data = new Map<number, number>();
  let section: "text" | "data" = "text";
  let textPc = TEXT_BASE;
  let dataPc = DATA_BASE;

  source.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    try {
      let text = stripComment(raw).trim();
      // Labels, possibly several, before a statement.
      for (
        let m = /^([A-Za-z_.$][\w.$]*):/.exec(text);
        m;
        m = /^([A-Za-z_.$][\w.$]*):/.exec(text)
      ) {
        const name = m[1] as string;
        if (name in labels) throw new AsmError(`the label '${name}' is defined twice.`);
        if (section === "data") {
          // A .word after a label is aligned first, so the label points at the word.
          const next = text.slice(m[0].length).trim();
          if (/^\.word\b/.test(next)) dataPc = align(dataPc, 4);
          else if (/^\.half\b/.test(next)) dataPc = align(dataPc, 2);
        }
        labels[name] = section === "text" ? textPc : dataPc;
        text = text.slice(m[0].length).trim();
      }
      if (!text) return;
      const [head = "", ...restParts] = text.split(/\s+/);
      const rest = text.slice(head.length).trim();
      const word = head.toLowerCase();
      if (word.startsWith(".")) {
        switch (word) {
          case ".text":
            section = "text";
            return;
          case ".data":
            section = "data";
            return;
          case ".globl":
          case ".global":
            return;
          case ".align": {
            const n = parseNumber(rest);
            if (n === null || n < 0 || n > 8)
              throw new AsmError(".align needs a power of two from 0 to 8.");
            if (section === "data") dataPc = align(dataPc, 2 ** n);
            return;
          }
          case ".word":
          case ".half":
          case ".byte":
          case ".space":
          case ".ascii":
          case ".asciz":
          case ".string": {
            if (section !== "data") throw new AsmError(`${word} belongs in the .data section.`);
            const args = word.startsWith(".asc") || word === ".string" ? [rest] : splitArgs(rest);
            const size = word === ".word" ? 4 : word === ".half" ? 2 : 1;
            if (size > 1) dataPc = align(dataPc, size);
            const start = dataPc;
            if (word === ".space") {
              const n = parseNumber(rest);
              if (n === null || n < 0) throw new AsmError(".space needs a number of bytes.");
              dataPc += n;
            } else if (size > 1 || word === ".byte") {
              if (args.length === 0) throw new AsmError(`${word} needs at least one value.`);
              dataPc += size * args.length;
            } else {
              const m = /^"((?:[^"\\]|\\.)*)"$/.exec(rest);
              if (!m) throw new AsmError(`${word} needs text in double quotes.`);
              dataPc += unescape(m[1] as string).length + (word === ".ascii" ? 0 : 1);
            }
            dataItems.push({ line, address: start, directive: word, args });
            return;
          }
          default:
            throw new AsmError(`'${head}' is not a directive this machine knows.`);
        }
      }
      if (section !== "text") throw new AsmError("instructions belong in the .text section.");
      if (!(word in SPECS) && !PSEUDOS.has(word)) {
        throw new AsmError(`'${head}' is not a RISC-V instruction this machine knows.`);
      }
      void restParts;
      const args = splitArgs(rest);
      const count = PSEUDO_SIZE[word]?.(args) ?? 1;
      pending.push({ line, address: textPc, name: word, args, source: text });
      textPc += 4 * count;
    } catch (e) {
      if (!(e instanceof AsmError)) throw e;
      diagnostics.push({ line, message: `Line ${line}: ${e.message}` });
    }
  });

  // Data, now that every label is known.
  for (const item of dataItems) {
    try {
      let at = item.address;
      if (item.directive === ".space") continue;
      if (item.directive.startsWith(".asc") || item.directive === ".string") {
        const m = /^"((?:[^"\\]|\\.)*)"$/.exec(item.args[0] ?? "") as RegExpExecArray;
        const s = unescape(m[1] as string);
        for (const ch of s) data.set(at++, ch.charCodeAt(0) & 0xff);
        if (item.directive !== ".ascii") data.set(at, 0);
        continue;
      }
      const size = item.directive === ".word" ? 4 : item.directive === ".half" ? 2 : 1;
      for (const arg of item.args) {
        const v = parseNumber(arg) ?? labels[arg];
        if (v === undefined) throw new AsmError(`'${arg}' is not a number or a label.`);
        for (let b = 0; b < size; b++) data.set(at + b, (v >>> (8 * b)) & 0xff);
        at += size;
      }
    } catch (e) {
      if (!(e instanceof AsmError)) throw e;
      diagnostics.push({ line: item.line, message: `Line ${item.line}: ${e.message}` });
    }
  }

  // Instructions.
  const text: RvInstruction[] = [];
  for (const p of pending) {
    try {
      const made = expand(p, labels);
      made.forEach((d, i) => {
        const address = p.address + 4 * i;
        text.push({
          address,
          word: encode(d),
          line: p.line,
          basic: show(d, address),
          source: p.source,
        });
      });
    } catch (e) {
      if (!(e instanceof AsmError)) throw e;
      diagnostics.push({ line: p.line, message: `Line ${p.line}: ${e.message}` });
    }
  }

  diagnostics.sort((a, b) => a.line - b.line);
  const ok = diagnostics.length === 0;
  return { ok, program: ok ? { text, data, labels, textEnd: textPc } : null, diagnostics };
}

function align(v: number, n: number): number {
  return Math.ceil(v / n) * n;
}

type D = { name: RvName; rd: number; rs1: number; rs2: number; imm: number };

function expand(p: Pending, labels: Readonly<Record<string, number>>): D[] {
  const { args, name } = p;
  const need = (n: number) => {
    if (args.length !== n) {
      throw new AsmError(
        `${name} needs ${n} operand${n === 1 ? "" : "s"}, separated by commas; this has ${args.length}.`,
      );
    }
  };
  const reg = (i: number) => {
    const r = registerNumber(args[i] ?? "");
    if (r === null)
      throw new AsmError(
        `'${args[i] ?? ""}' is not a register. Use x0 to x31 or a name such as t0, a0, sp.`,
      );
    return r;
  };
  const imm = (i: number, bits: number, what = "value") => {
    const v = parseNumber(args[i] ?? "");
    if (v === null) throw new AsmError(`'${args[i] ?? ""}' is not a number.`);
    if (!fits(v, bits))
      throw new AsmError(
        `${v} does not fit in a ${bits}-bit ${what} (${-(2 ** (bits - 1))} to ${2 ** (bits - 1) - 1}).`,
      );
    return v;
  };
  const target = (i: number, at: number, bits: number) => {
    const t = args[i] ?? "";
    const addr = labels[t] ?? parseNumber(t);
    if (addr === null || addr === undefined) throw new AsmError(`the label '${t}' is not defined.`);
    const offset = addr - at;
    if (!fits(offset, bits)) throw new AsmError(`'${t}' is too far away to reach from here.`);
    return offset;
  };
  const memArg = (i: number) => {
    const m = /^(-?(?:0x[0-9a-f]+|\d+))?\(([^)]+)\)$/i.exec((args[i] ?? "").replace(/\s+/g, ""));
    if (!m)
      throw new AsmError(
        `'${args[i] ?? ""}' should look like offset(register), for example 8(sp).`,
      );
    const off = m[1] === undefined ? 0 : (parseNumber(m[1]) as number);
    if (!fits(off, 12))
      throw new AsmError(`the offset ${off} does not fit in 12 bits (-2048 to 2047).`);
    const r = registerNumber(m[2] as string);
    if (r === null) throw new AsmError(`'${m[2]}' is not a register.`);
    return { off, r };
  };
  const at = p.address;
  const I = (n: RvName, rd: number, rs1: number, v: number): D => ({
    name: n,
    rd,
    rs1,
    rs2: 0,
    imm: v,
  });
  const R = (n: RvName, rd: number, rs1: number, rs2: number): D => ({
    name: n,
    rd,
    rs1,
    rs2,
    imm: 0,
  });
  const B = (n: RvName, rs1: number, rs2: number, off: number): D => ({
    name: n,
    rd: 0,
    rs1,
    rs2,
    imm: off,
  });
  /** lui + addi for any 32-bit value, with the upper part rounded for the sign of the lower. */
  const split = (v: number) => {
    const lo = ((v & 0xfff) << 20) >> 20;
    const hi = ((v - lo) >>> 0) & 0xfffff000;
    return { hi: hi | 0, lo };
  };

  if (name in SPECS) {
    const n = name as RvName;
    const s = SPECS[n];
    switch (s.format) {
      case "R":
        need(3);
        return [R(n, reg(0), reg(1), reg(2))];
      case "I":
        if (n === "ecall") {
          need(0);
          return [I("ecall", 0, 0, 0)];
        }
        if (s.opcode === 0x03 || (n === "jalr" && args.length === 2)) {
          need(2);
          const m = memArg(1);
          return [I(n, reg(0), m.r, m.off)];
        }
        if (n === "jalr") {
          need(3);
          return [I(n, reg(0), reg(1), imm(2, 12))];
        }
        need(3);
        if (n === "slli" || n === "srli" || n === "srai") {
          const v = parseNumber(args[2] ?? "");
          if (v === null || v < 0 || v > 31) throw new AsmError("a shift amount must be 0 to 31.");
          return [I(n, reg(0), reg(1), v)];
        }
        return [I(n, reg(0), reg(1), imm(2, 12))];
      case "S": {
        need(2);
        const m = memArg(1);
        return [{ name: n, rd: 0, rs1: m.r, rs2: reg(0), imm: m.off }];
      }
      case "B":
        need(3);
        return [B(n, reg(0), reg(1), target(2, at, 13))];
      case "U": {
        need(2);
        const v = parseNumber(args[1] ?? "");
        if (v === null || v < -524288 || v > 1048575)
          throw new AsmError("the upper immediate must be 0 to 1048575 (20 bits).");
        return [{ name: n, rd: reg(0), rs1: 0, rs2: 0, imm: (v << 12) | 0 }];
      }
      default:
        if (args.length === 1)
          return [{ name: "jal", rd: 1, rs1: 0, rs2: 0, imm: target(0, at, 21) }];
        need(2);
        return [{ name: "jal", rd: reg(0), rs1: 0, rs2: 0, imm: target(1, at, 21) }];
    }
  }
  switch (name) {
    case "li": {
      need(2);
      const v = parseNumber(args[1] ?? "");
      if (v === null || v < -(2 ** 31) || v > 2 ** 32 - 1)
        throw new AsmError(`'${args[1] ?? ""}' is not a 32-bit number.`);
      if (fits(v | 0, 12)) return [I("addi", reg(0), 0, v | 0)];
      const { hi, lo } = split(v | 0);
      return [{ name: "lui", rd: reg(0), rs1: 0, rs2: 0, imm: hi }, I("addi", reg(0), reg(0), lo)];
    }
    case "la": {
      need(2);
      const t = args[1] ?? "";
      const addr = labels[t];
      if (addr === undefined) throw new AsmError(`the label '${t}' is not defined.`);
      const { hi, lo } = split((addr - at) | 0);
      return [
        { name: "auipc", rd: reg(0), rs1: 0, rs2: 0, imm: hi },
        I("addi", reg(0), reg(0), lo),
      ];
    }
    case "mv":
      need(2);
      return [I("addi", reg(0), reg(1), 0)];
    case "not":
      need(2);
      return [I("xori", reg(0), reg(1), -1)];
    case "neg":
      need(2);
      return [R("sub", reg(0), 0, reg(1))];
    case "nop":
      need(0);
      return [I("addi", 0, 0, 0)];
    case "j":
      need(1);
      return [{ name: "jal", rd: 0, rs1: 0, rs2: 0, imm: target(0, at, 21) }];
    case "call":
      need(1);
      return [{ name: "jal", rd: 1, rs1: 0, rs2: 0, imm: target(0, at, 21) }];
    case "jr":
      need(1);
      return [I("jalr", 0, reg(0), 0)];
    case "ret":
      need(0);
      return [I("jalr", 0, 1, 0)];
    case "beqz":
    case "bnez":
    case "bltz":
    case "bgez": {
      need(2);
      const n = ({ beqz: "beq", bnez: "bne", bltz: "blt", bgez: "bge" } as const)[name];
      return [B(n, reg(0), 0, target(1, at, 13))];
    }
    case "bgtz":
      need(2);
      return [B("blt", 0, reg(0), target(1, at, 13))];
    case "blez":
      need(2);
      return [B("bge", 0, reg(0), target(1, at, 13))];
    default: {
      // bgt, ble, bgtu, bleu: swap the registers.
      need(3);
      const n = ({ bgt: "blt", ble: "bge", bgtu: "bltu", bleu: "bgeu" } as const)[name as "bgt"];
      return [B(n, reg(1), reg(0), target(2, at, 13))];
    }
  }
}
