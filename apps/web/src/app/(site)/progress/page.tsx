import type { Metadata } from "next";
import { ProgressView } from "@/progress/ProgressView";

export const metadata: Metadata = {
  title: "Your progress",
  description: "Challenges solved, best scores and prediction accuracy, kept on this device.",
};

export default function ProgressPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Your progress</h1>
      <p className="max-w-2xl text-muted">Kept on this device only. Nobody else can see it.</p>
      <ProgressView />
    </div>
  );
}
