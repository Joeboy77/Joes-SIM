import { describe, expect, it } from "vitest";
import { assemble } from "../../assembler/assemble";
import { run } from "../../core/run";
import { createState } from "../../core/state";
import { REFERENCE_PROGRAMS } from "../../reference/programs";
import { checkDefinition, parseDefinition, type MachineDefinition } from "./definition";
import { LMC_DEFINITION, LMC_PLUS } from "./lmc";
import { assembleCustom, createCustomState, runCustom, stepCustom } from "./machine";

function runOn(def: MachineDefinition, source: string, inputs: number[] = []) {
  const a = assembleCustom(source, def);
  if (!a.program) throw new Error(JSON.stringify(a.diagnostics));
  return runCustom(createCustomState(def, a.program.memory, inputs), def);
}

describe("custom machines", () => {
  it("the LMC preset is a valid definition", () => {
    expect(checkDefinition(LMC_DEFINITION)).toEqual([]);
    expect(checkDefinition(LMC_PLUS)).toEqual([]);
  });

  it("the LMC preset gives the same results as the built-in machine on every reference program", () => {
    let compared = 0;
    for (const p of REFERENCE_PROGRAMS) {
      const builtIn = assemble(p.source, { dialect: "classic" });
      if (!builtIn.program) continue;
      const custom = assembleCustom(p.source, LMC_DEFINITION);
      expect(custom.diagnostics, p.id).toEqual([]);
      expect(custom.program?.memory.slice(0, 100), p.id).toEqual(builtIn.program.memory);
      for (const c of p.cases) {
        if (c.only && !c.only.includes("classic")) continue;
        const a = run(createState({ memory: builtIn.program.memory, inputs: c.inputs }));
        if (a.reason !== "halted" && a.reason !== "error" && a.reason !== "waiting-input") continue;
        const b = runCustom(
          createCustomState(LMC_DEFINITION, builtIn.program.memory, c.inputs),
          LMC_DEFINITION,
        );
        expect(b.reason, p.id).toBe(a.reason);
        expect(
          b.state.outputs.map((o) => o.value),
          p.id,
        ).toEqual(a.state.outputs.map((o) => o.value));
        expect(b.state.memory, p.id).toEqual(a.state.memory);
        expect(b.state.registers.ACC, p.id).toBe(a.state.acc);
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(40);
  });

  it("a variant with extra instructions runs them, defined with no code", () => {
    const r = runOn(
      LMC_PLUS,
      "        INP\n        MUL x\n        INC\n        OUT\n        DEC\n        DEC\n        OUT\n        HLT\nx       DAT 6",
      [7],
    );
    expect(r.reason).toBe("halted");
    expect(r.state.outputs.map((o) => o.value)).toEqual([43, 41]);
  });

  it("reports each micro-step, fetch, decode and execute", () => {
    const a = assembleCustom("        LDA x\n        HLT\nx       DAT 9", LMC_DEFINITION);
    let s = createCustomState(LMC_DEFINITION, a.program?.memory ?? []);
    const phases: string[] = [];
    for (let i = 0; i < 8; i++) {
      const r = stepCustom(s, LMC_DEFINITION);
      phases.push(`${r.step?.phase}:${r.step?.micro?.op ?? "decode"}`);
      s = r.state;
    }
    expect(phases).toEqual([
      "fetch:copy",
      "fetch:read",
      "fetch:copy",
      "fetch:inc",
      "decode:decode",
      "execute:copy",
      "execute:read",
      "execute:copy",
    ]);
    expect(s.registers.ACC).toBe(9);
    expect(s.cycles).toBe(1);
  });

  it("waits for input and carries on when it comes", () => {
    const def = LMC_DEFINITION;
    const a = assembleCustom("        INP\n        OUT\n        HLT", def);
    const waiting = runCustom(createCustomState(def, a.program?.memory ?? []), def);
    expect(waiting.reason).toBe("waiting-input");
    const done = runCustom({ ...waiting.state, inputs: [5] }, def);
    expect(done.state.outputs.map((o) => o.value)).toEqual([5]);
  });

  it("works in other bases and word sizes, with every ALU function and condition", () => {
    const bin: MachineDefinition = {
      ...LMC_DEFINITION,
      name: "Binary accumulator machine",
      memory: 16,
      word: { digits: 8, base: 2, signed: true },
      opcodeDigits: 4,
      registers: [...LMC_DEFINITION.registers, { name: "B" }],
      instructions: [
        { mnemonic: "HLT", opcode: 0, operand: false, micro: [{ op: "halt" }] },
        {
          mnemonic: "LDA",
          opcode: 1,
          operand: true,
          micro: [
            { op: "copy", from: "operand", to: "MAR" },
            { op: "read" },
            { op: "copy", from: "MDR", to: "ACC" },
          ],
        },
        {
          mnemonic: "LDB",
          opcode: 2,
          operand: true,
          micro: [
            { op: "copy", from: "operand", to: "MAR" },
            { op: "read" },
            { op: "copy", from: "MDR", to: "B" },
          ],
        },
        {
          mnemonic: "DIV",
          opcode: 3,
          operand: false,
          micro: [{ op: "alu", fn: "div", a: "ACC", b: "B", to: "ACC" }],
        },
        {
          mnemonic: "MOD",
          opcode: 4,
          operand: false,
          micro: [{ op: "alu", fn: "mod", a: "ACC", b: "B", to: "ACC" }],
        },
        {
          mnemonic: "NEG",
          opcode: 5,
          operand: false,
          micro: [{ op: "alu", fn: "negate", a: "ACC", to: "ACC" }],
        },
        { mnemonic: "OUT", opcode: 6, operand: false, micro: [{ op: "output", from: "ACC" }] },
        {
          mnemonic: "BRN",
          opcode: 7,
          operand: true,
          micro: [{ op: "jump", when: "negative", to: "operand" }],
        },
        {
          mnemonic: "BNZ",
          opcode: 8,
          operand: true,
          micro: [{ op: "jump", when: "not-zero", to: "operand" }],
        },
        {
          mnemonic: "SET",
          opcode: 9,
          operand: false,
          micro: [{ op: "set", reg: "ACC", value: 65 }],
        },
        {
          mnemonic: "CHR",
          opcode: 10,
          operand: false,
          micro: [{ op: "output", from: "ACC", as: "char" }],
        },
        {
          mnemonic: "STA",
          opcode: 11,
          operand: true,
          micro: [
            { op: "copy", from: "operand", to: "MAR" },
            { op: "copy", from: "ACC", to: "MDR" },
            { op: "write" },
          ],
        },
        {
          mnemonic: "JMP",
          opcode: 12,
          operand: true,
          micro: [{ op: "jump", when: "always", to: "operand" }],
        },
      ],
    };
    expect(checkDefinition(bin)).toEqual([]);
    const r = runOn(
      bin,
      "LDA a\nLDB b\nDIV\nOUT\nLDA a\nMOD\nOUT\nNEG\nBRN minus\nHLT\nminus OUT\nSET\nCHR\nHLT\na DAT 17\nb DAT 5",
    );
    expect(r.state.outputs.map((o) => o.value)).toEqual([3, 2, -2, 65]);
    expect(r.state.outputs[3]).toEqual({ kind: "char", value: 65, char: "A" });
  });

  it("explains assembly problems", () => {
    const msgs = (src: string) =>
      assembleCustom(src, LMC_DEFINITION).diagnostics.map((d) => d.message);
    expect(msgs("        MUL 5")).toEqual([
      "Line 1: 'MUL' is not an instruction of this machine. It knows HLT, ADD, SUB, STA, LDA, BRA, BRZ, BRP, INP, OUT and DAT.",
    ]);
    expect(msgs("x       FOO")[0]).toMatch(
      /'FOO' is not an instruction of this machine. It knows HLT, ADD/,
    );
    expect(msgs("x")).toEqual(["Line 1: put an instruction or DAT after the label 'x'."]);
    expect(msgs("        LDA")).toEqual(["Line 1: LDA needs an address or a value."]);
    expect(msgs("        HLT 5")).toEqual(["Line 1: HLT takes no operand."]);
    expect(msgs("        LDA nowhere")).toEqual(["Line 1: the label 'nowhere' is not defined."]);
    expect(msgs("        LDA 100")).toEqual([
      "Line 1: 100 does not fit in the operand field (0 to 99).",
    ]);
    expect(msgs("        DAT 1000")).toEqual(["Line 1: 1000 does not fit in a word (0 to 999)."]);
    expect(msgs("a DAT\na DAT")).toEqual(["Line 2: the label 'a' is used twice."]);
    expect(msgs("        LDA 1 2")).toEqual([
      "Line 1: there is more after the operand than this line can use.",
    ]);
    expect(msgs("+x DAT")[0]).toMatch(/'\+x' is not an instruction of this machine/);
    expect(msgs("        DAT\n".repeat(101))).toContain(
      "Line 101: the program does not fit in 100 words.",
    );
  });

  it("stops at an address outside memory, or a word that is not an instruction", () => {
    const small: MachineDefinition = { ...LMC_DEFINITION, memory: 50 };
    expect(checkDefinition(small)).toEqual([]);
    expect(runOn(small, "        LDA 70\n        HLT").state.error).toBe(
      "Address 70 is outside memory (0 to 49).",
    );
    expect(runOn(small, "        STA 70\n        HLT").state.error).toBe(
      "Address 70 is outside memory (0 to 49).",
    );
    expect(runOn(LMC_DEFINITION, "        DAT 400").state.error).toBe(
      "400 is not an instruction this machine knows.",
    );
  });

  it("explains every problem with a definition", () => {
    const bad = (patch: object) => checkDefinition({ ...LMC_DEFINITION, ...patch });
    expect(checkDefinition(null)).toEqual(["This is not a machine definition."]);
    expect(bad({ format: "x" })[0]).toMatch(/not a Joe's SIM machine/);
    expect(bad({ name: " " })).toContain("The machine needs a name.");
    expect(bad({ memory: 5 })).toContain("Memory must be a whole number of words from 10 to 1000.");
    expect(bad({ word: { digits: 9, base: 10, signed: false } })[0]).toMatch(
      /base of 10 or 16 with 1 to 6 digits/,
    );
    expect(bad({ opcodeDigits: 3 })[0]).toMatch(/opcode needs at least 1 digit/);
    expect(bad({ memory: 200 })[0]).toMatch(/operand field \(2 digits\) can only reach 100/);
    expect(bad({ registers: [{ name: "1X" }] }).join(" ")).toMatch(
      /'1X' cannot be a register name/,
    );
    expect(bad({ registers: [...LMC_DEFINITION.registers, { name: "ACC" }] })).toContain(
      "Two registers have the same name.",
    );
    expect(bad({ registers: LMC_DEFINITION.registers.slice(1) }).join(" ")).toMatch(/role 'pc'/);
    expect(bad({ fetch: "x" })).toContain("Fetch needs a list of micro-operations.");
    expect(bad({ instructions: [] })).toContain("The machine needs at least one instruction.");
    const one = (ins: object) => bad({ instructions: [ins] }).join(" ");
    const base = { mnemonic: "ABC", opcode: 1, operand: false, micro: [] };
    expect(one({ ...base, mnemonic: "A" })).toMatch(/2 to 6 letters/);
    expect(one({ ...base, mnemonic: "DAT" })).toMatch(/DAT is kept for data/);
    expect(one({ ...base, opcode: 10 })).toMatch(/opcode must be 0 to 9/);
    expect(one({ ...base, fixedOperand: 100 })).toMatch(/fixed operand must fit/);
    expect(one({ ...base, micro: [{ op: "copy", from: "AC", to: "ACC" }] })).toMatch(
      /register 'AC' does not exist. The registers are PC, MAR, MDR, IR, ACC/,
    );
    expect(one({ ...base, micro: [{ op: "set", reg: "ACC", value: 1.5 }] })).toMatch(
      /'set' needs a whole number/,
    );
    expect(
      one({ ...base, micro: [{ op: "alu", fn: "pow", a: "ACC", b: "ACC", to: "ACC" }] }),
    ).toMatch(/not something the ALU can do/);
    expect(one({ ...base, micro: [{ op: "jump", when: "sometimes", to: "operand" }] })).toMatch(
      /condition must be one of/,
    );
    expect(one({ ...base, micro: [{ op: "fly" }] })).toMatch(/'fly' is not a micro-operation/);
    expect(
      one({
        ...base,
        micro: [
          { op: "inc", reg: "Q" },
          { op: "input", to: "Q" },
          { op: "output", from: "Q" },
        ],
      }),
    ).toMatch(/'Q' does not exist/);
    expect(bad({ instructions: [base, { ...base, mnemonic: "ABC" }] })).toContain(
      "Two instructions are called ABC.",
    );
    expect(bad({ instructions: [base, { ...base, mnemonic: "XYZ" }] })).toContain(
      "Opcode 1 is used by both ABC and XYZ.",
    );
    expect(parseDefinition("{")).toEqual({ ok: false, problems: ["The file is not valid JSON."] });
    expect(parseDefinition(JSON.stringify(LMC_DEFINITION)).ok).toBe(true);
    expect(parseDefinition("{}").ok).toBe(false);
  });
});

describe("custom machine edge cases", () => {
  const extra: MachineDefinition = {
    ...LMC_PLUS,
    instructions: [
      ...LMC_PLUS.instructions,
      {
        mnemonic: "DVZ",
        opcode: 9,
        operand: false,
        fixedOperand: 20,
        micro: [
          { op: "alu", fn: "div", a: "ACC", b: "PC", to: "ACC" },
          { op: "set", reg: "ACC", value: 0 },
          { op: "alu", fn: "mod", a: "ACC", b: "ACC", to: "ACC" },
        ],
      },
      {
        mnemonic: "BNZ",
        opcode: 9,
        operand: false,
        fixedOperand: 21,
        micro: [{ op: "jump", when: "not-zero", to: "MAR" }],
      },
    ],
  };

  it("stops at the step budget, and on a negative instruction word", () => {
    const loop = runCustom(createCustomState(LMC_DEFINITION, [600]), LMC_DEFINITION, 50);
    expect(loop.reason).toBe("budget");
    expect(loop.state.cycles).toBe(50);
    const neg = runOn(LMC_PLUS, "        LDA m\n        STA 2\n        DAT 0\nm       DAT -5");
    expect(neg.state.error).toBe("-5 is not an instruction this machine knows.");
  });

  it("wraps signed results, divides by zero to 0, and jumps to a register", () => {
    const big = runOn(
      LMC_PLUS,
      "        LDA x\n        MUL x\n        OUT\n        DEC\n        HLT\nx       DAT 40",
    );
    expect(big.state.outputs.map((o) => o.value)).toEqual([600]);
    const wrapped = runOn(
      LMC_PLUS,
      "        LDA x\n        MUL x\n        OUT\n        HLT\nx       DAT 50",
    );
    expect(wrapped.state.outputs.map((o) => o.value)).toEqual([500]);
    const zero = runCustom(createCustomState(extra, [920, 0]), extra);
    expect(zero.state.registers.ACC).toBe(0);
    // MAR holds 0 after the fetch of an instruction at 00: BNZ jumps there while ACC is not 0.
    const jumps = runCustom(
      createCustomState(extra, [510, 921, 0, 0, 0, 0, 0, 0, 0, 0, 7]),
      extra,
      20,
    );
    expect(jumps.reason).toBe("budget");
    const dec = runOn(
      LMC_DEFINITION.instructions.length ? LMC_PLUS : LMC_PLUS,
      "        DEC\n        OUT\n        HLT",
    );
    expect(dec.state.outputs.map((o) => o.value)).toEqual([-1]);
    expect(dec.state.n).toBe(true);
  });

  it("explains missing parts of a definition", () => {
    const { registers: _r, instructions: _i, ...bare } = LMC_DEFINITION;
    void _r;
    void _i;
    const problems = checkDefinition(bare);
    expect(problems.join(" ")).toMatch(/there are 0/);
    expect(problems).toContain("The machine needs at least one instruction.");
    const two = checkDefinition({
      ...LMC_DEFINITION,
      registers: [...LMC_DEFINITION.registers, { name: "PC2", role: "pc" }],
    });
    expect(two.join(" ")).toMatch(/role 'pc' \(program counter\); there are 2/);
    const wide = checkDefinition({
      ...LMC_DEFINITION,
      word: { digits: 4, base: 10, signed: false },
      opcodeDigits: 2,
      instructions: [{ opcode: 100, operand: false, micro: [] }],
    });
    expect(wide.join(" ")).toMatch(/Instruction \(no name\): a mnemonic is 2 to 6 letters/);
    expect(wide.join(" ")).toMatch(/with 2 opcode digits the opcode must be 0 to 99/);
  });
});
