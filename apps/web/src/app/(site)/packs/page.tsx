import type { Metadata } from "next";
import { PackHome } from "@/packs/PackHome";

export const metadata: Metadata = {
  title: "Teacher packs",
  description:
    "Lessons, challenges and programs in a chosen order, for a class. Share them as a file or a link.",
};

export default function PacksPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Teacher packs</h1>
      <p className="max-w-2xl">
        A pack puts lessons, challenges and starter programs in the order a course needs. Teachers
        make packs here and share them as a file or a link. Learners open them with no account, and
        their progress stays on their own device.
      </p>
      <PackHome />
    </div>
  );
}
