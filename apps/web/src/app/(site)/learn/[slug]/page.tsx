import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LESSONS, lessonBySlug } from "@/lessons/catalogue";
import { LESSON_CONTENT } from "@/lessons/content";
import { LessonDone } from "@/lessons/LessonDone";
import { LessonProvider } from "@/lessons/LessonContext";

export function generateStaticParams() {
  return LESSONS.map((l) => ({ slug: l.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const lesson = lessonBySlug((await params).slug);
  return lesson ? { title: lesson.title, description: lesson.summary } : {};
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = lessonBySlug(slug);
  const load = LESSON_CONTENT[slug];
  if (!lesson || !load) notFound();
  const { default: Content } = await load();
  const n = LESSONS.indexOf(lesson) + 1;
  return (
    <article>
      <p className="text-sm">
        <Link href="/learn" className="text-accent underline">
          Lessons
        </Link>{" "}
        <span className="text-muted">
          · Lesson {n} of {LESSONS.length} · about {lesson.minutes} minutes
        </span>
      </p>
      <h1 className="mt-2 mb-4 text-3xl font-bold">{lesson.title}</h1>
      <LessonProvider>
        <Content />
      </LessonProvider>
      <LessonDone slug={slug} />
    </article>
  );
}
