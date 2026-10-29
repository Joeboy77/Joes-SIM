import { SiteHeader } from "@/components/SiteHeader";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-sm focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-5xl px-4 py-8">
        {children}
      </main>
      <footer className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted">
        Free and open source. No account, no tracking. Your work stays on your device.
      </footer>
    </>
  );
}
