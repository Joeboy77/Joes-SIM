import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "How to use Joe's SIM: getting started, embedding in a course page, teacher packs, sharing and offline use.",
};

const DOCS = [
  ["/docs/getting-started", "Getting started", "Write, run and step through your first program."],
  ["/reference", "Instruction reference", "Every instruction and how the dialects differ."],
  [
    "/docs/embed",
    "Embedding (for teachers)",
    "Put a live simulator in Moodle, Sakai, Canvas, slides or a blog.",
  ],
  ["/docs/packs", "Teacher packs", "Put lessons, challenges and programs in order for a class."],
  [
    "/docs/sharing",
    "Sharing and backups",
    "Share links, .lmc files, and moving your work to another device.",
  ],
  [
    "/docs/offline",
    "Offline and installing",
    "Use Joe's SIM with no connection, and install it as an app.",
  ],
] as const;

export default function DocsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Docs</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {DOCS.map(([href, title, text]) => (
          <li key={href} className="rounded-md border border-border bg-surface p-3">
            <Link href={href} className="font-bold text-accent underline-offset-4 hover:underline">
              {title}
            </Link>
            <p className="text-sm">{text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
