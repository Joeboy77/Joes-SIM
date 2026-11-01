import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveLink } from "@/community/client";

export const metadata: Metadata = {
  title: "Short link",
  robots: { index: false },
};

// Each short link is looked up when it is opened.
export const dynamic = "force-dynamic";

/** Only links to the simulator or the machine designer are followed. */
const SAFE = /^\/(sim\?p=|machines\?m=)[A-Za-z0-9+$-]+$/;

export default async function ShortLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = await resolveLink(id);
  if (path && SAFE.test(path)) redirect(path);
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-bold">This link does not open anything</h1>
      <p className="max-w-2xl">
        The short link may be mistyped, or the service that keeps short links could not be reached
        just now. If someone sent it to you, ask them for the full link or the program file.
      </p>
      <p>
        <Link href="/sim" className="text-accent underline">
          Open the simulator
        </Link>
      </p>
    </div>
  );
}
