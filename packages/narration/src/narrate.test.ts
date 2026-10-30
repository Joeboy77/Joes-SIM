import {
  DIALECTS,
  assemble,
  createState,
  step,
  type DialectId,
  type MachineState,
  type MicroStep,
  type Mnemonic,
} from "@joes-sim/engine";
import { describe, expect, it } from "vitest";
import { en, type Catalogue, type MessageKey } from "./en";
import { narrate, narrateInstruction, narrateStep } from "./narrate";
import type { Level, Narration } from "./types";

const LEVELS: Level[] = ["beginner", "technical"];
const DIALECT_IDS = Object.keys(DIALECTS) as DialectId[];

interface Instruction {
  readonly steps: MicroStep[];
  readonly afters: MachineState[];
}

/** Runs a program micro-step by micro-step, grouping the steps into instructions. */
function execute(
  source: string,
  dialect: DialectId,
  inputs: number[] = [],
  start?: Partial<MachineState>,
) {
  const r = assemble(source, { dialect });
  if (!r.program) throw new Error(`${source}: ${JSON.stringify(r.diagnostics)}`);
  let s: MachineState = { ...createState({ memory: r.program.memory, inputs, dialect }), ...start };
  const instructions: Instruction[] = [];
  let current: Instruction = { steps: [], afters: [] };
  for (let i = 0; i < 500; i++) {
    const res = step(s, { granularity: "micro" });
    const st = res.steps[0];
    if (!st) break;
    current.steps.push(st);
    current.afters.push(res.state);
    const stuck = res.state === s;
    s = res.state;
    if (s.stage === 0 || s.status !== "ready") {
      instructions.push(current);
      current = { steps: [], afters: [] };
    }
    if (stuck || s.status !== "ready") break;
  }
  return instructions;
}

const PROGRAMS: { source: string; inputs?: number[]; start?: Partial<MachineState> }[] = [
  {
    // Wraps on ADD, goes below zero on SUB, clears the flag on LDA.
    source:
      "        INP\n        STA x\n        ADD x\n        SUB big\n        LDA x\n        OUT\n        HLT\nx       DAT\nbig     DAT 999",
    inputs: [600],
  },
  { source: "        INP\n        BRZ z\n        HLT\nz       HLT", inputs: [0] },
  { source: "        INP\n        BRZ z\n        HLT\nz       HLT", inputs: [5] },
  { source: "        INP\n        BRP p\n        HLT\np       HLT", inputs: [5] },
  { source: "        INP\n        BRP p\n        HLT\np       HLT", inputs: [0] },
  {
    source: "        INP\n        SUB one\n        BRP p\n        HLT\np       HLT\none     DAT 1",
    inputs: [0],
  },
  { source: "        BRA x\nx       HLT" },
  { source: "        INP\n        HLT" },
  { source: "x       DAT 400" },
  // A zero accumulator with the negative flag set, which BRZ must not treat as zero.
  { source: "        BRZ z\n        HLT\nz       HLT", start: { acc: 0, negative: true } },
];
const OTC_PROGRAM: (typeof PROGRAMS)[number] = {
  source: "        LDA c\n        OTC\n        HLT\nc       DAT 65",
};

const supported = (dialect: DialectId) =>
  new Set<Mnemonic>(Object.values(DIALECTS[dialect].spellings));

function corpus(dialect: DialectId) {
  const programs = supported(dialect).has("OTC") ? [...PROGRAMS, OTC_PROGRAM] : PROGRAMS;
  return programs.flatMap((p) => execute(p.source, dialect, p.inputs, p.start));
}

function expectWellFormed(n: Narration) {
  expect(n.text).not.toMatch(/\{|\}|\[\[|\]\]|undefined|NaN|null/);
  expect(n.text).toMatch(/[.!]$/);
  expect(n.text).not.toMatch(/ {2}/);
  expect(n.segments.map((s) => s.text).join("")).toBe(n.text);
}

describe("narration", () => {
  it("matches the brief's example sentence", () => {
    const program =
      "        LDA 12\n        HLT\n" + "        DAT 0\n".repeat(10) + "        DAT 42";
    const [lda] = execute(program, "classic");
    const n = narrateInstruction(lda?.steps ?? [], lda?.afters.at(-1) as MachineState, {
      level: "beginner",
    });
    expect(n?.text).toBe(
      "The instruction is 512, so the Little Man loads the value from mailbox 12 into the accumulator. The accumulator is now 42.",
    );
  });

  for (const dialect of DIALECT_IDS) {
    describe(`in the ${dialect} dialect`, () => {
      const instructions = corpus(dialect);

      for (const level of LEVELS) {
        it(`narrates every instruction it supports, at the ${level} level`, () => {
          const narrated = new Set<Mnemonic>();
          for (const ins of instructions) {
            const after = ins.afters.at(-1) as MachineState;
            const whole = narrateInstruction(ins.steps, after, { level });
            expect(whole).not.toBeNull();
            if (whole) expectWellFormed(whole);
            const decode = ins.steps.flatMap((s) => s.events).find((e) => e.type === "decode");
            if (decode?.type === "decode") narrated.add(decode.mnemonic);
          }
          expect([...narrated].sort()).toEqual([...supported(dialect)].sort());
        });

        it(`narrates every micro-step, at the ${level} level`, () => {
          for (const ins of instructions) {
            ins.steps.forEach((s, i) =>
              expectWellFormed(narrateStep(s, ins.afters[i] as MachineState, { level })),
            );
          }
        });
      }
    });
  }

  it("uses every message in the catalogue, at both levels", () => {
    for (const level of LEVELS) {
      const used = new Set<string>();
      for (const dialect of DIALECT_IDS) {
        for (const ins of corpus(dialect)) {
          const after = ins.afters.at(-1) as MachineState;
          narrateInstruction(ins.steps, after, { level })?.keys.forEach((k) => used.add(k));
          ins.steps.forEach((s, i) => {
            narrateStep(s, ins.afters[i] as MachineState, { level }).keys.forEach((k) =>
              used.add(k),
            );
            const d = s.events.find((e) => e.type === "decode");
            if (d?.type === "decode") used.add(`meaning-${d.mnemonic}`);
          });
        }
      }
      const all = Object.keys(en.messages[level]) as MessageKey[];
      expect(all.filter((k) => !used.has(k))).toEqual([]);
    }
  });

  it("explains the dialect differences", () => {
    const sub = (dialect: DialectId) => {
      const ins = execute(PROGRAMS[0]?.source ?? "", dialect, [600])[3] as Instruction;
      return narrateInstruction(ins.steps, ins.afters.at(-1) as MachineState, { level: "beginner" })
        ?.text;
    };
    expect(sub("classic")).toBe(
      "The instruction is 208, so the Little Man subtracts the value in mailbox 08 (999) from the accumulator. The accumulator is now 201. The true answer, -799, is outside what the accumulator can hold, so it wraps round to 201. The answer went below zero, so the negative flag is set.",
    );
    expect(sub("higginson")).toBe(
      "The instruction is 208, so the Little Man subtracts the value in mailbox 08 (999) from the accumulator. The accumulator is now -799. The answer went below zero, so the negative flag is set.",
    );
  });

  it("says that BRP treats zero as positive", () => {
    const [, brp] = execute(PROGRAMS[4]?.source ?? "", "ocr", [0]);
    const after = brp?.afters.at(-1) as MachineState;
    expect(narrateInstruction(brp?.steps ?? [], after, { level: "beginner" })?.text).toMatch(
      /zero counts as positive/,
    );
    expect(narrateInstruction(brp?.steps ?? [], after, { level: "technical" })?.text).toBe(
      "BRP 03: ACC = 0 counts as ≥ 0, taken; PC ← 03.",
    );
  });

  it("marks the names of machine parts so views can link them to their highlights", () => {
    const [inp] = execute("        INP\n        HLT", "classic", [7]);
    const n = narrateStep(inp?.steps[0] as MicroStep, inp?.afters[0] as MachineState, {
      level: "beginner",
    });
    expect(n.segments).toEqual([
      { text: "The Little Man reads the " },
      { text: "program counter", term: "PC" },
      { text: ": the next instruction is in mailbox 00. He notes 00 in the " },
      { text: "address register", term: "MAR" },
      { text: "." },
    ]);
    const t = narrateStep(inp?.steps[0] as MicroStep, inp?.afters[0] as MachineState, {
      level: "technical",
    });
    expect(t.text).toBe("Fetch: copy the PC (00) into the MAR.");
  });

  it("narrates each step of a part-done instruction, or nothing for no steps", () => {
    const [add] = execute("        ADD x\n        HLT\nx       DAT 5", "classic");
    const steps = add?.steps ?? [];
    const after = add?.afters.at(-1) as MachineState;
    // Fetch (4), decode, operand address, operand read, ALU.
    expect(steps).toHaveLength(8);
    expect(narrate(steps.slice(5), after, { level: "beginner" })).toHaveLength(3);
    expect(narrate(steps, after, { level: "beginner" })).toHaveLength(1);
    expect(narrate(steps.slice(0, 1), after, { level: "beginner" })).toHaveLength(1);
    expect(narrate([], after, { level: "beginner" })).toEqual([]);
    expect(narrateInstruction(steps.slice(0, 3), after, { level: "beginner" })).toBeNull();
    expect(narrateInstruction(steps.slice(0, 6), after, { level: "beginner" })).toBeNull();
  });

  it("speaks any language given a catalogue", () => {
    const shout: Catalogue = {
      terms: {
        beginner: Object.fromEntries(
          Object.entries(en.terms.beginner).map(([k, v]) => [k, v.toUpperCase()]),
        ) as Catalogue["terms"]["beginner"],
        technical: en.terms.technical,
      },
      messages: {
        beginner: { ...en.messages.beginner, halt: "STOP! [[ACC]] IS DONE." },
        technical: en.messages.technical,
      },
    };
    const [hlt] = execute("        HLT", "classic");
    const n = narrateStep(hlt?.steps.at(-1) as MicroStep, hlt?.afters.at(-1) as MachineState, {
      level: "beginner",
      catalogue: shout,
    });
    expect(n.text).toBe("STOP! ACCUMULATOR IS DONE.");
  });

  it("refuses a catalogue with unknown parts or missing values", () => {
    const [hlt] = execute("        HLT", "classic");
    const broken = (message: string): Catalogue => ({
      terms: en.terms,
      messages: {
        beginner: { ...en.messages.beginner, halt: message },
        technical: en.messages.technical,
      },
    });
    const run = (message: string) =>
      narrateStep(hlt?.steps.at(-1) as MicroStep, hlt?.afters.at(-1) as MachineState, {
        level: "beginner",
        catalogue: broken(message),
      });
    expect(() => run("[[DESK]]")).toThrow(/Unknown machine part/);
    expect(() => run("{missing}")).toThrow(/Missing value/);
    expect(run("[[ACC]]").segments).toEqual([{ text: "accumulator", term: "ACC" }]);
    const state = hlt?.afters.at(-1) as MachineState;
    expect(() =>
      narrateStep({ phase: "fetch", op: "fetch-read", events: [] }, state, { level: "beginner" }),
    ).toThrow(/Expected a memory-read event/);
  });
});
