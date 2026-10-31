import type { Metadata } from "next";
import { PackView } from "@/packs/PackView";

export const metadata: Metadata = { title: "Teacher pack" };

export default function PackViewPage() {
  return <PackView />;
}
