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

  it("keeps the trace in step with stepping, stepping back and jumps", () => {
    const store = createSimStore();
    const rows = () => store.getState().trace?.rows.length;
    store.getState().stepInstruction();
    store.getState().stepInstruction();
    expect(rows()).toBe(2);
    for (let i = 0; i < 5; i++) store.getState().stepMicro();
    expect(rows()).toBe(2); // INP takes six micro-steps: four fetch, decode, input
    store.getState().stepMicro();
    expect(rows()).toBe(3);
    store.getState().backInstruction();
    expect(rows()).toBe(store.getState().state?.cycles);
    store.getState().jumpToCycle(0);
    expect(rows()).toBe(0);
    const result = run(loaded(store));
    store.getState().applyRun(result.state, result.reason);
    expect(rows()).toBe(6);
    expect(store.getState().traceVersion).toBeGreaterThan(0);
    store.getState().jumpToCycle(4);
    expect(store.getState().trace?.rows.map((r) => r.mnemonic)).toEqual([
      "INP",
      "STA",
      "INP",
      "ADD",
    ]);
  });

  it("records inputs given while waiting in the trace", () => {
    const store = createSimStore({ inputText: "3" });
    for (let i = 0; i < 3; i++) store.getState().stepInstruction();
    expect(store.getState().state?.status).toBe("waiting-input");
    store.getState().provideInput(4);
    for (let i = 0; i < 4; i++) store.getState().stepInstruction();
    expect(
      store
        .getState()
        .trace?.rows.map((r) => r.input)
        .filter((v) => v !== undefined),
    ).toEqual([3, 4]);
    expect(store.getState().typedInputs).toBe(1);
  });

  it("stops playback after the instruction that meets a run-until condition", () => {
    const store = createSimStore({ source: COUNTDOWN, inputText: "3" });
    store.getState().addCondition({ target: { kind: "acc" }, op: "==", value: 1 });
    store.getState().setSpeed("fast");
    store.getState().play();
    while (store.getState().tick()) {
      /* keep ticking */
    }
    expect(store.getState().stopReason).toBe("condition");
    expect(store.getState().metCondition).toBe(0);
    expect(store.getState().state?.acc).toBe(1);
    store.getState().stepInstruction();
    expect(store.getState().metCondition).toBeNull();
    store.getState().removeCondition(0);
    expect(store.getState().conditions).toEqual([]);
  });

  it("records which condition stopped an instant run", () => {
    const store = createSimStore();
    const result = run(loaded(store), {
      conditions: [{ target: { kind: "outputs" }, op: ">", value: 0 }],
    });
    store.getState().applyRun(result.state, result.reason, result.loop, result.condition);
    expect(store.getState()).toMatchObject({ stopReason: "condition", metCondition: 0 });
  });

  it("manages watches, the explanation level, the heatmap and the pointed-at part", () => {
    const store = createSimStore();
    const a = store.getState();
    a.addWatch({ kind: "mailbox", address: 6 });
    a.addWatch({ kind: "mailbox", address: 6 });
    expect(store.getState().watches).toHaveLength(3);
    a.removeWatch(0);
    expect(store.getState().watches[0]).toEqual({ kind: "pc" });
    a.setLevel("technical");
    a.toggleHeatmap();
    a.setHoverTerm("ACC");
    a.setHoverTerm("ACC");
    a.setView("flow");
    expect(store.getState()).toMatchObject({
      level: "technical",
      heatmap: true,
      hoverTerm: "ACC",
      view: "flow",
    });
  });
});

const ECHO = `
        VEC key
        EI
idle    WAIT
        BRA idle
key     GET 2
        OUT
        RTI
`;

describe("the extended machine in the store", () => {
  it("assembles for the chosen machine", () => {
    const store = createSimStore({ source: ECHO, inputText: "" });
    expect(store.getState().state).toBeNull();
    store.getState().setMachine("extended");
    expect(loaded(store).ext?.sp).toBe(100);
    expect(store.getState().assembled.program?.machine).toBe("extended");
  });

  it("wakes WAIT with a key press, and keeps keys when replaying the timeline", () => {
    const store = createSimStore({ source: ECHO, inputText: "", machine: "extended" });
    const a = store.getState();
    const result = run(loaded(store));
    a.applyRun(result.state, result.reason);
    expect(store.getState().stopReason).toBe("waiting-interrupt");
    a.pressKey(65);
    for (let i = 0; i < 6; i++) store.getState().stepInstruction();
    expect(outputs(store)).toEqual([65]);
    const at = loaded(store).cycles;
    store.getState().jumpToCycle(0);
    store.getState().jumpToCycle(at);
    expect(outputs(store)).toEqual([65]);
  });
});

const RACE = `
        LDA total
        ADD one
        STA total
        HLT
core1   LDA total
        ADD one
        STA total
        HLT
total   DAT 0
one     DAT 1
`;

describe("the multicore machine in the store", () => {
  it("starts each core at its label and runs them in turn", () => {
    const store = createSimStore({ source: RACE, inputText: "", machine: "multicore" });
    expect(loaded(store).multi?.cores.map((c) => c.pc)).toEqual([0, 4]);
    const r = run(loaded(store));
    expect(r.state.memory[8]).toBe(1); // round-robin, one instruction each: an update is lost
  });

  it("manual stepping picks cores, and stepping back replays the same choices", () => {
    const store = createSimStore({
      source: RACE,
      inputText: "",
      machine: "multicore",
      multicore: { cores: 2, schedule: { mode: "manual", quantum: 1, seed: 1 } },
    });
    const a = store.getState();
    for (const c of [0, 0, 0, 1, 1, 1]) store.getState().runCore(c);
    expect(loaded(store).memory[8]).toBe(2);
    store.getState().jumpToCycle(3);
    store.getState().jumpToCycle(6);
    expect(loaded(store).memory[8]).toBe(2);
    // Choosing differently from step 3 replaces the choices after it.
    store.getState().jumpToCycle(1);
    for (const c of [1, 1, 1, 0, 0]) store.getState().runCore(c);
    expect(loaded(store).memory[8]).toBe(1);
    expect(a.multicore.cores).toBe(2);
  });
});
