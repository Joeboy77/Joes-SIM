"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => undefined;

/**
 * The page's query string (such as "?id=dcit-207"), read in the browser. Pages that take options
 * from the address stay static (and work offline); on the server this returns null.
 */
export function useSearch(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => window.location.search,
    () => null,
  );
}
