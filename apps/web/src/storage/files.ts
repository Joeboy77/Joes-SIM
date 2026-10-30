/**
 * Moving work in and out of the browser: single programs as .lmc files and everything as a
 * backup .json file. Pure functions, so they are easy to test; the page does the downloading.
 */
import { isDialectId, type DialectId } from "@joes-sim/engine";
import { normaliseProgress, type Progress } from "./progress";
import type { WorkspaceFile } from "./workspace";

const DIALECT_LINE = /^\/\/ dialect: ([a-z]+)\s*$/;

/** An .lmc file is the source, with its dialect on the first line as a comment. */
export function toLmc(file: Pick<WorkspaceFile, "source" | "dialect">): string {
  const source = file.source.endsWith("\n") ? file.source : `${file.source}\n`;
  return `// dialect: ${file.dialect}\n${source}`;
}

export function fromLmc(
  text: string,
  fallback: DialectId = "classic",
): { source: string; dialect: DialectId } {
  const normalised = text.replace(/\r\n?/g, "\n");
  const [first, ...rest] = normalised.split("\n");
  const m = first?.match(DIALECT_LINE);
  if (m?.[1] && isDialectId(m[1])) return { source: rest.join("\n"), dialect: m[1] };
  return { source: normalised, dialect: fallback };
}

/** A file name for a program: letters, digits and hyphens, ending in .lmc. */
export function lmcFileName(name: string): string {
  const base = name
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "program"}.lmc`;
}

export const BACKUP_FORMAT = "joes-sim-backup";
export const BACKUP_VERSION = 1;

export interface Backup {
  readonly format: typeof BACKUP_FORMAT;
  readonly version: number;
  readonly exported: string;
  readonly files: readonly WorkspaceFile[];
  readonly progress: Progress;
  readonly currentFile: string | null;
}

export function makeBackup(
  files: readonly WorkspaceFile[],
  progress: Progress,
  currentFile: string | null,
  now = new Date(),
): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported: now.toISOString(),
    files,
    progress,
    currentFile,
  };
}

export type BackupResult = { ok: true; backup: Backup } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Reads a backup file, checking every part, so a damaged or wrong file is refused whole. */
export function parseBackup(text: string): BackupResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "This is not a Joe's SIM backup: it is not valid JSON." };
  }
  if (!isObject(data) || data.format !== BACKUP_FORMAT) {
    return { ok: false, error: "This is not a Joe's SIM backup file." };
  }
  if (typeof data.version !== "number" || data.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: "This backup was made by a newer version of Joe's SIM. Update the app and try again.",
    };
  }
  if (!Array.isArray(data.files)) return { ok: false, error: "The backup has no list of files." };
  const files: WorkspaceFile[] = [];
  for (const f of data.files) {
    if (
      !isObject(f) ||
      typeof f.id !== "string" ||
      typeof f.name !== "string" ||
      typeof f.source !== "string" ||
      typeof f.dialect !== "string" ||
      !isDialectId(f.dialect)
    ) {
      return { ok: false, error: "A file in the backup is damaged." };
    }
    files.push({
      id: f.id,
      name: f.name,
      source: f.source,
      dialect: f.dialect,
      inputs: typeof f.inputs === "string" ? f.inputs : "",
      created: typeof f.created === "number" ? f.created : 0,
      updated: typeof f.updated === "number" ? f.updated : 0,
    });
  }
  if (data.progress !== undefined && !isObject(data.progress)) {
    return { ok: false, error: "The progress in the backup is damaged." };
  }
  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: data.version,
      exported: typeof data.exported === "string" ? data.exported : "",
      files,
      progress: normaliseProgress(data.progress as Partial<Progress> | undefined),
      currentFile: typeof data.currentFile === "string" ? data.currentFile : null,
    },
  };
}

export const backupFileName = (now = new Date()) =>
  `joes-sim-backup-${now.toISOString().slice(0, 10)}.json`;
