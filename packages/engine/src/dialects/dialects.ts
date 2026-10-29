import type { Dialect, DialectId, Mnemonic } from "./types";

const CORE_SPELLINGS: Record<string, Mnemonic> = {
  ADD: "ADD",
  SUB: "SUB",
  STA: "STA",
  LDA: "LDA",
  BRA: "BRA",
  BRZ: "BRZ",
  BRP: "BRP",
  INP: "INP",
  OUT: "OUT",
  HLT: "HLT",
};

export const classic: Dialect = {
  id: "classic",
  name: "Classic",
  summary:
    "The original Little Man Computer as commonly taught: mailboxes hold 000 to 999 and a negative flag records subtraction below zero.",
  spec: "docs/specs/dialects/classic.md",
  minValue: 0,
  maxValue: 999,
  arithmetic: "unsigned-wrap",
  brzRequiresFlagClear: true,
  spellings: { ...CORE_SPELLINGS, STO: "STA", COB: "HLT" },
  unsupported: {
    OTC: "OTC (output as a character) is not part of the Classic dialect. Switch to the Higginson-compatible dialect to use it.",
  },
  missingOperand: "error",
};

export const higginson: Dialect = {
  id: "higginson",
  name: "Higginson-compatible",
  summary:
    "Matches the widely used online LMC simulator: the accumulator holds -999 to 999, and OTC outputs characters.",
  spec: "docs/specs/dialects/higginson.md",
  minValue: -999,
  maxValue: 999,
  arithmetic: "signed-wrap",
  brzRequiresFlagClear: false,
  spellings: { ...CORE_SPELLINGS, STO: "STA", OTC: "OTC" },
  unsupported: {
    COB: "COB is not accepted by the Higginson-compatible dialect. Use HLT.",
  },
  missingOperand: "zero-with-warning",
};

export const ocr: Dialect = {
  id: "ocr",
  name: "OCR (GCSE and A level)",
  summary:
    "The instruction set in OCR's GCSE and A level specifications: the eleven standard mnemonics only, with the Higginson simulator's arithmetic.",
  spec: "docs/specs/dialects/ocr.md",
  minValue: -999,
  maxValue: 999,
  arithmetic: "signed-wrap",
  brzRequiresFlagClear: false,
  spellings: { ...CORE_SPELLINGS },
  unsupported: {
    OTC: "OTC (output as a character) is not in the OCR instruction set. Switch to the Higginson-compatible dialect to use it.",
    STO: "OCR uses STA for store. STO is not in the OCR instruction set.",
    COB: "OCR uses HLT to stop. COB is not in the OCR instruction set.",
  },
  missingOperand: "error",
};

export const DIALECTS: Readonly<Record<DialectId, Dialect>> = { classic, higginson, ocr };
export const DIALECT_IDS = Object.keys(DIALECTS) as DialectId[];
export const DEFAULT_DIALECT: DialectId = "classic";

export function isDialectId(value: unknown): value is DialectId {
  return typeof value === "string" && value in DIALECTS;
}

export function getDialect(id: DialectId): Dialect {
  return DIALECTS[id];
}

/** The canonical spelling of each mnemonic in a dialect (for example STA, not STO). */
export function canonicalSpelling(dialect: Dialect, mnemonic: Mnemonic): string | undefined {
  return Object.keys(dialect.spellings).find((s) => dialect.spellings[s] === mnemonic);
}
