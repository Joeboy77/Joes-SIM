/** Writing a whole backup out of IndexedDB, and restoring one into it. */
import { FILES, clear, put } from "./db";
import { makeBackup, type Backup } from "./files";
import { getProgress, setProgress } from "./progress";
import { getCurrentFileId, listFiles, setCurrentFileId } from "./workspace";

export async function exportBackup(): Promise<Backup> {
  return makeBackup(await listFiles(), await getProgress(), await getCurrentFileId());
}

/** Replaces everything on this device with the backup's contents. */
export async function restoreBackup(backup: Backup): Promise<void> {
  await clear(FILES);
  for (const f of backup.files) await put(FILES, f);
  await setProgress(backup.progress);
  const current = backup.currentFile ?? backup.files[0]?.id;
  if (current) await setCurrentFileId(current);
}

/** Starts a download of text as a file. */
export function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
