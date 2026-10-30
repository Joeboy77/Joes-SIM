"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { completeLesson, getProgress } from "@/storage/progress";
import { LESSONS } from "./catalogue";

/** Marks a lesson finished on this device, and points to the next one. */
export function LessonDone({ slug }: { slug: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    void getProgress()
      .then((p) => setDone(!!p.lessons[slug]))
      .catch(() => undefined);
  }, [slug]);
  const i = LESSONS.findIndex((l) => l.slug === slug);
  const next = LESSONS[i + 1];
  return (
    <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-border pt-6">
      {done ? (
        <p role="status" className="font-bold text-success">
          ✓ You have finished this lesson.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void completeLesson(slug).then(() => setDone(true))}
          className="min-h-11 rounded-md bg-accent px-4 font-bold text-on-accent"
        >
          I have finished this lesson
        </button>
      )}
      {next ? (
        <Link href={`/learn/${next.slug}`} className="font-bold text-accent underline">
          Next: {next.title} →
        </Link>
      ) : (
        <Link href="/challenges" className="font-bold text-accent underline">
          On to the challenges →
        </Link>
      )}
    </div>
  );
}
