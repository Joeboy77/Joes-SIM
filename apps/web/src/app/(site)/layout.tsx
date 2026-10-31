import Link from "next/link";
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
      <footer className="mx-auto max-w-5xl space-y-2 border-t border-border px-4 py-8 text-sm text-muted">
        <nav aria-label="Site">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {(
              [
                ["/docs", "Docs"],
                ["/reference", "Instruction reference"],
                ["/about", "About"],
                ["/privacy", "Privacy"],
                ["/contribute", "Contribute"],
              ] as const
            ).map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="text-accent underline-offset-4 hover:underline">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p>Free and open source. No account, no tracking. Your work stays on your device.</p>
      </footer>
    </>
  );
}
