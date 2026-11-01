"use client";

import { useSyncExternalStore } from "react";
import { RiscvWorkbench } from "./RiscvWorkbench";

export const RISCV_STARTER = `# Add the numbers from 1 to n, then print the total
.text
        li   a7, 5          # read n
        ecall
        mv   t2, a0
        li   t0, 0          # total
        li   t1, 1          # i
loop:   bgt  t1, t2, done   # stop when i > n
        add  t0, t0, t1
        addi t1, t1, 1
        j    loop
done:   mv   a0, t0
        li   a7, 1          # print the total
        ecall
        li   a7, 10         # exit
        ecall
`;

const KEY = "joes-sim-riscv";
const subscribe = () => () => undefined;

function saved(): string {
  try {
    return window.localStorage.getItem(KEY) ?? RISCV_STARTER;
  } catch {
    return RISCV_STARTER;
  }
}

function save(source: string) {
  try {
    window.localStorage.setItem(KEY, source);
  } catch {
    // Storage can be unavailable; the program still works for this visit.
  }
}

/** The RISC-V page: the learner's program, kept in this browser between visits. */
export function RiscvPage() {
  const browser = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!browser) return <p className="text-muted">Loading the RISC-V machine…</p>;
  return <RiscvWorkbench initial={saved()} inputs="10" onSource={save} />;
}
