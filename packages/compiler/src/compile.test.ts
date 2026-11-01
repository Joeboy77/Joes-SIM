import { createState, run, type DialectId } from "@joes-sim/engine";
import { describe, expect, it } from "vitest";
import { compile } from "./compile";

interface Case {
  readonly name: string;
  readonly source: string;
  readonly runs: readonly {
    readonly inputs: readonly number[];
    readonly outputs: readonly number[];
  }[];
  readonly dialect?: DialectId;
}

const p = (...lines: string[]) => lines.join("\n");

/** The test programs (brief, Phase 9: at least 25 compile and give the right output). */
export const PROGRAMS: readonly Case[] = [
  { name: "echo", source: p("input x", "print x"), runs: [{ inputs: [7], outputs: [7] }] },
  { name: "constant", source: p("print 42"), runs: [{ inputs: [], outputs: [42] }] },
  {
    name: "add two numbers",
    source: p("input a", "input b", "print a + b"),
    runs: [{ inputs: [3, 4], outputs: [7] }],
  },
  {
    name: "subtract",
    source: p("input a", "input b", "print a - b"),
    runs: [{ inputs: [9, 4], outputs: [5] }],
    dialect: "higginson",
  },
  {
    name: "longer sum",
    source: p("input a", "input b", "input c", "s = a + b + c - 1", "print s"),
    runs: [{ inputs: [1, 2, 3], outputs: [5] }],
  },
  {
    name: "parentheses",
    source: p("input a", "input b", "input c", "print a - (b + c)"),
    runs: [{ inputs: [10, 2, 3], outputs: [5] }],
  },
  {
    name: "nested parentheses",
    source: p("input a", "print (a + 1) - (a - (2 + a))"),
    runs: [{ inputs: [5], outputs: [8] }],
  },
  {
    name: "unary minus",
    source: p("input a", "print -a + 10"),
    runs: [{ inputs: [3], outputs: [7] }],
    dialect: "higginson",
  },
  {
    name: "negative result",
    source: p("input a", "print 0 - a", "print -(a + 1)"),
    runs: [{ inputs: [4], outputs: [-4, -5] }],
    dialect: "higginson",
  },
  {
    name: "multiply",
    source: p("input a", "input b", "print a * b"),
    runs: [
      { inputs: [6, 7], outputs: [42] },
      { inputs: [9, 0], outputs: [0] },
    ],
  },
  {
    name: "divide and remainder",
    source: p("input a", "input b", "print a / b", "print a % b"),
    runs: [
      { inputs: [17, 5], outputs: [3, 2] },
      { inputs: [4, 9], outputs: [0, 4] },
      { inputs: [8, 0], outputs: [0, 0] },
    ],
  },
  {
    name: "precedence",
    source: p("input a", "print a + 2 * 3", "print (a + 2) * 3", "print a * 2 + a / 2"),
    runs: [{ inputs: [4], outputs: [10, 18, 10] }],
  },
  {
    name: "if equal",
    source: p("input a", "input b", "if a == b then", "  print 1", "else", "  print 0", "end"),
    runs: [
      { inputs: [5, 5], outputs: [1] },
      { inputs: [5, 6], outputs: [0] },
    ],
  },
  {
    name: "if not equal, no else",
    source: p("input a", "if a != 0 then", "  print a", "end", "print 9"),
    runs: [
      { inputs: [3], outputs: [3, 9] },
      { inputs: [0], outputs: [9] },
    ],
  },
  {
    name: "less than",
    source: p("input a", "input b", "if a < b then", "  print a", "else", "  print b", "end"),
    runs: [
      { inputs: [2, 8], outputs: [2] },
      { inputs: [8, 2], outputs: [2] },
      { inputs: [4, 4], outputs: [4] },
    ],
  },
  {
    name: "greater than",
    source: p("input a", "input b", "if a > b then", "  print 1", "else", "  print 0", "end"),
    runs: [
      { inputs: [9, 3], outputs: [1] },
      { inputs: [3, 9], outputs: [0] },
      { inputs: [5, 5], outputs: [0] },
    ],
  },
  {
    name: "greater or equal",
    source: p("input a", "input b", "if a >= b then", "  print 1", "else", "  print 0", "end"),
    runs: [
      { inputs: [9, 3], outputs: [1] },
      { inputs: [3, 9], outputs: [0] },
      { inputs: [5, 5], outputs: [1] },
    ],
  },
  {
    name: "less or equal",
    source: p("input a", "input b", "if a <= b then", "  print 1", "else", "  print 0", "end"),
    runs: [
      { inputs: [9, 3], outputs: [0] },
      { inputs: [3, 9], outputs: [1] },
      { inputs: [5, 5], outputs: [1] },
    ],
  },
  {
    name: "signed comparison",
    source: p("input a", "if a < 0 then", "  print 0 - a", "else", "  print a", "end"),
    runs: [
      { inputs: [-7], outputs: [7] },
      { inputs: [7], outputs: [7] },
    ],
    dialect: "higginson",
  },
  {
    name: "countdown",
    source: p("input n", "while n > 0 do", "  print n", "  n = n - 1", "end"),
    runs: [
      { inputs: [3], outputs: [3, 2, 1] },
      { inputs: [0], outputs: [] },
    ],
  },
  {
    name: "sum 1 to n",
    source: p(
      "input n",
      "s = 0",
      "i = 1",
      "while i <= n do",
      "  s = s + i",
      "  i = i + 1",
      "end",
      "print s",
    ),
    runs: [
      { inputs: [10], outputs: [55] },
      { inputs: [0], outputs: [0] },
    ],
  },
  {
    name: "maximum of inputs until 0",
    source: p(
      "m = 0",
      "input x",
      "while x != 0 do",
      "  if x > m then",
      "    m = x",
      "  end",
      "  input x",
      "end",
      "print m",
    ),
    runs: [{ inputs: [4, 9, 2, 0], outputs: [9] }],
  },
  {
    name: "nested loops: times table",
    source: p(
      "i = 1",
      "while i <= 3 do",
      "  j = 1",
      "  while j <= 2 do",
      "    print i * j",
      "    j = j + 1",
      "  end",
      "  i = i + 1",
      "end",
    ),
    runs: [{ inputs: [], outputs: [1, 2, 2, 4, 3, 6] }],
  },
  {
    name: "factorial",
    source: p("input n", "f = 1", "while n > 1 do", "  f = f * n", "  n = n - 1", "end", "print f"),
    runs: [
      { inputs: [5], outputs: [120] },
      { inputs: [1], outputs: [1] },
    ],
  },
  {
    name: "fibonacci",
    source: p(
      "input n",
      "a = 0",
      "b = 1",
      "while n > 0 do",
      "  print a",
      "  c = a + b",
      "  a = b",
      "  b = c",
      "  n = n - 1",
      "end",
    ),
    runs: [{ inputs: [7], outputs: [0, 1, 1, 2, 3, 5, 8] }],
  },
  {
    name: "greatest common divisor",
    source: p(
      "input a",
      "input b",
      "while b != 0 do",
      "  t = a % b",
      "  a = b",
      "  b = t",
      "end",
      "print a",
    ),
    runs: [{ inputs: [48, 36], outputs: [12] }],
  },
  {
    name: "even or odd",
    source: p("input n", "if n % 2 == 0 then", "  print 0", "else", "  print 1", "end"),
    runs: [
      { inputs: [8], outputs: [0] },
      { inputs: [7], outputs: [1] },
    ],
  },
  {
    name: "digits of a number",
    source: p("input n", "print n / 100", "print n / 10 % 10", "print n % 10"),
    runs: [{ inputs: [472], outputs: [4, 7, 2] }],
  },
  {
    name: "names that are LMC mnemonics",
    source: p("input out", "add = out + 1", "print add", "t1 = 3", "print t1"),
    runs: [{ inputs: [4], outputs: [5, 3] }],
  },
  {
    name: "comments and blank lines",
    source: p("# a comment", "", "input x   // read it", "", "print x # and show it"),
    runs: [{ inputs: [2], outputs: [2] }],
  },
];

const TARGETS: ("classic" | "extended")[] = ["classic", "extended"];

describe("compiling and running the test programs", () => {
  it("has at least 25 programs", () => {
    expect(PROGRAMS.length).toBeGreaterThanOrEqual(25);
  });

  for (const prog of PROGRAMS) {
    for (const target of TARGETS) {
      for (const optimise of [false, true]) {
        it(`${prog.name} (${target}${optimise ? ", optimised" : ""})`, () => {
          const dialect = prog.dialect ?? "classic";
          const r = compile(prog.source, { target, optimise, dialect });
          expect(r.errors).toEqual([]);
          const program = r.program;
          if (!program) throw new Error("no program");
          for (const c of prog.runs) {
            const out = run(
              createState({ memory: program.memory, inputs: c.inputs, dialect, machine: target }),
              { maxSteps: 200_000 },
            );
            expect(out.reason).toBe("halted");
            expect(out.state.outputs.map((o) => o.value)).toEqual(c.outputs);
          }
          // Every generated instruction maps back to a source line.
          program.kinds.forEach((kind, a) => {
            if (kind === "code" || kind === "operand") expect(r.addressToSource[a]).not.toBeNull();
          });
          r.lines.forEach((l) => {
            if (l.instruction) expect(l.source).not.toBeNull();
          });
        });
      }
    }
  }
});

describe("the generated code", () => {
  it("is readable: each statement is introduced by its source line", () => {
    const r = compile(p("input n", "while n > 0 do", "  n = n - 1", "end"));
    expect(r.lmc).toBe(
      [
        "// 1: input n",
        "          INP",
        "          STA  n",
        "",
        "// 2: while n > 0 do",
        "while1    LDA  n",
        "          SUB  zero",
        "          BRZ  endwhile1",
        "          BRP  yes2",
        "          BRA  endwhile1",
        "",
        "// 3: n = n - 1",
        "yes2      LDA  n",
        "          SUB  one",
        "          STA  n",
        "          BRA  while1",
        "endwhile1 HLT",
        "",
        "// Variables, constants and working mailboxes",
        "n         DAT  0",
        "zero      DAT  0",
        "one       DAT  1",
        "",
      ].join("\n"),
    );
  });

  it("maps source lines to mailboxes and back", () => {
    const r = compile(p("input a", "print a + 1"));
    // INP, STA a, then LDA a, ADD one, OUT, HLT; then a (line 1) and one (line 2).
    expect(r.sourceToAddresses[0]).toEqual([0, 1, 6]);
    expect(r.sourceToAddresses[1]).toEqual([2, 3, 4, 5, 7]);
    expect(r.addressToSource.slice(0, 8)).toEqual([1, 1, 2, 2, 2, 2, 1, 2]);
    expect(r.sourceToLines[0]?.length).toBeGreaterThan(0);
  });

  it("optimising folds constants and drops reloads", () => {
    const source = p("x = 2 + 3 * 4", "print x", "y = -5 + 9", "print y");
    const plain = compile(source);
    const fast = compile(source, { optimise: true });
    expect(fast.instructions).toBeLessThan(plain.instructions);
    expect(fast.lmc).toContain("LDA  c14");
    expect(fast.lmc).not.toMatch(/STA {2}x\n\s+LDA {2}x/);
  });

  it("uses one shared subroutine for multiplication on the extended target", () => {
    const source = p("input a", "print a * a", "print a * 3");
    const ext = compile(source, { target: "extended" });
    expect(ext.lmc.match(/CALL mul/g)).toHaveLength(2);
    expect(ext.lmc.match(/^mul /m)).not.toBeNull();
    const classic = compile(source);
    expect(classic.instructions).toBeGreaterThan(ext.instructions);
  });
});

describe("errors in plain language", () => {
  const errors = (source: string) => compile(source).errors.map((e) => e.message);

  it("explains each mistake", () => {
    expect(errors("while x > 0\n  x = x - 1\nend")).toEqual([
      "Line 1: 'while' needs 'do' after its condition.",
    ]);
    expect(errors("end")).toEqual(["Line 1: This 'end' does not close an 'if' or a 'while'."]);
    expect(errors("print y")).toEqual([
      "Line 1: 'y' is used but never given a value. Set it with 'y = ...' or 'input y' first.",
    ]);
    expect(errors("if x = 1 then\nend\nx = 1")).toEqual([
      "Line 1: Use '==' to compare in an if condition; '=' sets a variable.",
    ]);
    expect(errors("x = 1\nif x > 0 then\n  print x")).toEqual([
      "Line 2: this 'if' has no 'end'. Add 'end' after its last statement.",
    ]);
    expect(errors("x = 1\nelse")).toEqual(["Line 2: This 'else' does not belong to an 'if'."]);
    expect(errors("x = (1 + 2")).toEqual(["Line 1: A '(' is not closed: add ')'."]);
    expect(errors("x = 1 +")).toEqual(["Line 1: A value is missing at the end of the line."]);
    expect(errors("x = 5 $")).toEqual(["Line 1: '$' is not part of the Little Language."]);
    expect(errors("x = 5 6")).toEqual(["Line 1: Unexpected '6' after the end of the statement."]);
    expect(errors("print 1000")).toEqual(["Line 1: 1000 does not fit in a mailbox (0 to 999)."]);
    expect(errors("hello")).toEqual([
      "Line 1: 'hello' is not a statement. To set a variable write 'hello = ...'; the statements are input, print, if and while.",
    ]);
    expect(errors("then")).toEqual(["Line 1: 'then' cannot start a statement here."]);
    expect(errors("= 5")).toEqual(["Line 1: A statement cannot start with '='."]);
    expect(errors("input 5")).toEqual([
      "Line 1: input needs the name of a variable, for example 'input x'.",
    ]);
    expect(errors("x = then")).toEqual([
      "Line 1: Expected a number, a name or '(' here, not the keyword 'then'.",
    ]);
    expect(errors("x = 1\nif x > 0\nend")).toEqual([
      "Line 2: 'if' needs 'then' after its condition.",
    ]);
    expect(errors("x = 1\nif x\nend")).toEqual([
      "Line 2: The if condition needs a comparison: ==, !=, <, <=, > or >=.",
    ]);
  });

  it("reports a program too big for 100 mailboxes", () => {
    const source = Array.from({ length: 40 }, (_, i) => `x${i} = ${i} + 1`).join("\n");
    const r = compile(source);
    expect(r.ok).toBe(false);
    expect(r.errors[0]?.message).toMatch(/needs more than 100 mailboxes/);
  });
});

describe("more cases", () => {
  const out = (
    source: string,
    inputs: number[] = [],
    optimise = false,
    dialect: "classic" | "higginson" = "higginson",
  ) => {
    const r = compile(source, { optimise, dialect });
    if (!r.program) throw new Error(JSON.stringify(r.errors));
    return run(createState({ memory: r.program.memory, inputs, dialect }), {
      maxSteps: 50_000,
    }).state.outputs.map((o) => o.value);
  };

  it("folds every operator, and leaves what does not fit", () => {
    const src = p(
      "print 7 - 2",
      "print 9 / 2",
      "print 9 % 4",
      "print 9 % 0",
      "print -(3)",
      "print 500 + 600",
      "print 2 - 5",
    );
    expect(out(src, [], true)).toEqual([5, 4, 1, 0, -3, 100, -3]);
    expect(compile(src, { optimise: true, dialect: "higginson" }).lmc).toContain("cm3");
  });

  it("negates an expression, and nests ifs that end together", () => {
    const src = p(
      "input x",
      "print -(x + 1)",
      "if x > 0 then",
      "  if x > 5 then",
      "    print 2",
      "  end",
      "end",
      "if x == 3 then",
      "  print 3",
      "else",
      "end",
    );
    expect(out(src, [3])).toEqual([-4, 3]);
    expect(out(src, [9])).toEqual([-10, 2]);
    // An empty else: the jump over it goes straight to the next line, so optimising drops it.
    const plain = compile(src, { dialect: "higginson" });
    const fast = compile(src, { optimise: true, dialect: "higginson" });
    expect(fast.instructions).toBeLessThan(plain.instructions);
    expect(out(src, [3], true)).toEqual([-4, 3]);
  });

  it("points at what is missing or wrong in each kind of statement", () => {
    const errors = (source: string) => compile(source).errors.map((e) => e.message);
    expect(errors("input")).toEqual([
      "Line 1: input needs the name of a variable, for example 'input x'.",
    ]);
    expect(errors("x = 1\nif x > 0 hello\nend")).toEqual([
      "Line 2: 'if' needs 'then' after its condition.",
    ]);
    expect(errors("hello 5")[0]).toMatch(/'hello' is not a statement/);
    expect(errors("x = )")).toEqual(["Line 1: Expected a number, a name or '(' here, not ')'."]);
    expect(errors("x = (1")).toEqual(["Line 1: A '(' is not closed: add ')'."]);
  });
});
