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
        const r = runChallenge(c.solution, c, {
          ...(c.cache ? { cache: c.cache.solution } : {}),
          ...(c.multicore?.chooseOrder ? { choices: c.multicore.chooseOrder.solution } : {}),
        });
        expect(r.results.filter((t) => !t.pass).map((t) => t.explanation)).toEqual([]);
        expect(r.scores).toEqual(c.targets);
      });

      it("starts from a program that assembles but does not pass yet", () => {
        const assembled = assemble(c.starter, {
          dialect: c.dialect,
          machine: c.machine ?? "classic",
        });
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

describe("running a challenge on the extended machine", () => {
  const byId = (id: string) => CHALLENGES.find((c) => c.id === id) as Challenge;
  const custom: Challenge = {
    ...byId("stack-reverse"),
    id: "custom",
    tests: [{ inputs: [], outputs: [], console: "Hi" }],
  };

  it("checks the console", () => {
    const r = runChallenge(
      "        LDA h\n        PUT 1\n        LDA o\n        PUT 1\n        HLT\nh       DAT 72\no       DAT 111",
      custom,
    );
    expect(r.results[0]?.explanation).toBe('The console shows "Ho"; the test expects "Hi".');
  });

  it("checks the pixel display", () => {
    const r = runChallenge("        HLT\nred     DAT 4", byId("red-line"));
    expect(r.results[0]?.explanation).toMatch(/0 pixels lit, not the 16/);
  });

  it("explains machine errors and waiting for a key", () => {
    const err = runChallenge("        POP\n        HLT", byId("stack-reverse")).results[0];
    expect(err?.explanation).toMatch(/stopped with an error: The stack is empty/);
    const wait = runChallenge("        EI\n        WAIT\n        HLT", byId("stack-reverse"))
      .results[0];
    expect(wait?.reason).toBe("waiting-interrupt");
    expect(wait?.explanation).toMatch(/still waiting for a key/);
  });
});

describe("pipeline and cache goals", () => {
  const byId = (id: string) => CHALLENGES.find((c) => c.id === id) as Challenge;

  it("passes the tests but misses the stall goal with the starter program", () => {
    const c = byId("no-stalls");
    const r = runChallenge(c.starter, c);
    expect(r.results.every((t) => t.pass)).toBe(true);
    expect(r.goal).toEqual({
      met: false,
      explanation:
        "The pipeline stalls for 1 cycle on one test; the goal is 0 or fewer. Look at the pipeline view to see where.",
    });
    expect(runChallenge(c.solution, c).goal?.met).toBe(true);
  });

  it("judges the cache the learner chose", () => {
    const c = byId("pick-a-cache");
    const start = runChallenge(c.solution, c);
    expect(start.passed).toBe(false);
    expect(start.goal?.explanation).toBe("The hit rate is 65.3%; the goal is at least 80.0%.");
    const big = runChallenge(c.solution, c, {
      cache: { blockSize: 4, sets: 4, ways: 1, replacement: "lru", write: "write-back" },
    });
    expect(big.goal?.explanation).toBe("This cache holds 16 mailboxes; the goal allows at most 8.");
    const bad = runChallenge(c.solution, c, {
      cache: { blockSize: 3, sets: 1, ways: 1, replacement: "lru", write: "write-back" },
    });
    expect(bad.goal?.met).toBe(false);
  });
});

describe("multicore challenges", () => {
  const byId = (id: string) => CHALLENGES.find((c) => c.id === id) as Challenge;

  it("the unlocked counter gives the wrong total under some schedules", () => {
    const c = byId("lock-the-counter");
    const r = runChallenge(c.starter, c);
    expect(r.results.some((t) => t.pass)).toBe(true);
    const failed = r.results.filter((t) => !t.pass);
    expect(failed.length).toBeGreaterThan(0);
    expect(failed[0]?.explanation).toMatch(/^total ended as [0-5]; the test expects 6\.$/);
  });

  it("the order of cores decides the lost update", () => {
    const c = byId("lost-update");
    expect(runChallenge(c.solution, c).passed).toBe(false);
    expect(runChallenge(c.solution, c, { choices: [0, 0, 0, 1, 1, 1] }).passed).toBe(false);
    expect(runChallenge(c.solution, c, { choices: [1, 0, 1, 0, 1, 0] }).passed).toBe(true);
  });
});

describe("edge cases of the runner", () => {
  const byId = (id: string) => CHALLENGES.find((c) => c.id === id) as Challenge;
  const ONE =
    "        LDA one\n        STA total\n        HLT\ncore1   HLT\ntotal   DAT 0\none     DAT 1";

  it("reports a mailbox the program has no label for, and runs without a multicore setting", () => {
    const base = byId("lost-update");
    const { multicore: _m, ...noCores } = base;
    void _m;
    const c: Challenge = {
      ...noCores,
      tests: [{ inputs: [], outputs: [], mailboxes: { missing: 1 } }],
    };
    expect(runChallenge(ONE, c).results[0]?.explanation).toBe(
      "The program has no mailbox labelled missing.",
    );
    const ok: Challenge = {
      ...noCores,
      tests: [{ inputs: [], outputs: [], mailboxes: { total: 1 } }],
    };
    expect(runChallenge(ONE, ok).passed).toBe(true);
  });

  it("explains the console on a machine with no devices, and a single lit pixel", () => {
    const c: Challenge = {
      ...byId("stack-reverse"),
      tests: [{ inputs: [], outputs: [], console: "x" }],
    };
    expect(
      runChallenge("        HLT", { ...c, machine: undefined } as unknown as Challenge).results[0]
        ?.explanation,
    ).toBe('The console shows ""; the test expects "x".');
    const red = byId("red-line");
    const one = runChallenge("        LDA red\n        PUT 11\n        HLT\nred     DAT 4", red);
    expect(one.results[0]?.explanation).toMatch(/1 pixel lit/);
  });

  it("reports a pipeline goal met with stalls to spare, and several tests' hit rates", () => {
    const c = byId("no-stalls");
    const loose = { ...c, pipeline: { forwarding: true, prediction: false, maxStalls: 3 } };
    expect(runChallenge(c.starter, loose).goal?.explanation).toBe(
      "The pipeline stalls for 1 cycle at most: the goal is 3 or fewer.",
    );
    const cache = byId("pick-a-cache");
    const twice = { ...cache, tests: [cache.tests[0], cache.tests[0]] as Challenge["tests"] };
    expect(runChallenge(cache.solution, twice).goal?.explanation).toMatch(/on the hardest test/);
  });
});
