import type { ComponentType } from "react";

/** Each lesson's content, loaded only when its page is built. */
export const LESSON_CONTENT: Record<string, () => Promise<{ default: ComponentType }>> = {
  "what-is-a-computer": () => import("./what-is-a-computer.mdx"),
  "meet-the-little-man": () => import("./meet-the-little-man.mdx"),
  "fetch-decode-execute": () => import("./fetch-decode-execute.mdx"),
  "input-and-output": () => import("./input-and-output.mdx"),
  "keeping-numbers": () => import("./keeping-numbers.mdx"),
  arithmetic: () => import("./arithmetic.mdx"),
  decisions: () => import("./decisions.mdx"),
  loops: () => import("./loops.mdx"),
  "counters-and-totals": () => import("./counters-and-totals.mdx"),
  arrays: () => import("./arrays.mdx"),
  "addressing-modes": () => import("./addressing-modes.mdx"),
  "stack-and-subroutines": () => import("./stack-and-subroutines.mdx"),
  "interrupts-and-devices": () => import("./interrupts-and-devices.mdx"),
  pipelining: () => import("./pipelining.mdx"),
  caches: () => import("./caches.mdx"),
  "races-and-locks": () => import("./races-and-locks.mdx"),
  "lmc-to-riscv": () => import("./lmc-to-riscv.mdx"),
  "riscv-memory-and-functions": () => import("./riscv-memory-and-functions.mdx"),
};
