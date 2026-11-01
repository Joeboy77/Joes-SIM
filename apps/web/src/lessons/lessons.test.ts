import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assemble, assembleRiscv, createRvState, runRv } from "@joes-sim/engine";
import { describe, expect, it } from "vitest";
import { LESSONS } from "./catalogue";
import { LESSON_CONTENT } from "./content";

const dir = join(__dirname, "content");

/** Every <LessonSim> in a lesson: its program, and the machine it runs on. */
function sims(slug: string) {
  const text = readFileSync(join(dir, `${slug}.mdx`), "utf8");
  return [...text.matchAll(/<LessonSim([\s\S]*?)\/>/g)].map(([, attrs = ""]) => ({
    program: /program=\{`([\s\S]*?)`\}/.exec(attrs)?.[1]?.replace(/^\n/, "") ?? "",
    machine: (/machine="(extended|multicore)"/.exec(attrs)?.[1] ?? "classic") as
      "classic" | "extended" | "multicore",
  }));
}

/** Every <RiscvSim> program in a lesson. */
function riscvSims(slug: string) {
  const text = readFileSync(join(dir, `${slug}.mdx`), "utf8");
  return [...text.matchAll(/<RiscvSim([\s\S]*?)\/>/g)].map(
    ([, attrs = ""]) => /program=\{`([\s\S]*?)`\}/.exec(attrs)?.[1]?.replace(/^\n/, "") ?? "",
  );
}

describe("lessons", () => {
  it("lists every lesson once, with its content and known prerequisites", () => {
    const slugs = LESSONS.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(Object.keys(LESSON_CONTENT).sort()).toEqual([...slugs].sort());
    for (const l of LESSONS) for (const p of l.prerequisites) expect(slugs).toContain(p);
  });

  it("every RISC-V program in a lesson assembles and finishes", () => {
    let count = 0;
    for (const lesson of LESSONS) {
      for (const src of riscvSims(lesson.slug)) {
        const r = assembleRiscv(src);
        expect(r.diagnostics).toEqual([]);
        if (r.program) expect(runRv(createRvState([3, 4]), r.program).reason).toBe("halted");
        count++;
      }
    }
    expect(count).toBeGreaterThanOrEqual(4);
  });

  for (const lesson of LESSONS) {
    it(`${lesson.slug}: every simulator program assembles on its machine`, () => {
      for (const s of sims(lesson.slug)) {
        const r = assemble(s.program, { dialect: lesson.dialect, machine: s.machine });
        expect(r.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
        if (lesson.machine) expect(s.machine).toBe(lesson.machine);
      }
    });
  }
});
