"use client";

import { CHALLENGES } from "@joes-sim/content";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LESSONS } from "@/lessons/catalogue";
import { downloadText, exportBackup, restoreBackup } from "@/storage/backup";
import { backupFileName, parseBackup } from "@/storage/files";
import {
  EMPTY_PROGRESS,
  accuracy,
  getProgress,
  type PredictionKind,
  type Progress,
} from "@/storage/progress";
import { listFiles } from "@/storage/workspace";

const KIND_NAMES: Record<PredictionKind, string> = {
  acc: "The accumulator",
  branch: "Branches taken or not",
  pc: "The next mailbox",
  output: "Outputs",
  memory: "Mailboxes written",
  halt: "When the machine stops",
};

const percent = (correct: number, total: number) =>
  total === 0
    ? "no answers yet"
    : `${Math.round((correct / total) * 100)}% (${correct} of ${total})`;

/** Everything learnt so far, from this device only, and backups to move it elsewhere. */
export function ProgressView() {
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [files, setFiles] = useState(0);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = async () => {
    setProgress(await getProgress());
    setFiles((await listFiles()).length);
  };
  useEffect(() => {
    void Promise.all([getProgress(), listFiles()])
      .then(([p, f]) => {
        setProgress(p);
        setFiles(f.length);
      })
      .catch(() => setMessage({ ok: false, text: "This browser does not allow saving." }));
  }, []);

  const solved = CHALLENGES.filter((c) => progress.challenges[c.id]?.solved);
  const all = accuracy(progress.predictions);
  const lessonsDone = LESSONS.filter((l) => progress.lessons[l.slug]);

  return (
    <div className="space-y-8">
      <section aria-labelledby="ch-h" className="space-y-2">
        <h2 id="ch-h" className="text-xl font-bold">
          Challenges
        </h2>
        <p>
          <span className="text-2xl font-bold">{solved.length}</span> of {CHALLENGES.length} solved.
        </p>
        {solved.length > 0 && (
          <table className="w-full max-w-2xl border-collapse text-sm">
            <caption className="sr-only">Best scores for solved challenges</caption>
            <thead>
              <tr className="text-start">
                <th scope="col" className="border-b border-border py-1">
                  Challenge
                </th>
                <th scope="col" className="border-b border-border py-1">
                  Instructions
                </th>
                <th scope="col" className="border-b border-border py-1">
                  Steps
                </th>
                <th scope="col" className="border-b border-border py-1">
                  Mailboxes
                </th>
              </tr>
            </thead>
            <tbody>
              {solved.map((c) => {
                const best = progress.challenges[c.id]?.best;
                const cell = (k: "instructions" | "cycles" | "mailboxes") =>
                  best ? (
                    <>
                      {best[k]} <span className="text-muted">/ {c.targets[k]}</span>
                      {best[k] <= c.targets[k] && <span className="text-success"> ✓</span>}
                    </>
                  ) : (
                    "–"
                  );
                return (
                  <tr key={c.id}>
                    <th scope="row" className="border-b border-border py-1 text-start font-normal">
                      <Link href={`/challenges/${c.id}`} className="text-accent underline">
                        {c.title}
                      </Link>
                    </th>
                    <td className="border-b border-border py-1">{cell("instructions")}</td>
                    <td className="border-b border-border py-1">{cell("cycles")}</td>
                    <td className="border-b border-border py-1">{cell("mailboxes")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="text-sm text-muted">
          Scores show your best against the target. Lower is better.
        </p>
      </section>

      <section aria-labelledby="pr-h" className="space-y-2">
        <h2 id="pr-h" className="text-xl font-bold">
          Predictions
        </h2>
        <p>
          Overall: <span className="font-bold">{percent(all.correct, all.total)}</span>
        </p>
        <ul className="space-y-1 text-sm">
          {(Object.keys(KIND_NAMES) as PredictionKind[]).map((k) => {
            const t = progress.predictions[k];
            return (
              <li key={k}>
                {KIND_NAMES[k]}: {percent(t.correct, t.total)}
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted">
          Turn on predict mode in the simulator&apos;s Explain panel to practise.
        </p>
      </section>

      <section aria-labelledby="le-h" className="space-y-2">
        <h2 id="le-h" className="text-xl font-bold">
          Lessons
        </h2>
        <p>
          <span className="text-2xl font-bold">{lessonsDone.length}</span> of {LESSONS.length}{" "}
          finished.
        </p>
      </section>

      <section aria-labelledby="bk-h" className="space-y-2">
        <h2 id="bk-h" className="text-xl font-bold">
          Back up and restore
        </h2>
        <p className="max-w-2xl">
          Your {files} file{files === 1 ? "" : "s"} and all your progress are kept in this browser
          only. Download a backup to keep them safe, or to move them to another device.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              const backup = await exportBackup();
              downloadText(backupFileName(), JSON.stringify(backup, null, 2), "application/json");
              setMessage({ ok: true, text: "Backup downloaded." });
            }}
            className="min-h-11 rounded-md bg-accent px-4 font-bold text-on-accent"
          >
            Download a backup
          </button>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="min-h-11 rounded-md border border-border-strong px-4"
          >
            Restore from a backup
          </button>
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose a backup file"
            onChange={async (e) => {
              const picked = e.target.files?.[0];
              e.target.value = "";
              if (!picked) return;
              const parsed = parseBackup(await picked.text());
              if (!parsed.ok) return setMessage({ ok: false, text: parsed.error });
              const n = parsed.backup.files.length;
              if (
                !window.confirm(
                  `Replace everything in this browser with the backup (${n} file${n === 1 ? "" : "s"} and its progress)?`,
                )
              )
                return;
              await restoreBackup(parsed.backup);
              await load();
              setMessage({
                ok: true,
                text: `Restored ${n} file${n === 1 ? "" : "s"} and your progress.`,
              });
            }}
          />
        </div>
        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={message.ok ? "text-success" : "text-danger"}
          >
            {message.text}
          </p>
        )}
      </section>
    </div>
  );
}
