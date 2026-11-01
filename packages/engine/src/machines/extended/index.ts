import type { Machine } from "../../core/machine";
import { run } from "../../core/run";
import { createState, provideInput, type CreateStateOptions } from "../../core/state";
import { step } from "../../core/step";

export const extendedMachine: Machine = {
  id: "extended",
  name: "Extended Little Man Computer",
  createState: (options: CreateStateOptions = {}) =>
    createState({ ...options, machine: "extended" }),
  step,
  run,
  provideInput,
};

export * from "./types";
export * from "./semantics";
export * from "./devices";
export { pressKey, interruptPending } from "./micro";
