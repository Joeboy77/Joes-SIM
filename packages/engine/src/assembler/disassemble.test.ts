import { describe, expect, it } from "vitest";
import { assemble } from "./assemble";
import { disassemble, disassembleWord } from "./disassemble";

describe("disassembleWord", () => {
  it("turns instructions back into mnemonics", () => {
    expect(disassembleWord(512)).toEqual({
      kind: "instruction",
      mnemonic: "LDA",
      address: 12,
      text: "LDA 12",
    });
    expect(disassembleWord(605).text).toBe("BRA 05");
    expect(disassembleWord(901)).toEqual({ kind: "instruction", mnemonic: "INP", text: "INP" });
    expect(disassembleWord(0).text).toBe("HLT");
  });

  it("uses DAT for values that are not exactly an instruction", () => {
    expect(disassembleWord(400)).toEqual({ kind: "data", value: 400, text: "DAT 400" });
    expect(disassembleWord(7).text).toBe("DAT 7"); // decodes as HLT, but HLT assembles to 000
    expect(disassembleWord(922).text).toBe("DAT 922");
    expect(disassembleWord(922, "higginson").text).toBe("OTC");
    expect(disassembleWord(-3, "higginson").text).toBe("DAT -3");
  });
});

describe("disassemble", () => {
  it("lists mailboxes up to the last non-zero one, with addresses", () => {
    const text = disassemble([901, 902, 0, 0]);
    expect(text).toBe("        INP       // 00\n        OUT       // 01");
  });

  it("can include a fixed length and leave out addresses", () => {
    expect(disassemble([901, 0], { length: 2, addresses: false })).toBe("        INP\n        HLT");
    expect(disassemble([0, 0])).toBe("");
  });

  it("round-trips through the assembler", () => {
    const source =
      "        INP\n        STA 9\n        LDA 9\n        BRZ 7\n        OUT\n        BRA 0\n        DAT 400\n        HLT";
    const memory = assemble(source).program?.memory ?? [];
    expect(assemble(disassemble(memory)).program?.memory).toEqual(memory);
  });
});
