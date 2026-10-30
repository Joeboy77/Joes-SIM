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
};
