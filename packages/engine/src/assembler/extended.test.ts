import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { REFERENCE_PROGRAMS } from "../reference/programs";
import { assemble } from "./assemble";
import { disassemble, disassembleWord } from "./disassemble";

const ext = (source: string) => assemble(source, { machine: "extended" });

describe("assembling for the extended machine", () => {
  it("puts an instruction's address in the next mailbox", () => {
    const r = ext(`
        CALL proc
        HLT
proc    PUSH
        POP
        RET
`);
    expect(r.ok).toBe(true);
    expect(r.program?.memory.slice(0, 6)).toEqual([412, 3, 0, 410, 411, 413]);
    expect(r.program?.kinds.slice(0, 4)).toEqual(["code", "operand", "code", "code"]);
    expect(r.program?.addressToLine.slice(0, 2)).toEqual([2, 2]);
    expect(r.program?.labels.proc?.address).toBe(3);
    expect(r.program?.size).toBe(6);
    expect(r.program?.machine).toBe("extended");
  });

  it("reads @ as indirect and ,X as indexed, with or without spaces", () => {
    for (const operand of ["table,X", "table,x", "table, X", "table ,X", "table , X"]) {
      const r = ext(`        LDA ${operand}\n        HLT\ntable   DAT 5`);
      expect(r.diagnostics).toEqual([]);
      expect(r.program?.memory.slice(0, 3)).toEqual([430, 3, 0]);
    }
    const r = ext(
      "        STA @ptr\n        ADD @ptr\n        SUB 7,X\n        HLT\nptr     DAT 9",
    );
    expect(r.program?.memory.slice(0, 8)).toEqual([421, 7, 422, 7, 433, 7, 0, 9]);
    expect(r.program?.statements[0]).toMatchObject({ mode: "indirect", words: 2, operandValue: 7 });
  });

  it("assembles every extended instruction", () => {
    const r = ext(`
        PUSH
        POP
        CALL 50
        RET
        LDX 50
        STX 50
        INX
        DEX
        EI
        DI
        RTI
        VEC 50
        WAIT
        GET 2
        PUT 11
`);
    expect(r.ok).toBe(true);
    expect(r.program?.memory.slice(0, 22)).toEqual([
      410, 411, 412, 50, 413, 414, 50, 415, 50, 416, 417, 440, 441, 442, 443, 50, 444, 450, 2, 451,
      11, 0,
    ]);
  });

  it("says when an instruction needs the extended machine", () => {
    const r = assemble("        PUSH\n        HLT");
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0]).toMatchObject({ code: "extended-only", line: 1 });
    expect(assemble("        LDA @5").diagnostics[0]?.code).toBe("extended-only");
    expect(assemble("        LDA 5,X").diagnostics[0]?.code).toBe("extended-only");
  });

  it("keeps the new names usable as labels, so classic programs still assemble", () => {
    const source = "get     LDA put\n        BRA get\nput     DAT 3\nwait    WAIT";
    const r = ext(source);
    expect(r.ok).toBe(true);
    expect(r.program?.labels.get?.address).toBe(0);
    expect(r.program?.labels.put?.address).toBe(2);
    expect(r.program?.memory.slice(0, 4)).toEqual([502, 600, 3, 444]);
  });

  it("reports missing and out-of-range addresses and ports", () => {
    expect(ext("        CALL").diagnostics[0]?.code).toBe("missing-address");
    expect(ext("        PUT").diagnostics[0]?.message).toBe("PUT needs a port.");
    expect(ext("        GET 100").diagnostics[0]?.code).toBe("address-out-of-range");
    expect(ext("        BRA @5").diagnostics[0]?.message).toBe("BRA cannot use @.");
    expect(ext("        PUSH 5").diagnostics[0]?.code).toBe("operand-ignored");
    expect(ext("        CALL nowhere").diagnostics[0]?.code).toBe("undefined-label");
    expect(ext("        LDA @nowher\nnowhere DAT").diagnostics[0]?.message).toContain(
      "Did you mean 'nowhere'?",
    );
  });

  it("counts two mailboxes towards the 100", () => {
    const r = ext("        CALL 0\n".repeat(50) + "        HLT");
    expect(r.diagnostics[0]?.code).toBe("program-too-long");
  });

  it("assembles every classic reference program to the same memory", () => {
    for (const p of REFERENCE_PROGRAMS) {
      const a = assemble(p.source);
      const b = ext(p.source);
      expect(b.ok).toBe(a.ok);
      expect(b.program?.memory).toEqual(a.program?.memory);
    }
  });
});

describe("disassembling the extended machine", () => {
  it("shows a two-mailbox instruction with its address", () => {
    expect(disassembleWord(430, "classic", { machine: "extended", next: 20 }).text).toBe(
      "LDA 20,X",
    );
    expect(disassembleWord(420, "classic", { machine: "extended", next: 5 }).text).toBe("LDA @05");
    expect(disassembleWord(410, "classic", { machine: "extended" }).text).toBe("PUSH");
    expect(disassembleWord(410).text).toBe("DAT 410");
  });

  it("gives back the same memory when reassembled", () => {
    const words = fc.oneof(
      fc.constantFrom(410, 411, 412, 413, 414, 420, 431, 443, 444, 450, 451),
      fc.integer({ min: 0, max: 999 }),
    );
    fc.assert(
      fc.property(fc.array(words, { maxLength: 100 }), (values) => {
        const memory = Array.from({ length: 100 }, (_, i) => values[i] ?? 0);
        const source = disassemble(memory, { machine: "extended" });
        const r = ext(source);
        expect(r.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
        expect(r.program?.memory).toEqual(memory);
      }),
      { numRuns: 300 },
    );
  });
});
