import { describe, expect, it } from "vitest";
import { assemble } from "../assembler/assemble";
import { run } from "../core/run";
import { createState } from "../core/state";
import { step } from "../core/step";
import type { OutputItem } from "../core/types";
import { DIALECT_IDS } from "../dialects/dialects";
import { REFERENCE_PROGRAMS, type ExpectedOutput } from "./programs";

const asExpected = (outputs: readonly OutputItem[]): ExpectedOutput[] =>
  outputs.map((o) => (o.kind === "char" ? o.char : o.value));

describe("reference library", () => {
  it("has at least 30 programs with unique ids", () => {
    expect(REFERENCE_PROGRAMS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(REFERENCE_PROGRAMS.map((p) => p.id)).size).toBe(REFERENCE_PROGRAMS.length);
  });
});

for (const program of REFERENCE_PROGRAMS) {
  describe(program.id, () => {
    for (const dialect of DIALECT_IDS) {
      const result = assemble(program.source, { dialect });

      if (program.assemblyError?.dialects.includes(dialect)) {
        it(`fails to assemble in ${dialect} with ${program.assemblyError.code}`, () => {
          expect(result.ok).toBe(false);
          expect(result.diagnostics.map((d) => d.code)).toContain(program.assemblyError?.code);
        });
        continue;
      }

      it(`assembles cleanly in ${dialect}`, () => {
        expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
        expect(result.ok).toBe(true);
      });

      for (const c of program.cases) {
        if (c.only && !c.only.includes(dialect)) continue;
        const expected = { ...c, ...c.byDialect?.[dialect] };
        const reason = expected.reason ?? "halted";

        it(`[${dialect}] inputs ${JSON.stringify(c.inputs)} -> ${reason} ${JSON.stringify(expected.outputs)}`, () => {
          const memory = result.program?.memory ?? [];
          const final = run(createState({ memory, inputs: c.inputs, dialect }));
          expect(final.reason).toBe(reason);
          if (expected.outputs) expect(asExpected(final.state.outputs)).toEqual(expected.outputs);

          // The micro-step machine must reach the very same state.
          if (reason !== "infinite-loop") {
            let state = createState({ memory, inputs: c.inputs, dialect });
            for (let i = 0; i < 100_000 && state.status === "ready"; i++) state = step(state).state;
            expect(state).toEqual(final.state);
          }
        });
      }
    }
  });
}
