import { isDialectId } from "@joes-sim/engine";
import { PACK_FORMAT, type Pack, type PackItem } from "./types";

export type PackResult = { ok: true; pack: Pack } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const text = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");
const note = (v: Record<string, unknown>) =>
  typeof v.note === "string" ? { note: v.note.slice(0, 2000) } : {};

/** Checks a pack completely; a damaged pack is refused whole, with a plain reason. */
export function parsePack(data: unknown): PackResult {
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return { ok: false, error: "This is not a teacher pack: it is not valid JSON." };
    }
  }
  if (!isObject(data) || data.format !== PACK_FORMAT) {
    return { ok: false, error: "This is not a Joe's SIM teacher pack." };
  }
  if (data.version !== 1) {
    return { ok: false, error: "This pack was made by a newer version of Joe's SIM." };
  }
  if (typeof data.title !== "string" || !data.title.trim()) {
    return { ok: false, error: "The pack has no title." };
  }
  if (typeof data.dialect !== "string" || !isDialectId(data.dialect)) {
    return { ok: false, error: "The pack's dialect is not one Joe's SIM knows." };
  }
  if (!Array.isArray(data.items)) return { ok: false, error: "The pack has no list of items." };
  const items: PackItem[] = [];
  for (const [i, raw] of data.items.entries()) {
    const bad = { ok: false as const, error: `Item ${i + 1} in the pack is damaged.` };
    if (!isObject(raw)) return bad;
    switch (raw.type) {
      case "heading":
        if (typeof raw.title !== "string") return bad;
        items.push({ type: "heading", title: text(raw.title, 200), ...note(raw) });
        break;
      case "lesson":
        if (typeof raw.slug !== "string") return bad;
        items.push({ type: "lesson", slug: raw.slug, ...note(raw) });
        break;
      case "challenge":
        if (typeof raw.id !== "string") return bad;
        items.push({ type: "challenge", id: raw.id, ...note(raw) });
        break;
      case "program":
        if (typeof raw.title !== "string" || typeof raw.source !== "string") return bad;
        items.push({
          type: "program",
          title: text(raw.title, 200),
          source: text(raw.source, 20000),
          ...(typeof raw.inputs === "string" ? { inputs: raw.inputs.slice(0, 2000) } : {}),
          ...note(raw),
        });
        break;
      default:
        return bad;
    }
  }
  return {
    ok: true,
    pack: {
      format: PACK_FORMAT,
      version: 1,
      id:
        typeof data.id === "string" && data.id
          ? data.id.slice(0, 80)
          : `pack-${Date.now().toString(36)}`,
      title: data.title.slice(0, 200),
      author: text(data.author, 200),
      description: text(data.description),
      dialect: data.dialect,
      items,
    },
  };
}
