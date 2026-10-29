import { describe, expect, it } from "vitest";
import { assemble } from "../assembler/assemble";
import { History } from "./history";
import { createState, provideInput } from "./state";
import { step } from "./step";
import type { MachineState } from "./types";

const load = (source: string, inputs: number[] = []) =>
  createState({ memory: assemble(source).program?.memory ?? [], inputs });

/** Records every micro-step, keeping each state for comparison. */
function record(initial: MachineState, steps: number, history = new History(initial)) {
  const states = [initial];
  let s = initial;
  for (let i = 0; i < steps; i++) {
    const r = step(s, { granularity: "micro" });
    if (!r.steps[0] || r.state === s) break;
    history.push(r.state, r.steps[0]);
    states.push(r.state);
    s = r.state;
  }
  return { history, states };
}

const LOOP = `
loop    LDA n
        ADD one
        STA n
        OUT
        BRA loop
n       DAT 0
one     DAT 1
`;

describe("History", () => {
  it("restores every recorded position exactly", () => {
    const { history, states } = record(
      load(LOOP),
      400,
      new History(load(LOOP), { keyframeInterval: 7, maxInstructions: 1000 }),
    );
    expect(history.end).toBe(400);
    for (let p = 0; p <= 400; p += 13) expect(history.stateAt(p)).toEqual(states[p]);
    expect(history.stateAt(400)).toEqual(states[400]);
  });

  it("moves back and forward one micro-step at a time", () => {
    const { history, states } = record(load(LOOP), 30);
    expect(history.position).toBe(30);
    expect(history.back()).toEqual(states[29]);
    expect(history.back()).toEqual(states[28]);
    expect(history.forward()).toEqual(states[29]);
    expect(history.state).toEqual(states[29]);
    history.goTo(0);
    expect(history.back()).toBeNull();
    history.goTo(30);
    expect(history.forward()).toBeNull();
  });

  it("uses the cursor as a shortcut when it is closer than a keyframe", () => {
    const { history, states } = record(load(LOOP), 50);
    history.goTo(20);
    expect(history.stateAt(45)).toEqual(states[45]);
    expect(history.stateAt(21)).toEqual(states[21]);
    expect(history.stateAt(19)).toEqual(states[19]);
  });

  it("steps back by whole instructions", () => {
    const { history, states } = record(load(LOOP), 20);
    const positions = history.instructionPositions();
    expect(positions.slice(0, 3)).toEqual([0, 8, 16]);
    history.goTo(18);
    expect(history.backInstruction()).toEqual(states[16]);
    expect(history.backInstruction()).toEqual(states[8]);
    expect(history.backInstruction()).toEqual(states[0]);
    expect(history.backInstruction()).toBeNull();
  });

  it("hands back the events of each step", () => {
    const { history } = record(load(LOOP), 5);
    expect(history.stepAt(1).op).toBe("fetch-address");
    expect(history.stepAt(5).op).toBe("decode");
    expect(() => history.stepAt(0)).toThrow(RangeError);
    expect(() => history.stateAt(99)).toThrow(RangeError);
    expect(() => history.stateAt(1.5)).toThrow(RangeError);
  });

  it("starts a new future when stepping after going back", () => {
    const initial = load("        INP\n        OUT\n        HLT");
    const history = new History(initial);
    let s = initial;
    while (s.status === "ready") {
      const r = step(s, { granularity: "micro" });
      history.push(r.state, r.steps[0] as never);
      s = r.state;
    }
    expect(s.status).toBe("waiting-input");
    const given = provideInput(s, 7);
    const after = step(given, { granularity: "micro" });
    history.push(after.state, after.steps[0] as never);
    const withSeven = history.position;
    expect(history.stateAt(withSeven).acc).toBe(7);
    // The input is part of the recorded change, so going back removes it.
    expect(history.stateAt(withSeven - 1).inputs).toEqual([]);

    history.goTo(2);
    const branch = step(history.state, { granularity: "micro" });
    history.push(branch.state, branch.steps[0] as never);
    expect(history.end).toBe(3);
    expect(history.stateAt(3)).toEqual(branch.state);
  });

  it("ignores a push that changes nothing", () => {
    const initial = load("HLT");
    const history = new History(initial);
    history.push(initial, { phase: "fetch", op: "fetch-address", events: [] });
    expect(history.end).toBe(0);
  });

  it("drops the oldest instructions past the limit and says so", () => {
    const initial = load(LOOP);
    const history = new History(initial, { maxInstructions: 50, keyframeInterval: 10 });
    const { states } = record(initial, 8 * 200, history);
    expect(history.dropped).toBeGreaterThan(0);
    expect(history.start).toBe(history.dropped);
    expect(history.instructionPositions().length - 1).toBeLessThanOrEqual(50);
    expect(history.stateAt(history.start)).toEqual(states[history.start]);
    expect(history.stateAt(history.end)).toEqual(states[history.end]);
    expect(() => history.stateAt(0)).toThrow(RangeError);
  });

  it("rejects a keyframe interval that cannot work", () => {
    expect(() => new History(load("HLT"), { keyframeInterval: 0 })).toThrow(RangeError);
    expect(() => new History(load("HLT"), { maxInstructions: 10, keyframeInterval: 10 })).toThrow(
      RangeError,
    );
  });

  it("handles a machine that starts part-way through an instruction", () => {
    const s = step(load("        OUT\n        HLT"), { granularity: "micro" }).state;
    const { history } = record(s, 10, new History(s));
    expect(history.instructionPositions()[0]).toBe(5);
  });
});
