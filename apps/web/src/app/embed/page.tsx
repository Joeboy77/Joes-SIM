import type { Metadata } from "next";

export const metadata: Metadata = { title: "Embedded simulator", robots: { index: false } };

// The embeddable simulator (brief, Section 7.12). No site chrome: it lives inside iframes.
export default function EmbedPage() {
  return (
    <main className="p-4">
      <h1 className="text-lg font-bold">Joe&apos;s SIM</h1>
      <p className="text-sm text-muted">The embeddable simulator arrives in Phase 5.</p>
    </main>
  );
}
