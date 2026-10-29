import { describe, expect, it } from "vitest";
import type { DialectId } from "../dialects/types";
import { assemble } from "./assemble";
import { closest, editDistance } from "./suggest";

const codes = (source: string, dialect: DialectId = "classic") =>
  assemble(source, { dialect }).diagnostics.map((d) => d.code);
const first = (source: string, dialect: DialectId = "classic") => {
  const d = assemble(source, { dialect }).diagnostics[0];
  if (!d) throw new Error("expected a diagnostic");
  return d;
};

describe("assemble", () => {
  it("assembles a program with labels, comments and blank lines", () => {
    const r = assemble(`
// Add two numbers
        INP           // first
        STA first     ; keep it
        INP           # second

        ADD first
        OUT
        HLT
first   DAT
`);
    expect(r.ok).toBe(true);
    expect(r.diagnostics).toEqual([]);
    expect(r.program?.memory.slice(0, 7)).toEqual([901, 306, 901, 106, 902, 0, 0]);
    expect(r.program?.labels).toEqual({ first: { address: 6, line: 10 } });
    expect(r.program?.size).toBe(7);
    expect(r.program?.kinds.slice(0, 8)).toEqual([
      "code",
      "code",
      "code",
      "code",
      "code",
      "code",
      "data",
      "empty",
    ]);
  });

  it("builds a source map both ways", () => {
    const p = assemble("\n        INP\n\n        OUT\n        HLT").program;
    expect(p?.lineToAddress).toEqual([null, 0, null, 1, 2]);
    expect(p?.addressToLine.slice(0, 4)).toEqual([2, 4, 5, null]);
    expect(p?.statements[1]).toEqual({ line: 4, address: 1, mnemonic: "OUT", value: 902 });
  });

  it("reads mnemonics in any case and numeric operands", () => {
    const p = assemble("lda 5\nAdd 06\nbrp 99\nsto 7\ncob").program;
    expect(p?.memory.slice(0, 5)).toEqual([505, 106, 899, 307, 0]);
  });

  it("accepts a label with a trailing colon", () => {
    const p = assemble("start: BRA start").program;
    expect(p?.memory[0]).toBe(600);
    expect(p?.labels["start"]).toEqual({ address: 0, line: 1 });
  });

  it("stores DAT values, label addresses and negative values in signed dialects", () => {
    expect(assemble("DAT 42\nDAT\nx DAT x").program?.memory.slice(0, 3)).toEqual([42, 0, 2]);
    expect(assemble("DAT -5", { dialect: "higginson" }).program?.memory[0]).toBe(-5);
    expect(first("DAT -5").code).toBe("value-out-of-range");
    expect(first("DAT 1000", "ocr").message).toBe("1000 does not fit in a mailbox.");
  });

  it("explains an undefined label with a suggestion and a fix", () => {
    const d = first("loop    INP\n        BRA lop");
    expect(d).toMatchObject({
      severity: "error",
      code: "undefined-label",
      line: 2,
      column: 13,
      endColumn: 16,
      message: "Label 'lop' is not defined. Did you mean 'loop'?",
      fix: { label: "Change to 'loop'", edit: { from: 13, to: 16, text: "loop" } },
    });
    expect(first("Loop BRA loop").explanation).toMatch(/case-sensitive/);
    expect(first("BRA nowhere").message).toBe("Label 'nowhere' is not defined.");
    expect(first("BRA nowhere").fix).toBeUndefined();
  });

  it("reports a duplicate label", () => {
    const d = first("x DAT 1\nx DAT 2");
    expect(d).toMatchObject({
      code: "duplicate-label",
      line: 2,
      message: "The label 'x' is already used on line 1.",
    });
  });

  it("reports invalid labels and operands", () => {
    expect(codes("1abc DAT")).toEqual(["invalid-label"]);
    expect(codes("LDA 12x")).toEqual(["invalid-operand"]);
    expect(codes("DAT 1.5")).toEqual(["invalid-operand"]);
  });

  it("suggests the right mnemonic for typos", () => {
    expect(first("        LDR 5")).toMatchObject({
      code: "unknown-instruction",
      message: "Unknown instruction 'LDR'. Did you mean LDA?",
      fix: { edit: { from: 9, to: 12, text: "LDA" } },
    });
    expect(first("        HTL").message).toBe("Unknown instruction 'HTL'. Did you mean HLT?");
    expect(first("count LDR 5").message).toBe("Unknown instruction 'LDR'. Did you mean LDA?");
    expect(first("start banana 5").message).toBe("Unknown instruction 'banana'.");
  });

  it("explains a label used as an instruction", () => {
    const d = first("        INP\nloop");
    expect(d).toMatchObject({
      code: "label-without-instruction",
      line: 2,
      message: "'loop' is not an instruction.",
      fix: { edit: { from: 5, to: 5, text: " DAT" } },
    });
  });

  it("knows which mnemonics each dialect accepts", () => {
    expect(codes("OTC")).toEqual(["instruction-not-in-dialect"]);
    expect(codes("OTC", "higginson")).toEqual([]);
    expect(codes("STO 5", "ocr")).toEqual(["instruction-not-in-dialect"]);
    expect(codes("x STO 5", "ocr")).toEqual(["instruction-not-in-dialect"]);
    expect(codes("COB", "higginson")).toEqual(["instruction-not-in-dialect"]);
    expect(first("OTC", "ocr").explanation).toMatch(/Higginson/);
  });

  it("checks addresses", () => {
    expect(first("LDA 100")).toMatchObject({
      code: "address-out-of-range",
      message: "There is no mailbox 100.",
    });
    expect(codes("LDA -1")).toEqual(["address-out-of-range"]);
    expect(codes("LDA 99")).toEqual([]);
  });

  it("handles a missing address by dialect", () => {
    expect(first("        ADD")).toMatchObject({
      severity: "error",
      code: "missing-address",
      column: 9,
    });
    const higginson = assemble("ADD", { dialect: "higginson" });
    expect(higginson.ok).toBe(true);
    expect(higginson.program?.memory[0]).toBe(100);
    expect(higginson.diagnostics[0]).toMatchObject({
      severity: "warning",
      code: "missing-address",
    });
  });

  it("warns about ignored operands and extra text", () => {
    const ignored = assemble("INP 5");
    expect(ignored.ok).toBe(true);
    expect(ignored.diagnostics[0]).toMatchObject({ severity: "warning", code: "operand-ignored" });
    expect(ignored.program?.memory[0]).toBe(901);
    const extra = assemble("LDA 5 load the number");
    expect(extra.ok).toBe(true);
    expect(extra.diagnostics[0]).toMatchObject({
      code: "extra-text",
      column: 7,
      endColumn: 22,
      fix: { edit: { from: 7, to: 7, text: "// " } },
    });
  });

  it("rejects programs longer than 100 mailboxes, once", () => {
    const r = assemble(Array.from({ length: 102 }, () => "DAT").join("\n"));
    expect(r.ok).toBe(false);
    expect(r.program).toBeNull();
    expect(r.diagnostics.map((d) => d.code)).toEqual(["program-too-long"]);
    expect(r.diagnostics[0]?.line).toBe(101);
  });

  it("handles Windows line endings and an empty program", () => {
    expect(assemble("INP\r\nOUT").program?.memory.slice(0, 2)).toEqual([901, 902]);
    const empty = assemble("");
    expect(empty.ok).toBe(true);
    expect(empty.program?.size).toBe(0);
  });

  it("sorts diagnostics by position", () => {
    const r = assemble("BRA nowhere\nfoo bar\nLDA 100");
    expect(r.diagnostics.map((d) => d.line)).toEqual([1, 2, 3]);
  });
});

describe("suggestions", () => {
  it("measures edit distance, including swapped letters", () => {
    expect(editDistance("loop", "loop")).toBe(0);
    expect(editDistance("lop", "loop")).toBe(1);
    expect(editDistance("HTL", "HLT")).toBe(1);
    expect(editDistance("", "abc")).toBe(3);
  });

  it("only suggests close matches", () => {
    expect(closest("lop", ["loop", "done"])).toBe("loop");
    expect(closest("LOOP", ["loop"])).toBe("loop");
    expect(closest("a", ["z", "b"])).toBeUndefined();
    expect(closest("counter", ["count"])).toBe("count");
    expect(closest("xyz", [])).toBeUndefined();
  });
});
