"use client";

import { RiscvWorkbench } from "@/riscv/RiscvWorkbench";

/** A RISC-V machine inside a lesson, set up by the lesson. */
export function RiscvSim({
  program,
  inputs,
  title,
}: {
  program: string;
  inputs?: string;
  title?: string;
}) {
  return (
    <div className="my-6 rounded-lg border border-border-strong bg-surface p-3">
      <RiscvWorkbench
        initial={program.replace(/^\n/, "")}
        inputs={inputs ?? ""}
        compact
        title={title ?? "Try it in RISC-V"}
      />
    </div>
  );
}
