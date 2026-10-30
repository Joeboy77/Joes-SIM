import type { Metadata } from "next";
import { ChallengeList } from "@/challenges/ChallengeList";

export const metadata: Metadata = {
  title: "Challenges",
  description: "Short Little Man Computer puzzles with tests, hints and scores. For practice only.",
};

export default function ChallengesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Challenges</h1>
      <p className="max-w-2xl">
        Short programming puzzles. Each one has tests you can run as often as you like, hints when
        you are stuck, and a score to beat. They are for practice only: nothing is graded or sent
        anywhere.
      </p>
      <ChallengeList />
    </div>
  );
}
