/** Workspace files: programs the learner writes, saved as they type. */
import type { DialectId } from "@joes-sim/engine";
import { FILES, RECORDS, get, getAll, put, remove } from "./db";

export interface WorkspaceFile {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly dialect: DialectId;
  /** The inputs typed in, as text. */
  readonly inputs: string;
  readonly created: number;
  readonly updated: number;
}

const CURRENT = "current-file";

export const newId = () => `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export async function listFiles(): Promise<WorkspaceFile[]> {
  return (await getAll<WorkspaceFile>(FILES)).sort((a, b) => b.updated - a.updated);
}

export const getFile = (id: string) => get<WorkspaceFile>(FILES, id);

export async function saveFile(file: WorkspaceFile): Promise<void> {
  await put(FILES, file);
}

export async function createFile(
  fields: Pick<WorkspaceFile, "name" | "source" | "dialect" | "inputs">,
): Promise<WorkspaceFile> {
  const now = Date.now();
  const file: WorkspaceFile = { ...fields, id: newId(), created: now, updated: now };
  await saveFile(file);
  return file;
}

/** A name not used by any file: "Untitled", then "Untitled 2", and so on. */
export function uniqueName(base: string, files: readonly WorkspaceFile[]): string {
  const names = new Set(files.map((f) => f.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
}

export async function renameFile(id: string, name: string): Promise<WorkspaceFile | null> {
  const file = await getFile(id);
  if (!file) return null;
  const renamed = { ...file, name: name.trim() || file.name, updated: Date.now() };
  await saveFile(renamed);
  return renamed;
}

export async function duplicateFile(id: string): Promise<WorkspaceFile | null> {
  const file = await getFile(id);
  if (!file) return null;
  const all = await listFiles();
  return createFile({ ...file, name: uniqueName(`${file.name} (copy)`, all) });
}

export async function deleteFile(id: string): Promise<void> {
  await remove(FILES, id);
  if ((await getCurrentFileId()) === id) await put(RECORDS, null, CURRENT);
}

export const getCurrentFileId = async () => (await get<string | null>(RECORDS, CURRENT)) ?? null;
export const setCurrentFileId = (id: string) => put(RECORDS, id, CURRENT);
