/** Teacher packs the learner made or opened, kept on this device. */
import { parsePack, type Pack } from "@joes-sim/content";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { RECORDS, get, put } from "./db";

const KEY = "packs";

export async function listPacks(): Promise<Pack[]> {
  const all = (await get<Record<string, Pack>>(RECORDS, KEY)) ?? {};
  return Object.values(all).sort((a, b) => a.title.localeCompare(b.title));
}

export async function getPack(id: string): Promise<Pack | undefined> {
  return ((await get<Record<string, Pack>>(RECORDS, KEY)) ?? {})[id];
}

export async function savePack(pack: Pack): Promise<void> {
  const all = (await get<Record<string, Pack>>(RECORDS, KEY)) ?? {};
  await put(RECORDS, { ...all, [pack.id]: pack }, KEY);
}

export async function deletePack(id: string): Promise<void> {
  const all = (await get<Record<string, Pack>>(RECORDS, KEY)) ?? {};
  await put(RECORDS, Object.fromEntries(Object.entries(all).filter(([k]) => k !== id)), KEY);
}

export async function replacePacks(packs: readonly Pack[]): Promise<void> {
  await put(RECORDS, Object.fromEntries(packs.map((p) => [p.id, p])), KEY);
}

/** A pack in a link: /packs/view?pack=... Nothing is uploaded. */
export const packLink = (pack: Pack) =>
  `/packs/view?pack=${compressToEncodedURIComponent(JSON.stringify(pack))}`;

export function packFromLink(param: string | null): Pack | null {
  if (!param) return null;
  const json = decompressFromEncodedURIComponent(param);
  if (!json) return null;
  const r = parsePack(json);
  return r.ok ? r.pack : null;
}

export const packFileName = (pack: Pack) =>
  `${pack.title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "pack"}.joes-sim-pack.json`;
