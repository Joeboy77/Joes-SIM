import { describe, expect, it } from "vitest";
import { classicMachine } from "../machines/classic";
import { formatValue } from "../machines/classic/micro";
import type { EngineEvent, MicroOp } from "./events";
import { canStep, createState, isFinished, isValidInput, provideInput } from "./state";
import { step } from "./step";
import type { MachineState } from "./types";

const ops = (state: MachineState) => step(state).steps.map((s) => s.op);
const types = (events: readonly EngineEvent[]) => events.map((e) => e.type);

describe("createState", () => {
  it("fills memory to 100 mailboxes and starts at 00", () => {
    const s = createState({ memory: [901, 902] });
    expect(s.memory).toHaveLength(100);
    expect(s.memory.slice(0, 3)).toEqual([901, 902, 0]);
    expect(s).toMatchObject({ pc: 0, acc: 0, status: "ready", stage: 0, dialect: "classic" });
  });

  it("rejects values the dialect cannot hold", () => {
    expect(() => createState({ memory: new Array(101).fill(0) })).toThrow(RangeError);
    expect(() => createState({ memory: [-1] })).toThrow(/Classic/);
    expect(() => createState({ memory: [1000], dialect: "higginson" })).toThrow(RangeError);
    expect(() => createState({ inputs: [-3] })).toThrow(/Input -3/);
    expect(createState({ memory: [-1], inputs: [-3], dialect: "higginson" }).memory[0]).toBe(-1);
  });

  it("validates inputs", () => {
    expect(isValidInput(5, "classic")).toBe(true);
    expect(isValidInput(-5, "classic")).toBe(false);
    expect(isValidInput(-5, "ocr")).toBe(true);
  });
});

describe("micro-steps", () => {
  it("fetches in four steps and decodes in one", () => {
    let s = createState({ memory: [105, 0, 0, 0, 0, 7] });
    const expected: MicroOp[] = [
      "fetch-address",
      "fetch-read",
      "fetch-load-ir",
      "fetch-increment",
      "decode",
    ];
    const seen: string[] = [];
    for (let i = 0; i < expected.length; i++) {
      const r = step(s, { granularity: "micro" });
      expect(r.steps).toHaveLength(1);
      seen.push(r.steps[0]?.op ?? "");
      s = r.state;
    }
    expect(seen).toEqual(expected);
    expect(s).toMatchObject({
      mar: 0,
      mdr: 105,
      ir: 105,
      pc: 1,
      stage: 5,
      microSteps: 5,
      cycles: 0,
    });
  });

  it("reports each transfer with its value", () => {
    const r = step(createState({ memory: [105, 0, 0, 0, 0, 7] }));
    expect(r.events).toContainEqual({ type: "transfer", from: "PC", to: "MAR", value: 0 });
    expect(r.events).toContainEqual({ type: "memory-read", address: 0, value: 105 });
    expect(r.events).toContainEqual({ type: "pc-increment", previous: 0, value: 1 });
    expect(r.events).toContainEqual({
      type: "decode",
      instruction: 105,
      opcode: 1,
      address: 5,
      mnemonic: "ADD",
    });
    expect(r.events).toContainEqual({ type: "transfer", from: "IR", to: "MAR", value: 5 });
    expect(r.events).toContainEqual({ type: "memory-read", address: 5, value: 7 });
    expect(r.events).toContainEqual({
      type: "alu",
      operation: "add",
      a: 0,
      b: 7,
      raw: 7,
      result: 7,
      wrapped: false,
    });
    expect(r.events.at(-1)).toEqual({
      type: "instruction-complete",
      address: 0,
      instruction: 105,
      mnemonic: "ADD",
    });
    expect(r.state).toMatchObject({ acc: 7, cycles: 1, microSteps: 8, stage: 0 });
  });

  it("runs every instruction with the right execute steps", () => {
    expect(ops(createState({ memory: [305] })).slice(5)).toEqual([
      "operand-address",
      "store-mdr",
      "store-write",
    ]);
    expect(ops(createState({ memory: [505] })).slice(5)).toEqual([
      "operand-address",
      "operand-read",
      "load-acc",
    ]);
    expect(ops(createState({ memory: [205] })).slice(5)).toEqual([
      "operand-address",
      "operand-read",
      "alu",
    ]);
    expect(ops(createState({ memory: [610] })).slice(5)).toEqual(["branch"]);
    expect(ops(createState({ memory: [901], inputs: [1] })).slice(5)).toEqual(["input"]);
    expect(ops(createState({ memory: [902] })).slice(5)).toEqual(["output"]);
    expect(ops(createState({ memory: [0] })).slice(5)).toEqual(["halt"]);
  });

  it("stores the accumulator", () => {
    let s = createState({ memory: [901, 310], inputs: [42] });
    s = step(s).state;
    const r = step(s);
    expect(r.state.memory[10]).toBe(42);
    expect(r.events).toContainEqual({ type: "memory-write", address: 10, previous: 0, value: 42 });
  });

  it("sets and clears the negative flag with an event", () => {
    let s = createState({ memory: [210, 510, 0], dialect: "classic" });
    s = { ...s, memory: s.memory.map((v, i) => (i === 10 ? 5 : v)) };
    const sub = step(s);
    expect(sub.state).toMatchObject({ acc: 995, negative: true });
    expect(sub.events).toContainEqual({ type: "flag-change", flag: "negative", value: true });
    const lda = step(sub.state);
    expect(lda.state.negative).toBe(false);
    expect(lda.events).toContainEqual({ type: "flag-change", flag: "negative", value: false });
  });

  it("reports branches taken and not taken", () => {
    const taken = step(createState({ memory: [707] }));
    expect(taken.events).toContainEqual({
      type: "branch",
      mnemonic: "BRZ",
      taken: true,
      from: 0,
      target: 7,
    });
    expect(taken.state.pc).toBe(7);
    const s = { ...createState({ memory: [0, 807] }), pc: 1, negative: true, acc: 995 };
    const notTaken = step(s);
    expect(notTaken.events).toContainEqual({
      type: "branch",
      mnemonic: "BRP",
      taken: false,
      from: 1,
      target: 7,
    });
    expect(notTaken.state.pc).toBe(2);
    expect(notTaken.events.slice(-2)[0]).toMatchObject({ type: "branch", taken: false });
    expect(notTaken.events.filter((e) => e.type === "transfer" && e.to === "PC")).toEqual([]);
    expect(types(taken.events)).toContain("branch");
  });

  it("outputs numbers and characters", () => {
    const n = step({ ...createState({ memory: [902] }), acc: 65 });
    expect(n.state.outputs).toEqual([{ kind: "number", value: 65 }]);
    const c = step({ ...createState({ memory: [922], dialect: "higginson" }), acc: 65 });
    expect(c.state.outputs).toEqual([{ kind: "char", value: 65, char: "A" }]);
    const bad = step({ ...createState({ memory: [922], dialect: "higginson" }), acc: -1 });
    expect(bad.state.outputs[0]).toMatchObject({ char: "�" });
  });

  it("halts and then stays put", () => {
    const r = step(createState({ memory: [0] }));
    expect(r.state.status).toBe("halted");
    expect(r.events).toContainEqual({ type: "halt", address: 0 });
    expect(isFinished(r.state)).toBe(true);
    const again = step(r.state);
    expect(again.state).toBe(r.state);
    expect(again.events).toEqual([]);
  });

  it("stops with an error on an invalid instruction", () => {
    const r = step(createState({ memory: [400] }));
    expect(r.state.status).toBe("error");
    expect(r.state.error).toEqual({
      code: "invalid-instruction",
      message: "400 is not an instruction the machine understands.",
      address: 0,
      value: 400,
    });
    expect(r.state.stage).toBe(4);
    expect(r.state.microSteps).toBe(5);
    expect(step(r.state).state).toBe(r.state);
  });

  it("waits for input, then continues when given one", () => {
    const waiting = step(createState({ memory: [901, 902, 0] })).state;
    expect(waiting.status).toBe("waiting-input");
    expect(canStep(waiting)).toBe(false);
    const still = step(waiting);
    expect(still.state).toBe(waiting);
    expect(still.events).toEqual([{ type: "input-needed" }]);

    const given = provideInput(waiting, 8);
    expect(given.status).toBe("ready");
    const r = step(given);
    expect(r.events).toContainEqual({ type: "input", value: 8, index: 0 });
    expect(r.state).toMatchObject({ acc: 8, inputIndex: 1, cycles: 1 });
    expect(() => provideInput(waiting, 1000)).toThrow(RangeError);
    // Giving input while not waiting just queues it.
    expect(provideInput(createState(), 3).status).toBe("ready");
  });

  it("wraps the program counter after 99", () => {
    const s = {
      ...createState({ memory: Array.from({ length: 100 }, (_, i) => (i === 99 ? 902 : 0)) }),
      pc: 99,
    };
    const r = step(s);
    expect(r.state.pc).toBe(0);
  });

  it("finishes a part-done instruction when stepping by instruction", () => {
    let s = createState({ memory: [902] });
    s = step(s, { granularity: "micro" }).state;
    s = step(s, { granularity: "micro" }).state;
    const r = step(s);
    expect(r.steps).toHaveLength(4);
    expect(r.state.stage).toBe(0);
  });
});

describe("classic machine interface", () => {
  it("exposes the engine functions", () => {
    const m = classicMachine;
    expect(m.id).toBe("classic");
    const s = m.provideInput(m.createState({ memory: [901, 902, 0] }), 4);
    expect(m.run(s).state.outputs).toEqual([{ kind: "number", value: 4 }]);
    expect(m.step(s).state.acc).toBe(4);
  });

  it("formats values with three digits", () => {
    expect(formatValue(7)).toBe("007");
    expect(formatValue(-7)).toBe("-007");
    expect(formatValue(123)).toBe("123");
  });
});
