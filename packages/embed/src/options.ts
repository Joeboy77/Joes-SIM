/**
 * Options for the embedded simulator (brief, 7.12): the same names work as <joes-sim>
 * attributes and as /embed query parameters, so the element just copies its attributes across.
 */
export const PANELS = ["editor", "machine", "memory", "explain", "io"] as const;
export type Panel = (typeof PANELS)[number];
export const DEFAULT_PANELS: readonly Panel[] = ["editor", "machine", "explain", "io"];

const DIALECTS = ["classic", "higginson", "ocr"] as const;
const MACHINES = ["classic", "extended"] as const;
const VIEWS = ["datapath", "story", "flow"] as const;

export interface EmbedSettings {
  /** Plain source text, from `program`. */
  readonly program: string | null;
  /** A compressed share-link payload, from `p`. Used when `program` is not given. */
  readonly p: string | null;
  readonly name: string;
  readonly dialect: (typeof DIALECTS)[number] | null;
  /** "extended" adds the stack, interrupts and devices. */
  readonly machine: (typeof MACHINES)[number] | null;
  readonly view: (typeof VIEWS)[number] | null;
  readonly inputs: string | null;
  /** The program can be read and run but not edited. */
  readonly readonly: boolean;
  readonly panels: readonly Panel[];
}

/** Option names accepted as attributes and query parameters. */
export const OPTION_NAMES = [
  "program",
  "p",
  "name",
  "dialect",
  "machine",
  "view",
  "inputs",
  "readonly",
  "panels",
] as const;

const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | null =>
  value !== null && (allowed as readonly string[]).includes(value.trim().toLowerCase())
    ? (value.trim().toLowerCase() as T)
    : null;

/** `readonly`, `readonly=""`, `readonly="true"` and `readonly="1"` all switch it on. */
const flag = (value: string | null) =>
  value !== null && !["false", "0", "no", "off"].includes(value.trim().toLowerCase());

export function parseEmbedOptions(params: URLSearchParams): EmbedSettings {
  const panelList = params.get("panels");
  const panels = panelList
    ? PANELS.filter((p) =>
        panelList
          .split(/[\s,]+/)
          .map((x) => x.toLowerCase())
          .includes(p),
      )
    : DEFAULT_PANELS;
  return {
    program: params.get("program"),
    p: params.get("p"),
    name: (params.get("name") ?? "").slice(0, 80),
    dialect: pick(params.get("dialect"), DIALECTS),
    machine: pick(params.get("machine"), MACHINES),
    view: pick(params.get("view"), VIEWS),
    inputs: params.get("inputs"),
    readonly: flag(params.get("readonly")),
    panels: panels.length ? panels : DEFAULT_PANELS,
  };
}
