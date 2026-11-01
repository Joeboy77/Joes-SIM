import { describe, expect, it } from "vitest";
import { assemble } from "../assembler/assemble";
import type { Program } from "../assembler/types";
import {
  conditionMet,
  describeCondition,
  isValidCondition,
  type RunCondition,
} from "../core/conditions";
import { run } from "../core/run";
import { createState, pressKey } from "../core/state";
import { step } from "../core/step";
import type { DialectId } from "../dialects/types";
import { FastCore } from "../machines/classic/fast";
import { REFERENCE_PROGRAMS } from "../reference/programs";
import { numberViews } from "./numbers";
import { detectRuntime, type RuntimeFindingCode } from "./runtime";
import { Trace, mailboxColumn, usageOf } from "./trace";

const EXTENDED = /\b(PUSH|POP|CALL|RET|EI|VEC|WAIT|RTI|PUT|GET)\b|@/;
const build = (source: string, dialect: DialectId = "higginson"): Program => {
  const r = assemble(source, { dialect, machine: EXTENDED.test(source) ? "extended" : "classic" });
  if (!r.program) throw new Error(JSON.stringify(r.diagnostics));
  return r.program;
};

function traced(source: string, inputs: number[], dialect: DialectId = "higginson") {
  const program = build(source, dialect);
  const initial = createState({
    memory: program.memory,
    inputs,
    dialect,
    ...(program.machine ? { machine: program.machine, stackFloor: program.size } : {}),
  });
  const result = run(initial, { maxSteps: 10_000 });
  const trace = new Trace(initial);
  trace.syncTo(result.state.cycles);
  return { program, initial, result, trace };
}

const source = (id: string) => {
  const p = REFERENCE_PROGRAMS.find((r) => r.id === id);
  if (!p) throw new Error(id);
  return p.source;
};

/**
 * Trace tables worked out by hand, as a learner would in an exam: step, mailbox run, mnemonic,
 * accumulator and program counter after the instruction, then any output.
 */
const BY_HAND: {
  id: string;
  inputs: number[];
  dialect: DialectId;
  rows: string;
  column?: { address: number; values: number[] };
}[] = [
  {
    id: "add",
    inputs: [3, 4],
    dialect: "classic",
    rows: `
      1 00 INP 3 01
      2 01 STA 3 02
      3 02 INP 4 03
      4 03 ADD 7 04
      5 04 OUT 7 05 7
      6 05 HLT 7 06`,
    column: { address: 6, values: [0, 3, 3, 3, 3, 3] },
  },
  {
    id: "subtract",
    inputs: [4, 9],
    dialect: "classic",
    rows: `
      1 00 INP 4 01
      2 01 STA 4 02
      3 02 INP 9 03
      4 03 STA 9 04
      5 04 LDA 4 05
      6 05 SUB 995 06
      7 06 OUT 995 07 995
      8 07 HLT 995 08`,
  },
  {
    id: "subtract",
    inputs: [4, 9],
    dialect: "higginson",
    rows: `
      1 00 INP 4 01
      2 01 STA 4 02
      3 02 INP 9 03
      4 03 STA 9 04
      5 04 LDA 4 05
      6 05 SUB -5 06
      7 06 OUT -5 07 -5
      8 07 HLT -5 08`,
  },
  {
    id: "countdown",
    inputs: [3],
    dialect: "higginson",
    rows: `
      1 00 INP 3 01
      2 01 OUT 3 02 3
      3 02 SUB 2 03
      4 03 BRP 2 01
      5 01 OUT 2 02 2
      6 02 SUB 1 03
      7 03 BRP 1 01
      8 01 OUT 1 02 1
      9 02 SUB 0 03
      10 03 BRP 0 01
      11 01 OUT 0 02 0
      12 02 SUB -1 03
      13 03 BRP -1 04
      14 04 HLT -1 05`,
  },
  {
    id: "echo-until-zero",
    inputs: [5, 7, 0],
    dialect: "ocr",
    rows: `
      1 00 INP 5 01
      2 01 BRZ 5 02
      3 02 OUT 5 03 5
      4 03 BRA 5 00
      5 00 INP 7 01
      6 01 BRZ 7 02
      7 02 OUT 7 03 7
      8 03 BRA 7 00
      9 00 INP 0 01
      10 01 BRZ 0 04
      11 04 HLT 0 05`,
  },
  {
    id: "max-of-two",
    inputs: [3, 8],
    dialect: "classic",
    rows: `
      1 00 INP 3 01
      2 01 STA 3 02
      3 02 INP 8 03
      4 03 STA 8 04
      5 04 SUB 5 05
      6 05 BRP 5 08
      7 08 LDA 8 09
      8 09 OUT 8 10 8
      9 10 HLT 8 11`,
    column: { address: 12, values: [0, 0, 0, 8, 8, 8, 8, 8, 8] },
  },
];

describe("trace tables", () => {
  for (const c of BY_HAND) {
    it(`matches the hand-made table for ${c.id} (${c.dialect}, inputs ${c.inputs.join(", ")})`, () => {
      const { trace } = traced(source(c.id), c.inputs, c.dialect);
      const generated = trace.rows.map((r) =>
        [
          r.step,
          String(r.address).padStart(2, "0"),
          r.mnemonic,
          r.acc,
          String(r.pc).padStart(2, "0"),
          ...(r.output ? [r.output.value] : []),
        ].join(" "),
      );
      const expected = c.rows
        .trim()
        .split("\n")
        .map((l) => l.trim());
      expect(generated).toEqual(expected);
      if (c.column) expect(mailboxColumn(trace, c.column.address)).toEqual(c.column.values);
    });
  }

  it("agrees with the fast core, instruction by instruction, for every reference program", () => {
    let checked = 0;
    for (const p of REFERENCE_PROGRAMS) {
      for (const dialect of ["classic", "higginson", "ocr"] as const) {
        const assembled = assemble(p.source, { dialect });
        if (!assembled.program) continue;
        for (const c of p.cases) {
          if (c.only && !c.only.includes(dialect)) continue;
          const initial = createState({
            memory: assembled.program.memory,
            inputs: c.inputs,
            dialect,
          });
          const trace = new Trace(initial);
          trace.syncTo(5000);
          const core = new FastCore(initial);
          for (const row of trace.rows) {
            const address = core.pc;
            expect(core.exec()).not.toBe("error");
            expect([row.address, row.acc, row.pc, row.negative]).toEqual([
              address,
              core.acc,
              core.pc,
              core.negative,
            ]);
          }
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("records reads, writes, inputs, outputs, branches and arithmetic", () => {
    const { trace } = traced(source("max-of-two"), [3, 8], "classic");
    const [inp, sta, , , sub, brp] = trace.rows;
    expect(inp?.input).toBe(3);
    expect(sta?.write).toEqual({ address: 11, previous: 0, value: 3 });
    expect(sub?.read).toEqual({ address: 11, value: 3 });
    expect(sub?.alu).toEqual({ operation: "sub", wrapped: false });
    expect(brp?.branch).toEqual({ taken: true, target: 8 });
    expect(inp?.read).toBeUndefined();
  });

  it("counts how often each mailbox was run, read and written", () => {
    const { trace } = traced(source("countdown"), [3]);
    expect(trace.executed[1]).toBe(4);
    expect(trace.executed[2]).toBe(4);
    expect(trace.reads[5]).toBe(4);
    expect(trace.writes[5]).toBe(0);
    expect(usageOf(trace, 1)).toBe("code");
    expect(usageOf(trace, 5)).toBe("data");
    expect(usageOf(trace, 50)).toBe("unused");
    expect(trace.transitions.get(3 * 100 + 1)).toBe(3); // the back edge, three times
    expect(trace.transitions.get(3 * 100 + 4)).toBe(1);
  });

  it("classifies a mailbox both run and written as both", () => {
    const { trace } = traced("        LDA v\n        STA x\nx       DAT 0\nv       DAT 0", []);
    expect(usageOf(trace, 2)).toBe("both");
  });

  it("gives the same rows and counts after stepping back as a fresh trace", () => {
    const loop =
      "loop    LDA n\n        ADD one\n        STA n\n        BRA loop\nn       DAT 0\none     DAT 1";
    const program = build(loop);
    const initial = createState({ memory: program.memory, dialect: "higginson" });
    const trace = new Trace(initial);
    trace.syncTo(2600);
    expect(trace.rows).toHaveLength(2600);
    trace.truncate(1234);
    trace.syncTo(1500);
    const fresh = new Trace(initial);
    fresh.syncTo(1500);
    expect(trace.rows).toEqual(fresh.rows);
    expect([...trace.executed]).toEqual([...fresh.executed]);
    expect([...trace.writes]).toEqual([...fresh.writes]);
    expect([...trace.transitions]).toEqual([...fresh.transitions]);
    trace.syncTo(10);
    expect(trace.rows).toHaveLength(10);
    expect(trace.cycle).toBe(10);
  });

  it("waits at INP until more inputs are given, then carries on", () => {
    const program = build(source("echo-until-zero"));
    const initial = createState({ memory: program.memory, inputs: [5], dialect: "higginson" });
    const trace = new Trace(initial);
    trace.syncTo(100);
    expect(trace.rows).toHaveLength(4);
    trace.truncate(1);
    trace.setInputs([5, 0]);
    trace.syncTo(100);
    expect(trace.rows.map((r) => r.mnemonic)).toEqual([
      "INP",
      "BRZ",
      "OUT",
      "BRA",
      "INP",
      "BRZ",
      "HLT",
    ]);
  });

  it("stops at its row limit, and starts only between instructions", () => {
    const program = build("loop    BRA loop");
    const initial = createState({ memory: program.memory, dialect: "higginson" });
    const trace = new Trace(initial, { maxRows: 50 });
    trace.syncTo(1000);
    expect(trace.rows).toHaveLength(50);
    expect(trace.full).toBe(true);
    const version = trace.version;
    trace.syncTo(1000);
    trace.truncate(60);
    expect(trace.version).toBe(version);
    const mid = step(initial, { granularity: "micro" }).state;
    expect(() => new Trace(mid)).toThrow();
  });
});

const RUNTIME: Record<
  RuntimeFindingCode,
  { triggers: [[string, number[]], [string, number[]]]; clean: [string, number[]] }
> = {
  "brp-on-zero": {
    triggers: [
      [source("countdown"), [3]],
      [
        "        INP\n        SUB five\n        BRP pos\n        HLT\npos     OUT\n        HLT\nfive    DAT 5",
        [5],
      ],
    ],
    clean: [
      "        INP\n        SUB five\n        BRP pos\n        HLT\npos     OUT\n        HLT\nfive    DAT 5",
      [9],
    ],
  },
  "ran-data": {
    triggers: [
      ["        INP\n        OUT\nx       DAT 0", [1]],
      ["        INP\n        BRZ 20\n        HLT", [0]],
    ],
    clean: [source("add"), [3, 4]],
  },
  "input-ran-out": {
    triggers: [
      ["        INP\n        INP\n        HLT", [1]],
      [source("echo-until-zero"), [5]],
    ],
    clean: ["        INP\n        INP\n        HLT", [1, 2]],
  },
  "inputs-left-over": {
    triggers: [
      ["        INP\n        HLT", [1, 2]],
      [source("echo-until-zero"), [0, 5]],
    ],
    clean: [source("add"), [3, 4]],
  },
  "infinite-loop": {
    triggers: [
      ["loop    BRA loop", []],
      ["        INP\nloop    ADD one\n        SUB one\n        BRA loop\none     DAT 1", [3]],
    ],
    clean: [source("countdown"), [3]],
  },
  "invalid-instruction": {
    triggers: [
      ["        INP\n        OUT\nx       DAT 400", [1]],
      ["        LDA v\n        STA x\nx       DAT 0\nv       DAT 450", []],
    ],
    clean: [source("add"), [3, 4]],
  },
  "stack-overwritten": {
    triggers: [
      ["        LDA v\n        PUSH\n        STA 99\n        HLT\nv       DAT 5", []],
      ["        CALL s\n        HLT\ns       STA 99\n        RET", []],
    ],
    clean: [
      "        LDA v\n        PUSH\n        POP\n        STA 99\n        HLT\nv       DAT 5",
      [],
    ],
  },
  "machine-error": {
    triggers: [
      ["        POP\n        HLT", []],
      ["        LDA @p\n        HLT\np       DAT 150", []],
    ],
    clean: [source("add"), [3, 4]],
  },
};

describe("tracing the extended machine", () => {
  const timer = `
        VEC tick
        LDA period
        PUT 20
        EI
idle    WAIT
        BRA idle
tick    LDA count
        ADD one
        STA count
        SUB two
        BRZ done
        RTI
done    HLT
period  DAT 4
count   DAT 0
one     DAT 1
two     DAT 2`;

  it("records SP, X and IE, interrupt entries and devices", () => {
    const { trace, result } = traced(timer, [], "classic");
    expect(result.reason).toBe("halted");
    const int = trace.rows.find((r) => r.mnemonic === "INT");
    expect(int).toMatchObject({
      interrupt: "timer",
      ie: false,
      sp: 97,
      stack: { pushed: 3, popped: 0 },
    });
    expect(trace.rows.find((r) => r.mnemonic === "PUT")?.device).toEqual({
      port: 20,
      device: "timer",
      value: 4,
      direction: "write",
    });
    expect(trace.rows.find((r) => r.mnemonic === "RTI")).toMatchObject({ sp: 100, ie: true });
    // The second mailbox of VEC counts as part of the instruction, not as data.
    expect(trace.executed[1]).toBe(1);
    expect(trace.reads[1]).toBe(0);
  });

  it("replays key presses typed during the run", () => {
    const echo = `
        VEC key
        EI
idle    WAIT
        BRA idle
key     GET 2
        OUT
        RTI`;
    const program = build(echo, "classic");
    const initial = createState({
      memory: program.memory,
      dialect: "classic",
      machine: "extended",
      stackFloor: program.size,
    });
    let live = run(initial).state;
    live = run(pressKey(live, 72)).state;
    live = run(pressKey(live, 73)).state;
    expect(live.outputs.map((o) => o.value)).toEqual([72, 73]);
    const trace = new Trace(initial);
    trace.setKeys(live.ext?.keys ?? []);
    trace.syncTo(live.cycles);
    expect(trace.rows.filter((r) => r.mnemonic === "OUT").map((r) => r.acc)).toEqual([72, 73]);
  });
});

const runtimeFindings = (src: string, inputs: number[]) => {
  const { program, result, trace } = traced(src, inputs);
  return detectRuntime(trace, result.state, {
    program,
    inputsGiven: inputs.length,
    loop: result.loop ?? null,
  });
};

describe("runtime mistake detectors", () => {
  for (const [code, c] of Object.entries(RUNTIME) as [
    RuntimeFindingCode,
    (typeof RUNTIME)[RuntimeFindingCode],
  ][]) {
    describe(code, () => {
      c.triggers.forEach(([src, inputs], i) => {
        it(`finds it in example ${i + 1}, with three hints`, () => {
          const f = runtimeFindings(src, inputs).find((x) => x.code === code);
          expect(f).toBeDefined();
          expect(f?.hints).toHaveLength(3);
          expect(f?.message).not.toMatch(/undefined|NaN/);
        });
      });
      it("stays quiet on a correct program", () => {
        expect(runtimeFindings(...c.clean).map((f) => f.code)).not.toContain(code);
      });
    });
  }

  it("points to the step that caused an invalid instruction", () => {
    const written = runtimeFindings(RUNTIME["invalid-instruction"].triggers[1][0], []).find(
      (f) => f.code === "invalid-instruction",
    );
    // Step 2 (STA) wrote 450 into mailbox 02; jump to just before it runs.
    expect(written?.cause?.cycle).toBe(1);
    expect(written?.explanation).toMatch(/STA wrote 450 into mailbox 02 at step 2/);
    expect(written?.line).toBe(3);
    const ranInto = runtimeFindings(RUNTIME["invalid-instruction"].triggers[0][0], [1]).find(
      (f) => f.code === "invalid-instruction",
    );
    expect(ranInto?.cause?.cycle).toBe(1); // OUT at step 2 led into the DAT
  });

  it("points to where an infinite loop began", () => {
    const f = runtimeFindings(RUNTIME["infinite-loop"].triggers[1][0], [3]).find(
      (x) => x.code === "infinite-loop",
    );
    expect(f?.cause?.cycle).toBe(1);
    expect(f?.message).toMatch(/started at step 2, on line 2/);
  });

  it("explains a DAT that was written and then run", () => {
    const f = runtimeFindings(
      "        LDA v\n        STA x\nx       DAT 0\nv       DAT 0",
      [],
    ).find((x) => x.code === "ran-data");
    expect(f?.explanation).toMatch(/written by STA at step 2/);
    expect(f?.cause?.label).toMatch(/where this mailbox was written/);
  });

  it("describes mailboxes when there is no program to give line numbers", () => {
    const { result, trace } = traced("        INP\n        INP\n        HLT", [1]);
    const [f] = detectRuntime(trace, result.state);
    expect(f?.message).toMatch(/in mailbox 01/);
    expect(f?.message).toMatch(/only 1 input was typed in/);
  });

  it("reports a program that starts on a bad instruction", () => {
    const { result, trace, program } = traced("x       DAT 400", []);
    const [f] = detectRuntime(trace, result.state, { program });
    expect(f?.code).toBe("invalid-instruction");
    expect(f?.cause).toBeUndefined();
    expect(f?.hints[1]).toMatch(/first mailbox/);
  });

  it("reports a DAT reached at the very start", () => {
    const { result, trace, program } = traced("x       DAT 0", []);
    const [f] = detectRuntime(trace, result.state, { program });
    expect(f?.code).toBe("ran-data");
    expect(f?.cause).toBeUndefined();
  });
});

describe("run-until conditions", () => {
  const countdown = build(source("countdown"));
  const start = createState({ memory: countdown.memory, inputs: [3], dialect: "higginson" });

  it("stops after the first instruction that makes a condition true", () => {
    const r = run(start, { conditions: [{ target: { kind: "acc" }, op: "==", value: 0 }] });
    expect(r.reason).toBe("condition");
    expect(r.condition).toBe(0);
    expect(r.state.acc).toBe(0);
    expect(r.state.cycles).toBe(9);
  });

  it("checks mailboxes, the program counter and the output count", () => {
    const outputs = run(start, {
      conditions: [{ target: { kind: "outputs" }, op: ">=", value: 2 }],
    });
    expect(outputs.state.outputs).toHaveLength(2);
    const pc = run(start, { conditions: [{ target: { kind: "pc" }, op: "==", value: 4 }] });
    expect(pc.state.pc).toBe(4);
    const add = build(source("add"));
    const s = createState({ memory: add.memory, inputs: [3, 4], dialect: "classic" });
    const mailbox = run(s, {
      conditions: [{ target: { kind: "mailbox", address: 6 }, op: "!=", value: 0 }],
    });
    expect(mailbox.state.cycles).toBe(2);
  });

  it("finishes a part-done instruction, then checks", () => {
    const mid = step(start, { granularity: "micro" }).state;
    const r = run(mid, { conditions: [{ target: { kind: "acc" }, op: ">", value: 0 }] });
    expect(r.reason).toBe("condition");
    expect(r.state.cycles).toBe(1);
  });

  it("compares in every way and describes itself in words", () => {
    const view = { pc: 5, acc: 3, memory: [7], outputs: [] };
    const c = (op: RunCondition["op"], value: number): RunCondition => ({
      target: { kind: "acc" },
      op,
      value,
    });
    expect(
      [c("==", 3), c("!=", 3), c("<", 4), c("<=", 3), c(">", 3), c(">=", 3)].map((x) =>
        conditionMet(x, view),
      ),
    ).toEqual([true, false, true, true, false, true]);
    expect(describeCondition(c(">", 5))).toBe("the accumulator is more than 5");
    expect(describeCondition({ target: { kind: "pc" }, op: "==", value: 4 })).toBe(
      "the program counter is 04",
    );
    expect(describeCondition({ target: { kind: "mailbox", address: 7 }, op: "<=", value: 1 })).toBe(
      "mailbox 07 is at most 1",
    );
    expect(describeCondition({ target: { kind: "outputs" }, op: ">=", value: 3 })).toBe(
      "the number of outputs is at least 3",
    );
    expect(describeCondition(c("!=", 0))).toBe("the accumulator is not 0");
    expect(describeCondition(c("<", 0))).toBe("the accumulator is less than 0");
    expect(isValidCondition(c("==", 1.5))).toBe(false);
    expect(
      isValidCondition({ target: { kind: "mailbox", address: 100 }, op: "==", value: 1 }),
    ).toBe(false);
    expect(isValidCondition({ target: { kind: "mailbox", address: 99 }, op: "==", value: 1 })).toBe(
      true,
    );
    expect(isValidCondition(c("==", 1))).toBe(true);
  });
});

describe("number views", () => {
  it("shows a value in binary, hexadecimal and two's complement", () => {
    expect(numberViews(42, "classic")).toEqual({
      decimal: "42",
      binary: "10 1010",
      hex: "2A",
      twosComplement: "00 0010 1010",
      bits: 10,
    });
    expect(numberViews(999, "classic").binary).toBe("11 1110 0111");
  });

  it("uses 11 bits for signed dialects and stores negatives as two's complement", () => {
    const v = numberViews(-5, "higginson");
    expect(v.bits).toBe(11);
    expect(v.binary).toBe("-101");
    expect(v.hex).toBe("-5");
    expect(v.twosComplement).toBe("111 1111 1011");
    expect(numberViews(0, "ocr").twosComplement).toBe("000 0000 0000");
  });
});
