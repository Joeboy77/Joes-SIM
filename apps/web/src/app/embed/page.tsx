import type { Metadata } from "next";
import { EmbedSim } from "./EmbedSim";

export const metadata: Metadata = { title: "Embedded simulator", robots: { index: false } };

// The embeddable simulator (brief, 7.12). No site chrome: it lives inside iframes and
// <joes-sim> elements. Options come from the address; see /docs/embed.
export default function EmbedPage() {
  return (
    <main>
      <EmbedSim />
    </main>
  );
}
