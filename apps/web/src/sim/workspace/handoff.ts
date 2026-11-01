/**
 * Opening a program in the simulator from elsewhere in the app, such as a failing challenge test.
 * The program travels in the URL fragment (#open=...), which browsers never send to a server.
 */
import { isDialectId, type DialectId, type MachineId } from "@joes-sim/engine";

export interface Handoff {
  readonly name: string;
  readonly source: string;
  readonly dialect: DialectId;
  /** Absent means the classic machine. */
  readonly machine?: MachineId;
  readonly inputs: string;
  /** Instructions to run before showing the machine. */
  readonly cycle: number;
}

const PREFIX = "#open=";

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (b64: string) => {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export function handoffHref(h: Handoff): string {
  return `/sim${PREFIX}${toBase64Url(JSON.stringify(h))}`;
}

export function readHandoff(hash: string): Handoff | null {
  if (!hash.startsWith(PREFIX)) return null;
  try {
    const d = JSON.parse(fromBase64Url(hash.slice(PREFIX.length))) as Partial<Handoff>;
    if (typeof d.source !== "string" || typeof d.dialect !== "string" || !isDialectId(d.dialect)) {
      return null;
    }
    return {
      name: typeof d.name === "string" ? d.name : "Opened program",
      source: d.source,
      dialect: d.dialect,
      ...(d.machine === "extended" ? { machine: "extended" as const } : {}),
      inputs: typeof d.inputs === "string" ? d.inputs : "",
      cycle: typeof d.cycle === "number" && d.cycle >= 0 ? Math.floor(d.cycle) : 0,
    };
  } catch {
    return null;
  }
}
