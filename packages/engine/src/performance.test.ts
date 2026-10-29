import { describe, expect, it } from "vitest";
import { assemble } from "./assembler/assemble";
import { run } from "./core/run";
import { createState } from "./core/state";

// Two nested counting loops: about six million instructions, then HLT.
const NESTED = `
outer   LDA zero
        STA i
inner   LDA i
        ADD one
        STA i
        SUB limit
        BRZ next
        BRA inner
next    LDA j
        ADD one
        STA j
        SUB limit
        BRZ done
        BRA outer
done    HLT
i       DAT 0
j       DAT 0
one     DAT 1
zero    DAT 0
limit   DAT 999
`;

const TARGET = 1_000_000; // instructions per second (brief, Phase 1)

function measure(detectLoops: boolean) {
  const memory = assemble(NESTED).program?.memory ?? [];
  run(createState({ memory }), { maxSteps: 200_000, detectLoops }); // warm up the JIT
  const start = performance.now();
  const result = run(createState({ memory }), { maxSteps: 10_000_000, detectLoops });
  const seconds = (performance.now() - start) / 1000;
  return { result, perSecond: result.state.cycles / seconds };
}

describe("performance", () => {
  for (const detectLoops of [false, true]) {
    it(`runs at least ${TARGET.toLocaleString("en")} instructions per second (loop detection ${detectLoops ? "on" : "off"})`, () => {
      const { result, perSecond } = measure(detectLoops);
      expect(result.reason).toBe("halted");
      expect(result.state.cycles).toBeGreaterThan(5_000_000);
      console.info(`${Math.round(perSecond).toLocaleString("en")} instructions per second`);
      expect(perSecond).toBeGreaterThan(TARGET);
    });
  }
});
