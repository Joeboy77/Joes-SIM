/**
 * Share links (brief, 4.4 and Phase 5): the program, inputs, dialect and view, compressed into
 * the link's `p` parameter with lz-string. Nothing is stored on a server.
 */
import { isDialectId, type DialectId, type MachineId } from "@joes-sim/engine";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { VIEW_ORDER, type ViewMode } from "../store";

export interface Shared {
  readonly name: string;
  readonly source: string;
  readonly dialect: DialectId;
  /** Absent means the classic machine. */
  readonly machine?: MachineId;
  readonly inputs: string;
  readonly view: ViewMode;
}

/** Short keys keep links short. Version 1. */
interface Wire {
  v: 1;
  n?: string;
  s: string;
  d: DialectId;
  /** "e" for the extended machine, "m" for the multicore one. */
  m?: "e" | "m";
  i?: string;
  w?: ViewMode;
}

export function encodeShare(s: Shared): string {
  const wire: Wire = { v: 1, s: s.source, d: s.dialect };
  if (s.name) wire.n = s.name;
  if (s.machine === "extended") wire.m = "e";
  if (s.machine === "multicore") wire.m = "m";
  if (s.inputs) wire.i = s.inputs;
  if (s.view !== "datapath") wire.w = s.view;
  return compressToEncodedURIComponent(JSON.stringify(wire));
}

export function decodeShare(p: string | null | undefined): Shared | null {
  if (!p) return null;
  try {
    const json = decompressFromEncodedURIComponent(p);
    if (!json) return null;
    const w = JSON.parse(json) as Partial<Wire>;
    if (w.v !== 1 || typeof w.s !== "string" || typeof w.d !== "string" || !isDialectId(w.d)) {
      return null;
    }
    return {
      name: typeof w.n === "string" ? w.n.slice(0, 80) : "",
      source: w.s,
      dialect: w.d,
      machine: w.m === "e" ? "extended" : w.m === "m" ? "multicore" : "classic",
      inputs: typeof w.i === "string" ? w.i : "",
      view: w.w && VIEW_ORDER.includes(w.w) ? w.w : "datapath",
    };
  } catch {
    return null;
  }
}

/** The path of a share link, such as `/sim?p=...`. Add the site's origin to make a full link. */
export const sharePath = (s: Shared, route = "/sim") => `${route}?p=${encodeShare(s)}`;

/** Links much longer than this may be cut off by some apps. */
export const LONG_LINK = 2000;
