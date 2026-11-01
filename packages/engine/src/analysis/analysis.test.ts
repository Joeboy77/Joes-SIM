import { describe, expect, it } from "vitest";
import { assemble } from "../assembler/assemble";
import type { Program } from "../assembler/types";
import { run } from "../core/run";
import { createState } from "../core/state";
import { REFERENCE_PROGRAMS } from "../reference/programs";
import { buildCfg } from "./cfg";
import { analyse, type FindingCode } from "./detectors";
import { measure, measureRun } from "./metrics";

const EXTENDED = /\b(PUSH|POP|CALL|RET|EI|VEC|WAIT|RTI)\b/;
const program = (source: string): Program => {
  const machine = EXTENDED.test(source) ? "extended" : "classic";
  const r = assemble(source, { dialect: "higginson", machine });
  if (!r.program) throw new Error(JSON.stringify(r.diagnostics));
  return r.program;
};
const found = (source: string, inputs?: number[]): FindingCode[] =>
  analyse(program(source), inputs ? { inputs } : {}).map((f) => f.code);

/** Each detector: two programs that trigger it and one that does not. */
const CASES: Record<
  FindingCode,
  { triggers: [string, string]; clean: string; inputs?: number[][] }
> = {
  "no-halt": {
    triggers: [
      "        INP\n        OUT",
      "loop    INP\n        OUT\n        BRZ loop\nx       DAT 0",
    ],
    clean: "        INP\n        OUT\n        HLT",
  },
  "runs-into-data": {
    triggers: [
      "        INP\n        OUT\nx       DAT 5",
      "        LDA x\nx       DAT 5\n        OUT\n        HLT",
    ],
    clean: "        LDA x\n        OUT\n        HLT\nx       DAT 5",
  },
  "runs-past-end": {
    triggers: ["        INP\n        OUT", "        INP\n        BRZ 20\n        HLT"],
    clean: "        INP\n        BRZ end\nend     HLT",
  },
  "uninitialised-read": {
    triggers: [
      "        LDA 50\n        OUT\n        HLT",
      "        LDA x\n        OUT\n        HLT\nx       DAT",
    ],
    clean: "        INP\n        STA x\n        LDA x\n        OUT\n        HLT\nx       DAT",
  },
  "unreachable-code": {
    triggers: [
      "        HLT\n        OUT",
      "        BRA end\n        OUT\n        OUT\nend     HLT",
    ],
    clean: "        INP\n        BRZ end\n        OUT\nend     HLT",
  },
  "cannot-halt": {
    triggers: [
      "loop    BRA loop\n        HLT",
      "        INP\n        BRZ spin\n        HLT\nspin    OUT\n        BRA spin",
    ],
    clean: "loop    INP\n        BRZ done\n        BRA loop\ndone    HLT",
  },
  "not-enough-inputs": {
    triggers: [
      "        INP\n        INP\n        HLT",
      "        INP\n        BRZ end\n        INP\nend     INP\n        HLT",
    ],
    clean: "        INP\n        INP\n        HLT",
    inputs: [[1], [], [1, 2]],
  },
  "inputs-unused": {
    triggers: ["        INP\n        HLT", "        LDA x\n        HLT\nx       DAT 1"],
    clean: "        INP\n        INP\n        HLT",
    inputs: [[1, 2, 3], [4], [1, 2]],
  },
  "ret-outside-subroutine": {
    triggers: ["        INP\n        RET", "        CALL s\ns       OUT\n        RET"],
    clean: "        CALL s\n        HLT\ns       OUT\n        RET",
  },
  "call-without-ret": {
    triggers: [
      "        CALL s\n        HLT\ns       OUT\n        HLT",
      "        CALL s\n        HLT\ns       BRA s",
    ],
    clean: "        CALL s\n        HLT\ns       OUT\n        RET",
  },
  "ei-without-vec": {
    triggers: ["        EI\n        HLT", "        EI\nl       WAIT\n        BRA l"],
    clean: "        VEC h\n        EI\n        HLT\nh       RTI",
  },
  "push-without-pop": {
    triggers: ["        PUSH\n        HLT", "        INP\n        PUSH\n        PUSH\n        HLT"],
    clean: "        PUSH\n        POP\n        HLT",
  },
};

describe("mistake detectors", () => {
  for (const [code, c] of Object.entries(CASES) as [FindingCode, (typeof CASES)[FindingCode]][]) {
    describe(code, () => {
      c.triggers.forEach((source, i) => {
        it(`finds it in example ${i + 1}`, () => {
          expect(found(source, c.inputs?.[i])).toContain(code);
        });
      });
      it("stays quiet on a correct program", () => {
        expect(found(c.clean, c.inputs?.[2])).not.toContain(code);
      });
    });
  }

  it("gives three tiers of hints and links to the line", () => {
    const [finding] = analyse(program("        LDA x\n        OUT\n        HLT\nx       DAT"));
    expect(finding?.hints).toHaveLength(3);
    expect(finding?.line).toBe(1);
    expect(finding?.address).toBe(0);
  });

  it("does not run a self-modifying program's placeholder as data", () => {
    const sum = REFERENCE_PROGRAMS.find((p) => p.id === "array-sum");
    const codes = analyse(program(sum?.source ?? "")).map((f) => f.code);
    expect(codes).not.toContain("runs-into-data");
    expect(codes).not.toContain("cannot-halt");
  });

  it("says when the whole program cannot stop, or only part of it", () => {
    const whole = analyse(program("loop    BRA loop")).find((f) => f.code === "cannot-halt");
    expect(whole?.message).toMatch(/can never stop: no path/);
    const part = analyse(
      program("        INP\n        BRZ spin\n        HLT\nspin    BRA spin"),
    ).find((f) => f.code === "cannot-halt");
    expect(part?.message).toMatch(/mailbox 03/);
  });

  it("explains running past the end into a DAT and a DAT in the middle", () => {
    const end = analyse(program("        OUT\nx       DAT 5")).find(
      (f) => f.code === "runs-into-data",
    );
    expect(end?.message).toMatch(/runs past its last instruction/);
    const middle = analyse(program("x       DAT 5\n        HLT")).find(
      (f) => f.code === "runs-into-data",
    );
    expect(middle?.message).toMatch(/sits where the program will run it/);
  });

  it("skips input counts when loops decide them", () => {
    expect(found("loop    INP\n        BRZ end\n        BRA loop\nend     HLT", [])).toEqual([]);
  });

  it("expects no HLT and no way out in a program driven by interrupts", () => {
    const codes = found("        VEC h\n        EI\nidle    WAIT\n        BRA idle\nh       RTI");
    expect(codes).toEqual([]);
  });

  it("does not run an instruction's address as code", () => {
    const p = program("        CALL s\n        HLT\ns       RET");
    const cfg = buildCfg(p.memory, p.dialect, true);
    expect(cfg.reachable.slice(0, 4)).toEqual([true, false, true, true]);
    expect(cfg.blocks[0]?.exit).toBe("call");
  });

  it("reports nothing for an empty program", () => {
    expect(found("")).toEqual([]);
  });

  it("reports nothing wrong in the clean reference programs", () => {
    for (const id of ["add", "multiply", "divide", "gcd", "fibonacci", "sort-three"]) {
      const p = REFERENCE_PROGRAMS.find((r) => r.id === id);
      expect(found(p?.source ?? ""), id).toEqual([]);
    }
  });
});

describe("control-flow graph", () => {
  it("splits code into blocks joined by branches and finds the loop", () => {
    const p = program(`
loop    INP
        BRZ done
        OUT
        BRA loop
done    HLT
`);
    const cfg = buildCfg(p.memory, p.dialect);
    expect(cfg.blocks.map((b) => b.addresses)).toEqual([[0, 1], [2, 3], [4]]);
    expect(cfg.blocks.map((b) => b.exit)).toEqual(["branch", "jump", "halt"]);
    expect(cfg.edges).toEqual([
      { from: 0, to: 1, kind: "not-taken" },
      { from: 0, to: 2, kind: "taken" },
      { from: 1, to: 0, kind: "jump" },
    ]);
    expect(cfg.loops).toEqual([{ header: 0, latch: 1, body: [0, 1] }]);
    expect(cfg.blockOf.slice(0, 6)).toEqual([0, 0, 1, 1, 2, null]);
  });

  it("starts a new block where a branch lands mid-run", () => {
    const p = program("        INP\nmid     OUT\n        BRZ mid\n        HLT");
    const cfg = buildCfg(p.memory, p.dialect);
    expect(cfg.blocks.map((b) => b.addresses)).toEqual([[0], [1, 2], [3]]);
    expect(cfg.blocks[0]?.exit).toBe("fallthrough");
  });

  it("marks invalid instructions as a stopping point", () => {
    const p = program("        DAT 400");
    expect(buildCfg(p.memory, p.dialect).blocks[0]?.exit).toBe("invalid");
  });
});

describe("metrics", () => {
  it("counts instructions, data and cycles", () => {
    const p = program(
      "        INP\n        STA x\n        INP\n        ADD x\n        OUT\n        HLT\nx       DAT",
    );
    expect(measure(p)).toEqual({ instructions: 6, data: 1, mailboxes: 7 });
    const final = run(
      createState({ memory: p.memory, inputs: [3, 4], dialect: "higginson" }),
    ).state;
    expect(measureRun(p, final)).toEqual({
      instructions: 6,
      data: 1,
      mailboxes: 7,
      cycles: 6,
      microSteps: 40,
    });
  });
});
