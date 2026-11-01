import {
  LMC_PLUS,
  assembleCustom,
  assembleRiscv,
  createCustomState,
  createRvState,
  stepCustom,
  stepRv,
  type CustomStep,
  type RvStep,
} from "@joes-sim/engine";
import { describe, expect, it } from "vitest";
import { narrateCustom, narrateRv } from "./machines";

function rvSteps(src: string, inputs: number[] = []): RvStep[] {
  const p = assembleRiscv(src).program;
  if (!p) throw new Error("no program");
  let s = createRvState(inputs);
  const out: RvStep[] = [];
  for (let i = 0; i < 200; i++) {
    const r = stepRv(s, p);
    if (!r.step) break;
    out.push(r.step);
    s = r.state;
  }
  return out;
}

const RV = `
.data
v:  .word 4
.text
    la   t0, v
    lw   t1, 0(t0)
    addi t1, t1, 3
    sw   t1, 0(t0)
    slt  t2, t1, t0
    lui  t3, 0x1
    beq  t1, t1, a
a:  bne  t1, t1, a
    jal  ra, f
    li   a7, 10
    ecall
f:  li   a0, 7
    li   a7, 1
    ecall
    j    g
g:  jalr t4, 0(ra)
`;

describe("RISC-V narration", () => {
  const steps = rvSteps(RV);

  it("tells each instruction in a sentence, at both levels", () => {
    for (const s of steps) {
      for (const level of ["beginner", "technical"] as const) {
        const text = narrateRv(s, level);
        expect(text).toMatch(/[.)]$/);
        expect(text).not.toMatch(/undefined|NaN/);
      }
    }
  });

  it("explains loads, the ALU and branches in plain words", () => {
    const at = (name: string) => steps.find((s) => s.instruction.name === name) as RvStep;
    expect(narrateRv(at("lw"), "beginner")).toBe(
      "lw t1, 0(t0): the address is t0 + 0 = 0x10010000; the word there, 4, is loaded into t1.",
    );
    const addi = steps.find(
      (s) => s.instruction.name === "addi" && s.instruction.rd === 6,
    ) as RvStep;
    expect(narrateRv(addi, "technical")).toBe("addi t1, t1, 3: t1 ← 4 + 3 = 7.");
    expect(narrateRv(at("sw"), "beginner")).toMatch(/t1 \(7\) is stored there as a word\.$/);
    expect(narrateRv(at("bne"), "beginner")).toMatch(
      /is not not equal to|is not equal to|carry on/,
    );
    expect(narrateRv(at("ecall"), "beginner")).toMatch(/ask the system to/);
  });
});

describe("custom machine narration", () => {
  it("tells each micro-operation in a sentence", () => {
    const src =
      "        INP\n        MUL x\n        INC\n        STA y\n        BRZ 0\n        BRA end\nend     OUT\n        HLT\nx       DAT 3\ny       DAT";
    const p = assembleCustom(src, LMC_PLUS).program;
    let s = createCustomState(LMC_PLUS, p?.memory ?? []);
    const texts: string[] = [];
    for (let i = 0; i < 80; i++) {
      const r = stepCustom(s, LMC_PLUS);
      if (r.step) {
        texts.push(
          narrateCustom(r.step as CustomStep, "beginner"),
          narrateCustom(r.step as CustomStep, "technical"),
        );
      }
      if (r.state === s) {
        s = { ...r.state, inputs: [5] };
        continue;
      }
      s = r.state;
      if (s.status === "halted") break;
    }
    expect(texts).toContain("There is no input to read, so the machine waits for one.");
    expect(texts).toContain("The ALU works out mul of 5 and 3: 15. It goes into ACC.");
    expect(texts).toContain("The machine stops.");
    expect(texts.some((t) => t.startsWith("The control unit reads"))).toBe(true);
    expect(texts.some((t) => t === "Jump to 6.")).toBe(true);
    expect(texts.some((t) => t === "The condition does not hold, so carry on.")).toBe(true);
    expect(texts.every((t) => !/undefined|NaN/.test(t))).toBe(true);
  });
});

describe("every kind of step, at both levels", () => {
  const ALL = `
.data
w:  .word 1
.text
    la   s0, w
    lb   t0, 0(s0)
    lh   t0, 0(s0)
    sb   t0, 0(s0)
    sh   t0, 0(s0)
    add  t1, t0, t0
    sub  t1, t1, t0
    and  t1, t1, t0
    or   t1, t1, t0
    xor  t1, t1, t0
    sll  t1, t1, t0
    srl  t1, t1, t0
    sra  t1, t1, t0
    sltu t1, t1, t0
    andi t1, t1, 1
    ori  t1, t1, 1
    xori t1, t1, 1
    slli t1, t1, 1
    srli t1, t1, 1
    srai t1, t1, 1
    slti t1, t1, 1
    sltiu t1, t1, 1
    blt  t1, t0, n1
n1: bge  t1, t0, n2
n2: bltu t1, t0, n3
n3: bgeu t1, t0, n4
n4: jal  f
    j    end
f:  la   t2, g
    jalr t3, 0(t2)
g:  jalr zero, 0(t3)
end: jal ra, r
    li  a7, 10
    ecall
r:  ret
`;

  it("never leaves a gap in a sentence", () => {
    const steps = rvSteps(ALL);
    expect(steps.length).toBeGreaterThan(30);
    for (const s of steps) {
      for (const level of ["beginner", "technical"] as const) {
        expect(narrateRv(s, level)).not.toMatch(/undefined|NaN|\?\?/);
      }
    }
    const read = rvSteps(".text\n li a7, 5\n ecall\n li a7, 10\n ecall", [4]);
    expect(narrateRv(read[1] as RvStep, "technical")).toBe(
      "ecall: system call 5: read the integer 4 into a0.",
    );
  });

  it("tells custom machines' micro-operations at both levels", () => {
    const def = {
      ...LMC_PLUS,
      instructions: [
        ...LMC_PLUS.instructions,
        {
          mnemonic: "SETC",
          opcode: 9,
          operand: false,
          fixedOperand: 30,
          micro: [
            { op: "set" as const, reg: "ACC", value: 65 },
            { op: "output" as const, from: "ACC", as: "char" as const },
          ],
        },
        {
          mnemonic: "NEGJ",
          opcode: 9,
          operand: false,
          fixedOperand: 31,
          micro: [
            { op: "alu" as const, fn: "negate" as const, a: "ACC", to: "ACC" },
            { op: "jump" as const, when: "negative" as const, to: "MAR" },
          ],
        },
      ],
    };
    const p = assembleCustom(
      "        SETC\n        NEGJ\n        INC\n        DEC\n        STA 20\n        BRA 7\n        HLT\n        DAT 999",
      def,
    ).program;
    let s = createCustomState(def, p?.memory ?? []);
    const texts: string[] = [];
    for (let i = 0; i < 80 && s.status === "ready"; i++) {
      const r = stepCustom(s, def);
      if (r.step)
        for (const level of ["beginner", "technical"] as const)
          texts.push(narrateCustom(r.step, level));
      s = r.state;
    }
    expect(texts).toContain("Put 65 in the output.");
    expect(texts).toContain("The ALU works out negate of 65: -65. It goes into ACC.");
    expect(texts).toContain("Execute: ACC ← 65 negate 0 = -65.");
    expect(texts).toContain("The condition holds, so jump to 1.");
    expect(texts).toContain("Execute: condition false; no jump.");
    expect(texts).toContain("Execute: PC ← 7.");
    expect(texts).toContain("The machine stops: 999 is not an instruction this machine knows.");
    expect(texts.some((t) => /changes by one/.test(t))).toBe(true);
    expect(texts.some((t) => /^Write .* into memory at 20/.test(t))).toBe(true);
    expect(texts.every((t) => !/undefined|NaN/.test(t))).toBe(true);
  });
});
