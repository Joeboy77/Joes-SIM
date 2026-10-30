import { CHALLENGES } from "@joes-sim/content";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChallengeWorkbench } from "@/challenges/ChallengeWorkbench";

export function generateStaticParams() {
  return CHALLENGES.map((c) => ({ id: c.id }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const c = CHALLENGES.find((x) => x.id === id);
  return c ? { title: c.title, description: c.description } : {};
}

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const challenge = CHALLENGES.find((c) => c.id === id);
  if (!challenge) notFound();
  return <ChallengeWorkbench id={challenge.id} />;
}
