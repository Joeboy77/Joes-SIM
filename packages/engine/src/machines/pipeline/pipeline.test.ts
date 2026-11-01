/**
 * Hand-worked examples from docs/specs/pipeline.md. Each expected value was worked out by hand
 * from the rules in the spec before the scheduler was run on it.
 */
import { describe, expect, it } from "vitest";
import { assemble } from "../../assembler/assemble";
import { run } from "../../core/run";
import { createState } from "../../core/state";
import type { DialectId } from "../../dialects/types";
import { Trace } from "../../insight/trace";
import type { KeyPress } from "../extended/types";
import { EXTENDED_REFERENCE_PROGRAMS } from "../../reference/extended";
import { REFERENCE_PROGRAMS } from "../../reference/programs";
import { schedulePipeline, stageOf, stagesAt, type PipelineOptions } from "./schedule";

const FWD: PipelineOptions = { forwarding: true, prediction: false };
const NOFWD: PipelineOptions = { forwarding: false, prediction: false };
const PRED: PipelineOptions = { forwarding: true, prediction: true };

function pipeline(
  source: string,
  options: PipelineOptions,
  {
    inputs = [],
    keys = [],
    dialect = "classic",
  }: { inputs?: number[]; keys?: KeyPress[]; dialect?: DialectId } = {},
) {
  const program = assemble(source, { machine: "extended", dialect }).program;
  if (!program) throw new Error(`does not assemble: ${source}`);
  const initial = createState({
    memory: program.memory,
    inputs,
    keys,
    dialect,
    machine: "extended",
    stackFloor: program.size,
  });
  const final = run(initial, { maxSteps: 1000 });
  const trace = new Trace(initial);
  trace.syncTo(final.state.cycles);
  return schedulePipeline(trace.rows, program.memory, options);
}

const starts = (r: ReturnType<typeof pipeline>) =>
  r.instructions.map((s) => [s.start.IF, s.start.ID, s.start.EX, s.start.MEM, s.start.WB]);

const lines = (...l: string[]) => l.join("\n");

describe("hand-worked pipeline examples (docs/specs/pipeline.md)", () => {
  it("1. independent instructions overlap fully", () => {
    const r = pipeline(
      lines("        LDA a", "        LDA b", "        HLT", "a       DAT 1", "b       DAT 2"),
      FWD,
    );
    expect(starts(r)).toEqual([
      [1, 2, 3, 4, 5],
      [2, 3, 4, 5, 6],
      [3, 4, 5, 6, 7],
    ]);
    expect(r.cycles).toBe(7);
    expect(r.unpipelinedCycles).toBe(15);
    expect(r.stalls.total).toBe(0);
  });

  const chain = lines(
    "        LDA a",
    "        ADD b",
    "        STA c",
    "        HLT",
    "a DAT 1",
    "b DAT 2",
    "c DAT",
  );

  it("2. a chain through ACC needs no stalls with forwarding", () => {
    const r = pipeline(chain, FWD);
    expect(r.cycles).toBe(8);
    expect(r.stalls.total).toBe(0);
    expect(r.instructions[1]?.forwards).toEqual([
      { resource: "ACC", from: 0, fromStage: "MEM", toStage: "MEM", cycle: 5 },
    ]);
    expect(r.instructions[2]?.forwards).toEqual([
      { resource: "ACC", from: 1, fromStage: "MEM", toStage: "MEM", cycle: 6 },
    ]);
  });

  it("3. the same chain without forwarding waits for each write back", () => {
    const r = pipeline(chain, NOFWD);
    expect(starts(r)).toEqual([
      [1, 2, 3, 4, 5],
      [2, 3, 6, 7, 8],
      [3, 6, 9, 10, 11],
      [6, 9, 10, 11, 12],
    ]);
    expect(r.stalls).toEqual({ data: 4, control: 0, structural: 0, selfModifying: 0, total: 4 });
  });

  const branch = lines("        INP", "        BRZ z", "        HLT", "z       HLT");

  it("4. load-use before a taken branch: one data stall, two cycles of penalty", () => {
    const r = pipeline(branch, FWD, { inputs: [0] });
    expect(starts(r)).toEqual([
      [1, 2, 3, 4, 5],
      [2, 3, 5, 6, 7],
      [6, 7, 8, 9, 10],
    ]);
    expect(r.stalls).toEqual({ data: 1, control: 2, structural: 0, selfModifying: 0, total: 3 });
    expect(r.flushed.map((f) => [f.address, f.fetched, f.decoded])).toEqual([
      [2, 3, 5],
      [3, 5, undefined],
    ]);
  });

  it("5. the branch not taken costs nothing more", () => {
    const r = pipeline(branch, FWD, { inputs: [5] });
    expect(r.cycles).toBe(8);
    expect(r.stalls.data).toBe(1);
    expect(r.flushed).toEqual([]);
  });

  it("6. without forwarding the branch waits two cycles for ACC", () => {
    const r = pipeline(branch, NOFWD, { inputs: [5] });
    expect(r.cycles).toBe(9);
    expect(r.stalls.data).toBe(2);
  });

  it("7. BRA is known in decode: one cycle lost", () => {
    const r = pipeline(lines("        BRA x", "        HLT", "x       HLT"), FWD);
    expect(starts(r)[1]).toEqual([3, 4, 5, 6, 7]);
    expect(r.stalls.control).toBe(1);
    expect(r.flushed).toHaveLength(1);
  });

  const countdown = (n: number) =>
    lines(
      "        LDA n",
      "loop    SUB one",
      "        BRP loop",
      "        HLT",
      `n       DAT ${n}`,
      "one     DAT 1",
    );

  it("8. a loop that goes round twice, without prediction", () => {
    const r = pipeline(countdown(2), FWD);
    expect(r.instructions).toHaveLength(8);
    expect(r.cycles).toBe(19);
    expect(r.stalls).toEqual({ data: 3, control: 4, structural: 0, selfModifying: 0, total: 7 });
  });

  it("9. the same loop with prediction: one right guess, one wrong at the exit", () => {
    const r = pipeline(countdown(2), PRED);
    expect(r.cycles).toBe(19);
    expect(r.instructions.filter((s) => s.guess).map((s) => s.guess)).toEqual([
      { taken: false, right: false },
      { taken: true, right: true },
      { taken: true, right: false },
    ]);
    expect(starts(r)[5]).toEqual([9, 11, 12, 13, 14]);
  });

  it("10. a longer loop: prediction saves two cycles each time round", () => {
    expect(pipeline(countdown(4), FWD).cycles).toBe(29);
    expect(pipeline(countdown(4), PRED).cycles).toBe(25);
  });

  it("11. indirect addressing holds MEM for two cycles", () => {
    const r = pipeline(
      lines("        LDA @p", "        LDA a", "        HLT", "p       DAT a", "a       DAT 7"),
      FWD,
    );
    expect(starts(r)).toEqual([
      [1, 2, 3, 4, 6],
      [2, 3, 4, 6, 7],
      [3, 4, 6, 7, 8],
    ]);
    expect(r.stalls).toEqual({ data: 0, control: 0, structural: 1, selfModifying: 0, total: 1 });
  });

  const indexed = lines(
    "        INX",
    "        LDA t,X",
    "        HLT",
    "t       DAT 5",
    "        DAT 9",
  );

  it("12. INX to an indexed load: X is forwarded from EX to EX", () => {
    const r = pipeline(indexed, FWD);
    expect(r.cycles).toBe(7);
    expect(r.instructions[1]?.forwards).toEqual([
      { resource: "X", from: 0, fromStage: "EX", toStage: "EX", cycle: 4 },
    ]);
  });

  it("13. the same without forwarding: two stalls", () => {
    const r = pipeline(indexed, NOFWD);
    expect(r.cycles).toBe(9);
    expect(r.stalls.data).toBe(2);
  });

  it("14. LDX then an indexed load: X comes from memory, one stall", () => {
    const r = pipeline(
      lines(
        "        LDX i",
        "        LDA t,X",
        "        HLT",
        "i       DAT 1",
        "t       DAT 5",
        "        DAT 9",
      ),
      FWD,
    );
    expect(r.cycles).toBe(8);
    expect(r.stalls.data).toBe(1);
  });

  const stack = lines(
    "        LDA a",
    "        PUSH",
    "        PUSH",
    "        POP",
    "        POP",
    "        HLT",
    "a       DAT 3",
  );

  it("15. PUSH and POP pass SP along with forwarding", () => {
    const r = pipeline(stack, FWD);
    expect(r.cycles).toBe(10);
    expect(r.stalls.total).toBe(0);
    expect(r.instructions[2]?.forwards.map((f) => f.resource).sort()).toEqual(["ACC", "SP"]);
  });

  it("16. PUSH and POP without forwarding wait for SP every time", () => {
    const r = pipeline(stack, NOFWD);
    expect(r.cycles).toBe(18);
    expect(r.stalls.data).toBe(8);
  });

  it("17. CALL is known in decode; RET only after MEM", () => {
    const r = pipeline(lines("        CALL s", "        HLT", "s       RET"), FWD);
    expect(starts(r)).toEqual([
      [1, 2, 3, 4, 5],
      [3, 4, 5, 6, 7],
      [7, 8, 9, 10, 11],
    ]);
    expect(r.stalls.control).toBe(4);
    expect(r.flushed.map((f) => f.address)).toEqual([2, 4, 5, 6]);
  });

  it("18. a store into an instruction already fetched makes it fetch again", () => {
    const r = pipeline(
      lines("        LDA new", "        STA x", "x       HLT", "        HLT", "new     DAT 902"),
      FWD,
    );
    expect(r.instructions.map((s) => s.mnemonic)).toEqual(["LDA", "STA", "OUT", "HLT"]);
    expect(starts(r)[2]).toEqual([6, 7, 8, 9, 10]);
    expect(r.stalls).toEqual({ data: 0, control: 0, structural: 0, selfModifying: 3, total: 3 });
  });

  it("19. an interrupt: entry and RTI each hold MEM for three cycles", () => {
    const r = pipeline(
      lines(
        "        VEC h",
        "        EI",
        "        WAIT",
        "        HLT",
        "h       GET 2",
        "        RTI",
      ),
      FWD,
      { keys: [{ cycle: 0, key: 65 }] },
    );
    expect(r.instructions.map((s) => s.mnemonic)).toEqual(["VEC", "EI", "INT", "GET", "RTI"]);
    expect(starts(r)).toEqual([
      [1, 2, 3, 4, 5],
      [2, 3, 4, 5, 6],
      [3, 4, 5, 6, 9],
      [5, 6, 7, 9, 10],
      [6, 7, 9, 10, 13],
    ]);
    expect(r.cycles).toBe(13);
    expect(r.unpipelinedCycles).toBe(29);
    expect(r.stalls).toEqual({ data: 0, control: 0, structural: 4, selfModifying: 0, total: 4 });
  });

  it("20. each stage holds one instruction, a flushed fetch or a bubble", () => {
    const r = pipeline(branch, FWD, { inputs: [0] });
    expect(stagesAt(r, 5)).toEqual({
      IF: { kind: "flushed", address: 3 },
      ID: { kind: "flushed", address: 2 },
      EX: { kind: "instruction", index: 1, stalled: false },
      MEM: { kind: "bubble" },
      WB: { kind: "instruction", index: 0, stalled: false },
    });
    expect(stagesAt(r, 4).ID).toEqual({ kind: "instruction", index: 1, stalled: true });
  });
});

describe("pipeline invariants, on every reference program", () => {
  const programs: { id: string; source: string; inputs: number[]; keys: KeyPress[] }[] = [
    ...REFERENCE_PROGRAMS.map((p) => ({
      id: p.id,
      source: p.source,
      inputs: [...(p.cases[0]?.inputs ?? [])],
      keys: [],
    })),
    ...EXTENDED_REFERENCE_PROGRAMS.map((p) => ({
      id: p.id,
      source: p.source,
      inputs: [...(p.cases[0]?.inputs ?? [])],
      keys: [...(p.cases[0]?.keys ?? [])],
    })),
  ];
  for (const p of programs) {
    for (const options of [FWD, NOFWD, PRED, { forwarding: false, prediction: true }]) {
      it(`${p.id} (${options.forwarding ? "forwarding" : "no forwarding"}, ${options.prediction ? "prediction" : "no prediction"})`, () => {
        if (!assemble(p.source, { machine: "extended" }).ok) return;
        const r = pipeline(p.source, options, {
          inputs: p.inputs,
          keys: p.keys,
        });
        const n = r.instructions.length;
        if (n === 0) return;
        // Lost cycles add up to everything beyond one instruction finishing per cycle.
        const s = r.stalls;
        expect(s.data + s.control + s.structural + s.selfModifying).toBe(s.total);
        expect(r.cycles).toBe(n + 4 + s.total);
        r.instructions.forEach((x, i) => {
          const st = x.start;
          expect(st.ID).toBeGreaterThan(st.IF);
          expect(st.EX).toBeGreaterThan(st.ID);
          expect(st.MEM).toBeGreaterThan(st.EX);
          expect(st.WB).toBeGreaterThanOrEqual(st.MEM + x.memCycles);
          const prev = r.instructions[i - 1];
          if (prev) expect(st.WB).toBeGreaterThan(prev.start.WB);
        });
        // No stage ever holds two things at once.
        for (let c = 1; c <= Math.min(r.cycles, 400); c++) {
          const busy = new Map<string, number>();
          for (const x of r.instructions) {
            if (c >= x.start.IF && c <= x.start.WB) {
              const key = stageOf(x, c);
              busy.set(key, (busy.get(key) ?? 0) + 1);
            }
          }
          for (const count of busy.values()) expect(count).toBe(1);
        }
      });
    }
  }
});
