import type { Metadata } from "next";
import { LessonList } from "@/lessons/LessonList";

export const metadata: Metadata = {
  title: "Learn",
  description:
    "A beginner path from 'What is a computer?' to loops and arrays, with live simulators.",
};

export default function LearnPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Learn</h1>
      <p className="max-w-2xl">
        Ten short lessons, from what a computer is to loops and arrays. Each one has live simulators
        to try things in, and questions to think about before you read on.
      </p>
      <LessonList />
    </div>
  );
}
