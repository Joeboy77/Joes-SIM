import { assemble } from "@joes-sim/engine";
import { describe, expect, it } from "vitest";
import { CHALLENGES } from "./library";
import { meetsTargets, runChallenge, TEST_STEP_LIMIT } from "./run";
import { CONCEPTS, type Challenge } from "./types";

describe("the challenge library", () => {
  it("has at least 40 challenges with unique ids", () => {
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
  });

  it("covers every concept tag, every difficulty and some bug hunts", () => {
    const tags = new Set(CHALLENGES.flatMap((c) => c.concepts));
    expect([...CONCEPTS].filter((t) => !tags.has(t))).toEqual([]);
    expect(new Set(CHALLENGES.map((c) => c.difficulty))).toEqual(new Set([1, 2, 3, 4, 5]));
    const bugs = CHALLENGES.filter((c) => c.kind === "bug-hunt");
    expect(bugs.length).toBeGreaterThanOrEqual(5);
    for (const b of bugs) expect(b.concepts).toContain("debugging");
  });

  for (const c of CHALLENGES) {
    describe(c.id, () => {
      it("has a model solution that passes every test and meets the targets exactly", () => {
        const r = runChallenge(c.solution, c);
        expect(r.results.filter((t) => !t.pass).map((t) => t.explanation)).toEqual([]);
        expect(r.scores).toEqual(c.targets);
      });

      it("starts from a program that assembles but does not pass yet", () => {
        const assembled = assemble(c.starter, { dialect: c.dialect });
        expect(assembled.ok).toBe(true);
        expect(runChallenge(c.starter, c).passed).toBe(false);
      });

      it("is complete", () => {
        expect(c.title.length).toBeGreaterThan(2);
        expect(c.description).toMatch(/[.!?]$/);
        expect(c.hints).toHaveLength(3);
        expect(c.tests.length).toBeGreaterThan(0);
        expect(c.concepts.length).toBeGreaterThan(0);
      });
    });
  }
});

const add = CHALLENGES.find((c) => c.id === "sum-two-numbers") as Challenge;

describe("running a challenge", () => {
  it("reports assembly errors without running any tests", () => {
    const r = runChallenge("        LDR 5", add);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.results).toEqual([]);
    expect(r.passed).toBe(false);
    expect(r.scores).toBeNull();
  });

  it("finds the step where the output first goes wrong", () => {
    // Outputs the first number, then the sum: the first output is already wrong.
    const r = runChallenge(
      "        INP\n        OUT\n        STA a\n        INP\n        ADD a\n        OUT\n        HLT\na       DAT",
      add,
    );
    const [first] = r.results;
    expect(first?.pass).toBe(false);
    expect(first?.difference).toEqual({ index: 0, cycle: 2 });
    expect(first?.explanation).toBe("It output 3, 7; the test expects 7.");
  });

  it("points to the end of the run when an output is missing", () => {
    const r = runChallenge("        INP\n        INP\n        HLT", add);
    expect(r.results[0]?.difference).toEqual({ index: 0, cycle: 3 });
    expect(r.results[0]?.explanation).toBe("It output nothing; the test expects 7.");
  });

  it("explains each way a run can fail", () => {
    const waits = runChallenge("        INP\n        INP\n        INP\n        HLT", add)
      .results[0];
    expect(waits?.reason).toBe("waiting-input");
    expect(waits?.explanation).toMatch(/asked for more inputs/);
    const loops = runChallenge("loop    BRA loop", add).results[0];
    expect(loops?.explanation).toMatch(/stuck in a loop/);
    const bad = runChallenge("        INP\n        DAT 400", add).results[0];
    expect(bad?.explanation).toMatch(/not an instruction/);
    // Two counters, like an odometer: millions of steps before any state repeats.
    const long = runChallenge(
      "loop    LDA a\n        ADD one\n        STA a\n        BRZ carry\n        BRA loop\ncarry   LDA b\n        ADD one\n        STA b\n        BRA loop\na       DAT 0\nb       DAT 0\none     DAT 1",
      add,
    ).results[0];
    expect(long?.reason).toBe("budget");
    expect(long?.explanation).toContain(TEST_STEP_LIMIT.toLocaleString("en"));
  });

  it("compares characters from OTC", () => {
    const hi = CHALLENGES.find((c) => c.id === "say-hi") as Challenge;
    const wrong = runChallenge("        LDA i\n        OTC\n        HLT\ni       DAT 73", hi)
      .results[0];
    expect(wrong?.explanation).toBe("It output 'I'; the test expects 'H', 'I'.");
  });

  it("says which targets a score meets", () => {
    expect(meetsTargets({ instructions: 6, cycles: 7, mailboxes: 7 }, add.targets)).toEqual({
      instructions: true,
      cycles: false,
      mailboxes: true,
    });
  });
});
