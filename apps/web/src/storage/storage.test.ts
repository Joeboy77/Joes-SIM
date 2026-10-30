import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { exportBackup, restoreBackup } from "./backup";
import { closeDb } from "./db";
import {
  BACKUP_VERSION,
  backupFileName,
  fromLmc,
  lmcFileName,
  makeBackup,
  parseBackup,
  toLmc,
} from "./files";
import {
  EMPTY_PROGRESS,
  accuracy,
  bestOf,
  completeLesson,
  getProgress,
  normaliseProgress,
  recordPrediction,
  updateChallenge,
} from "./progress";
import {
  createFile,
  deleteFile,
  duplicateFile,
  getCurrentFileId,
  getFile,
  listFiles,
  renameFile,
  setCurrentFileId,
  uniqueName,
} from "./workspace";

beforeEach(() => {
  closeDb();
  globalThis.indexedDB = new IDBFactory();
});

const program = {
  name: "Add",
  source: "        INP\n        HLT\n",
  dialect: "classic" as const,
  inputs: "3",
};

describe("workspace files", () => {
  it("creates, lists newest first, renames, duplicates and deletes", async () => {
    const a = await createFile(program);
    await new Promise((r) => setTimeout(r, 2));
    const b = await createFile({ ...program, name: "Loop" });
    expect((await listFiles()).map((f) => f.name)).toEqual(["Loop", "Add"]);
    expect((await renameFile(a.id, "  Sum  "))?.name).toBe("Sum");
    expect((await renameFile(a.id, "   "))?.name).toBe("Sum");
    expect(await renameFile("missing", "x")).toBeNull();
    const copy = await duplicateFile(a.id);
    expect(copy?.name).toBe("Sum (copy)");
    expect(copy?.source).toBe(program.source);
    expect((await duplicateFile(a.id))?.name).toBe("Sum (copy) 2");
    expect(await duplicateFile("missing")).toBeNull();
    await setCurrentFileId(b.id);
    await deleteFile(b.id);
    expect(await getFile(b.id)).toBeUndefined();
    expect(await getCurrentFileId()).toBeNull();
    await setCurrentFileId(a.id);
    await deleteFile(copy?.id ?? "");
    expect(await getCurrentFileId()).toBe(a.id);
  });

  it("picks names nobody is using", () => {
    expect(uniqueName("Untitled", [])).toBe("Untitled");
    const files = [{ name: "Untitled" }, { name: "Untitled 2" }] as never[];
    expect(uniqueName("Untitled", files)).toBe("Untitled 3");
  });
});

describe("progress", () => {
  it("starts empty and keeps every quick update", async () => {
    expect(await getProgress()).toEqual(EMPTY_PROGRESS);
    await Promise.all([
      updateChallenge("echo", (c) => ({ ...c, attempts: c.attempts + 1 })),
      updateChallenge("echo", (c) => ({ ...c, attempts: c.attempts + 1 })),
      recordPrediction("acc", true),
      recordPrediction("acc", false),
      recordPrediction("branch", true),
      completeLesson("loops"),
    ]);
    const p = await getProgress();
    expect(p.challenges.echo?.attempts).toBe(2);
    expect(p.predictions.acc).toEqual({ total: 2, correct: 1 });
    expect(accuracy(p.predictions)).toEqual({ total: 3, correct: 2 });
    expect(p.lessons.loops?.completed).toBeGreaterThan(0);
  });

  it("keeps the best of each score separately", () => {
    const a = { instructions: 6, cycles: 9, mailboxes: 7 };
    expect(bestOf(null, a)).toEqual(a);
    expect(bestOf(a, { instructions: 7, cycles: 6, mailboxes: 7 })).toEqual({
      instructions: 6,
      cycles: 6,
      mailboxes: 7,
    });
  });

  it("fills in anything missing from older saves", () => {
    const p = normaliseProgress({ challenges: { echo: { solved: true } as never } });
    expect(p.challenges.echo?.attempts).toBe(0);
    expect(p.challenges.echo?.solved).toBe(true);
    expect(p.predictions.halt).toEqual({ total: 0, correct: 0 });
    expect(normaliseProgress(null)).toEqual(EMPTY_PROGRESS);
  });
});

describe(".lmc files", () => {
  it("round-trips the source and dialect", () => {
    const text = toLmc({ source: "        INP\n        OTC\n        HLT", dialect: "higginson" });
    expect(text).toBe("// dialect: higginson\n        INP\n        OTC\n        HLT\n");
    expect(fromLmc(text)).toEqual({
      source: "        INP\n        OTC\n        HLT\n",
      dialect: "higginson",
    });
  });

  it("reads files from other tools as they are, with Windows line endings fixed", () => {
    expect(fromLmc("INP\r\nOUT\r\nHLT", "ocr")).toEqual({
      source: "INP\nOUT\nHLT",
      dialect: "ocr",
    });
    expect(fromLmc("// dialect: nonsense\nHLT").dialect).toBe("classic");
  });

  it("makes safe file names", () => {
    expect(lmcFileName("Add two numbers!")).toBe("Add-two-numbers.lmc");
    expect(lmcFileName("  ")).toBe("program.lmc");
  });
});

describe("backups", () => {
  it("restores files and progress on another device", async () => {
    const f = await createFile(program);
    await setCurrentFileId(f.id);
    await updateChallenge("echo", (c) => ({ ...c, solved: true }));
    const text = JSON.stringify(await exportBackup());

    // A fresh browser on another device.
    closeDb();
    globalThis.indexedDB = new IDBFactory();
    await createFile({ ...program, name: "Something else" });
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await restoreBackup(parsed.backup);
    expect((await listFiles()).map((x) => x.name)).toEqual(["Add"]);
    expect(await getCurrentFileId()).toBe(f.id);
    expect((await getProgress()).challenges.echo?.solved).toBe(true);
  });

  it("refuses files that are not backups, damaged or from a newer version", () => {
    const good = makeBackup([], EMPTY_PROGRESS, null, new Date("2026-10-30T10:00:00Z"));
    expect(good.exported).toBe("2026-10-30T10:00:00.000Z");
    const bad = (v: unknown) => {
      const r = parseBackup(typeof v === "string" ? v : JSON.stringify(v));
      return r.ok ? "ok" : r.error;
    };
    expect(bad("{nope")).toMatch(/not valid JSON/);
    expect(bad({ format: "other" })).toMatch(/not a Joe's SIM backup file/);
    expect(bad({ ...good, version: BACKUP_VERSION + 1 })).toMatch(/newer version/);
    expect(bad({ ...good, files: "x" })).toMatch(/no list of files/);
    expect(bad({ ...good, files: [{ id: 1 }] })).toMatch(/damaged/);
    expect(bad({ ...good, files: [{ id: "a", name: "a", source: "", dialect: "x" }] })).toMatch(
      /damaged/,
    );
    expect(bad({ ...good, progress: 3 })).toMatch(/progress in the backup is damaged/);
    expect(bad(good)).toBe("ok");
  });

  it("fills in optional parts of older backups", () => {
    const r = parseBackup(
      JSON.stringify({
        format: "joes-sim-backup",
        version: 1,
        files: [{ id: "a", name: "A", source: "HLT", dialect: "ocr" }],
      }),
    );
    expect(r.ok && r.backup.files[0]).toEqual({
      id: "a",
      name: "A",
      source: "HLT",
      dialect: "ocr",
      inputs: "",
      created: 0,
      updated: 0,
    });
    expect(r.ok && r.backup.currentFile).toBeNull();
    expect(backupFileName(new Date("2026-10-30T10:00:00Z"))).toBe(
      "joes-sim-backup-2026-10-30.json",
    );
  });
});
