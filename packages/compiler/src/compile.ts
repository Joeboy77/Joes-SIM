/**
 * Compiles the Little Language to LMC assembly (docs/specs/little-language.md), with a mapping
 * from every generated line back to the source line it came from.
 */
import {
  DIALECTS,
  EXT_MNEMONICS,
  assemble,
  getDialect,
  type DialectId,
  type Program,
} from "@joes-sim/engine";
import { parse, type CompileError, type Condition, type Expr, type Stmt } from "./parse";

export type { CompileError } from "./parse";

export interface CompileOptions {
  /** The machine to compile for. Extended uses one shared subroutine for *, / and %. */
  readonly target?: "classic" | "extended";
  readonly dialect?: DialectId;
  /** Fold constants and remove needless instructions. */
  readonly optimise?: boolean;
}

/** One line of the generated program, and the source line it came from. */
export interface OutputLine {
  readonly text: string;
  /** 1-based Little Language line, or null for a blank separator. */
  readonly source: number | null;
  /** True for an instruction (not a comment, DAT or blank line). */
  readonly instruction: boolean;
}

export interface CompileResult {
  readonly ok: boolean;
  readonly errors: readonly CompileError[];
  /** The generated LMC source. */
  readonly lmc: string;
  readonly lines: readonly OutputLine[];
  /** Instructions generated (not counting DATs). */
  readonly instructions: number;
  /** The assembled program, when it compiled. */
  readonly program: Program | null;
  /** For each mailbox, the Little Language line it came from. */
  readonly addressToSource: readonly (number | null)[];
  /** For each Little Language line (index = line − 1), its mailboxes. */
  readonly sourceToAddresses: readonly (readonly number[])[];
  /** For each Little Language line, the indexes of its generated lines. */
  readonly sourceToLines: readonly (readonly number[])[];
}

interface Item {
  label?: string;
  op: string;
  arg?: string;
  /** A comment line repeating the source statement, instead of an instruction. */
  comment?: string;
  source: number;
}

const RESERVED = new Set(
  [
    ...Object.values(DIALECTS).flatMap((d) => [
      ...Object.keys(d.spellings),
      ...Object.keys(d.unsupported),
    ]),
    ...EXT_MNEMONICS,
    "DAT",
    "TAS",
  ].map((m) => m.toUpperCase()),
);
const GENERATED =
  /^(t\d+|c\d+|cm\d+|zero|one|while\d+|endwhile\d+|else\d+|endif\d+|yes\d+|loop\d+|done\d+|out\d+|mul|div|arg_a|arg_b|rem|mul_\w+|div_\w+|v_\w+|core\d)$/;

function foldable(e: Expr, min: number, max: number): Expr {
  const ok = (v: number) => Number.isInteger(v) && v >= min && v <= max;
  if (e.kind === "neg") {
    const a = foldable(e.arg, min, max);
    if (a.kind === "num" && ok(-a.value)) return { ...a, value: -a.value || 0 };
    return { ...e, arg: a };
  }
  if (e.kind !== "bin") return e;
  const left = foldable(e.left, min, max);
  const right = foldable(e.right, min, max);
  if (left.kind === "num" && right.kind === "num" && left.value >= 0 && right.value >= 0) {
    const a = left.value;
    const b = right.value;
    const v =
      e.op === "+"
        ? a + b
        : e.op === "-"
          ? a - b
          : e.op === "*"
            ? a * b
            : b === 0
              ? 0
              : e.op === "/"
                ? Math.floor(a / b)
                : a % b;
    if (ok(v)) return { kind: "num", value: v, line: e.line, column: e.column };
  }
  return { ...e, left, right };
}

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const target = options.target ?? "classic";
  const dialectId = options.dialect ?? "classic";
  const dialect = getDialect(dialectId);
  const parsed = parse(source);
  const errors: CompileError[] = [...parsed.errors];
  const sourceLines = source.split(/\r?\n/);

  // Variables are set by = or input; using one that is never set is an error.
  const set = new Map<string, number>();
  const visit = (stmts: readonly Stmt[], fn: (s: Stmt) => void) => {
    for (const s of stmts) {
      fn(s);
      if (s.kind === "if") {
        visit(s.then, fn);
        if (s.otherwise) visit(s.otherwise, fn);
      } else if (s.kind === "while") visit(s.body, fn);
    }
  };
  visit(parsed.statements, (s) => {
    if ((s.kind === "input" || s.kind === "assign") && !set.has(s.name)) set.set(s.name, s.line);
  });
  const reported = new Set<string>();
  const checkExpr = (e: Expr) => {
    if (e.kind === "var" && !set.has(e.name) && !reported.has(e.name)) {
      reported.add(e.name);
      errors.push({
        line: e.line,
        column: e.column,
        endColumn: e.column + e.name.length,
        message: `Line ${e.line}: '${e.name}' is used but never given a value. Set it with '${e.name} = ...' or 'input ${e.name}' first.`,
      });
    }
    if (e.kind === "num" && (e.value < dialect.minValue || e.value > dialect.maxValue)) {
      errors.push({
        line: e.line,
        column: e.column,
        endColumn: e.column + String(e.value).length,
        message: `Line ${e.line}: ${e.value} does not fit in a mailbox (${dialect.minValue} to ${dialect.maxValue}).`,
      });
    }
    if (e.kind === "neg") checkExpr(e.arg);
    if (e.kind === "bin") {
      checkExpr(e.left);
      checkExpr(e.right);
    }
  };
  const exprsOf = (s: Stmt): Expr[] =>
    s.kind === "print" || s.kind === "assign"
      ? [s.expr]
      : s.kind === "if" || s.kind === "while"
        ? [s.cond.left, s.cond.right]
        : [];
  visit(parsed.statements, (s) => exprsOf(s).forEach(checkExpr));

  if (errors.length) return failed(errors.sort((a, b) => a.line - b.line || a.column - b.column));

  // Names: variables keep theirs unless they clash with mnemonics or generated labels.
  const varName = (n: string) =>
    RESERVED.has(n.toUpperCase()) || GENERATED.test(n) ? `v_${n}` : n;

  const items: Item[] = [];
  const consts = new Map<number, { name: string; source: number }>();
  const temps = new Map<string, number>();
  let labels = 0;
  let needMul = false;
  let needDiv = false;
  const fresh = () => ++labels;
  const constant = (v: number, line: number) => {
    const existing = consts.get(v);
    if (existing) return existing.name;
    const name = v === 0 ? "zero" : v === 1 ? "one" : v < 0 ? `cm${-v}` : `c${v}`;
    consts.set(v, { name, source: line });
    return name;
  };
  const temp = (d: number, line: number) => {
    const name = `t${d}`;
    if (!temps.has(name)) temps.set(name, line);
    return name;
  };
  const emit = (line: number, op: string, arg?: string, label?: string) => {
    items.push({
      op,
      source: line,
      ...(arg !== undefined ? { arg } : {}),
      ...(label ? { label } : {}),
    });
  };
  /** A pending label to put on the next instruction. */
  let pending: string[] = [];
  const at = (label: string) => pending.push(label);
  const put = (line: number, op: string, arg?: string) => {
    const [first, ...rest] = pending;
    pending = [];
    // Several labels on one place: extra ones get a BRA-free alias by sharing the instruction.
    for (const extra of rest) aliases.set(extra, first as string);
    emit(line, op, arg, first);
  };
  const aliases = new Map<string, string>();

  const fold = (e: Expr) =>
    options.optimise ? foldable(e, dialect.minValue, dialect.maxValue) : e;
  const simple = (e: Expr, line: number): string | null =>
    e.kind === "num" ? constant(e.value, line) : e.kind === "var" ? varName(e.name) : null;

  const gen = (e: Expr, d: number, line: number): void => {
    const s = simple(e, line);
    if (s) return put(line, "LDA", s);
    if (e.kind === "neg") {
      const a = simple(e.arg, line);
      if (a) {
        put(line, "LDA", constant(0, line));
        return put(line, "SUB", a);
      }
      gen(e.arg, d, line);
      put(line, "STA", temp(d, line));
      put(line, "LDA", constant(0, line));
      return put(line, "SUB", temp(d, line));
    }
    const bin = e as Extract<Expr, { kind: "bin" }>;
    if (bin.op === "+" || bin.op === "-") {
      const op = bin.op === "+" ? "ADD" : "SUB";
      const r = simple(bin.right, line);
      if (r) {
        gen(bin.left, d, line);
        return put(line, op, r);
      }
      gen(bin.right, d, line);
      put(line, "STA", temp(d, line));
      gen(bin.left, d + 1, line);
      return put(line, op, temp(d, line));
    }
    // *, / and %: built from additions or subtractions in a loop.
    gen(bin.right, d, line);
    const b = temp(d, line);
    put(line, "STA", b);
    gen(bin.left, d + 1, line);
    if (target === "extended") {
      put(line, "STA", "arg_a");
      put(line, "LDA", b);
      put(line, "STA", "arg_b");
      if (bin.op === "*") {
        needMul = true;
        return put(line, "CALL", "mul");
      }
      needDiv = true;
      put(line, "CALL", "div");
      if (bin.op === "%") put(line, "LDA", "rem");
      return;
    }
    const a = temp(d + 1, line);
    const r = temp(d + 2, line);
    const n = fresh();
    const zero = constant(0, line);
    const one = constant(1, line);
    put(line, "STA", a);
    put(line, "LDA", zero);
    put(line, "STA", r);
    if (bin.op === "*") {
      // r = 0; while b > 0: r = r + a; b = b - 1
      at(`loop${n}`);
      put(line, "LDA", b);
      put(line, "BRZ", `done${n}`);
      put(line, "SUB", one);
      put(line, "STA", b);
      put(line, "LDA", r);
      put(line, "ADD", a);
      put(line, "STA", r);
      put(line, "BRA", `loop${n}`);
      at(`done${n}`);
      return put(line, "LDA", r);
    }
    // r = 0; if b == 0 the answer is 0; while a >= b: a = a - b; r = r + 1
    put(line, "LDA", b);
    put(line, "BRZ", `out${n}`);
    at(`loop${n}`);
    put(line, "LDA", a);
    put(line, "SUB", b);
    put(line, "BRP", `yes${n}`);
    put(line, "BRA", `done${n}`);
    at(`yes${n}`);
    put(line, "STA", a);
    put(line, "LDA", r);
    put(line, "ADD", one);
    put(line, "STA", r);
    put(line, "BRA", `loop${n}`);
    at(`out${n}`);
    put(line, "STA", a);
    at(`done${n}`);
    return put(line, "LDA", bin.op === "/" ? r : a);
  };

  /** Code that carries on when the condition holds and jumps to `no` when it does not. */
  const branch = (cond: Condition, no: string, line: number) => {
    const diff: Expr = {
      kind: "bin",
      op: "-",
      left: cond.left,
      right: cond.right,
      line,
      column: 1,
    };
    gen(fold(diff), 0, line);
    const yes = `yes${fresh()}`;
    switch (cond.op) {
      case "==":
        put(line, "BRZ", yes);
        put(line, "BRA", no);
        return at(yes);
      case "!=":
        return put(line, "BRZ", no);
      case ">=":
        put(line, "BRP", yes);
        put(line, "BRA", no);
        return at(yes);
      case "<":
        return put(line, "BRP", no);
      case ">":
        put(line, "BRZ", no);
        put(line, "BRP", yes);
        put(line, "BRA", no);
        return at(yes);
      default:
        // <=
        put(line, "BRZ", yes);
        put(line, "BRP", no);
        return at(yes);
    }
  };

  const comment = (line: number) => {
    items.push({
      op: "",
      comment: `// ${line}: ${(sourceLines[line - 1] as string).trim()}`,
      source: line,
    });
  };

  const statements = (stmts: readonly Stmt[]) => {
    for (const s of stmts) {
      comment(s.line);
      switch (s.kind) {
        case "input":
          put(s.line, "INP");
          put(s.line, "STA", varName(s.name));
          break;
        case "print":
          gen(fold(s.expr), 0, s.line);
          put(s.line, "OUT");
          break;
        case "assign":
          gen(fold(s.expr), 0, s.line);
          put(s.line, "STA", varName(s.name));
          break;
        case "if": {
          const n = fresh();
          const end = `endif${n}`;
          const otherwise = s.otherwise ? `else${n}` : end;
          branch(s.cond, otherwise, s.line);
          statements(s.then);
          if (s.otherwise) {
            put(s.elseLine as number, "BRA", end);
            at(otherwise);
            statements(s.otherwise);
          }
          at(end);
          break;
        }
        case "while": {
          const n = fresh();
          at(`while${n}`);
          branch(s.cond, `endwhile${n}`, s.line);
          statements(s.body);
          put(s.endLine, "BRA", `while${n}`);
          at(`endwhile${n}`);
          break;
        }
      }
    }
  };

  statements(parsed.statements);
  const lastLine = Math.max(
    1,
    ...parsed.statements.map((s) => ("endLine" in s ? s.endLine : s.line)),
  );
  put(lastLine, "HLT");

  // Shared subroutines (Extended target).
  if (needMul) {
    const zero = constant(0, lastLine);
    const one = constant(1, lastLine);
    at("mul");
    put(lastLine, "LDA", zero);
    put(lastLine, "STA", "mul_r");
    at("mul_loop");
    put(lastLine, "LDA", "arg_b");
    put(lastLine, "BRZ", "mul_done");
    put(lastLine, "SUB", one);
    put(lastLine, "STA", "arg_b");
    put(lastLine, "LDA", "mul_r");
    put(lastLine, "ADD", "arg_a");
    put(lastLine, "STA", "mul_r");
    put(lastLine, "BRA", "mul_loop");
    at("mul_done");
    put(lastLine, "LDA", "mul_r");
    put(lastLine, "RET");
  }
  if (needDiv) {
    const zero = constant(0, lastLine);
    const one = constant(1, lastLine);
    at("div");
    put(lastLine, "LDA", zero);
    put(lastLine, "STA", "div_q");
    put(lastLine, "LDA", "arg_b");
    put(lastLine, "BRZ", "div_zero");
    at("div_loop");
    put(lastLine, "LDA", "arg_a");
    put(lastLine, "SUB", "arg_b");
    put(lastLine, "BRP", "div_more");
    put(lastLine, "LDA", "arg_a");
    put(lastLine, "STA", "rem");
    put(lastLine, "LDA", "div_q");
    put(lastLine, "RET");
    at("div_more");
    put(lastLine, "STA", "arg_a");
    put(lastLine, "LDA", "div_q");
    put(lastLine, "ADD", one);
    put(lastLine, "STA", "div_q");
    put(lastLine, "BRA", "div_loop");
    at("div_zero");
    put(lastLine, "STA", "rem");
    put(lastLine, "RET");
  }

  // Labels that ended up on the same instruction refer to the first one.
  for (const item of items) {
    if (item.arg && aliases.has(item.arg)) item.arg = aliases.get(item.arg) as string;
  }
  const code = options.optimise ? optimise(items) : items;

  // Data: variables, then constants, then working mailboxes.
  const data: { name: string; value: number; source: number }[] = [
    ...[...set].map(([name, line]) => ({ name: varName(name), value: 0, source: line })),
    ...[...consts].map(([value, c]) => ({ name: c.name, value, source: c.source })),
    ...[...temps].map(([name, line]) => ({ name, value: 0, source: line })),
  ];
  const work = [
    ...(needMul || needDiv ? ["arg_a", "arg_b"] : []),
    ...(needMul ? ["mul_r"] : []),
    ...(needDiv ? ["div_q", "rem"] : []),
  ];
  for (const name of work) data.push({ name, value: 0, source: lastLine });

  const lines: OutputLine[] = [];
  for (const item of code) {
    if (item.comment) {
      if (lines.length) lines.push({ text: "", source: null, instruction: false });
      lines.push({ text: item.comment, source: item.source, instruction: false });
    } else {
      const text =
        `${(item.label ?? "").padEnd(10)}${item.op.padEnd(5)}${item.arg ?? ""}`.trimEnd();
      lines.push({ text, source: item.source, instruction: true });
    }
  }
  lines.push({ text: "", source: null, instruction: false });
  lines.push({
    text: "// Variables, constants and working mailboxes",
    source: null,
    instruction: false,
  });
  for (const d of data) {
    lines.push({
      text: `${d.name.padEnd(10)}DAT  ${d.value}`,
      source: d.source,
      instruction: false,
    });
  }

  const lmc = `${lines.map((l) => l.text).join("\n")}\n`;
  const assembled = assemble(lmc, { dialect: dialectId, machine: target });
  const instructions = lines.filter((l) => l.instruction).length;
  if (!assembled.program) {
    // The compiler only writes LMC it knows is correct, so the one way assembly fails is size.
    const size = code.filter((i) => !i.comment).length + data.length;
    return {
      ...failed([
        {
          line: lastLine,
          column: 1,
          endColumn: 2,
          message: `The compiled program needs more than 100 mailboxes (about ${size}), but LMC has 100. Shorten the program.`,
        },
      ]),
      lmc,
      lines,
      instructions,
    };
  }
  const program = assembled.program;
  const count = sourceLines.length;
  const addressToSource = program.addressToLine.map((l) =>
    l === null ? null : (lines[l - 1] as OutputLine).source,
  );
  const sourceToAddresses: number[][] = Array.from({ length: count }, () => []);
  addressToSource.forEach((s, a) => {
    if (s !== null && program.kinds[a] !== "empty") sourceToAddresses[s - 1]?.push(a);
  });
  const sourceToLines: number[][] = Array.from({ length: count }, () => []);
  lines.forEach((l, i) => {
    if (l.source !== null) sourceToLines[l.source - 1]?.push(i);
  });
  return {
    ok: true,
    errors: [],
    lmc,
    lines,
    instructions,
    program,
    addressToSource,
    sourceToAddresses,
    sourceToLines,
  };
}

function failed(errors: readonly CompileError[]): CompileResult {
  return {
    ok: false,
    errors,
    lmc: "",
    lines: [],
    instructions: 0,
    program: null,
    addressToSource: [],
    sourceToAddresses: [],
    sourceToLines: [],
  };
}

/** Removes reloads after stores and jumps to the very next instruction, until nothing changes. */
function optimise(input: readonly Item[]): Item[] {
  let items = [...input];
  for (let changed = true; changed;) {
    changed = false;
    const out: Item[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as Item;
      const prev = [...out].reverse().find((x) => !x.comment);
      const next = items.slice(i + 1).find((x) => !x.comment);
      if (item.op === "LDA" && !item.label && prev?.op === "STA" && prev.arg === item.arg) {
        changed = true;
        continue;
      }
      if (item.op === "BRA" && next?.label === item.arg && !item.label) {
        changed = true;
        continue;
      }
      out.push(item);
    }
    items = out;
  }
  return items;
}
