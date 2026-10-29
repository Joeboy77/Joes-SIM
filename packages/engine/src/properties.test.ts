/**
 * Property-based tests: fast-check generates thousands of random programs and inputs and checks
 * rules that must hold for all of them.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { assemble } from "./assembler/assemble";
import { disassemble } from "./assembler/disassemble";
import { History } from "./core/history";
import { run } from "./core/run";
import { createState } from "./core/state";
import { step } from "./core/step";
import type { MachineState } from "./core/types";
import { DIALECT_IDS, getDialect } from "./dialects/dialects";
import type { DialectId } from "./dialects/types";

const OPCODE_BASES = [0, 100, 200, 300, 500, 600, 700, 800];
const IO = [901, 902, 922];

/** Mostly real instructions aimed at nearby mailboxes, plus arbitrary values. */
const word = (dialect: DialectId) => {
  const d = getDialect(dialect);
  return fc.oneof(
    {
      weight: 4,
      arbitrary: fc
        .tuple(fc.constantFrom(...OPCODE_BASES), fc.integer({ min: 0, max: 24 }))
        .map(([b, a]) => b + a),
    },
    { weight: 1, arbitrary: fc.constantFrom(...IO) },
    { weight: 1, arbitrary: fc.integer({ min: d.minValue, max: d.maxValue }) },
  );
};

const machine = fc.constantFrom(...DIALECT_IDS).chain((dialect) => {
  const d = getDialect(dialect);
  return fc.record({
    dialect: fc.constant(dialect),
    memory: fc.array(word(dialect), { maxLength: 30 }),
    inputs: fc.array(fc.integer({ min: d.minValue, max: d.maxValue }), { maxLength: 6 }),
  });
});

function checkRanges(s: MachineState) {
  const d = getDialect(s.dialect);
  const value = (v: number) => Number.isInteger(v) && v >= d.minValue && v <= d.maxValue;
  expect(s.pc >= 0 && s.pc <= 99).toBe(true);
  expect(s.mar >= 0 && s.mar <= 99).toBe(true);
  expect(value(s.acc)).toBe(true);
  expect(value(s.mdr)).toBe(true);
  expect(value(s.ir)).toBe(true);
  expect(s.memory).toHaveLength(100);
  expect(s.memory.every(value)).toBe(true);
  expect(s.outputs.every((o) => value(o.value))).toBe(true);
  expect(s.stage >= 0 && s.stage <= 7).toBe(true);
  expect(s.inputIndex <= s.inputs.length).toBe(true);
}

describe("properties", () => {
  it("every value stays in range after every micro-step", () => {
    fc.assert(
      fc.property(machine, ({ dialect, memory, inputs }) => {
        let s = createState({ dialect, memory, inputs });
        for (let i = 0; i < 400; i++) {
          checkRanges(s);
          const next = step(s, { granularity: "micro" }).state;
          if (next === s) break;
          s = next;
        }
      }),
      { numRuns: 300 },
    );
  });

  it("stepping forward then restoring from history gives identical states", () => {
    fc.assert(
      fc.property(
        machine,
        fc.integer({ min: 1, max: 20 }),
        ({ dialect, memory, inputs }, interval) => {
          const initial = createState({ dialect, memory, inputs });
          const history = new History(initial, {
            keyframeInterval: interval,
            maxInstructions: 10_000,
          });
          const states = [initial];
          let s = initial;
          for (let i = 0; i < 300; i++) {
            const r = step(s, { granularity: "micro" });
            if (r.state === s || !r.steps[0]) break;
            history.push(r.state, r.steps[0]);
            states.push(r.state);
            s = r.state;
          }
          states.forEach((expected, position) =>
            expect(history.stateAt(position)).toEqual(expected),
          );
          // Walking backwards one step at a time also retraces every state.
          for (let p = states.length - 2; p >= 0; p--) expect(history.back()).toEqual(states[p]);
        },
      ),
      { numRuns: 150 },
    );
  });

  it("assembling then disassembling preserves meaning", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DIALECT_IDS).chain((dialect) =>
          fc.record({
            dialect: fc.constant(dialect),
            memory: fc.array(word(dialect), { maxLength: 100 }),
          }),
        ),
        ({ dialect, memory }) => {
          const full = createState({ dialect, memory }).memory;
          const result = assemble(disassemble(full, { dialect }), { dialect });
          expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
          expect(result.program?.memory).toEqual(full);
        },
      ),
      { numRuns: 400 },
    );
  });

  it("the fast run loop ends in exactly the state of stepping one instruction at a time", () => {
    fc.assert(
      fc.property(
        machine,
        fc.integer({ min: 0, max: 200 }),
        ({ dialect, memory, inputs }, budget) => {
          const initial = createState({ dialect, memory, inputs });
          const fast = run(initial, { maxSteps: budget, detectLoops: false }).state;
          let slow = initial;
          for (let i = 0; i < budget && slow.status === "ready"; i++) slow = step(slow).state;
          expect(fast).toEqual(slow);
        },
      ),
      { numRuns: 400 },
    );
  });

  it("a reported infinite loop really never stops, and loop detection never cuts a finishing run short", () => {
    fc.assert(
      fc.property(machine, ({ dialect, memory, inputs }) => {
        const initial = createState({ dialect, memory, inputs });
        const plain = run(initial, { maxSteps: 20_000, detectLoops: false });
        const detected = run(initial, { maxSteps: 20_000 });
        if (detected.reason === "infinite-loop") {
          expect(plain.reason).toBe("budget");
          const loop = detected.loop;
          expect(loop && loop.length > 0).toBe(true);
          // Running on from the start of the loop comes back to the same state after one trip.
          const start = run(initial, { maxSteps: loop?.startCycle ?? 0, detectLoops: false }).state;
          const later = run(start, { maxSteps: loop?.length ?? 0, detectLoops: false }).state;
          expect(start.pc).toBe(loop?.startAddress);
          expect([later.pc, later.acc, later.negative, later.memory]).toEqual([
            start.pc,
            start.acc,
            start.negative,
            start.memory,
          ]);
        } else {
          expect(detected.reason).toBe(plain.reason);
          expect(detected.state).toEqual(plain.state);
        }
      }),
      { numRuns: 400 },
    );
  });
});
