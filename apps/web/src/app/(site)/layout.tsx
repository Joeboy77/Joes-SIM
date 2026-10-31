import { SiteFooter, SkipLink } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <SiteHeader />
      <main id="main" className="mx-auto max-w-5xl px-4 py-8">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
