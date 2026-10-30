"use client";

import type { Component } from "@joes-sim/engine";
import { createContext, useContext, useState, type ReactNode } from "react";

interface LessonApi {
  /** The machine part named by the Highlight the learner is pointing at. */
  readonly term: Component | null;
  setTerm(term: Component | null): void;
}

const Ctx = createContext<LessonApi>({ term: null, setTerm: () => undefined });

export const useLesson = () => useContext(Ctx);

export function LessonProvider({ children }: { children: ReactNode }) {
  const [term, setTerm] = useState<Component | null>(null);
  return <Ctx.Provider value={{ term, setTerm }}>{children}</Ctx.Provider>;
}
