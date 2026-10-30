import { run } from "@joes-sim/engine";
import { describe, expect, it } from "vitest";
import { createSimStore, parseInputs, STARTER_PROGRAM } from "./store";

const COUNTDOWN = `
        INP
loop    OUT
        SUB one
        BRP loop
        HLT
one     DAT 1
`;

const outputs = (store: ReturnType<typeof createSimStore>) =>
  store.getState().state?.outputs.map((o) => o.value);

function loaded(store: ReturnType<typeof createSimStore>) {
  const { state } = store.getState();
  if (!state) throw new Error("The program did not load.");
  return state;
}

describe("parseInputs", () => {
  it("reads numbers separated by commas or spaces", () => {
    expect(parseInputs("3, 4  5\n6", "classic")).toEqual({ values: [3, 4, 5, 6], error: null });
    expect(parseInputs("", "classic")).toEqual({ values: [], error: null });
  });

  it("explains values that cannot be used", () => {
    expect(parseInputs("3, x", "classic").error).toBe("'x' is not a whole number.");
    expect(parseInputs("-2", "classic").error).toMatch(/outside the range/);
    expect(parseInputs("-2", "higginson").error).toBeNull();
  });
});

describe("simulator store", () => {
  it("starts with the starter program assembled and ready", () => {
    const store = createSimStore();
    const s = store.getState();
    expect(s.source).toBe(STARTER_PROGRAM);
    expect(s.assembled.ok).toBe(true);
    expect(s.state?.status).toBe("ready");
    expect(s.initial?.inputs).toEqual([3, 4]);
  });

  it("runs the starter program to 7 one instruction at a time", () => {
    const store = createSimStore();
    for (let i = 0; i < 6; i++) store.getState().stepInstruction();
    expect(outputs(store)).toEqual([7]);
    expect(store.getState().stopReason).toBe("halted");
    expect(store.getState().maxCycle).toBe(6);
  });

  it("steps by micro-step and reports what happened", () => {
    const store = createSimStore();
    store.getState().stepMicro();
    const s = store.getState();
    expect(s.state?.microSteps).toBe(1);
    expect(s.lastSteps.map((x) => x.op)).toEqual(["fetch-address"]);
    expect(s.direction).toBe("forward");
  });

  it("steps back by micro-step and by instruction, retracing exact states", () => {
    const store = createSimStore();
    const seen = [store.getState().state];
    for (let i = 0; i < 20; i++) {
      store.getState().stepMicro();
      seen.push(store.getState().state);
    }
    store.getState().back();
    expect(store.getState().state).toEqual(seen[19]);
    expect(store.getState().direction).toBe("back");
    expect(store.getState().lastSteps).toHaveLength(1);
    store.getState().backInstruction();
    expect(store.getState().state?.stage).toBe(0);
    expect(store.getState().state?.cycles).toBe(2);
  });

  it("jumps along the timeline by replaying, then steps back from there", () => {
    const store = createSimStore();
    for (let i = 0; i < 6; i++) store.getState().stepInstruction();
    store.getState().jumpToCycle(3);
    const at3 = store.getState().state;
    expect(at3?.cycles).toBe(3);
    expect(at3?.acc).toBe(4);
    store.getState().back();
    expect(store.getState().state?.microSteps).toBe((at3?.microSteps ?? 0) - 1);
    store.getState().backInstruction();
    expect(store.getState().state?.cycles).toBe(2);
    store.getState().jumpToCycle(99);
    expect(store.getState().state?.cycles).toBe(6);
  });

  it("does nothing when stepping back from the very start", () => {
    const store = createSimStore();
    const before = store.getState().state;
    store.getState().back();
    store.getState().backInstruction();
    expect(store.getState().state).toBe(before);
  });

  it("plays tick by tick and stops at a breakpoint", () => {
    const store = createSimStore({ source: COUNTDOWN, inputText: "3" });
    store.getState().toggleBreakpoint(4);
    store.getState().setSpeed("fast");
    store.getState().play();
    expect(store.getState().playing).toBe(true);
    let ticks = 0;
    while (store.getState().tick()) ticks++;
    expect(store.getState().stopReason).toBe("breakpoint");
    expect(store.getState().state?.pc).toBe(4);
    expect(outputs(store)).toEqual([3, 2, 1, 0]);
    expect(ticks).toBeGreaterThan(0);
    store.getState().toggleBreakpoint(4);
    expect(store.getState().breakpoints).toEqual([]);
  });

  it("does not play in manual or instant speed", () => {
    const store = createSimStore();
    store.getState().setSpeed("manual");
    store.getState().play();
    expect(store.getState().playing).toBe(false);
    expect(store.getState().tick()).toBe(false);
  });

  it("stops a playing loop after one trip round, once the loop is known", () => {
    const store = createSimStore({ source: "loop    BRA loop", inputText: "" });
    const ahead = run(loaded(store));
    store.getState().setLoop(ahead.loop ?? null);
    store.getState().setSpeed("fast");
    store.getState().play();
    while (store.getState().tick());
    expect(store.getState().stopReason).toBe("infinite-loop");
  });

  it("waits for input, takes it, and remembers it for replays", () => {
    const store = createSimStore({ inputText: "3" });
    for (let i = 0; i < 3; i++) store.getState().stepInstruction();
    expect(store.getState().state?.status).toBe("waiting-input");
    expect(store.getState().stopReason).toBe("waiting-input");
    store.getState().provideInput(9);
    expect(store.getState().initial?.inputs).toEqual([3, 9]);
    for (let i = 0; i < 3; i++) store.getState().stepInstruction();
    expect(outputs(store)).toEqual([12]);
    store.getState().jumpToCycle(4);
    expect(store.getState().state?.acc).toBe(12);
    store.getState().back();
    expect(store.getState().state?.cycles).toBe(3);
  });

  it("resumes playback after an input only if it was playing", () => {
    const store = createSimStore({ inputText: "3" });
    store.getState().setSpeed("fast");
    store.getState().play();
    while (store.getState().tick());
    expect(store.getState().resumeAfterInput).toBe(true);
    store.getState().provideInput(4);
    expect(store.getState().playing).toBe(true);
    while (store.getState().tick());
    expect(outputs(store)).toEqual([7]);

    const manual = createSimStore({ inputText: "3" });
    for (let i = 0; i < 3; i++) manual.getState().stepInstruction();
    manual.getState().provideInput(4);
    expect(manual.getState().playing).toBe(false);
  });

  it("starts a new run when the code, inputs or dialect change", () => {
    const store = createSimStore();
    store.getState().stepInstruction();
    store.getState().setInputText("10, 20");
    expect(store.getState().state?.cycles).toBe(0);
    expect(store.getState().initial?.inputs).toEqual([10, 20]);
    store.getState().setSource("        LDR 5");
    expect(store.getState().assembled.ok).toBe(false);
    expect(store.getState().state).toBeNull();
    store.getState().stepInstruction();
    store.getState().back();
    store.getState().setDialect("higginson");
    expect(store.getState().dialect).toBe("higginson");
  });

  it("applies an instant run's result", () => {
    const store = createSimStore();
    const result = run(loaded(store));
    store.getState().applyRun(result.state, result.reason);
    expect(outputs(store)).toEqual([7]);
    expect(store.getState().maxCycle).toBe(6);
    store.getState().back();
    expect(store.getState().state?.cycles).toBe(5);
  });

  it("switches view and presentation mode", () => {
    const store = createSimStore();
    store.getState().setView("story");
    store.getState().togglePresentation();
    store.getState().setBusy(true);
    expect(store.getState()).toMatchObject({ view: "story", presentation: true, busy: true });
    store.getState().reset();
    store.getState().pause();
    expect(store.getState().playing).toBe(false);
  });
});
