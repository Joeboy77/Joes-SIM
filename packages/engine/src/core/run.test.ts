import { describe, expect, it } from "vitest";
import { assemble } from "../assembler/assemble";
import { run } from "./run";
import { createState, provideInput } from "./state";
import { step } from "./step";

const load = (source: string, inputs: number[] = []) => {
  const r = assemble(source);
  if (!r.program) throw new Error(JSON.stringify(r.diagnostics));
  return createState({ memory: r.program.memory, inputs });
};

const COUNTER = `
loop    LDA n
        ADD one
        STA n
        BRA loop
n       DAT 0
one     DAT 1
`;

describe("run", () => {
  it("stops when the step budget runs out", () => {
    const r = run(load(COUNTER), { maxSteps: 10, detectLoops: false });
    expect(r.reason).toBe("budget");
    expect(r.state.cycles).toBe(10);
    expect(r.state.stage).toBe(0);
  });

  it("returns at once for a machine that has already stopped", () => {
    const halted = run(load("HLT")).state;
    expect(run(halted)).toEqual({ state: halted, reason: "halted" });
    const errored = run(load("DAT 400")).state;
    expect(run(errored).reason).toBe("error");
    const waiting = run(load("INP")).state;
    expect(run(waiting).reason).toBe("waiting-input");
  });

  it("stops before an instruction at a breakpoint, but not at the starting one", () => {
    const s = load("        INP\n        OUT\n        BRA 0", [1, 2, 3]);
    const first = run(s, { breakpoints: [1] });
    expect(first.reason).toBe("breakpoint");
    expect(first.state.pc).toBe(1);
    expect(first.state.outputs).toEqual([]);
    const second = run(first.state, { breakpoints: [1] });
    expect(second.reason).toBe("breakpoint");
    expect(second.state.outputs).toEqual([{ kind: "number", value: 1 }]);
  });

  it("finishes a part-done instruction first", () => {
    let s = load("        INP\n        OUT\n        HLT", [5]);
    s = step(s, { granularity: "micro" }).state;
    const r = run(s, { breakpoints: [1] });
    expect(r.reason).toBe("breakpoint");
    expect(r.state.acc).toBe(5);
    const halted = step(load("HLT"), { granularity: "micro" }).state;
    expect(run(halted).reason).toBe("halted");
  });

  it("stops part-way when the part-done instruction needs input", () => {
    let s = load("        INP\n        HLT");
    s = step(s, { granularity: "micro" }).state;
    const r = run(s);
    expect(r.reason).toBe("waiting-input");
    const resumed = run(provideInput(r.state, 4));
    expect(resumed.reason).toBe("halted");
    expect(resumed.state.acc).toBe(4);
  });

  it("detects a loop that can never end, with where it starts", () => {
    const r = run(load("        INP\n        OUT\nspin    BRA spin", [9]));
    expect(r.reason).toBe("infinite-loop");
    expect(r.loop).toEqual({ startCycle: 2, startAddress: 2, length: 1 });
    expect(r.state.outputs).toEqual([{ kind: "number", value: 9 }]);
  });

  it("detects a long loop that changes memory and comes back round", () => {
    const r = run(load(COUNTER));
    expect(r.reason).toBe("infinite-loop");
    expect(r.loop?.length).toBe(4000);
    expect(r.loop?.startCycle).toBe(0);
  });

  it("does not report a loop that reads input each time round", () => {
    const r = run(load("loop    INP\n        BRA loop", [1, 1, 1]));
    expect(r.reason).toBe("waiting-input");
  });

  it("does not report a loop that halts eventually", () => {
    const r = run(load(COUNTER.replace("BRA loop", "BRZ done\n        BRA loop\ndone    HLT")));
    expect(r.reason).toBe("halted");
  });
});
