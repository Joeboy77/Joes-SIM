import { describe, expect, it } from "vitest";
import { assemble } from "../../assembler/assemble";
import { disassembleWord } from "../../assembler/disassemble";
import { run } from "../../core/run";
import { createState, provideInput } from "../../core/state";
import { step } from "../../core/step";
import { detectRaces } from "../../insight/races";
import { Trace } from "../../insight/trace";
import { REFERENCE_PROGRAMS } from "../../reference/programs";
import type { Schedule } from "./types";

const lines = (...l: string[]) => l.join("\n");
const add3 = lines(
  ...Array.from({ length: 3 }, () => [
    "        LDA total",
    "        ADD one",
    "        STA total",
  ]).flat(),
);

/** The classic race: two cores each add 1 to a shared total three times. */
export const RACE = lines(
  add3,
  "        HLT",
  "core1" + add3.slice(5),
  "        HLT",
  "total   DAT 0",
  "one     DAT 1",
);

/** The same, with a TAS lock round each addition. */
export const LOCKED = lines(
  "loop0   TAS lock",
  "        BRZ in0",
  "        BRA loop0",
  "in0     LDA total",
  "        ADD one",
  "        STA total",
  "        LDA zero",
  "        STA lock",
  "        LDA n0",
  "        SUB one",
  "        STA n0",
  "        BRZ done0",
  "        BRA loop0",
  "done0   HLT",
  "core1   TAS lock",
  "        BRZ in1",
  "        BRA core1",
  "in1     LDA total",
  "        ADD one",
  "        STA total",
  "        LDA zero",
  "        STA lock",
  "        LDA n1",
  "        SUB one",
  "        STA n1",
  "        BRZ done1",
  "        BRA core1",
  "done1   HLT",
  "total   DAT 0",
  "one     DAT 1",
  "zero    DAT 0",
  "lock    DAT 0",
  "n0      DAT 3",
  "n1      DAT 3",
);

function machine(
  source: string,
  schedule: Schedule,
  extra: { cores?: number; inputs?: number[] } = {},
) {
  const p = assemble(source, { machine: "multicore" }).program;
  if (!p) throw new Error(JSON.stringify(assemble(source, { machine: "multicore" }).diagnostics));
  const starts = [0, 1, 2, 3].map((i) => p.labels[`core${i}`]?.address ?? 0);
  return {
    program: p,
    initial: createState({
      memory: p.memory,
      machine: "multicore",
      cores: extra.cores ?? 2,
      starts,
      schedule,
      inputs: extra.inputs ?? [],
    }),
  };
}

function total(source: string, schedule: Schedule) {
  const { program, initial } = machine(source, schedule);
  const r = run(initial, { maxSteps: 10_000 });
  const trace = new Trace(initial);
  trace.syncTo(r.state.cycles);
  return {
    reason: r.reason,
    total: r.state.memory[program.labels.total?.address ?? 0],
    cores: trace.rows.map((row) => row.core),
    races: detectRaces(trace.rows),
  };
}

const rr = (quantum: number): Schedule => ({ mode: "round-robin", quantum, seed: 1 });
const random = (seed: number): Schedule => ({ mode: "random", quantum: 1, seed });

describe("the multicore machine", () => {
  it("the classic race: switching after every instruction loses updates", () => {
    const r = total(RACE, rr(1));
    expect(r.reason).toBe("halted");
    expect(r.total).toBe(3);
    expect(r.cores.slice(0, 6)).toEqual([0, 1, 0, 1, 0, 1]);
    // Core 0 writes the total (step 5) after core 1 read it (step 2), with no lock held.
    expect(r.races[0]).toEqual({
      address: 20,
      first: { step: 2, core: 1, write: false },
      second: { step: 5, core: 0, write: true },
    });
  });

  it("switching after every three instructions happens to give the right total", () => {
    expect(total(RACE, rr(3)).total).toBe(6);
  });

  it("some seeds give the wrong total and some the right one", () => {
    const totals = new Set(Array.from({ length: 30 }, (_, i) => total(RACE, random(i + 1)).total));
    expect(totals.has(6)).toBe(true);
    expect([...totals].some((t) => t !== 6)).toBe(true);
  });

  it("the same seed always gives the same interleaving", () => {
    for (const seed of [1, 7, 42]) {
      expect(total(RACE, random(seed)).cores).toEqual(total(RACE, random(seed)).cores);
    }
    const seqs = new Set([1, 2, 3, 4, 5].map((s) => total(RACE, random(s)).cores.join("")));
    expect(seqs.size).toBeGreaterThan(1);
  });

  it("with a TAS lock every schedule gives 6, and no race is reported", () => {
    const schedules = [
      ...[1, 2, 3, 5, 10].map(rr),
      ...Array.from({ length: 40 }, (_, i) => random(i + 1)),
    ];
    for (const s of schedules) {
      const r = total(LOCKED, s);
      expect(r.reason).toBe("halted");
      expect(r.total).toBe(6);
      expect(r.races).toEqual([]);
    }
  });

  it("manual scheduling runs the chosen cores, and replays the choices", () => {
    const { initial } = machine(RACE, { mode: "manual", quantum: 1, seed: 1 });
    // Core 1 reads, then core 0 does its whole update, then core 1 writes back: total 1.
    const choices = [1, 0, 0, 0, 1, 1];
    let s = initial;
    for (const c of choices) {
      s = { ...s, multi: { ...(s.multi as NonNullable<typeof s.multi>), selected: c } };
      s = step(s).state;
    }
    expect(s.multi?.choices).toEqual(choices);
    expect(s.memory[20]).toBe(1);
    const replay = run(
      { ...initial, multi: { ...(initial.multi as NonNullable<typeof initial.multi>), choices } },
      { maxSteps: 6 },
    );
    expect(replay.state.memory).toEqual(s.memory);
  });

  it("a halted core is skipped, and the machine halts when every core has", () => {
    const { initial } = machine(
      lines("        HLT", "core1   LDA x", "        OUT", "        HLT", "x       DAT 5"),
      rr(1),
    );
    const r = run(initial);
    expect(r.reason).toBe("halted");
    expect(r.state.outputs).toEqual([{ kind: "number", value: 5, core: 1 }]);
    expect(r.state.multi?.cores.map((c) => c.cycles)).toEqual([1, 3]);
  });

  it("a core waiting for input lets the others run; input wakes it", () => {
    const { initial } = machine(
      lines("        INP", "        OUT", "        HLT", "core1   HLT"),
      rr(1),
    );
    const waiting = run(initial);
    expect(waiting.reason).toBe("waiting-input");
    expect(waiting.state.multi?.cores[1]?.status).toBe("halted");
    const done = run(provideInput(waiting.state, 8));
    expect(done.reason).toBe("halted");
    expect(done.state.outputs.map((o) => o.value)).toEqual([8]);
  });

  it("TAS reads and sets the lock in one instruction of 11 micro-steps", () => {
    const { initial } = machine(
      lines("        TAS lock", "        HLT", "core1   HLT", "lock    DAT 0"),
      rr(1),
    );
    const r = step(initial);
    expect(r.steps.map((s) => s.op)).toEqual([
      "fetch-address",
      "fetch-read",
      "fetch-load-ir",
      "fetch-increment",
      "decode",
      "operand-fetch-address",
      "operand-fetch-read",
      "operand-address",
      "operand-read",
      "load-acc",
      "store-write",
    ]);
    expect(r.state.acc).toBe(0);
    expect(r.state.memory[4]).toBe(1);
    expect(r.events[0]).toEqual({ type: "core", core: 0 });
    expect(disassembleWord(460, "classic", { machine: "multicore", next: 4 }).text).toBe("TAS 04");
  });

  it("TAS needs the multicore machine, and a mailbox", () => {
    expect(assemble("        TAS 5").diagnostics[0]?.code).toBe("multicore-only");
    expect(assemble("        TAS", { machine: "multicore" }).diagnostics[0]?.code).toBe(
      "missing-address",
    );
    expect(assemble("tas     LDA 5\n        HLT", { machine: "multicore" }).ok).toBe(true);
    const bad = run(machine(lines("        TAS 0", "        HLT"), rr(1)).initial);
    expect(bad.reason).toBe("halted");
  });

  it("runs every classic reference program on core 0 with the same outputs", () => {
    for (const p of REFERENCE_PROGRAMS) {
      const a = assemble(p.source);
      if (!a.program || a.program.memory[99] !== 0) continue;
      for (const c of p.cases) {
        if (c.only && !c.only.includes("classic")) continue;
        const classic = run(createState({ memory: a.program.memory, inputs: c.inputs }));
        if (classic.reason !== "halted" && classic.reason !== "error") continue;
        const multi = run(
          createState({
            memory: a.program.memory,
            inputs: c.inputs,
            machine: "multicore",
            starts: [0, 99],
          }),
        );
        expect(multi.reason, p.id).toBe(classic.reason);
        expect(
          multi.state.outputs.map((o) => o.value),
          p.id,
        ).toEqual(classic.state.outputs.map((o) => o.value));
      }
    }
  });

  it("refuses a machine with too few or too many cores", () => {
    expect(() => createState({ machine: "multicore", cores: 1 })).toThrow(RangeError);
    expect(() => createState({ machine: "multicore", cores: 5 })).toThrow(RangeError);
  });
});
