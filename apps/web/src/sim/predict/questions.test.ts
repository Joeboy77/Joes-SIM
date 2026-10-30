import { assemble, createState, type DialectId } from "@joes-sim/engine";
import { describe, expect, it } from "vitest";
import { isCorrect, questionFor as maybeQuestion, showAnswer, type Question } from "./questions";

/** The question for a state, failing the test if there is none. */
const questionFor = (state: Parameters<typeof maybeQuestion>[0]): Question => {
  const q = maybeQuestion(state);
  if (!q) throw new Error("expected a question");
  return q;
};

const at = (source: string, inputs: number[] = [], dialect: DialectId = "higginson") => {
  const p = assemble(source, { dialect }).program;
  if (!p) throw new Error("does not assemble");
  return createState({ memory: p.memory, inputs, dialect });
};

describe("predict mode questions", () => {
  it("asks about the accumulator after LDA, ADD, SUB and INP", () => {
    const q = questionFor(at("        INP\n        HLT", [7]));
    expect(q).toMatchObject({ kind: "acc", answer: 7, input: "number" });
    expect(q.prompt).toBe("After mailbox 00 (INP), what will the accumulator hold?");
    expect(isCorrect(q, "007")).toBe(true);
    expect(isCorrect(q, "8")).toBe(false);
    expect(isCorrect(q, "seven")).toBe(false);
    expect(isCorrect(q, true)).toBe(false);
  });

  it("asks whether a branch is taken, where BRA goes, and what is output", () => {
    const brz = questionFor(at("        BRZ 05\n        HLT"));
    expect(brz).toMatchObject({ kind: "branch", answer: true, input: "yes-no" });
    expect(isCorrect(brz, true)).toBe(true);
    expect(showAnswer(brz)).toBe("yes");
    const bra = questionFor(at("        BRA 07"));
    expect(bra).toMatchObject({ kind: "pc", answer: 7 });
    expect(showAnswer(bra)).toBe("07");
    expect(questionFor(at("        OUT"))).toMatchObject({ kind: "output", answer: 0 });
    const otc = questionFor(at("        OTC\n        HLT", [], "higginson"));
    expect(otc).toMatchObject({ kind: "output", input: "character" });
  });

  it("asks what STA writes, and whether HLT or a bad instruction stops the machine", () => {
    const sta = { ...at("        STA 09\n        HLT"), acc: 42 };
    expect(questionFor(sta)).toMatchObject({ kind: "memory", answer: 42 });
    expect(questionFor(at("        HLT"))).toMatchObject({ kind: "halt", answer: true });
    expect(questionFor(at("x       DAT 400"))).toMatchObject({ kind: "halt", answer: true });
  });

  it("does not ask mid-instruction, after the end, or when an input is missing", () => {
    expect(maybeQuestion({ ...at("        HLT"), stage: 2 })).toBeNull();
    expect(maybeQuestion({ ...at("        HLT"), status: "halted" })).toBeNull();
    expect(maybeQuestion(at("        INP"))).toBeNull();
  });

  it("matches characters exactly", () => {
    const s = { ...at("        OTC\n        HLT", [], "higginson"), acc: 65 };
    const q = questionFor(s);
    expect(q.answer).toBe("A");
    expect(isCorrect(q, "A")).toBe(true);
    expect(isCorrect(q, "a")).toBe(false);
    expect(showAnswer(q)).toBe("'A'");
    expect(showAnswer(questionFor(at("        INP\n        HLT", [5])))).toBe("5");
  });
});
