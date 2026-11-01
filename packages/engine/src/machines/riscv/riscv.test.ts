import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TEXT_BASE, assembleRiscv } from "./assemble";
import { createRvState, runRv, stepRv } from "./execute";
import { decode, encode, registerNumber, show } from "./isa";

const dir = join(__dirname, "..", "..", "reference", "riscv");
const expected = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8")) as Record<
  string,
  { inputs: number[]; output: string; exitCode?: number; ended?: string }
>;

describe("RISC-V test programs (expected results as RARS gives them)", () => {
  it("has a result for every program", () => {
    const files = readdirSync(dir).filter((f) => f.endsWith(".s"));
    expect(files.sort()).toEqual(Object.keys(expected).sort());
    expect(files.length).toBeGreaterThanOrEqual(15);
  });

  for (const [file, want] of Object.entries(expected)) {
    it(file, () => {
      const a = assembleRiscv(readFileSync(join(dir, file), "utf8"));
      expect(a.diagnostics).toEqual([]);
      const program = a.program;
      if (!program) throw new Error("no program");
      const r = runRv(createRvState(want.inputs), program);
      expect(r.reason).toBe("halted");
      expect(r.state.console).toBe(want.output);
      if (want.exitCode !== undefined) expect(r.state.exitCode).toBe(want.exitCode);
      expect(r.state.ended).toBe(
        want.ended ?? (want.exitCode !== undefined ? "exit with code" : "exit"),
      );
    });
  }
});

describe("instruction encodings", () => {
  const word = (src: string) => assembleRiscv(`.text\n${src}`).program?.text[0]?.word;

  it("matches the RV32I encodings", () => {
    expect(word("addi x1, x0, 5")).toBe(0x00500093);
    expect(word("add x3, x1, x2")).toBe(0x002081b3);
    expect(word("sub x3, x1, x2")).toBe(0x402081b3);
    expect(word("lw x5, 8(x2)")).toBe(0x00812283);
    expect(word("sw x5, 8(x2)")).toBe(0x00512423);
    expect(word("lui x5, 0x12345")).toBe(0x123452b7);
    expect(word("srai x1, x2, 3")).toBe(0x40315093);
    expect(word("ecall")).toBe(0x00000073);
    expect(assembleRiscv(".text\n  nop\n  jal x1, l\n  nop\nl: nop").program?.text[1]?.word).toBe(
      0x008000ef,
    );
    expect(assembleRiscv(".text\nl: beq x0, x0, l").program?.text[0]?.word).toBe(0x00000063);
    expect(assembleRiscv(".text\nl: nop\n  beq x0, x0, l").program?.text[1]?.word).toBe(0xfe000ee3);
    expect(assembleRiscv(".text\n  nop\nl: beq x0, x0, m\nm: nop").program?.text[1]?.word).toBe(
      0x00000263,
    );
  });

  it("decodes every word it encodes, for every instruction", () => {
    const src = [
      "add a0, a1, a2",
      "sub t0, t1, t2",
      "and s0, s1, s2",
      "or a0, a0, a0",
      "xor x31, x30, x29",
      "sll a0, a1, a2",
      "srl a0, a1, a2",
      "sra a0, a1, a2",
      "slt a0, a1, a2",
      "sltu a0, a1, a2",
      "addi a0, a1, -2048",
      "andi a0, a1, 2047",
      "ori a0, a1, 1",
      "xori a0, a1, -1",
      "slti a0, a1, 3",
      "sltiu a0, a1, 3",
      "slli a0, a1, 31",
      "srli a0, a1, 1",
      "srai a0, a1, 31",
      "lui a0, 1048575",
      "auipc a0, 1",
      "lw a0, -4(sp)",
      "lh a0, 2(sp)",
      "lhu a0, 2(sp)",
      "lb a0, 1(sp)",
      "lbu a0, 1(sp)",
      "sw a0, -8(sp)",
      "sh a0, 2(sp)",
      "sb a0, 1(sp)",
      "jalr ra, 4(t0)",
      "jalr ra, t0, 4",
      "ecall",
      "l: beq a0, a1, l",
      "bne a0, a1, l",
      "blt a0, a1, l",
      "bge a0, a1, l",
      "bltu a0, a1, l",
      "bgeu a0, a1, l",
      "jal ra, l",
      "jal l",
    ].join("\n");
    const p = assembleRiscv(`.text\n${src}`);
    expect(p.diagnostics).toEqual([]);
    for (const ins of p.program?.text ?? []) {
      const d = decode(ins.word);
      expect(d).not.toBeNull();
      if (d) expect(encode(d)).toBe(ins.word);
    }
    expect(decode(0xffffffff)).toBeNull();
    expect(decode(0x00100073)).toBeNull();
    expect(decode(0x0000707f)).toBeNull();
  });

  it("expands pseudo-instructions as RARS does", () => {
    const basic = (src: string) => assembleRiscv(`.text\n${src}`).program?.text.map((t) => t.basic);
    expect(basic("li t0, 0x12345FFF")).toEqual(["lui t0, 0x12346", "addi t0, t0, -1"]);
    expect(basic("li t0, 5")).toEqual(["addi t0, zero, 5"]);
    expect(basic("li t0, 0xFFFFFFFF")).toEqual(["addi t0, zero, -1"]);
    expect(basic("mv a0, a1\nnot a0, a1\nneg a0, a1\nnop\nret\njr t0")).toEqual([
      "addi a0, a1, 0",
      "xori a0, a1, -1",
      "sub a0, zero, a1",
      "addi zero, zero, 0",
      "jalr zero, 0(ra)",
      "jalr zero, 0(t0)",
    ]);
    expect(
      basic("l: beqz a0, l\nbnez a0, l\nbltz a0, l\nbgez a0, l\nbgtz a0, l\nblez a0, l"),
    ).toEqual([
      "beq a0, zero, 0x00400000",
      "bne a0, zero, 0x00400000",
      "blt a0, zero, 0x00400000",
      "bge a0, zero, 0x00400000",
      "blt zero, a0, 0x00400000",
      "bge zero, a0, 0x00400000",
    ]);
    expect(
      basic("l: bgt a0, a1, l\nble a0, a1, l\nbgtu a0, a1, l\nbleu a0, a1, l\nj l\ncall l"),
    ).toEqual([
      "blt a1, a0, 0x00400000",
      "bge a1, a0, 0x00400000",
      "bltu a1, a0, 0x00400000",
      "bgeu a1, a0, 0x00400000",
      "jal zero, 0x00400000",
      "jal ra, 0x00400000",
    ]);
    expect(show({ name: "auipc", rd: 5, rs1: 0, rs2: 0, imm: 0x1000 }, TEXT_BASE)).toBe(
      "auipc t0, 0x1",
    );
  });

  it("knows the register names", () => {
    expect(registerNumber("zero")).toBe(0);
    expect(registerNumber("fp")).toBe(8);
    expect(registerNumber("x31")).toBe(31);
    expect(registerNumber("x32")).toBeNull();
    expect(registerNumber("q1")).toBeNull();
  });
});

describe("the assembler explains mistakes", () => {
  const errors = (src: string) => assembleRiscv(src).diagnostics.map((d) => d.message);

  it("in plain language, with the line", () => {
    expect(errors("  addx a0, a1, a2")).toEqual([
      "Line 1: 'addx' is not a RISC-V instruction this machine knows.",
    ]);
    expect(errors("  add a0, a1")).toEqual([
      "Line 1: add needs 3 operands, separated by commas; this has 2.",
    ]);
    expect(errors("  add a0, a1, q2")[0]).toMatch(/'q2' is not a register/);
    expect(errors("  addi a0, a1, 5000")).toEqual([
      "Line 1: 5000 does not fit in a 12-bit value (-2048 to 2047).",
    ]);
    expect(errors("  addi a0, a1, x")).toEqual(["Line 1: 'x' is not a number."]);
    expect(errors("  slli a0, a1, 32")).toEqual(["Line 1: a shift amount must be 0 to 31."]);
    expect(errors("  beq a0, a1, nowhere")).toEqual([
      "Line 1: the label 'nowhere' is not defined.",
    ]);
    expect(errors("  lw a0, sp")[0]).toMatch(/should look like offset\(register\)/);
    expect(errors("  lw a0, 9999(sp)")[0]).toMatch(/offset 9999 does not fit/);
    expect(errors("  lw a0, 4(q)")[0]).toMatch(/'q' is not a register/);
    expect(errors("  lui a0, 2000000")[0]).toMatch(/upper immediate/);
    expect(errors("  li a0, 99999999999")[0]).toMatch(/not a 32-bit number/);
    expect(errors("  la a0, nowhere")[0]).toMatch(/not defined/);
    expect(errors("l: nop\nl: nop")).toEqual(["Line 2: the label 'l' is defined twice."]);
    expect(errors(".data\n  add a0, a0, a0")).toEqual([
      "Line 2: instructions belong in the .data section.".replace(".data", ".text"),
    ]);
    expect(errors(".text\n.word 5")).toEqual(["Line 2: .word belongs in the .data section."]);
    expect(errors(".foo")).toEqual(["Line 1: '.foo' is not a directive this machine knows."]);
    expect(errors(".data\n.align 9")[0]).toMatch(/power of two/);
    expect(errors(".data\n.space x")[0]).toMatch(/number of bytes/);
    expect(errors(".data\n.word")[0]).toMatch(/at least one value/);
    expect(errors(".data\n.asciz hello")[0]).toMatch(/double quotes/);
    expect(errors(".data\n.word nope")[0]).toMatch(/'nope' is not a number or a label/);
    const far = `.text\n  beq a0, a1, far\n${"  nop\n".repeat(1100)}far: nop`;
    expect(errors(far)[0]).toMatch(/too far away/);
  });
});

describe("running", () => {
  const prog = (src: string) => {
    const a = assembleRiscv(src);
    if (!a.program) throw new Error(JSON.stringify(a.diagnostics));
    return a.program;
  };

  it("reports each stage of an instruction", () => {
    const p = prog(
      ".data\nv: .word 9\n.text\n  la t0, v\n  lw a0, 0(t0)\n  addi a0, a0, 1\n  sw a0, 0(t0)\n  beq a0, a0, end\nend: li a7, 10\n  ecall",
    );
    let s = createRvState();
    const steps = [];
    for (let i = 0; i < 6; i++) {
      const r = stepRv(s, p);
      steps.push(r.step);
      s = r.state;
    }
    expect(steps[2]?.memory).toEqual({ address: 0x10010000, value: 9, size: 4, write: false });
    expect(steps[2]?.writeBack).toEqual({ rd: 10, value: 9 });
    expect(steps[3]?.execute).toEqual({ a: 9, b: 1, result: 10, operation: "addi" });
    expect(steps[4]?.memory).toEqual({ address: 0x10010000, value: 10, size: 4, write: true });
    expect(steps[5]?.execute.taken).toBe(true);
    expect(steps[5]?.text).toBe(`beq a0, a0, 0x${(TEXT_BASE + 24).toString(16).padStart(8, "0")}`);
  });

  it("keeps x0 at zero, and waits for input", () => {
    const p = prog(
      ".text\n  addi zero, zero, 5\n  li a7, 5\n  ecall\n  li a7, 1\n  ecall\n  li a7, 10\n  ecall",
    );
    const waiting = runRv(createRvState(), p);
    expect(waiting.reason).toBe("waiting-input");
    expect(waiting.state.regs[0]).toBe(0);
    const done = runRv({ ...waiting.state, inputs: [-3] }, p);
    expect(done.state.console).toBe("-3");
  });

  it("stops with a clear error on bad addresses and unknown system calls", () => {
    const err = (src: string) => runRv(createRvState(), prog(src)).state.error;
    expect(err(".text\n  li t0, 2\n  lw a0, 0(t0)")).toMatch(
      /0x00000002 is not aligned to a word boundary/,
    );
    expect(err(".text\n  li t0, 3\n  lh a0, 0(t0)")).toMatch(/halfword boundary/);
    expect(err(".text\n  li t0, 0\n  lb a0, 0(t0)")).toMatch(
      /outside the data, heap and stack segments/,
    );
    expect(err(".text\n  lui t0, 0x400\n  sw a0, 0(t0)")).toMatch(/Cannot write to 0x00400000/);
    expect(err(".text\n  li a7, 42\n  ecall")).toMatch(/ecall 42 \(in a7\) is not a system call/);
    expect(err(".text\n  li t0, 0x1000\n  jr t0")).toMatch(/jumped to 0x00001000/);
    const loop = runRv(createRvState(), prog(".text\nl: j l"), 100);
    expect(loop.reason).toBe("budget");
    const text = runRv(
      createRvState(),
      prog(".text\n  lui t0, 0x400\n  lw a0, 0(t0)\n  li a7, 10\n  ecall"),
    );
    expect(text.state.regs[10]).toBe(0x004002b7);
    const after = stepRv(
      runRv(createRvState(), prog(".text\n li a7, 10\n ecall")).state,
      prog(".text\n nop"),
    );
    expect(after.step).toBeNull();
  });
});

describe("more of the language", () => {
  const out = (src: string, inputs: number[] = []) => {
    const a = assembleRiscv(src);
    if (!a.program) throw new Error(JSON.stringify(a.diagnostics));
    return runRv(createRvState(inputs), a.program).state;
  };

  it("reads characters, escapes, hex and data directives", () => {
    const s = out(
      [
        ".data",
        's:  .asciz "a\\tb\\"c#\\q"',
        't:  .ascii "xy"',
        "    .byte 0",
        "    .align 2",
        "w:  .word -0x10",
        "sp1: .space 4",
        "h:  .half 5",
        ".text",
        "  la a0, s",
        "  li a7, 4",
        "  ecall",
        "  la a0, t",
        "  ecall",
        "  li a0, '\\n'",
        "  li a7, 11",
        "  ecall",
        "  li a0, 'A'",
        "  ecall",
        "  la t0, w",
        "  lw a0, 0(t0)",
        "  li a7, 1",
        "  ecall",
        "  la t0, h",
        "  lh a0, 0(t0)",
        "  ecall",
        "  li a7, 10",
        "  ecall",
      ].join("\n"),
    );
    expect(s.console).toBe('a\tb"c#qxy\nA-165');
  });

  it("stores halfwords and bytes, and branches on unsigned comparisons", () => {
    const s = out(
      [
        ".data",
        "buf: .word 0",
        ".text",
        "  la t0, buf",
        "  li t1, -1",
        "  sb t1, 0(t0)",
        "  sh t1, 2(t0)",
        "  lw a0, 0(t0)",
        "  li a7, 1",
        "  ecall",
        "  li t2, 1",
        "  sltu a0, t2, t1",
        "  ecall",
        "  slt a0, t1, t2",
        "  ecall",
        "  bne t1, t2, x",
        "  ecall",
        "x: bltu t2, t1, y",
        "  ecall",
        "y: bgeu t1, t2, z",
        "  ecall",
        "z: li a7, 10",
        "  ecall",
      ].join("\n"),
    );
    expect(s.console).toBe(`${0xffff00ff | 0}11`);
  });

  it("reports a misaligned store, and an instruction outside the subset", () => {
    const a = assembleRiscv(".text\n  li t0, 0x10010001\n  sw t0, 0(t0)");
    const r = runRv(createRvState(), a.program as NonNullable<typeof a.program>);
    expect(r.state.error).toMatch(/Store address 0x10010001 is not aligned to a word boundary/);
    expect(decode(0x02208033)).toBeNull();
    expect(assembleRiscv(".text\n  j").diagnostics[0]?.message).toBe(
      "Line 2: j needs 1 operand, separated by commas; this has 0.",
    );
  });
});
