import { Trace, assemble, createState, numberSegments, run } from "@joes-sim/engine";
import { describe, expect, it } from "vitest";
import { describeDisplay, interruptSpans, keyCode, segmentText, stackNotes } from "./model";

function traced(source: string) {
  const program = assemble(source, { machine: "extended" }).program;
  if (!program) throw new Error("did not assemble");
  const initial = createState({
    memory: program.memory,
    machine: "extended",
    stackFloor: program.size,
  });
  const result = run(initial, { maxSteps: 2000 });
  const trace = new Trace(initial);
  trace.syncTo(result.state.cycles);
  return { trace, state: result.state };
}

describe("extended machine panels", () => {
  it("labels what each value on the stack is", () => {
    const { trace } = traced(`
        LDA v
        PUSH
        CALL s
        HLT
s       HLT
v       DAT 7`);
    expect(stackNotes(trace.rows, 3)).toEqual(["value", "return address"]);
  });

  it("finds each interrupt and where its handler ended", () => {
    const { trace, state } = traced(`
        VEC h
        LDA p
        PUT 20
        EI
idle    WAIT
        BRA idle
h       LDA c
        ADD one
        STA c
        SUB two
        BRZ done
        RTI
done    HLT
p       DAT 5
c       DAT 0
one     DAT 1
two     DAT 2`);
    const spans = interruptSpans(trace, state.cycles);
    expect(spans).toHaveLength(2);
    expect(spans[0]?.source).toBe("timer");
    expect(spans[0]?.end).not.toBeNull();
    expect(spans[1]?.end).toBeNull();
  });

  it("reads digits back from segments and keys into codes", () => {
    expect(segmentText(numberSegments(42), false)).toBe("42");
    expect(segmentText(numberSegments(-7), true)).toBe("−7");
    expect(segmentText([0, 0, 0x01], false)).toBe("?");
    expect(keyCode("A")).toBe(65);
    expect(keyCode("Enter")).toBe(10);
    expect(keyCode("ArrowLeft")).toBe(3);
    expect(keyCode("Shift")).toBeNull();
  });

  it("describes the display in words", () => {
    const pixels = new Array<number>(256).fill(0);
    expect(describeDisplay(pixels)).toMatch(/all black/);
    pixels[17] = 4;
    expect(describeDisplay(pixels)).toBe(
      "Pixel display, 16 by 16: 1 pixel lit: row 2 column 2 red.",
    );
  });
});
