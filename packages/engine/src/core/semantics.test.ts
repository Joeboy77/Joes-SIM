import { describe, expect, it } from "vitest";
import {
  DIALECTS,
  DIALECT_IDS,
  canonicalSpelling,
  classic,
  getDialect,
  higginson,
  isDialectId,
  ocr,
} from "../dialects/dialects";
import {
  alu,
  branchTaken,
  decode,
  encode,
  executeLength,
  flagAfterLoad,
  inRange,
  takesAddress,
} from "./semantics";

describe("decode and encode", () => {
  it("decodes every classic opcode", () => {
    expect(decode(0, classic)?.mnemonic).toBe("HLT");
    expect(decode(42, classic)).toEqual({ mnemonic: "HLT", opcode: 0, address: 42 });
    expect(decode(112, classic)).toEqual({ mnemonic: "ADD", opcode: 1, address: 12 });
    expect(decode(299, classic)?.mnemonic).toBe("SUB");
    expect(decode(300, classic)?.mnemonic).toBe("STA");
    expect(decode(550, classic)?.mnemonic).toBe("LDA");
    expect(decode(601, classic)?.mnemonic).toBe("BRA");
    expect(decode(701, classic)?.mnemonic).toBe("BRZ");
    expect(decode(801, classic)?.mnemonic).toBe("BRP");
    expect(decode(901, classic)?.mnemonic).toBe("INP");
    expect(decode(902, classic)?.mnemonic).toBe("OUT");
  });

  it("treats 4xx, unused 9xx and out-of-range values as invalid", () => {
    expect(decode(400, classic)).toBeNull();
    expect(decode(499, higginson)).toBeNull();
    expect(decode(903, classic)).toBeNull();
    expect(decode(999, higginson)).toBeNull();
    expect(decode(-5, higginson)).toBeNull();
    expect(decode(1000, classic)).toBeNull();
    expect(decode(1.5, classic)).toBeNull();
  });

  it("decodes OTC only where the dialect has it", () => {
    expect(decode(922, higginson)?.mnemonic).toBe("OTC");
    expect(decode(922, classic)).toBeNull();
    expect(decode(922, ocr)).toBeNull();
  });

  it("encodes mnemonics", () => {
    expect(encode("HLT")).toBe(0);
    expect(encode("INP")).toBe(901);
    expect(encode("OUT")).toBe(902);
    expect(encode("OTC")).toBe(922);
    expect(encode("ADD", 7)).toBe(107);
    expect(encode("BRP", 99)).toBe(899);
    expect(encode("LDA")).toBe(500);
  });

  it("knows which instructions take an address and how long they execute", () => {
    expect(takesAddress("ADD")).toBe(true);
    expect(takesAddress("HLT")).toBe(false);
    expect(takesAddress("INP")).toBe(false);
    expect(executeLength("ADD")).toBe(3);
    expect(executeLength("STA")).toBe(3);
    expect(executeLength("BRA")).toBe(1);
    expect(executeLength("OUT")).toBe(1);
  });
});

describe("arithmetic", () => {
  it("classic wraps unsigned and flags subtraction below zero", () => {
    expect(alu("add", 3, 4, classic)).toEqual({
      raw: 7,
      result: 7,
      negative: false,
      wrapped: false,
    });
    expect(alu("add", 999, 1, classic)).toEqual({
      raw: 1000,
      result: 0,
      negative: false,
      wrapped: true,
    });
    expect(alu("add", 600, 500, classic)).toMatchObject({ result: 100, wrapped: true });
    expect(alu("sub", 4, 9, classic)).toEqual({
      raw: -5,
      result: 995,
      negative: true,
      wrapped: true,
    });
    expect(alu("sub", 0, 999, classic)).toMatchObject({ result: 1, negative: true });
    expect(alu("sub", 5, 5, classic)).toEqual({
      raw: 0,
      result: 0,
      negative: false,
      wrapped: false,
    });
  });

  it("signed dialects keep the sign and wrap beyond 999", () => {
    for (const d of [higginson, ocr]) {
      expect(alu("sub", 4, 9, d)).toEqual({ raw: -5, result: -5, negative: true, wrapped: false });
      expect(alu("add", 999, 1, d)).toEqual({
        raw: 1000,
        result: 0,
        negative: false,
        wrapped: true,
      });
      expect(alu("sub", -999, 1, d)).toEqual({
        raw: -1000,
        result: 0,
        negative: false,
        wrapped: true,
      });
      expect(alu("sub", -999, 999, d)).toMatchObject({
        result: -998,
        negative: true,
        wrapped: true,
      });
      expect(alu("add", -5, 5, d)).toMatchObject({ result: 0, negative: false });
      expect(Object.is(alu("add", -5, 5, d).result, -0)).toBe(false);
    }
  });

  it("loading sets the flag only for negative values", () => {
    expect(flagAfterLoad(0)).toBe(false);
    expect(flagAfterLoad(12)).toBe(false);
    expect(flagAfterLoad(-1)).toBe(true);
  });
});

describe("branches", () => {
  it("BRA always branches", () => {
    expect(branchTaken("BRA", 5, true, classic)).toBe(true);
  });

  it("BRP treats zero as positive", () => {
    for (const d of Object.values(DIALECTS)) {
      expect(branchTaken("BRP", 0, false, d)).toBe(true);
      expect(branchTaken("BRP", 7, false, d)).toBe(true);
      expect(branchTaken("BRP", 995, true, d)).toBe(false);
    }
  });

  it("classic BRZ also needs the negative flag clear", () => {
    expect(branchTaken("BRZ", 0, false, classic)).toBe(true);
    expect(branchTaken("BRZ", 0, true, classic)).toBe(false);
    expect(branchTaken("BRZ", 0, true, higginson)).toBe(true);
    expect(branchTaken("BRZ", 3, false, ocr)).toBe(false);
  });
});

describe("dialect registry", () => {
  it("lists three dialects with matching ids and spec files", () => {
    expect(DIALECT_IDS).toEqual(["classic", "higginson", "ocr"]);
    for (const id of DIALECT_IDS) {
      expect(getDialect(id).id).toBe(id);
      expect(getDialect(id).spec).toBe(`docs/specs/dialects/${id}.md`);
    }
    expect(isDialectId("ocr")).toBe(true);
    expect(isDialectId("aqa")).toBe(false);
  });

  it("checks value ranges", () => {
    expect(inRange(999, classic)).toBe(true);
    expect(inRange(-1, classic)).toBe(false);
    expect(inRange(-999, higginson)).toBe(true);
    expect(inRange(1000, higginson)).toBe(false);
    expect(inRange(2.5, higginson)).toBe(false);
  });

  it("gives canonical spellings", () => {
    expect(canonicalSpelling(classic, "STA")).toBe("STA");
    expect(canonicalSpelling(classic, "HLT")).toBe("HLT");
    expect(canonicalSpelling(ocr, "OTC")).toBeUndefined();
  });
});
