/**
 * Two-pass LMC assembler. Pass one reads each line, gives it an address and collects labels.
 * Pass two resolves label operands and fills the mailboxes.
 *
 * Line format: [label] MNEMONIC [operand] [comment]. Mnemonics are case-insensitive; labels are
 * case-sensitive. Comments start with //, ; or #.
 */
import { DIALECTS, getDialect } from "../dialects/dialects";
import type { Dialect, DialectId, ExtMnemonic, Mnemonic } from "../dialects/types";
import { encode, inRange, takesAddress } from "../core/semantics";
import {
  EXT_MNEMONICS,
  encodeExt,
  extTakesOperand,
  type AddressMode,
  type ModeMnemonic,
} from "../machines/extended/semantics";
import { MEMORY_SIZE } from "../core/types";
import { closest } from "./suggest";
import type {
  AssembleResult,
  Diagnostic,
  DiagnosticCode,
  Fix,
  MailboxKind,
  Program,
  Statement,
} from "./types";

interface Token {
  readonly text: string;
  /** 1-based column of the first character. */
  readonly column: number;
}

type AsmMnemonic = Mnemonic | ExtMnemonic | "DAT";

interface Pending {
  readonly line: number;
  readonly address: number;
  readonly label?: Token;
  readonly mnemonic: AsmMnemonic;
  readonly operand?: Token;
  /**
   * Value already known in pass one (number operands and no-operand instructions). For a
   * two-mailbox instruction, the value of the second mailbox.
   */
  readonly value?: number;
  /** A two-mailbox instruction's first mailbox (extended machine). */
  readonly code?: number;
  readonly mode?: AddressMode;
}

const MODE_MNEMONICS: readonly string[] = ["LDA", "STA", "ADD", "SUB"];

const LABEL_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const NUMBER_PATTERN = /^[+-]?\d+$/;
const COMMENT_MARKERS = ["//", ";", "#"];

export interface AssembleOptions {
  readonly dialect?: DialectId;
  /** "extended" accepts the extended machine's instructions (docs/specs/extended.md). */
  readonly machine?: "classic" | "extended";
}

export function assemble(source: string, options: AssembleOptions = {}): AssembleResult {
  const dialect = getDialect(options.dialect ?? "classic");
  const extended = options.machine === "extended";
  const diagnostics: Diagnostic[] = [];
  const report = (
    severity: Diagnostic["severity"],
    code: DiagnosticCode,
    line: number,
    token: Token,
    message: string,
    explanation: string,
    fix?: Fix,
  ) => {
    diagnostics.push({
      severity,
      code,
      line,
      column: token.column,
      endColumn: token.column + token.text.length,
      message,
      explanation,
      ...(fix ? { fix } : {}),
    });
  };

  const lines = source.split(/\r?\n/);
  const pending: Pending[] = [];
  const labels = new Map<string, { address: number; line: number }>();
  let tooLongReported = false;
  let next = 0;

  lines.forEach((text, index) => {
    const line = index + 1;
    const tokens = tokenize(stripComment(text));
    if (tokens.length === 0) return;

    const parsed = parseStatement(tokens, dialect, extended, line, report);
    if (!parsed) return;
    const { label, mnemonic, at } = parsed;
    const rest = joinIndexed(parsed.rest);

    const address = next;
    const words = isTwoWord(mnemonic, rest[0]) && extended ? 2 : 1;
    if (address + words > MEMORY_SIZE) {
      if (!tooLongReported) {
        report(
          "error",
          "program-too-long",
          line,
          tokens[0] as Token,
          "The program does not fit in 100 mailboxes.",
          extended
            ? "Each DAT and most instructions use one mailbox; instructions with an address on the extended machine use two. There are only 100 (00 to 99). Shorten the program or reuse mailboxes."
            : "Each instruction and each DAT uses one mailbox, and there are only 100 (00 to 99). Shorten the program or reuse mailboxes.",
        );
        tooLongReported = true;
      }
      return;
    }
    next = address + words;

    if (label) {
      const name = label.text;
      const existing = labels.get(name);
      if (!LABEL_PATTERN.test(name)) {
        report(
          "error",
          "invalid-label",
          line,
          label,
          `'${name}' cannot be used as a label.`,
          "A label must start with a letter or underscore and contain only letters, digits and underscores.",
        );
      } else if (existing) {
        report(
          "error",
          "duplicate-label",
          line,
          label,
          `The label '${name}' is already used on line ${existing.line}.`,
          "Each label must name exactly one mailbox, so the assembler knows which address it stands for. Rename one of them.",
        );
      } else {
        labels.set(name, { address, line });
      }
    }

    const operand = rest[0];
    const extra = rest[1];
    if (extra) {
      const last = rest[rest.length - 1] as Token;
      report(
        "warning",
        "extra-text",
        line,
        {
          text: text.slice(extra.column - 1, last.column - 1 + last.text.length),
          column: extra.column,
        },
        "Text after the operand is ignored.",
        "Only a label, an instruction and one operand are read on each line. If this is a comment, start it with //.",
        {
          label: "Turn it into a comment",
          edit: { from: extra.column, to: extra.column, text: "// " },
        },
      );
    }

    pending.push(
      checkOperand({ line, address, mnemonic, at, operand, label }, dialect, extended, report),
    );
  });

  // Pass two: resolve label operands and fill memory.
  const memory = new Array<number>(MEMORY_SIZE).fill(0);
  const kinds = new Array<MailboxKind>(MEMORY_SIZE).fill("empty");
  const addressToLine = new Array<number | null>(MEMORY_SIZE).fill(null);
  const lineToAddress = new Array<number | null>(lines.length).fill(null);
  const statements: Statement[] = [];

  for (const p of pending) {
    let value = p.value;
    let operandLabel: string | undefined;
    if (value === undefined && p.operand) {
      const name = operandName(p.operand.text);
      const target = labels.get(name);
      operandLabel = name;
      if (target) {
        value =
          p.mnemonic === "DAT" || p.code !== undefined
            ? target.address
            : encode(p.mnemonic as Mnemonic, target.address);
      } else {
        reportUndefinedLabel({ ...p.operand, text: name }, p.line, labels, report);
        value = 0;
      }
    }
    const filled = value ?? 0;
    const first = p.code ?? filled;
    memory[p.address] = first;
    kinds[p.address] = p.mnemonic === "DAT" ? "data" : "code";
    addressToLine[p.address] = p.line;
    lineToAddress[p.line - 1] = p.address;
    if (p.code !== undefined) {
      memory[p.address + 1] = filled;
      kinds[p.address + 1] = "operand";
      addressToLine[p.address + 1] = p.line;
    }
    statements.push({
      line: p.line,
      address: p.address,
      mnemonic: p.mnemonic,
      value: first,
      ...(p.code !== undefined ? { words: 2 as const, operandValue: filled } : {}),
      ...(p.mode ? { mode: p.mode } : {}),
      ...(p.label ? { label: p.label.text } : {}),
      ...(p.operand ? { operandText: p.operand.text } : {}),
      ...(operandLabel ? { operandLabel } : {}),
    });
  }

  diagnostics.sort((a, b) => a.line - b.line || a.column - b.column);
  const ok = !diagnostics.some((d) => d.severity === "error");
  const program: Program = {
    dialect: dialect.id,
    ...(extended ? { machine: "extended" as const } : {}),
    memory,
    statements,
    labels: Object.fromEntries(labels),
    addressToLine,
    lineToAddress,
    kinds,
    size: next,
  };
  return { ok, program: ok ? program : null, diagnostics };
}

type Report = (
  severity: Diagnostic["severity"],
  code: DiagnosticCode,
  line: number,
  token: Token,
  message: string,
  explanation: string,
  fix?: Fix,
) => void;

function stripComment(text: string): string {
  let end = text.length;
  for (const marker of COMMENT_MARKERS) {
    const at = text.indexOf(marker);
    if (at !== -1 && at < end) end = at;
  }
  return text.slice(0, end);
}

function tokenize(text: string): Token[] {
  return [...text.matchAll(/\S+/g)].map((m) => ({ text: m[0], column: (m.index ?? 0) + 1 }));
}

/** Every spelling any dialect knows, so we can tell a typo from a real word. */
const ALL_SPELLINGS = [
  ...new Set(Object.values(DIALECTS).flatMap((d) => [...Object.keys(d.spellings), "DAT"])),
];
const EXT_SET = new Set<string>(EXT_MNEMONICS);

type Looked = AsmMnemonic | "unsupported" | "extended-only" | null;

function lookup(word: string, dialect: Dialect, extended: boolean): Looked {
  const upper = word.toUpperCase();
  if (upper === "DAT") return "DAT";
  const m = dialect.spellings[upper];
  if (m) return m;
  if (EXT_SET.has(upper)) return extended ? (upper as ExtMnemonic) : "extended-only";
  if (upper in dialect.unsupported) return "unsupported";
  return null;
}

/** Instructions that take a second mailbox on the extended machine. */
function isTwoWord(mnemonic: AsmMnemonic, operand: Token | undefined): boolean {
  if (EXT_SET.has(mnemonic)) return extTakesOperand(mnemonic as ExtMnemonic);
  return (
    MODE_MNEMONICS.includes(mnemonic) && operand !== undefined && modeOf(operand.text) !== null
  );
}

function modeOf(text: string): AddressMode | null {
  if (text.startsWith("@")) return "indirect";
  if (/,x$/i.test(text)) return "indexed";
  return null;
}

/** The label or number inside `@a` or `a,X`. */
function operandName(text: string): string {
  if (text.startsWith("@")) return text.slice(1);
  return text.replace(/,x$/i, "");
}

/** `table,X`, `table, X` and `table ,X` all mean indexed addressing: make them one token. */
function joinIndexed(rest: Token[]): Token[] {
  const [a, b, c] = rest;
  if (a && b && a.text.endsWith(",") && /^x$/i.test(b.text)) {
    return [{ text: `${a.text}X`, column: a.column }, ...rest.slice(2)];
  }
  if (a && b && /^,x$/i.test(b.text)) {
    return [{ text: `${a.text},X`, column: a.column }, ...rest.slice(2)];
  }
  if (a && b && c && b.text === "," && /^x$/i.test(c.text)) {
    return [{ text: `${a.text},X`, column: a.column }, ...rest.slice(3)];
  }
  return rest;
}

function reportExtendedOnly(token: Token, line: number, report: Report) {
  report(
    "error",
    "extended-only",
    line,
    token,
    `${token.text.toUpperCase()} is an instruction of the extended machine.`,
    "The classic Little Man Computer does not have it. Switch to the extended machine to use the stack, subroutines, interrupts and devices.",
  );
}

function looksLikeMnemonic(word: string): string | undefined {
  if (word.length < 2 || word.length > 4) return undefined;
  return closest(word.toUpperCase(), ALL_SPELLINGS);
}

function parseStatement(
  tokens: Token[],
  dialect: Dialect,
  extended: boolean,
  line: number,
  report: Report,
): { label?: Token; mnemonic: AsmMnemonic; at: Token; rest: Token[] } | null {
  const first = tokens[0] as Token;
  let firstKind = lookup(first.text, dialect, extended);
  // Classic programs may use the new names as labels ("get LDA table"): a word followed by an
  // instruction is a label, so they keep working on either machine.
  if (firstKind && EXT_SET.has(first.text.toUpperCase()) && tokens[1]) {
    const next = lookup(tokens[1].text, dialect, extended);
    if (next && next !== "extended-only" && next !== "unsupported") {
      firstKind = null;
    }
  }
  if (firstKind === "unsupported") {
    reportUnsupported(first, dialect, line, report);
    return null;
  }
  if (firstKind === "extended-only") {
    reportExtendedOnly(first, line, report);
    return null;
  }
  if (firstKind) return { mnemonic: firstKind, at: first, rest: tokens.slice(1) };

  // The first word is not an instruction, so it should be a label.
  const label: Token =
    first.text.endsWith(":") && first.text.length > 1
      ? { text: first.text.slice(0, -1), column: first.column }
      : first;
  const second = tokens[1];
  const typo = looksLikeMnemonic(first.text);

  if (!second) {
    if (typo) {
      reportUnknown(first, typo, line, report);
    } else {
      report(
        "error",
        "label-without-instruction",
        line,
        first,
        `'${first.text}' is not an instruction.`,
        `If '${first.text}' is meant to be a label, put an instruction or DAT after it on the same line, for example '${first.text} DAT'.`,
        {
          label: `Add DAT after '${first.text}'`,
          edit: {
            from: first.column + first.text.length,
            to: first.column + first.text.length,
            text: " DAT",
          },
        },
      );
    }
    return null;
  }

  const secondKind = lookup(second.text, dialect, extended);
  if (secondKind === "unsupported") {
    reportUnsupported(second, dialect, line, report);
    return null;
  }
  if (secondKind === "extended-only") {
    reportExtendedOnly(second, line, report);
    return null;
  }
  if (!secondKind) {
    if (typo) reportUnknown(first, typo, line, report);
    else reportUnknown(second, looksLikeMnemonic(second.text), line, report);
    return null;
  }
  return { label, mnemonic: secondKind, at: second, rest: tokens.slice(2) };
}

function reportUnknown(token: Token, suggestion: string | undefined, line: number, report: Report) {
  report(
    "error",
    "unknown-instruction",
    line,
    token,
    suggestion
      ? `Unknown instruction '${token.text}'. Did you mean ${suggestion}?`
      : `Unknown instruction '${token.text}'.`,
    "The instructions are ADD, SUB, STA, LDA, BRA, BRZ, BRP, INP, OUT and HLT, plus DAT to reserve a mailbox. Check the spelling.",
    suggestion
      ? {
          label: `Change to ${suggestion}`,
          edit: { from: token.column, to: token.column + token.text.length, text: suggestion },
        }
      : undefined,
  );
}

function reportUnsupported(token: Token, dialect: Dialect, line: number, report: Report) {
  const upper = token.text.toUpperCase();
  report(
    "error",
    "instruction-not-in-dialect",
    line,
    token,
    `${upper} is not available in the ${dialect.name} dialect.`,
    dialect.unsupported[upper] ?? "",
  );
}

function checkOperand(
  p: {
    line: number;
    address: number;
    mnemonic: AsmMnemonic;
    at: Token;
    operand: Token | undefined;
    label: Token | undefined;
  },
  dialect: Dialect,
  extended: boolean,
  report: Report,
): Pending {
  const base = {
    line: p.line,
    address: p.address,
    mnemonic: p.mnemonic,
    ...(p.label ? { label: p.label } : {}),
    ...(p.operand ? { operand: p.operand } : {}),
  };
  const { operand, mnemonic, line } = p;

  const mode = operand ? modeOf(operand.text) : null;
  if (operand && mode) {
    if (!extended) {
      report(
        "error",
        "extended-only",
        line,
        operand,
        mode === "indirect"
          ? "Indirect addressing (@) needs the extended machine."
          : "Indexed addressing (,X) needs the extended machine.",
        "The classic Little Man Computer only has direct addresses. Switch to the extended machine to use @ and ,X.",
      );
      return { ...base, value: 0 };
    }
    if (!MODE_MNEMONICS.includes(mnemonic)) {
      report(
        "error",
        "invalid-operand",
        line,
        operand,
        `${mnemonic} cannot use ${mode === "indirect" ? "@" : ",X"}.`,
        "Indirect (@) and indexed (,X) addressing work with LDA, STA, ADD and SUB.",
      );
      return { ...base, value: 0 };
    }
    const code = encodeExt(mnemonic as ModeMnemonic, mode);
    return { ...checkAddress(base, operandName(operand.text), operand, line, report), code, mode };
  }

  if (EXT_SET.has(mnemonic)) {
    const ext = mnemonic as ExtMnemonic;
    const code = encodeExt(ext);
    if (!extTakesOperand(ext)) {
      if (operand) reportIgnored(ext, code, operand, line, report);
      return { ...base, value: code };
    }
    if (!operand) {
      const what = ext === "GET" || ext === "PUT" ? "a port" : "an address";
      report(
        "error",
        "missing-address",
        line,
        p.at,
        `${ext} needs ${what}.`,
        ext === "GET" || ext === "PUT"
          ? `${ext} works with a device port, 00 to 99. For example 'PUT 11' colours a pixel.`
          : `${ext} works on a mailbox. Give a mailbox number (00 to 99) or a label.`,
      );
      return { ...base, value: 0, code };
    }
    return { ...checkAddress(base, operand.text, operand, line, report), code };
  }

  if (mnemonic === "DAT") {
    if (!operand) return { ...base, value: 0 };
    if (NUMBER_PATTERN.test(operand.text)) {
      const value = Number.parseInt(operand.text, 10);
      if (!inRange(value, dialect)) {
        report(
          "error",
          "value-out-of-range",
          line,
          operand,
          `${operand.text} does not fit in a mailbox.`,
          `In the ${dialect.name} dialect a mailbox holds ${dialect.minValue} to ${dialect.maxValue}.`,
        );
        return { ...base, value: 0 };
      }
      return { ...base, value };
    }
    if (LABEL_PATTERN.test(operand.text)) return { ...base, operand };
    reportInvalidOperand(operand, line, report);
    return { ...base, value: 0 };
  }

  const classic = mnemonic as Mnemonic;
  if (!takesAddress(classic)) {
    if (operand) reportIgnored(classic, encode(classic), operand, line, report);
    return { ...base, value: encode(classic) };
  }

  if (!operand) {
    const { at } = p;
    if (dialect.missingOperand === "zero-with-warning") {
      report(
        "warning",
        "missing-address",
        line,
        at,
        `${mnemonic} has no address, so it uses mailbox 00.`,
        `${mnemonic} works on a mailbox. Without an address the ${dialect.name} dialect uses 00, which is rarely what you want.`,
      );
      return { ...base, value: encode(classic, 0) };
    }
    report(
      "error",
      "missing-address",
      line,
      at,
      `${mnemonic} needs an address.`,
      `${mnemonic} works on a mailbox. Give a mailbox number (00 to 99) or a label, for example '${mnemonic} count'.`,
    );
    return { ...base, value: 0 };
  }

  if (NUMBER_PATTERN.test(operand.text)) {
    const value = Number.parseInt(operand.text, 10);
    if (value < 0 || value >= MEMORY_SIZE) {
      report(
        "error",
        "address-out-of-range",
        line,
        operand,
        `There is no mailbox ${operand.text}.`,
        "Mailboxes are numbered 00 to 99.",
      );
      return { ...base, value: 0 };
    }
    return { ...base, value: encode(classic, value) };
  }
  if (LABEL_PATTERN.test(operand.text)) return { ...base, operand };
  reportInvalidOperand(operand, line, report);
  return { ...base, value: 0 };
}

/** The address (or port) in a two-mailbox instruction's second mailbox. */
function checkAddress<T extends object>(
  base: T,
  text: string,
  operand: Token,
  line: number,
  report: Report,
): T & { value?: number } {
  if (NUMBER_PATTERN.test(text)) {
    const value = Number.parseInt(text, 10);
    if (value < 0 || value >= MEMORY_SIZE) {
      report(
        "error",
        "address-out-of-range",
        line,
        operand,
        `There is no mailbox or port ${text}.`,
        "Mailboxes and ports are numbered 00 to 99.",
      );
      return { ...base, value: 0 };
    }
    return { ...base, value };
  }
  if (LABEL_PATTERN.test(text)) return base;
  reportInvalidOperand(operand, line, report);
  return { ...base, value: 0 };
}

function reportIgnored(
  mnemonic: string,
  code: number,
  operand: Token,
  line: number,
  report: Report,
) {
  report(
    "warning",
    "operand-ignored",
    line,
    operand,
    `${mnemonic} does not use an address, so '${operand.text}' is ignored.`,
    `${mnemonic} always assembles to ${String(code).padStart(3, "0")}. If this is a comment, start it with //.`,
    {
      label: "Remove it",
      edit: { from: operand.column, to: operand.column + operand.text.length, text: "" },
    },
  );
}

function reportInvalidOperand(operand: Token, line: number, report: Report) {
  report(
    "error",
    "invalid-operand",
    line,
    operand,
    `'${operand.text}' is not a number or a label.`,
    "An operand is a whole number or a label made of letters, digits and underscores.",
  );
}

function reportUndefinedLabel(
  operand: Token,
  line: number,
  labels: ReadonlyMap<string, unknown>,
  report: Report,
) {
  const suggestion = closest(operand.text, labels.keys());
  const caseOnly =
    suggestion !== undefined && suggestion.toLowerCase() === operand.text.toLowerCase();
  report(
    "error",
    "undefined-label",
    line,
    operand,
    suggestion
      ? `Label '${operand.text}' is not defined. Did you mean '${suggestion}'?`
      : `Label '${operand.text}' is not defined.`,
    caseOnly
      ? "Labels are case-sensitive, so these count as different names."
      : "A label must be written at the start of a line before it can be used as an address.",
    suggestion
      ? {
          label: `Change to '${suggestion}'`,
          edit: {
            from: operand.column,
            to: operand.column + operand.text.length,
            text: suggestion,
          },
        }
      : undefined,
  );
}
