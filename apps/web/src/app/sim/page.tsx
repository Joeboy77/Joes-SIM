import type { Metadata } from "next";
import { Simulator } from "@/sim/Simulator";
import { decodeShare } from "@/sim/workspace/share";

const DESCRIPTION =
  "Write, run and step through Little Man Computer programs, forwards and backwards.";

/** A share link gets its own title and a preview card drawn from the program (see /og). */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ p?: string | string[] }>;
}): Promise<Metadata> {
  const { p } = await searchParams;
  const shared = typeof p === "string" ? decodeShare(p) : null;
  if (!shared || typeof p !== "string") return { title: "Simulator", description: DESCRIPTION };
  const title = shared.name || "A shared Little Man Computer program";
  const first = shared.source
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(" · ");
  const image = { url: `/og?p=${p}`, width: 1200, height: 630, alt: `${title}: ${first}` };
  return {
    title,
    description: `${first}. Open it in Joe's SIM to run it step by step.`,
    openGraph: { title, description: DESCRIPTION, images: [image], type: "website" },
    twitter: { card: "summary_large_image", title, description: DESCRIPTION, images: [image] },
  };
}

export default function SimulatorPage() {
  return <Simulator />;
}
