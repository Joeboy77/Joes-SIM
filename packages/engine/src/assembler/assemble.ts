/**
 * Two-pass LMC assembler. Pass one reads each line, gives it an address and collects labels.
 * Pass two resolves label operands and fills the mailboxes.
 *
 * Line format: [label] MNEMONIC [operand] [comment]. Mnemonics are case-insensitive; labels are
 * case-sensitive. Comments start with //, ; or #.
 */
import { DIALECTS, getDialect } from "../dialects/dialects";
import type { Dialect, DialectId, Mnemonic } from "../dialects/types";
import { encode, inRange, takesAddress } from "../core/semantics";
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

interface Pending {
  readonly line: number;
  readonly address: number;
  readonly label?: Token;
  readonly mnemonic: Mnemonic | "DAT";
  readonly operand?: Token;
  /** Value already known in pass one (number operands and no-operand instructions). */
  readonly value?: number;
}

const LABEL_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const NUMBER_PATTERN = /^[+-]?\d+$/;
const COMMENT_MARKERS = ["//", ";", "#"];

export interface AssembleOptions {
  readonly dialect?: DialectId;
}

export function assemble(source: string, options: AssembleOptions = {}): AssembleResult {
  const dialect = getDialect(options.dialect ?? "classic");
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

  lines.forEach((text, index) => {
    const line = index + 1;
    const tokens = tokenize(stripComment(text));
    if (tokens.length === 0) return;

    const parsed = parseStatement(tokens, dialect, line, report);
    if (!parsed) return;
    const { label, mnemonic, at, rest } = parsed;

    const address = pending.length;
    if (address >= MEMORY_SIZE) {
      if (!tooLongReported) {
        report(
          "error",
          "program-too-long",
          line,
          tokens[0] as Token,
          "The program does not fit in 100 mailboxes.",
          "Each instruction and each DAT uses one mailbox, and there are only 100 (00 to 99). Shorten the program or reuse mailboxes.",
        );
        tooLongReported = true;
      }
      return;
    }

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

    pending.push(checkOperand({ line, address, mnemonic, at, operand, label }, dialect, report));
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
      const target = labels.get(p.operand.text);
      operandLabel = p.operand.text;
      if (target) {
        value = p.mnemonic === "DAT" ? target.address : encode(p.mnemonic, target.address);
      } else {
        reportUndefinedLabel(p.operand, p.line, labels, report);
        value = 0;
      }
    }
    const filled = value ?? 0;
    memory[p.address] = filled;
    kinds[p.address] = p.mnemonic === "DAT" ? "data" : "code";
    addressToLine[p.address] = p.line;
    lineToAddress[p.line - 1] = p.address;
    statements.push({
      line: p.line,
      address: p.address,
      mnemonic: p.mnemonic,
      value: filled,
      ...(p.label ? { label: p.label.text } : {}),
      ...(p.operand ? { operandText: p.operand.text } : {}),
      ...(operandLabel ? { operandLabel } : {}),
    });
  }

  diagnostics.sort((a, b) => a.line - b.line || a.column - b.column);
  const ok = !diagnostics.some((d) => d.severity === "error");
  const program: Program = {
    dialect: dialect.id,
    memory,
    statements,
    labels: Object.fromEntries(labels),
    addressToLine,
    lineToAddress,
    kinds,
    size: statements.length,
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

function lookup(word: string, dialect: Dialect): Mnemonic | "DAT" | "unsupported" | null {
  const upper = word.toUpperCase();
  if (upper === "DAT") return "DAT";
  const m = dialect.spellings[upper];
  if (m) return m;
  if (upper in dialect.unsupported) return "unsupported";
  return null;
}

function looksLikeMnemonic(word: string): string | undefined {
  if (word.length < 2 || word.length > 4) return undefined;
  return closest(word.toUpperCase(), ALL_SPELLINGS);
}

function parseStatement(
  tokens: Token[],
  dialect: Dialect,
  line: number,
  report: Report,
): { label?: Token; mnemonic: Mnemonic | "DAT"; at: Token; rest: Token[] } | null {
  const first = tokens[0] as Token;
  const firstKind = lookup(first.text, dialect);
  if (firstKind === "unsupported") {
    reportUnsupported(first, dialect, line, report);
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

  const secondKind = lookup(second.text, dialect);
  if (secondKind === "unsupported") {
    reportUnsupported(second, dialect, line, report);
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
    mnemonic: Mnemonic | "DAT";
    at: Token;
    operand: Token | undefined;
    label: Token | undefined;
  },
  dialect: Dialect,
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

  if (!takesAddress(mnemonic)) {
    if (operand) {
      report(
        "warning",
        "operand-ignored",
        line,
        operand,
        `${mnemonic} does not use an address, so '${operand.text}' is ignored.`,
        `${mnemonic} always assembles to ${String(encode(mnemonic)).padStart(3, "0")}. If this is a comment, start it with //.`,
        {
          label: "Remove it",
          edit: { from: operand.column, to: operand.column + operand.text.length, text: "" },
        },
      );
    }
    return { ...base, value: encode(mnemonic) };
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
      return { ...base, value: encode(mnemonic, 0) };
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
    return { ...base, value: encode(mnemonic, value) };
  }
  if (LABEL_PATTERN.test(operand.text)) return { ...base, operand };
  reportInvalidOperand(operand, line, report);
  return { ...base, value: 0 };
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
