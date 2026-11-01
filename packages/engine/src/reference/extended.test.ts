import { describe, expect, it } from "vitest";
import { assemble } from "../assembler/assemble";
import { run } from "../core/run";
import { createState } from "../core/state";
import { step } from "../core/step";
import { DIALECT_IDS } from "../dialects/dialects";
import { EXTENDED_REFERENCE_PROGRAMS } from "./extended";

for (const program of EXTENDED_REFERENCE_PROGRAMS) {
  describe(program.id, () => {
    for (const dialect of DIALECT_IDS) {
      const result = assemble(program.source, { dialect, machine: "extended" });

      it(`assembles cleanly in ${dialect}`, () => {
        expect(result.diagnostics).toEqual([]);
      });

      program.cases.forEach((c, i) => {
        const reason = c.reason ?? "halted";
        it(`[${dialect}] case ${i + 1} -> ${reason}`, () => {
          const p = result.program;
          if (!p) throw new Error("did not assemble");
          const initial = createState({
            memory: p.memory,
            inputs: c.inputs,
            dialect,
            machine: "extended",
            stackFloor: p.size,
            keys: c.keys ?? [],
          });
          const final = run(initial, { maxSteps: c.maxSteps ?? 100_000 });
          expect(final.reason).toBe(reason);
          if (c.outputs) expect(final.state.outputs.map((o) => o.value)).toEqual(c.outputs);
          if (c.check) expect(c.check(final.state)).not.toBe(false);

          // The micro-step machine must reach the very same state.
          let state = initial;
          while (state.status === "ready" && state.cycles < final.state.cycles) {
            state = step(state).state;
          }
          if (reason === "waiting-interrupt") state = step(state).state;
          expect(state).toEqual(final.state);
        });
      });
    }
  });
}
