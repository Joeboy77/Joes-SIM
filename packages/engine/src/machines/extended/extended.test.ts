import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { assemble } from "../../assembler/assemble";
import type { EngineEvent } from "../../core/events";
import { run } from "../../core/run";
import { createState, pressKey, type CreateStateOptions } from "../../core/state";
import { step } from "../../core/step";
import type { MachineState } from "../../core/types";
import { DIALECT_IDS } from "../../dialects/dialects";
import { REFERENCE_PROGRAMS } from "../../reference/programs";
import { numberSegments } from "./devices";

const ext = (memory: number[], options: Omit<CreateStateOptions, "memory" | "machine"> = {}) =>
  createState({ memory, machine: "extended", ...options });

/** Steps whole instructions, collecting every event, until the machine stops or waits. */
function stepAll(
  state: MachineState,
  limit = 10_000,
): { state: MachineState; events: EngineEvent[] } {
  const events: EngineEvent[] = [];
  for (let i = 0; i < limit && state.status === "ready"; i++) {
    const r = step(state);
    events.push(...r.events);
    state = r.state;
  }
  return { state, events };
}

const types = (events: readonly EngineEvent[]) => events.map((e) => e.type);

describe("classic programs run unchanged on the extended machine", () => {
  for (const program of REFERENCE_PROGRAMS) {
    for (const dialect of DIALECT_IDS) {
      const result = assemble(program.source, { dialect });
      if (!result.ok || !result.program) continue;
      const memory = result.program.memory;
      program.cases.forEach((c, i) => {
        if (c.only && !c.only.includes(dialect)) return;
        it(`${program.id} [${dialect}] case ${i + 1}`, () => {
          const classic = createState({ memory, inputs: c.inputs, dialect });
          const extended = createState({ memory, inputs: c.inputs, dialect, machine: "extended" });
          const a = run(classic);
          const b = run(extended);
          expect(b.reason).toBe(a.reason);
          expect(b.loop).toEqual(a.loop);
          expect(b.state.ext).toBeDefined();
          expect({ ...b.state, ext: undefined }).toEqual(a.state);
          if (a.reason !== "infinite-loop") {
            const sa = stepAll(classic, 5_000);
            const sb = stepAll(extended, 5_000);
            expect(sb.events).toEqual(sa.events);
          }
        });
      });
    }
  }
});

describe("stack, subroutines and the index register", () => {
  it("PUSH and POP use the stack from mailbox 99 down", () => {
    // LDA 10; PUSH; LDA 11; PUSH; POP; OUT; POP; OUT; HLT
    const s = ext([510, 410, 511, 410, 411, 902, 411, 902, 0, 0, 7, 8]);
    const { state, events } = stepAll(s);
    expect(state.outputs.map((o) => o.value)).toEqual([8, 7]);
    expect(state.ext?.sp).toBe(100);
    expect(state.memory[99]).toBe(7);
    expect(state.memory[98]).toBe(8);
    const pushes = events.filter((e) => e.type === "stack-push");
    expect(pushes.map((e) => e.type === "stack-push" && [e.address, e.value, e.sp])).toEqual([
      [99, 7, 99],
      [98, 8, 98],
    ]);
  });

  it("CALL pushes the return address and RET goes back to it", () => {
    // 00 CALL 05; 02 OUT; 03 HLT; 05 LDA 08; RET; ...; 08 DAT 42
    const s = ext([412, 5, 902, 0, 0, 508, 413, 0, 42]);
    const { state, events } = stepAll(s);
    expect(state.status).toBe("halted");
    expect(state.outputs.map((o) => o.value)).toEqual([42]);
    expect(events.find((e) => e.type === "call")).toEqual({
      type: "call",
      from: 0,
      target: 5,
      returnAddress: 2,
    });
    expect(events.find((e) => e.type === "return")).toEqual({ type: "return", from: 6, target: 2 });
    expect(state.memory[99]).toBe(2);
  });

  it("micro-steps match the specification's counts", () => {
    const count = (memory: number[]) => {
      const s = ext(memory);
      return step(s).steps.length;
    };
    expect(count([410])).toBe(6); // PUSH
    expect(count([412, 5])).toBe(9); // CALL
    expect(count([414, 5])).toBe(10); // LDX
    expect(count([416])).toBe(6); // INX
    expect(count([420, 2, 3, 0])).toBe(12); // LDA @
    expect(count([430, 2, 3])).toBe(10); // LDA ,X
    expect(count([440])).toBe(6); // EI
    expect(count([443, 5])).toBe(8); // VEC
    expect(count([451, 30])).toBe(8); // PUT
  });

  it("indirect addressing follows the pointer", () => {
    // LDA @05 -> mailbox 05 holds 07 -> mailbox 07 holds 123; STA @06 -> mailbox 06 holds 08
    const s = ext([420, 5, 421, 6, 0, 7, 8, 123]);
    const { state, events } = stepAll(s);
    expect(state.acc).toBe(123);
    expect(state.memory[8]).toBe(123);
    expect(events.filter((e) => e.type === "effective-address")).toEqual([
      { type: "effective-address", mode: "indirect", operand: 5, via: 7, address: 7 },
      { type: "effective-address", mode: "indirect", operand: 6, via: 8, address: 8 },
    ]);
  });

  it("indexed addressing sums a table", () => {
    // 00 LDX two; 02 LDA sum; ADD table,X; STA sum; DEX; STX tmp; LDA tmp; BRP 02; LDA sum; OUT; HLT
    const memory = new Array<number>(30).fill(0);
    const prog = [414, 20, 521, 432, 23, 321, 417, 415, 22, 522, 802, 521, 902, 0];
    prog.forEach((v, i) => (memory[i] = v));
    memory[20] = 2;
    memory[23] = 10;
    memory[24] = 20;
    memory[25] = 30;
    const { state } = stepAll(ext(memory, { dialect: "higginson" }));
    expect(state.status).toBe("halted");
    expect(state.outputs.map((o) => o.value)).toEqual([60]);
  });

  it("errors name the bad address", () => {
    const s = ext([420, 3, 0, 150], { dialect: "higginson" });
    const r = run(s);
    expect(r.reason).toBe("error");
    expect(r.state.error?.code).toBe("address-out-of-range");
    expect(r.state.error?.message).toContain("150");
    const x = run(ext([414, 4, 430, 90, 20]));
    expect(x.state.error?.code).toBe("address-out-of-range");
    expect(x.state.error?.message).toContain("90 + X (20)");
  });

  it("stack overflow stops before the stack overwrites the program", () => {
    // PUSH forever: BRA 00 after PUSH. Floor is 2, so 98 pushes fit.
    const r = run(ext([410, 600]));
    expect(r.reason).toBe("error");
    expect(r.state.error?.code).toBe("stack-overflow");
    expect(r.state.ext?.sp).toBe(2);
  });

  it("POP on an empty stack is a stack underflow", () => {
    const r = run(ext([411]));
    expect(r.state.error?.code).toBe("stack-underflow");
  });

  it("400 to 409 stay invalid instructions", () => {
    for (const v of [400, 405, 409, 418, 499]) {
      expect(run(ext([v])).state.error?.code).toBe("invalid-instruction");
    }
  });
});

describe("interrupts", () => {
  /**
   * 00 VEC 10; 02 LDA period; 03 PUT 20; 05 EI; 06 WAIT; 07 BRA 06
   * 10 LDA count; 11 ADD one; 12 STA count; 13 OUT; 14 SUB three; 15 BRZ 17; 16 RTI; 17 HLT
   */
  const timerProgram = () => {
    const m = new Array<number>(30).fill(0);
    [443, 10, 520, 451, 20, 440, 444, 606].forEach((v, i) => (m[i] = v));
    [521, 122, 321, 902, 223, 717, 442, 0].forEach((v, i) => (m[10 + i] = v));
    m[20] = 5; // period
    m[21] = 0; // count
    m[22] = 1; // one
    m[23] = 3; // three
    return m;
  };

  it("a timer interrupt runs the handler and RTI resumes the main program", () => {
    const { state, events } = stepAll(ext(timerProgram()));
    expect(state.status).toBe("halted");
    expect(state.outputs.map((o) => o.value)).toEqual([1, 2, 3]);
    const enters = events.filter((e) => e.type === "interrupt-enter");
    expect(enters).toHaveLength(3);
    expect(enters[0]).toEqual({ type: "interrupt-enter", source: "timer", from: 6, handler: 10 });
    const saved = events.filter((e) => e.type === "stack-push");
    expect(saved.slice(0, 3).map((e) => e.type === "stack-push" && e.saves)).toEqual([
      "PC",
      "ACC",
      "flag",
    ]);
    expect(types(events)).toContain("interrupt-return");
  });

  it("the fast run loop agrees with the micro-step machine", () => {
    const s = ext(timerProgram());
    expect(run(s).state).toEqual(stepAll(s).state);
  });

  it("the timer counts instructions: the first tick comes `period` instructions after PUT", () => {
    const { events } = stepAll(ext(timerProgram()));
    const completes = events.filter(
      (e) => e.type === "instruction-complete" || e.type === "interrupt-raised",
    );
    // PUT 20 is the third instruction; five more complete before the timer fires.
    const putAt = completes.findIndex(
      (e) => e.type === "instruction-complete" && e.mnemonic === "PUT",
    );
    const firedAt = completes.findIndex((e) => e.type === "interrupt-raised");
    const between = completes
      .slice(putAt + 1, firedAt + 1)
      .filter((e) => e.type === "instruction-complete");
    expect(between).toHaveLength(5);
  });

  it("WAIT with interrupts off is an error", () => {
    expect(run(ext([444])).state.error?.code).toBe("wait-forever");
  });

  it("WAIT with nothing to wake it waits for a key, and a key press wakes it", () => {
    // VEC 06; EI; WAIT; HLT; 06 GET 02; OUT; HLT? handler reads the key and outputs it
    const m = [443, 6, 440, 444, 0, 0, 450, 2, 902, 0];
    const r = run(ext(m));
    expect(r.reason).toBe("waiting-interrupt");
    const woken = pressKey(r.state, 65);
    const done = run(woken);
    expect(done.reason).toBe("halted");
    expect(done.state.outputs.map((o) => o.value)).toEqual([65]);
  });

  it("a live key press replays identically from the key schedule", () => {
    const m = [443, 6, 440, 444, 603, 0, 450, 2, 902, 442];
    let live = run(ext(m)).state;
    live = run(pressKey(live, 72)).state;
    live = run(pressKey(live, 105)).state;
    expect(live.outputs.map((o) => o.value)).toEqual([72, 105]);
    const replay = run(ext(m, { keys: live.ext?.keys ?? [] })).state;
    expect(replay).toEqual(live);
  });

  it("keys pressed mid-instruction arrive at its end", () => {
    const m = [443, 6, 440, 600, 0, 0, 450, 2, 902, 0];
    let s = ext(m);
    s = step(s).state; // VEC
    s = step(s).state; // EI
    s = step(s, { granularity: "micro" }).state; // part-way through BRA
    s = pressKey(s, 50);
    expect(s.ext?.devices.keyboard).toEqual([]);
    const r = run(s);
    expect(r.state.outputs.map((o) => o.value)).toEqual([50]);
    expect(run(ext(m, { keys: s.ext?.keys ?? [] })).state).toEqual(r.state);
  });

  it("a program waiting on interrupts is never called infinite: a key could come at any time", () => {
    // VEC 06; EI; 03 LDA 08 (period); PUT 20; ... 06 RTI. Repeats every few instructions.
    const r = run(ext([443, 7, 440, 509, 451, 20, 444, 442, 0, 3]), { maxSteps: 5_000 });
    expect(r.reason).toBe("budget");
  });

  it("a loop that polls the keyboard is never called infinite", () => {
    // 00 GET 02; BRZ 00; OUT; HLT
    const r = run(ext([450, 2, 700, 902, 0]), { maxSteps: 5_000 });
    expect(r.reason).toBe("budget");
  });
});

describe("devices", () => {
  it("draws pixels, auto-advancing, and reports only changed pixels", () => {
    // LDA five; PUT 10; LDA red; PUT 11; PUT 11; GET 11? reads pixel 7 (0); HLT
    const m = new Array<number>(20).fill(0);
    [516, 451, 10, 517, 451, 11, 451, 11, 0].forEach((v, i) => (m[i] = v));
    m[16] = 5;
    m[17] = 4;
    const { state, events } = stepAll(ext(m));
    expect(state.ext?.devices.pixels.slice(4, 8)).toEqual([0, 4, 4, 0]);
    expect(state.ext?.devices.pixel).toBe(7);
    const writes = events.filter((e) => e.type === "device-write" && e.port === 11);
    expect(writes.map((e) => e.type === "device-write" && e.pixels)).toEqual([[5], [6]]);
  });

  it("console wraps at 32 columns and keeps 12 lines", () => {
    let s = ext([451, 1, 600]);
    s = { ...s, acc: 65 };
    const r = run(s, { maxSteps: 32 * 20 * 2 + 1 });
    const lines = (r.state.ext?.devices.console ?? "").split("\n");
    expect(lines).toHaveLength(12);
    expect(lines.every((l) => l.length <= 32)).toBe(true);
  });

  it("seven-segment numbers blank leading zeros", () => {
    expect(numberSegments(7)).toEqual([0, 0, 0x07]);
    expect(numberSegments(-120)).toEqual([0x06, 0x5b, 0x3f]);
  });

  it("the beeper emits a beep event", () => {
    const m = [512, 451, 40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 49];
    const { events } = stepAll(ext(m));
    expect(events.find((e) => e.type === "beep")).toEqual({ type: "beep", note: 49, length: 2 });
  });

  it("device errors name the port and the rule", () => {
    expect(run(ext([451, 99])).state.error?.message).toContain("no device on port 99");
    expect(run(ext([450, 1])).state.error?.message).toContain("can only be written");
    const big = run(ext([505, 451, 11, 0, 0, 16]));
    expect(big.state.error?.code).toBe("device-error");
    expect(big.state.error?.message).toContain("0 to 15");
  });
});

describe("properties", () => {
  const EXT_WORDS = [
    410, 411, 413, 416, 417, 440, 441, 442, 444, 412, 414, 415, 420, 421, 422, 423, 430, 431, 432,
    433, 443, 450, 451,
  ];
  const word = fc.oneof(
    { weight: 3, arbitrary: fc.constantFrom(...EXT_WORDS) },
    {
      weight: 3,
      arbitrary: fc
        .tuple(fc.constantFrom(100, 200, 300, 500, 600, 700, 800), fc.integer({ min: 0, max: 24 }))
        .map(([b, a]) => b + a),
    },
    { weight: 2, arbitrary: fc.integer({ min: 0, max: 30 }) },
    { weight: 1, arbitrary: fc.constantFrom(1, 2, 3, 10, 11, 12, 20, 21, 30, 50, 901, 902) },
  );

  it("the fast run loop and the micro-step machine always agree", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DIALECT_IDS),
        fc.array(word, { maxLength: 30 }),
        fc.array(fc.integer({ min: 0, max: 99 }), { maxLength: 4 }),
        fc.array(fc.integer({ min: 1, max: 126 }), { maxLength: 3 }),
        (dialect, memory, inputs, keys) => {
          const s = createState({
            memory,
            inputs,
            dialect,
            machine: "extended",
            keys: keys.map((key, i) => ({ cycle: i * 7, key })),
          });
          const fast = run(s, { maxSteps: 300, detectLoops: false });
          let slow = s;
          const limit = fast.reason === "budget" ? fast.state.cycles : Infinity;
          while (slow.status === "ready" && slow.cycles < limit) slow = step(slow).state;
          expect(slow).toEqual(fast.state);
        },
      ),
      { numRuns: 400 },
    );
  });
});
