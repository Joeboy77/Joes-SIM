import type { Machine } from "../../core/machine";
import { run } from "../../core/run";
import { createState, provideInput } from "../../core/state";
import { step } from "../../core/step";

export const classicMachine: Machine = {
  id: "classic",
  name: "Little Man Computer",
  createState,
  step,
  run,
  provideInput,
};
