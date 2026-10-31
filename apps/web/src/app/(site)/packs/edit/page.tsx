import type { Metadata } from "next";
import { PackEditor } from "@/packs/PackEditor";

export const metadata: Metadata = { title: "Edit a teacher pack", robots: { index: false } };

export default function PackEditPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Edit a teacher pack</h1>
      <PackEditor />
    </div>
  );
}
