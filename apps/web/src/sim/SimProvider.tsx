"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createSimStore, type SimStore, type SimStoreApi } from "./store";

const SimContext = createContext<SimStoreApi | null>(null);

export function SimProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createSimStore());
  return <SimContext.Provider value={store}>{children}</SimContext.Provider>;
}

/** The store itself, for actions and subscriptions outside React rendering. */
export function useSim(): SimStoreApi {
  const store = useContext(SimContext);
  if (!store) throw new Error("useSim must be used inside <SimProvider>");
  return store;
}

/** A slice of simulator state; re-renders only when that slice changes. */
export function useSimState<T>(selector: (s: SimStore) => T): T {
  return useStore(useSim(), selector);
}
