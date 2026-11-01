"use client";

import Link from "next/link";
import { LanguageSwitcher, useT } from "@/i18n/useLocale";
import { ThemeSwitcher } from "./ThemeSwitcher";

const LINKS = [
  ["/sim", "nav.simulator"],
  ["/learn", "nav.learn"],
  ["/challenges", "nav.challenges"],
  ["/compiler", "nav.compiler"],
  ["/riscv", "nav.riscv"],
  ["/machines", "nav.machines"],
  ["/packs", "nav.packs"],
  ["/progress", "nav.progress"],
] as const;

export function SiteHeader() {
  const t = useT();
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold">
          Joe&apos;s SIM
        </Link>
        <nav aria-label={t("nav.main")} className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {LINKS.map(([href, key]) => (
            <Link key={href} href={href} className="text-accent underline-offset-4 hover:underline">
              {t(key)}
            </Link>
          ))}
          <ThemeSwitcher />
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}
