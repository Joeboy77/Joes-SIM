"use client";

import Link from "next/link";
import { useT } from "@/i18n/useLocale";

const LINKS = [
  ["/docs", "footer.docs"],
  ["/reference", "footer.reference"],
  ["/about", "footer.about"],
  ["/privacy", "footer.privacy"],
  ["/contribute", "footer.contribute"],
] as const;

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="mx-auto max-w-5xl space-y-2 border-t border-border px-4 py-8 text-sm text-muted">
      <nav aria-label={t("footer.site")}>
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {LINKS.map(([href, key]) => (
            <li key={href}>
              <Link href={href} className="text-accent underline-offset-4 hover:underline">
                {t(key)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p>{t("footer.tagline")}</p>
    </footer>
  );
}

export function SkipLink() {
  const t = useT();
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-10 focus:rounded-sm focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent"
    >
      {t("nav.skip")}
    </a>
  );
}
