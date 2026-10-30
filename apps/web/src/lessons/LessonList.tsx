"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EMPTY_PROGRESS, getProgress, type Progress } from "@/storage/progress";
import { LESSONS } from "./catalogue";

export function LessonList() {
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  useEffect(() => {
    void getProgress()
      .then(setProgress)
      .catch(() => undefined);
  }, []);
  return (
    <ol className="space-y-3">
      {LESSONS.map((l, i) => {
        const done = progress.lessons[l.slug];
        return (
          <li key={l.slug} className="flex gap-3 rounded-md border border-border bg-surface p-3">
            <span aria-hidden="true" className="w-8 shrink-0 text-2xl font-bold text-muted">
              {i + 1}
            </span>
            <div>
              <Link
                href={`/learn/${l.slug}`}
                className="font-bold text-accent underline-offset-4 hover:underline"
              >
                {l.title}
              </Link>
              {done && (
                <span className="ml-2 text-sm font-bold text-success">
                  <span aria-hidden="true">✓ </span>Finished
                </span>
              )}
              <p className="text-sm">{l.summary}</p>
              <p className="text-xs text-muted">About {l.minutes} minutes</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
